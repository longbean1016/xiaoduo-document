'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Menu,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { PublicSearchDialog } from '@/components/public-search-dialog'
import { ThemePicker } from '@/components/theme-picker'
import type { PublicCategory } from '@/lib/public-library'
import { cn } from '@/lib/utils'

function decodedPathname(pathname: string) {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return pathname
  }
}

export function PublicLibraryShell({
  categories,
  avatarUrl,
  children,
}: {
  categories: PublicCategory[]
  avatarUrl?: string | null
  children: ReactNode
}) {
  const pathname = decodedPathname(usePathname())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const contentRef = useRef<HTMLElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarOpenRef = useRef(false)
  const sidebarButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarCloseRef = useRef<HTMLButtonElement>(null)
  const restoreSidebarFocusRef = useRef(false)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      if (event.key === 'Escape') {
        restoreSidebarFocusRef.current = true
        setSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  useEffect(() => {
    if (sidebarOpen) {
      sidebarOpenRef.current = true
      sidebarCloseRef.current?.focus()
      return
    }
    if (!sidebarOpenRef.current) return
    sidebarOpenRef.current = false
    if (restoreSidebarFocusRef.current) {
      sidebarButtonRef.current?.focus()
      restoreSidebarFocusRef.current = false
    }
  }, [sidebarOpen])

  function openSidebar() {
    restoreSidebarFocusRef.current = true
    setSidebarOpen(true)
  }

  function closeSidebar(restoreFocus = true) {
    restoreSidebarFocusRef.current = restoreFocus
    setSidebarOpen(false)
  }

  function toggleCategory(categoryId: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  return (
    <div className="library-shell">
      <a href="#library-content" className="skip-link">
        跳到正文
      </a>

      <header className="library-header">
        <button
          ref={sidebarButtonRef}
          type="button"
          className="library-icon-button library-mobile-menu"
          onClick={openSidebar}
          aria-label="打开目录"
          aria-controls="library-sidebar"
          aria-expanded={sidebarOpen}
        >
          <Menu size={22} />
        </button>
        <Link
          href="/"
          className="library-brand"
          aria-label="小多笔记首页"
          onClick={() => setSidebarOpen(false)}
        >
          <BrandMark avatarUrl={avatarUrl} />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <button
            ref={searchButtonRef}
            type="button"
            className="library-search-button"
            aria-label="搜索"
            onClick={() => setSearchOpen(true)}
          >
            <Search aria-hidden="true" size={19} />
            <span>搜索</span>
          </button>
          <ThemePicker className="library-icon-button" iconSize={20} />
        </div>
      </header>

      <aside
        id="library-sidebar"
        className={cn('library-sidebar', sidebarOpen && 'is-open')}
        aria-label="笔记目录"
      >
        <button
          ref={sidebarCloseRef}
          type="button"
          className="library-icon-button library-sidebar-close library-sidebar-close-floating"
          onClick={() => closeSidebar()}
          aria-label="关闭目录"
        >
          <X size={21} />
        </button>

        <nav className="library-directory" aria-label="笔记目录">
          {categories.map((category) => {
            const categoryPath = `/library/${category.slug}`
            const categoryActive = pathname === categoryPath
            const isCollapsed = collapsed.has(category.id)

            return (
              <section
                key={category.id}
                className={cn(
                  'library-category',
                  categoryActive && 'is-active',
                )}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="library-category-toggle"
                    data-visual-dynamic
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={!isCollapsed}
                    aria-label={
                      isCollapsed
                        ? `展开${category.title}`
                        : `折叠${category.title}`
                    }
                  >
                    {isCollapsed ? (
                      <ChevronRight size={17} />
                    ) : (
                      <ChevronDown size={17} />
                    )}
                  </button>
                  <Link
                    href={categoryPath}
                    onClick={() => closeSidebar(false)}
                    className={cn(
                      'library-category-link',
                      pathname === categoryPath && 'is-active',
                    )}
                    aria-current={
                      pathname === categoryPath ? 'page' : undefined
                    }
                  >
                    <strong>{category.title}</strong>
                  </Link>
                </div>

                {!isCollapsed && (
                  <div className="library-chapters">
                    {category.chapters.map((chapter) => {
                      const chapterPath = `${categoryPath}/${chapter.path}`
                      return (
                        <Link
                          key={chapter.articleId}
                          href={chapterPath}
                          onClick={() => closeSidebar(false)}
                          className={cn(
                            'library-chapter-link',
                            pathname === chapterPath && 'is-active',
                          )}
                          aria-current={
                            pathname === chapterPath ? 'page' : undefined
                          }
                        >
                          <span>{chapter.title}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </nav>

        <div className="library-sidebar-footer">
          <Link href="/" onClick={() => closeSidebar(false)}>
            <ArrowLeft size={17} />
            返回预览页
          </Link>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          className="library-sidebar-overlay"
          onClick={() => closeSidebar()}
          aria-label="关闭目录遮罩"
        />
      ) : null}

      <main
        ref={contentRef}
        id="library-content"
        className="library-content"
      >
        <div key={pathname} className="library-route-view">
          {children}
        </div>
      </main>
      <PublicSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        categories={categories}
        returnFocusTo={searchButtonRef}
      />
    </div>
  )
}
