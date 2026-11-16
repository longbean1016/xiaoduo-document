import { asc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { article, category } from '@/db/schema'

export interface CategoryRecord {
  id: string
  title: string
  slug: string
  position: number
}

export async function listCategories(): Promise<CategoryRecord[]> {
  return db
    .select({
      id: category.id,
      title: category.title,
      slug: category.slug,
      position: category.position,
    })
    .from(category)
    .orderBy(asc(category.position), asc(category.id))
}

export async function createCategory(input: {
  title: string
  slug: string
}): Promise<CategoryRecord> {
  const title = input.title.trim()
  const slug = input.slug.trim().toLowerCase()
  if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('INVALID_CATEGORY')
  }

  const existing = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.slug, slug))
    .limit(1)
  if (existing.length) throw new Error('SLUG_TAKEN')

  const categories = await listCategories()
  const created = {
    id: crypto.randomUUID(),
    title,
    slug,
    position: (categories.at(-1)?.position ?? 0) + 1,
  }
  await db.insert(category).values(created)
  return created
}

export async function updateCategory(
  id: string,
  input: { title: string; slug: string },
): Promise<CategoryRecord | null> {
  const title = input.title.trim()
  const slug = input.slug.trim().toLowerCase()
  if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('INVALID_CATEGORY')
  }

  const duplicate = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.slug, slug))
    .limit(1)
  if (duplicate[0] && duplicate[0].id !== id) throw new Error('SLUG_TAKEN')

  const result = await db
    .update(category)
    .set({ title, slug })
    .where(eq(category.id, id))
  if (result[0].affectedRows === 0) return null

  const [updated] = await db
    .select({
      id: category.id,
      title: category.title,
      slug: category.slug,
      position: category.position,
    })
    .from(category)
    .where(eq(category.id, id))
    .limit(1)
  return updated ?? null
}

export async function deleteCategory(id: string): Promise<boolean> {
  const [chapter] = await db
    .select({ id: article.id })
    .from(article)
    .where(eq(article.categoryId, id))
    .limit(1)
  if (chapter) return false

  const [existing] = await db
    .select({ id: category.id })
    .from(category)
    .where(eq(category.id, id))
    .limit(1)
  if (!existing) return false

  await db
    .delete(category)
    .where(eq(category.id, id))

  const remaining = await listCategories()
  await db.transaction(async (transaction) => {
    for (const [index, item] of remaining.entries()) {
      await transaction
        .update(category)
        .set({ position: index + 1 })
        .where(eq(category.id, item.id))
    }
  })
  return true
}

export async function reorderCategories(ids: string[]): Promise<boolean> {
  const categories = await listCategories()
  const existingIds = new Set(categories.map((item) => item.id))
  const requestedIds = new Set(ids)
  if (
    ids.length !== categories.length ||
    requestedIds.size !== ids.length ||
    ids.some((id) => !existingIds.has(id))
  ) {
    return false
  }

  await db.transaction(async (transaction) => {
    for (const [position, id] of ids.entries()) {
      await transaction
        .update(category)
        .set({ position: position + 1 })
        .where(eq(category.id, id))
    }
  })
  return true
}

export async function moveCategory(
  id: string,
  direction: -1 | 1,
): Promise<boolean> {
  const categories = await listCategories()
  const index = categories.findIndex((item) => item.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= categories.length) return false

  const reordered = [...categories]
  ;[reordered[index], reordered[target]] = [
    reordered[target],
    reordered[index],
  ]
  await db.transaction(async (transaction) => {
    for (const [position, item] of reordered.entries()) {
      await transaction
        .update(category)
        .set({ position: position + 1 })
        .where(eq(category.id, item.id))
    }
  })
  return true
}
