import type { Metadata } from 'next'
import { PublicSearchResults } from '@/components/public-search-results'
import {
  listPublicLibrary,
  searchPublicArticles,
} from '@/lib/public-library'

export const metadata: Metadata = {
  title: '搜索 · 小多笔记',
  description: '搜索小多笔记已发布分类和章节。',
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const query = (await searchParams).q?.trim() ?? ''
  const [results, categories] = await Promise.all([
    searchPublicArticles(query),
    listPublicLibrary(),
  ])
  return (
    <PublicSearchResults
      query={query}
      results={results}
      categories={categories}
    />
  )
}
