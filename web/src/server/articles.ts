import { and, asc, desc, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm'
import type { JSONContent } from '@tiptap/core'
import { db } from '@/db/client'
import {
  article,
  articleGrant,
  articleVersion,
  category,
  urlRedirect,
} from '@/db/schema'
import { toDatabaseDateTime } from '@/lib/database-time'
import { createNotification } from '@/server/notifications'

export interface ArticleDraft {
  id: string
  title: string
  categoryId: string
  categoryTitle: string
  categorySlug: string
  path: string
  position: number
  contentJson: string | null
  sourceFileName: string | null
  markdown: string
  plainText: string
  revision: number
  publicationState: 'draft' | 'published' | 'unpublished'
  trashedAt: string | null
  trashedById: string | null
  trashedByName: string | null
  updatedAt: string
}

export interface SaveArticleDraftInput {
  title: string
  categoryId: string
  contentJson: JSONContent
  markdown: string
  plainText: string
  expectedRevision: number
}

export interface ArticleVersionRecord {
  id: string
  articleId: string
  kind: 'manual' | 'published'
  title: string
  categoryId: string | null
  categorySlug: string | null
  path: string
  label: string | null
  contentJson: string | null
  markdown: string
  plainText: string
  authorId: string
  authorName: string
  authorRole: 'owner' | 'collaborator'
  createdAt: string
}

export interface VersionActor {
  id: string
  name: string
  role: 'owner' | 'collaborator'
}

export interface PublishedLocation {
  categorySlug: string
  path: string
}

export function chapterPathFromTitle(title: string): string {
  return title
    .normalize('NFC')
    .trim()
    .replace(/[/\\?#%]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'
}

async function uniquePath(
  categoryId: string,
  title: string,
  excludeId?: string,
) {
  const base = chapterPathFromTitle(title)
  const rows = await db
    .select({ id: article.id, path: article.path })
    .from(article)
    .where(eq(article.categoryId, categoryId))
  const existing = new Set(
    rows
      .filter((row) => row.id !== excludeId)
      .map((row) => row.path),
  )
  if (!existing.has(base)) return base
  let suffix = 2
  while (existing.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

export async function listArticleDrafts(): Promise<ArticleDraft[]> {
  return db
    .select({
      id: article.id,
      title: article.title,
      categoryId: article.categoryId,
      categoryTitle: category.title,
      categorySlug: category.slug,
      path: article.path,
      position: article.position,
      contentJson: article.contentJson,
      sourceFileName: article.sourceFileName,
      markdown: article.markdown,
      plainText: article.plainText,
      revision: article.revision,
      publicationState: article.publicationState,
      trashedAt: article.trashedAt,
      trashedById: article.trashedById,
      trashedByName: article.trashedByName,
      updatedAt: article.updatedAt,
    })
    .from(article)
    .innerJoin(category, eq(article.categoryId, category.id))
    .orderBy(asc(category.position), asc(article.position), asc(article.id))
}

export async function getArticleDraft(id: string): Promise<ArticleDraft | null> {
  const rows = await db
    .select({
      id: article.id,
      title: article.title,
      categoryId: article.categoryId,
      categoryTitle: category.title,
      categorySlug: category.slug,
      path: article.path,
      position: article.position,
      contentJson: article.contentJson,
      sourceFileName: article.sourceFileName,
      markdown: article.markdown,
      plainText: article.plainText,
      revision: article.revision,
      publicationState: article.publicationState,
      trashedAt: article.trashedAt,
      trashedById: article.trashedById,
      trashedByName: article.trashedByName,
      updatedAt: article.updatedAt,
    })
    .from(article)
    .innerJoin(category, eq(article.categoryId, category.id))
    .where(eq(article.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function createArticleDraft(input: {
  categoryId: string
  title: string
}): Promise<ArticleDraft> {
  const [targetCategory] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, input.categoryId))
    .limit(1)
  if (!targetCategory) throw new Error('CATEGORY_NOT_FOUND')

  const existing = await listArticleDrafts()
  const categoryArticles = existing.filter(
    (item) => item.categoryId === input.categoryId,
  )
  const title = input.title.trim() || '无标题章节'
  const created = {
    id: crypto.randomUUID(),
    categoryId: input.categoryId,
    title,
    path: await uniquePath(input.categoryId, title),
    position: (categoryArticles.at(-1)?.position ?? 0) + 1,
    markdown: '',
    plainText: '',
    contentJson: JSON.stringify({ type: 'doc', content: [] }),
    revision: 1,
  }
  await db.insert(article).values(created)
  const result = await getArticleDraft(created.id)
  if (!result) throw new Error('CREATE_FAILED')
  return result
}

export async function saveArticleDraft(
  id: string,
  input: SaveArticleDraftInput,
): Promise<'saved' | 'conflict' | 'missing'> {
  const current = await getArticleDraft(id)
  if (!current) return 'missing'
  if (current.revision !== input.expectedRevision) return 'conflict'

  const [destination] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, input.categoryId))
    .limit(1)
  if (!destination) return 'missing'

  const title = input.title.trim() || '无标题章节'
  let position = current.position
  if (current.categoryId !== input.categoryId) {
    const destinationArticles = (await listArticleDrafts()).filter(
      (item) => item.categoryId === input.categoryId,
    )
    position = (destinationArticles.at(-1)?.position ?? 0) + 1
  }

  const result = await db
    .update(article)
    .set({
      title,
      categoryId: input.categoryId,
      path: await uniquePath(input.categoryId, title, id),
      position,
      contentJson: JSON.stringify(input.contentJson),
      markdown: input.markdown,
      plainText: input.plainText,
      revision: current.revision + 1,
      updatedAt: toDatabaseDateTime(),
    })
    .where(and(eq(article.id, id), eq(article.revision, input.expectedRevision)))

  return result[0].affectedRows === 1 ? 'saved' : 'conflict'
}

export async function moveArticleDraft(
  id: string,
  direction: -1 | 1,
): Promise<boolean> {
  const current = await getArticleDraft(id)
  if (!current) return false
  const siblings = (await listArticleDrafts()).filter(
    (item) => item.categoryId === current.categoryId,
  )
  const index = siblings.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= siblings.length) return false

  const reordered = [...siblings]
  ;[reordered[index], reordered[target]] = [
    reordered[target],
    reordered[index],
  ]
  await db.transaction(async (transaction) => {
    for (const [position, item] of reordered.entries()) {
      await transaction
        .update(article)
        .set({ position: position + 1 })
        .where(eq(article.id, item.id))
    }
  })
  return true
}

export async function listArticleVersions(
  articleId: string,
): Promise<ArticleVersionRecord[]> {
  return db
    .select({
      id: articleVersion.id,
      articleId: articleVersion.articleId,
      kind: articleVersion.kind,
      title: articleVersion.title,
      categoryId: articleVersion.categoryId,
      categorySlug: articleVersion.categorySlug,
      path: articleVersion.path,
      label: articleVersion.label,
      contentJson: articleVersion.contentJson,
      markdown: articleVersion.markdown,
      plainText: articleVersion.plainText,
      authorId: articleVersion.authorId,
      authorName: articleVersion.authorName,
      authorRole: articleVersion.authorRole,
      createdAt: articleVersion.createdAt,
    })
    .from(articleVersion)
    .where(eq(articleVersion.articleId, articleId))
    .orderBy(desc(articleVersion.createdAt), desc(articleVersion.id))
}

export async function saveManualVersion(
  articleId: string,
  input: { label?: string; actor: VersionActor },
): Promise<ArticleVersionRecord> {
  const current = await getArticleDraft(articleId)
  if (!current) throw new Error('ARTICLE_NOT_FOUND')
  const id = crypto.randomUUID()
  await db.insert(articleVersion).values({
    id,
    articleId,
    kind: 'manual',
    title: current.title,
    categoryId: current.categoryId,
    categorySlug: current.categorySlug,
    path: current.path,
    label: input.label?.trim() || null,
    contentJson: current.contentJson,
    markdown: current.markdown,
    plainText: current.plainText,
    authorId: input.actor.id,
    authorName: input.actor.name,
    authorRole: input.actor.role,
  })
  const version = (await listArticleVersions(articleId)).find(
    (item) => item.id === id,
  )
  if (!version) throw new Error('VERSION_CREATE_FAILED')
  return version
}

export async function restoreArticleVersion(
  articleId: string,
  versionId: string,
): Promise<'saved' | 'conflict' | 'missing'> {
  const current = await getArticleDraft(articleId)
  if (!current) return 'missing'
  const [version] = await db
    .select()
    .from(articleVersion)
    .where(
      and(
        eq(articleVersion.id, versionId),
        eq(articleVersion.articleId, articleId),
      ),
    )
    .limit(1)
  if (!version) return 'missing'

  const categoryId = version.categoryId ?? current.categoryId
  const result = await db
    .update(article)
    .set({
      title: version.title,
      categoryId,
      path: await uniquePath(categoryId, version.title, articleId),
      contentJson: version.contentJson,
      markdown: version.markdown,
      plainText: version.plainText,
      revision: current.revision + 1,
      updatedAt: toDatabaseDateTime(),
    })
    .where(
      and(
        eq(article.id, articleId),
        eq(article.revision, current.revision),
      ),
    )
  return result[0].affectedRows === 1 ? 'saved' : 'conflict'
}

export async function deleteArticleVersion(
  articleId: string,
  versionId: string,
  actor: Pick<VersionActor, 'id' | 'role'>,
): Promise<'deleted' | 'missing' | 'forbidden' | 'published'> {
  const [version] = await db
    .select({
      id: articleVersion.id,
      kind: articleVersion.kind,
      authorId: articleVersion.authorId,
    })
    .from(articleVersion)
    .where(
      and(
        eq(articleVersion.id, versionId),
        eq(articleVersion.articleId, articleId),
      ),
    )
    .limit(1)
  if (!version) return 'missing'
  if (version.kind !== 'manual') return 'published'
  if (actor.role !== 'owner' && version.authorId !== actor.id) {
    return 'forbidden'
  }

  const result = await db
    .delete(articleVersion)
    .where(
      and(
        eq(articleVersion.id, versionId),
        eq(articleVersion.articleId, articleId),
        eq(articleVersion.kind, 'manual'),
      ),
    )
  return result[0].affectedRows === 1 ? 'deleted' : 'missing'
}

export async function publishArticle(
  articleId: string,
  actor: VersionActor,
): Promise<'published' | 'missing'> {
  const current = await getArticleDraft(articleId)
  if (!current || current.trashedAt) return 'missing'

  const [previous] = await db
    .select({
      path: articleVersion.path,
      categoryId: articleVersion.categoryId,
      categorySlug: articleVersion.categorySlug,
    })
    .from(articleVersion)
    .where(
      and(
        eq(articleVersion.articleId, articleId),
        eq(articleVersion.kind, 'published'),
      ),
    )
    .orderBy(desc(articleVersion.createdAt), desc(articleVersion.id))
    .limit(1)

  const previousCategorySlug = await resolveVersionCategorySlug(previous)
  const oldPath =
    previous && previousCategorySlug
      ? `/library/${previousCategorySlug}/${previous.path}`
      : null
  const newPath = `/library/${current.categorySlug}/${current.path}`

  const versionId = crypto.randomUUID()
  await db.transaction(async (transaction) => {
    await transaction.insert(articleVersion).values({
      id: versionId,
      articleId,
      kind: 'published',
      title: current.title,
      categoryId: current.categoryId,
      categorySlug: current.categorySlug,
      path: current.path,
      label: '更新线上版本',
      contentJson: current.contentJson,
      markdown: current.markdown,
      plainText: current.plainText,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
    })
    await transaction
      .update(article)
      .set({
        publicationState: 'published',
        updatedAt: toDatabaseDateTime(),
      })
      .where(eq(article.id, articleId))
    if (oldPath && oldPath !== newPath) {
      await transaction
        .insert(urlRedirect)
        .values({
          id: crypto.randomUUID(),
          fromPath: oldPath,
          toPath: newPath,
        })
        .onDuplicateKeyUpdate({ set: { toPath: newPath } })
    }
  })
  if (actor.role === 'collaborator') {
    await createNotification({
      eventKey: `publish:collaborator:${versionId}`,
      kind: 'publish',
      title: '协作者发布了章节',
      body: `${actor.name} 发布或更新了《${current.title}》`,
      href: `/studio/notes/${articleId}`,
    })
  }
  return 'published'
}

async function resolveVersionCategorySlug(version?: {
  categoryId: string | null
  categorySlug: string | null
}) {
  if (!version) return null
  if (version.categorySlug) return version.categorySlug
  if (!version.categoryId) return null
  const [record] = await db
    .select({ slug: category.slug })
    .from(category)
    .where(eq(category.id, version.categoryId))
    .limit(1)
  return record?.slug ?? null
}

export async function getLatestPublishedLocation(
  articleId: string,
): Promise<PublishedLocation | null> {
  const [previous] = await db
    .select({
      path: articleVersion.path,
      categoryId: articleVersion.categoryId,
      categorySlug: articleVersion.categorySlug,
    })
    .from(articleVersion)
    .where(
      and(
        eq(articleVersion.articleId, articleId),
        eq(articleVersion.kind, 'published'),
      ),
    )
    .orderBy(desc(articleVersion.createdAt), desc(articleVersion.id))
    .limit(1)
  const categorySlug = await resolveVersionCategorySlug(previous)
  return previous && categorySlug
    ? { categorySlug, path: previous.path }
    : null
}

export async function withdrawArticle(articleId: string): Promise<boolean> {
  const result = await db
    .update(article)
    .set({
      publicationState: 'unpublished',
      updatedAt: toDatabaseDateTime(),
    })
    .where(eq(article.id, articleId))
  return result[0].affectedRows > 0
}

export async function trashArticles(
  articleIds: string[],
  actor: VersionActor,
): Promise<number> {
  const ids = [...new Set(articleIds)]
  if (!ids.length) return 0
  const timestamp = toDatabaseDateTime()
  const result = await db
    .update(article)
    .set({
      trashedAt: timestamp,
      trashedById: actor.id,
      trashedByName: actor.name,
      publicationState: 'unpublished',
      updatedAt: timestamp,
    })
    .where(and(inArray(article.id, ids), isNull(article.trashedAt)))
  return result[0].affectedRows
}

export async function trashArticle(
  articleId: string,
  actor: VersionActor,
): Promise<boolean> {
  return (await trashArticles([articleId], actor)) > 0
}

export async function listTrash(): Promise<ArticleDraft[]> {
  return db
    .select({
      id: article.id,
      title: article.title,
      categoryId: article.categoryId,
      categoryTitle: category.title,
      categorySlug: category.slug,
      path: article.path,
      position: article.position,
      contentJson: article.contentJson,
      sourceFileName: article.sourceFileName,
      markdown: article.markdown,
      plainText: article.plainText,
      revision: article.revision,
      publicationState: article.publicationState,
      trashedAt: article.trashedAt,
      trashedById: article.trashedById,
      trashedByName: article.trashedByName,
      updatedAt: article.updatedAt,
    })
    .from(article)
    .innerJoin(category, eq(article.categoryId, category.id))
    .where(isNotNull(article.trashedAt))
    .orderBy(desc(article.trashedAt))
}

export async function listTrashForActor(
  actor: VersionActor,
): Promise<ArticleDraft[]> {
  if (actor.role === 'owner') return listTrash()
  return db
    .select({
      id: article.id,
      title: article.title,
      categoryId: article.categoryId,
      categoryTitle: category.title,
      categorySlug: category.slug,
      path: article.path,
      position: article.position,
      contentJson: article.contentJson,
      sourceFileName: article.sourceFileName,
      markdown: article.markdown,
      plainText: article.plainText,
      revision: article.revision,
      publicationState: article.publicationState,
      trashedAt: article.trashedAt,
      trashedById: article.trashedById,
      trashedByName: article.trashedByName,
      updatedAt: article.updatedAt,
    })
    .from(article)
    .innerJoin(category, eq(article.categoryId, category.id))
    .innerJoin(
      articleGrant,
      and(
        eq(articleGrant.articleId, article.id),
        eq(articleGrant.userId, actor.id),
      ),
    )
    .where(
      and(
        isNotNull(article.trashedAt),
        eq(article.trashedById, actor.id),
      ),
    )
    .orderBy(desc(article.trashedAt))
}

export async function restoreTrashArticlesForActor(
  articleIds: string[],
  actor: VersionActor,
): Promise<number> {
  const ids = [...new Set(articleIds)]
  if (!ids.length) return 0

  let allowedIds = ids
  if (actor.role !== 'owner') {
    const allowed = await db
      .select({ id: article.id })
      .from(article)
      .innerJoin(
        articleGrant,
        and(
          eq(articleGrant.articleId, article.id),
          eq(articleGrant.userId, actor.id),
        ),
      )
      .where(
        and(
          inArray(article.id, ids),
          isNotNull(article.trashedAt),
          eq(article.trashedById, actor.id),
        ),
      )
    allowedIds = allowed.map((item) => item.id)
  }
  if (!allowedIds.length) return 0

  const result = await db
    .update(article)
    .set({
      trashedAt: null,
      trashedById: null,
      trashedByName: null,
      publicationState: 'unpublished',
      updatedAt: toDatabaseDateTime(),
    })
    .where(
      and(
        inArray(article.id, allowedIds),
        isNotNull(article.trashedAt),
      ),
    )
  return result[0].affectedRows
}

export async function permanentlyDeleteArticles(
  articleIds: string[],
): Promise<number> {
  const ids = [...new Set(articleIds)]
  if (!ids.length) return 0

  return db.transaction(async (transaction) => {
    const records = await transaction
      .select({
        id: article.id,
        categorySlug: category.slug,
        path: article.path,
      })
      .from(article)
      .innerJoin(category, eq(article.categoryId, category.id))
      .where(
        and(inArray(article.id, ids), isNotNull(article.trashedAt)),
      )
    if (!records.length) return 0

    for (const record of records) {
      const path = `/library/${record.categorySlug}/${record.path}`
      await transaction
        .delete(urlRedirect)
        .where(eq(urlRedirect.fromPath, path))
      await transaction
        .delete(urlRedirect)
        .where(eq(urlRedirect.toPath, path))
    }
    await transaction
      .delete(article)
      .where(inArray(article.id, records.map((record) => record.id)))
    return records.length
  })
}
export async function restoreTrashArticle(articleId: string): Promise<boolean> {
  const result = await db
    .update(article)
    .set({
      trashedAt: null,
      trashedById: null,
      trashedByName: null,
      publicationState: 'unpublished',
      updatedAt: toDatabaseDateTime(),
    })
    .where(eq(article.id, articleId))
  return result[0].affectedRows > 0
}

export async function restoreTrashArticleForActor(
  articleId: string,
  actor: VersionActor,
): Promise<boolean> {
  if (actor.role === 'owner') return restoreTrashArticle(articleId)
  const [owned] = await db
    .select({ id: article.id })
    .from(article)
    .innerJoin(
      articleGrant,
      and(
        eq(articleGrant.articleId, article.id),
        eq(articleGrant.userId, actor.id),
      ),
    )
    .where(
      and(
        eq(article.id, articleId),
        isNotNull(article.trashedAt),
        eq(article.trashedById, actor.id),
      ),
    )
    .limit(1)
  return owned ? restoreTrashArticle(articleId) : false
}

export async function permanentlyDeleteArticle(
  articleId: string,
): Promise<boolean> {
  const current = await getArticleDraft(articleId)
  if (!current) return false
  const path = `/library/${current.categorySlug}/${current.path}`
  await db.transaction(async (transaction) => {
    await transaction
      .delete(urlRedirect)
      .where(eq(urlRedirect.fromPath, path))
    await transaction
      .delete(urlRedirect)
      .where(eq(urlRedirect.toPath, path))
    await transaction.delete(article).where(eq(article.id, articleId))
  })
  return true
}

export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = toDatabaseDateTime(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  )
  const expired = await db
    .select({ id: article.id })
    .from(article)
    .where(and(isNotNull(article.trashedAt), lt(article.trashedAt, cutoff)))
  for (const item of expired) {
    await permanentlyDeleteArticle(item.id)
  }
  return expired.length
}
