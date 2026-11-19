import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type mysql from 'mysql2/promise'
import { db, pool } from '@/db/client'
import {
  article,
  articleVersion,
  category,
  siteProfile,
  urlRedirect,
  user,
} from '@/db/schema'
import { getArticleViewCount } from '@/server/analytics'

export interface PublicChapter {
  id: string
  title: string
  categoryId: string
  categoryTitle: string
  categorySlug: string
  path: string
  markdown: string
  plainText: string
  publishedAt: string
  authorId: string
  authorName: string
  authorRole: 'owner' | 'collaborator'
  contributors: PublicContributor[]
  viewCount: number
}

export interface PublicContributor {
  id: string
  name: string
  avatarUrl: string | null
  role: 'collaborator'
}

export interface PublicChapterSummary {
  articleId: string
  title: string
  path: string
  plainText: string
  publishedAt: string
}

export interface PublicCategory {
  id: string
  title: string
  slug: string
  chapters: PublicChapterSummary[]
}

export interface PublicSiteProfile {
  authorName: string
  avatarUrl: string | null
  roleTitle: string
  intro: string
  location: string
}

export interface PublicSearchResult {
  articleId: string
  title: string
  path: string
  categoryTitle: string
  categorySlug: string
  plainText: string
}

async function latestPublishedVersion(articleId: string) {
  const [version] = await db
    .select({
      id: articleVersion.id,
      title: articleVersion.title,
      path: articleVersion.path,
      markdown: articleVersion.markdown,
      plainText: articleVersion.plainText,
      publishedAt: articleVersion.createdAt,
      categoryId: articleVersion.categoryId,
      authorId: articleVersion.authorId,
      authorName: articleVersion.authorName,
      authorRole: articleVersion.authorRole,
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
  return version ?? null
}

async function listPublicContributors(
  articleId: string,
): Promise<PublicContributor[]> {
  const versions = await db
    .select({
      authorId: articleVersion.authorId,
      authorName: articleVersion.authorName,
      avatarUrl: user.image,
    })
    .from(articleVersion)
    .leftJoin(user, eq(user.id, articleVersion.authorId))
    .where(
      and(
        eq(articleVersion.articleId, articleId),
        eq(articleVersion.authorRole, 'collaborator'),
      ),
    )
    .orderBy(desc(articleVersion.createdAt), desc(articleVersion.id))
  const contributors = new Map<string, PublicContributor>()
  for (const version of versions) {
    if (contributors.has(version.authorId)) continue
    contributors.set(version.authorId, {
      id: version.authorId,
      name: version.authorName,
      avatarUrl: version.avatarUrl ?? null,
      role: 'collaborator',
    })
  }
  return [...contributors.values()]
}

export async function listPublicLibrary({
  includeEmpty = false,
}: {
  includeEmpty?: boolean
} = {}): Promise<PublicCategory[]> {
  const categories = await db
    .select({
      id: category.id,
      title: category.title,
      slug: category.slug,
    })
    .from(category)
    .orderBy(asc(category.position), asc(category.id))

  const library: PublicCategory[] = []
  for (const item of categories) {
    const currentArticles = await db
      .select({ id: article.id })
      .from(article)
      .where(
        and(
          eq(article.categoryId, item.id),
          eq(article.publicationState, 'published'),
          isNull(article.trashedAt),
        ),
      )
      .orderBy(asc(article.position), asc(article.id))

    const chapters: PublicChapterSummary[] = []
    for (const current of currentArticles) {
      const version = await latestPublishedVersion(current.id)
      if (!version || version.categoryId !== item.id) continue
      chapters.push({
        articleId: current.id,
        title: version.title,
        path: version.path,
        plainText: version.plainText,
        publishedAt: version.publishedAt,
      })
    }
    if (chapters.length || includeEmpty) {
      library.push({ ...item, chapters })
    }
  }
  return library
}

export async function getPublicChapterNavigation(
  categorySlug: string,
  chapterPath: string,
) {
  const library = await listPublicLibrary()
  const currentCategory = library.find((item) => item.slug === categorySlug)
  if (!currentCategory) return null
  const index = currentCategory.chapters.findIndex(
    (item) => item.path === chapterPath,
  )
  if (index < 0) return null
  return {
    category: currentCategory,
    previous: index > 0 ? currentCategory.chapters[index - 1] : null,
    next:
      index < currentCategory.chapters.length - 1
        ? currentCategory.chapters[index + 1]
        : null,
  }
}

export async function getPublicSiteProfile(): Promise<PublicSiteProfile | null> {
  const [profile] = await db
    .select({
      authorName: siteProfile.authorName,
      avatarUrl: siteProfile.avatarUrl,
      roleTitle: siteProfile.roleTitle,
      intro: siteProfile.intro,
      location: siteProfile.location,
    })
    .from(siteProfile)
    .where(eq(siteProfile.id, 'primary'))
    .limit(1)
  return profile ?? null
}

export async function resolvePublicRedirect(
  fromPath: string,
): Promise<string | null> {
  let current = fromPath
  for (let hop = 0; hop < 5; hop += 1) {
    const [redirect] = await db
      .select({ toPath: urlRedirect.toPath })
      .from(urlRedirect)
      .where(eq(urlRedirect.fromPath, current))
      .limit(1)
    if (!redirect) return current === fromPath ? null : current
    current = redirect.toPath
  }
  return current === fromPath ? null : current
}

export async function searchPublicArticles(
  query: string,
): Promise<PublicSearchResult[]> {
  const normalized = query.trim()
  if (normalized.length < 2) return []
  const [candidateRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT
      av.id AS versionId,
      av.article_id AS articleId,
      c.title AS categoryTitle,
      c.slug AS categorySlug,
      MATCH(av.title, av.markdown, av.plain_text)
        AGAINST (? IN NATURAL LANGUAGE MODE) AS score
    FROM article_version av
    INNER JOIN article a ON a.id = av.article_id
    INNER JOIN category c ON c.id = a.category_id
    WHERE av.kind = 'published'
      AND a.publication_state = 'published'
      AND a.trashed_at IS NULL
      AND MATCH(av.title, av.markdown, av.plain_text)
        AGAINST (? IN NATURAL LANGUAGE MODE)
    ORDER BY score DESC
    LIMIT 30`,
    [normalized, normalized],
  )

  const results: PublicSearchResult[] = []
  for (const row of candidateRows) {
    const latest = await latestPublishedVersion(row.articleId)
    if (!latest || latest.id !== row.versionId) continue
    results.push({
      articleId: row.articleId,
      title: latest.title,
      path: latest.path,
      categoryTitle: row.categoryTitle,
      categorySlug: row.categorySlug,
      plainText: latest.plainText,
    })
  }
  return results
}

export async function getPublicChapterByPath(
  categorySlug: string,
  chapterPath: string,
): Promise<PublicChapter | null> {
  const publishedArticles = await db
    .select({
      id: article.id,
      categoryId: category.id,
      categoryTitle: category.title,
      categorySlug: category.slug,
    })
    .from(article)
    .innerJoin(category, eq(article.categoryId, category.id))
    .where(
      and(
        eq(category.slug, categorySlug),
        eq(article.publicationState, 'published'),
        isNull(article.trashedAt),
      ),
    )

  for (const current of publishedArticles) {
    const version = await latestPublishedVersion(current.id)
    if (version?.path !== chapterPath) continue
    return {
      ...current,
      ...version,
      id: current.id,
      categoryId: current.categoryId,
      contributors: await listPublicContributors(current.id),
      viewCount: await getArticleViewCount(current.id),
    }
  }

  return null
}
