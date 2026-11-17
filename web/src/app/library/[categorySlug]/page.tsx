import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { RelativeTime } from '@/components/relative-time'
import { listPublicLibrary } from '@/lib/public-library'

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params
  const library = await listPublicLibrary({ includeEmpty: true })
  const category = library.find(
    (item) => item.slug === decodeURIComponent(categorySlug),
  )
  return category
    ? {
        title: `${category.title} · 小多笔记`,
        description: `阅读${category.title}分类下的公开章节。`,
      }
    : {}
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params
  const library = await listPublicLibrary({ includeEmpty: true })
  const category = library.find(
    (item) => item.slug === decodeURIComponent(categorySlug),
  )
  if (!category) notFound()

  const categoryIndex = library.findIndex(
    (item) => item.id === category.id,
  )

  return (
    <div className="chapter-index-page">
      <header className="chapter-index-header">
        <p className="section-kicker">
          Category {String(categoryIndex + 1).padStart(2, '0')}
        </p>
        <h1>{category.title}</h1>
      </header>

      <div className="chapter-list">
        <div className="chapter-list-heading">
          <span>章节目录</span>
          <span>{category.chapters.length} 篇</span>
        </div>
        {category.chapters.map((chapter, index) => (
          <Link
            key={chapter.articleId}
            href={`/library/${category.slug}/${chapter.path}`}
            className="chapter-list-row group"
          >
            <span className="chapter-number">
              {categoryIndex + 1}.{index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-3">
                <span className="text-[24px] font-semibold text-[var(--ink)] group-hover:text-[var(--accent)]">
                  {chapter.title}
                </span>
              </span>
            </span>
            <span className="chapter-list-meta" data-visual-dynamic>
              <RelativeTime iso={chapter.publishedAt} />
              <ArrowRight size={18} />
            </span>
          </Link>
        ))}
        {!category.chapters.length ? (
          <p className="py-16 text-center text-sm text-[var(--muted)]">
            这个分类暂时没有公开章节。
          </p>
        ) : null}
      </div>
    </div>
  )
}
