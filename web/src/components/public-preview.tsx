import Link from 'next/link'
import { ArrowRight, BookOpen, ChevronRight } from 'lucide-react'
import { BrandMark } from '@/components/brand-mark'
import { ThemePicker } from '@/components/theme-picker'
import type {
  PublicCategory,
  PublicSiteProfile,
} from '@/lib/public-library'

export function PublicPreview({
  profile,
  categories,
}: {
  profile: PublicSiteProfile | null
  categories: PublicCategory[]
}) {
  const authorName = profile?.authorName ?? '站内作者'
  const publishedCount = categories.reduce(
    (total, category) => total + category.chapters.length,
    0,
  )
  const previewCategory = categories[0] ?? null
  const previewNotes = previewCategory?.chapters.slice(0, 4) ?? []

  return (
    <main className="landing-page">
      <header className="landing-header">
        <Link href="/" aria-label="知笺首页">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-2">
          <ThemePicker className="landing-icon-button" iconSize={21} />
          <Link href="/library" className="landing-header-link">
            进入笔记库
            <ArrowRight size={18} />
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-kicker">Personal knowledge library</p>
          <h1>
            把零散的知识，
            <br />
            整理成一本
            <br />
            可以一直读下去的书。
          </h1>
          <p className="landing-lede">
            {authorName}的个人知识库。按分类与章节组织长期笔记，适合系统阅读，也适合随手返回某一页继续查证。
          </p>
          <div className="landing-actions">
            <Link href="/library" className="landing-primary-button">
              进入笔记库
              <ArrowRight size={20} />
            </Link>
            <span className="landing-count">
              <BookOpen size={18} />
              {categories.length} 个分类
              <span />
              {publishedCount} 篇公开章节
            </span>
          </div>
        </div>

        <Link
          href="/library"
          className="landing-preview"
          aria-label="预览笔记库"
        >
          <div className="landing-preview-top">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[var(--rust)]" />
              知笺 · 笔记库
            </span>
            <span>预览</span>
          </div>
          <div className="landing-preview-body">
            <aside>
              <p>目录</p>
              {categories.slice(0, 3).map((category, index) => (
                <div
                  key={category.id}
                  className="landing-preview-category"
                >
                  <span className={index === 0 ? 'is-active' : ''}>
                    {String(index + 1).padStart(2, '0')} {category.title}
                  </span>
                  {index === 0
                    ? previewNotes.slice(0, 3).map((note, noteIndex) => (
                        <span
                          key={note.articleId}
                          className={noteIndex === 0 ? 'is-current' : ''}
                        >
                          {note.title}
                        </span>
                      ))
                    : null}
                </div>
              ))}
            </aside>
            <div className="landing-preview-content">
              <p className="landing-preview-breadcrumb">
                {previewCategory?.title ?? '知笺'}
                <ChevronRight size={15} />
                第一章
              </p>
              <h2>
                {previewNotes[0]?.title ?? '开始整理你的知识'}
              </h2>
              <p>
                {previewNotes[0]?.plainText.slice(0, 90) ??
                  '把长期笔记组织成清晰的分类和章节。'}
              </p>
              <div className="landing-preview-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </Link>
      </section>

      <footer className="landing-footer">
        <span>知笺 · {authorName}</span>
        <span>从一页笔记开始，慢慢形成自己的目录。</span>
      </footer>
    </main>
  )
}
