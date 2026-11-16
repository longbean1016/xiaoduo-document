import { redirect } from 'next/navigation'
import { CategoryManager } from '@/components/studio/category-manager'
import { requireOwner } from '@/lib/server-session'
import {
  listAccessibleArticles,
  studioActorFromUser,
} from '@/server/article-access'
import { listCategories } from '@/server/categories'

export default async function CategoriesPage() {
  const session = await requireOwner()
  if (!session) redirect('/studio')
  const categories = await listCategories()
  const articles = await listAccessibleArticles(
    studioActorFromUser(session.user),
  )
  const chapterCounts = Object.fromEntries(
    categories.map((category) => [
      category.id,
      articles.filter((article) => article.categoryId === category.id).length,
    ]),
  )

  const categorySnapshot = categories
    .map(
      (category) =>
        `${category.id}:${category.title}:${category.slug}`,
    )
    .join('|')

  return (
    <CategoryManager
      key={categorySnapshot}
      initialCategories={categories}
      chapterCounts={chapterCounts}
    />
  )
}
