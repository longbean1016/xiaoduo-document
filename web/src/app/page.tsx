import type { Metadata } from 'next'
import { PublicPreview } from '@/components/public-preview'
import {
  getPublicSiteProfile,
  listPublicLibrary,
} from '@/lib/public-library'

export const metadata: Metadata = {
  title: '小多笔记',
  description: '按分类与章节组织的个人公开知识书',
}

export default async function HomePage() {
  const [profile, categories] = await Promise.all([
    getPublicSiteProfile(),
    listPublicLibrary(),
  ])
  return <PublicPreview profile={profile} categories={categories} />
}
