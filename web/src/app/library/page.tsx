import type { Metadata } from 'next'
import { PublicLibraryIndex } from '@/components/public-library-index'
import { listPublicLibrary } from '@/lib/public-library'

export const metadata: Metadata = {
  title: '小多笔记',
  description: '按固定分类和章节顺序阅读公开知识书。',
}

export default async function LibraryIndexPage() {
  return <PublicLibraryIndex categories={await listPublicLibrary()} />
}
