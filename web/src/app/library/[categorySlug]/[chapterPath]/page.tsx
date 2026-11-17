import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Home,
} from 'lucide-react'
import { MarkdownArticle } from '@/components/markdown-article'
import { AuthorAvatar } from '@/components/author-avatar'
import { ArticleViewBeacon } from '@/components/article-view-beacon'
import { ChapterToc } from '@/components/chapter-toc'
import { formatDateTime } from '@/lib/format-time'
import {
  getPublicChapterByPath,
  getPublicChapterNavigation,
  getPublicSiteProfile,
  resolvePublicRedirect,
} from '@/lib/public-library'
import { countWords, markdownHeadings } from '@/lib/markdown-headings'
import {
  buildChapterOpenGraph,
  toReaderDiscoveryEntry,
} from '@/server/reader-discovery'

interface ChapterPageProps {
  params: Promise<{
    categorySlug: string
    chapterPath: string
  }>
}

export const revalidate = 60

export async function generateMetadata({
  params,
}: ChapterPageProps): Promise<Metadata> {
  const { categorySlug, chapterPath } = await params
  const chapter = await getPublicChapterByPath(
    decodeURIComponent(categorySlug),
    decodeURIComponent(chapterPath),
  )
  if (!chapter) return {}
  const profile = await getPublicSiteProfile()
  const siteUrl = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100'
  const entry = toReaderDiscoveryEntry(chapter)
  const openGraph = buildChapterOpenGraph(entry, profile, siteUrl)
  const image =
    openGraph.image ??
    `/library/${chapter.categorySlug}/${chapter.path}/opengraph-image`
  return {
    title: openGraph.title,
    description: openGraph.description,
    authors: [{ name: openGraph.author }],
    alternates: { canonical: openGraph.url },
    openGraph: {
      type: 'article',
      title: openGraph.title,
      description: openGraph.description,
      url: openGraph.url,
      siteName: '知笺',
      publishedTime: chapter.publishedAt,
      authors: [openGraph.author, ...openGraph.contributors],
      images: [{ url: image, alt: openGraph.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: openGraph.title,
      description: openGraph.description,
      images: [image],
    },
  }
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { categorySlug, chapterPath } = await params
  const decodedCategorySlug = decodeURIComponent(categorySlug)
  const decodedChapterPath = decodeURIComponent(chapterPath)
  const requestPath = `/library/${decodedCategorySlug}/${decodedChapterPath}`
  const redirectTo = await resolvePublicRedirect(requestPath)
  if (redirectTo) redirect(encodeURI(redirectTo))
  const chapter = await getPublicChapterByPath(
    decodedCategorySlug,
    decodedChapterPath,
  )

  if (!chapter) notFound()
  const headings = markdownHeadings(chapter.markdown)
  const navigation = await getPublicChapterNavigation(
    decodedCategorySlug,
    decodedChapterPath,
  )
  const profile = await getPublicSiteProfile()
  const authorName = profile?.authorName ?? chapter.authorName
  const authors = [
    {
      id: 'owner',
      name: authorName,
      avatarUrl: profile?.avatarUrl,
    },
    ...chapter.contributors.map((contributor) => ({
      id: contributor.id,
      name: contributor.name,
      avatarUrl: undefined,
    })),
  ]

  return (
    <article className="chapter-page">
      <div className="chapter-main-grid">
        <div>
          <nav className="chapter-breadcrumb" aria-label="面包屑">
            <Link href="/" className="breadcrumb-home" aria-label="返回预览页">
              <Home size={18} />
            </Link>
            <ChevronRight size={17} className="breadcrumb-separator" />
            <Link
              href={`/library/${categorySlug}`}
              className="breadcrumb-category"
            >
              {chapter.categoryTitle}
            </Link>
            <ChevronRight size={17} className="breadcrumb-separator" />
            <span className="breadcrumb-current">{chapter.title}</span>
          </nav>

          <header className="chapter-header">
            <h1>{chapter.title}</h1>
            <div className="chapter-byline">
              <span
                className="chapter-author-group"
                role="group"
                aria-label="作者"
              >
                {authors.map((author) => (
                  <span key={author.id} className="chapter-author">
                    <AuthorAvatar
                      name={author.name}
                      avatarUrl={author.avatarUrl}
                      size="md"
                    />
                    <strong>{author.name}</strong>
                  </span>
                ))}
              </span>
              <span className="chapter-byline-dot" aria-hidden="true" />
              <span>{countWords(chapter.plainText)} 字</span>
              <span className="chapter-byline-dot" aria-hidden="true" />
              <span
                className="article-view-count"
                data-visual-dynamic
              >
                {chapter.viewCount} 次浏览
              </span>
              <span className="chapter-byline-dot" aria-hidden="true" />
              <span>
                更新于{' '}
                <time dateTime={chapter.publishedAt}>
                  {formatDateTime(chapter.publishedAt)}
                </time>
              </span>
            </div>
          </header>

          <div className="chapter-body">
            <MarkdownArticle markdown={chapter.markdown} />
          </div>

          <nav className="chapter-pagination" aria-label="章节翻页">
            {navigation?.previous ? (
              <Link
                href={`/library/${categorySlug}/${navigation.previous.path}`}
              >
                <span>上一章</span>
                <strong>
                  <ArrowLeft size={19} />
                  {navigation.previous.title}
                </strong>
              </Link>
            ) : (
              <span />
            )}
            {navigation?.next ? (
              <Link
                href={`/library/${categorySlug}/${navigation.next.path}`}
                className="text-right"
              >
                <span>下一章</span>
                <strong>
                  {navigation.next.title}
                  <ArrowRight size={19} />
                </strong>
              </Link>
            ) : (
              <Link
                href={`/library/${categorySlug}`}
                className="text-right"
              >
                <span>返回目录</span>
                <strong>
                  查看全部章节
                  <ArrowRight size={19} />
                </strong>
              </Link>
            )}
          </nav>

        </div>

        {headings.length ? <ChapterToc headings={headings} /> : null}
      </div>
      <ArticleViewBeacon
        articleId={chapter.id}
        disabled={process.env.ENABLE_VISUAL_FIXTURES === '1'}
      />
    </article>
  )
}
