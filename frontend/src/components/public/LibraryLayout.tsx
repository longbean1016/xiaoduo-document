import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Menu,
  Search,
  X,
} from 'lucide-react'
import {
  Link,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { BrandMark } from '../BrandMark'
import { ThemePicker } from '../ThemePicker'
import { SearchDialog } from './SearchDialog'
import { categoryNotes, useSiteStore } from '../../store/siteStore'
import { cn } from '../../lib/utils'

export function LibraryLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const categories = useSiteStore((state) => state.categories)
  const notes = useSiteStore((state) => state.notes)
  const location = useLocation()

  const orderedCategories = useMemo(
    () => categories.slice().sort((a, b) => a.order - b.order),
    [categories],
  )
  useEffect(() => {
    const content = document.getElementById('library-content')
    content?.scrollTo({ top: 0, behavior: 'instant' })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const toggleCategory = (categoryId: string) => {
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
          type="button"
          className="library-icon-button library-mobile-menu"
          onClick={() => setSidebarOpen(true)}
          aria-label="打开目录"
        >
          <Menu size={22} />
        </button>
        <Link to="/" className="library-brand">
          <BrandMark />
        </Link>
        <span className="library-header-divider" />
        <span className="library-header-title">笔记库</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="library-search-button"
            onClick={() => setSearchOpen(true)}
            aria-label="搜索"
          >
            <Search size={19} />
            <span>搜索</span>
          </button>
          <ThemePicker className="library-icon-button" iconSize={20} />
        </div>
      </header>

      <aside
        className={cn('library-sidebar', sidebarOpen && 'is-open')}
        aria-label="笔记目录"
      >
        <button
          type="button"
          className="library-icon-button library-sidebar-close library-sidebar-close-floating"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭目录"
        >
          <X size={21} />
        </button>

        <nav className="library-directory">
          {orderedCategories.map((category) => {
            const chapters = categoryNotes(category, notes)
            const isCollapsed = collapsed.has(category.id)
            const categoryPath = `/library/${category.slug}`
            const isCategoryActive = location.pathname === categoryPath
            if (!chapters.length) return null

            return (
              <section
                key={category.id}
                className={cn(
                  'library-category',
                  isCategoryActive && 'is-active',
                )}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="library-category-toggle"
                    data-visual-dynamic
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? (
                      <ChevronRight size={17} />
                    ) : (
                      <ChevronDown size={17} />
                    )}
                  </button>
                  <Link
                    to={categoryPath}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'library-category-link',
                      isCategoryActive && 'is-active',
                    )}
                  >
                    <strong>{category.title}</strong>
                  </Link>
                </div>

                {!isCollapsed && (
                  <div className="library-chapters">
                    {chapters.map((note) => {
                      const published = note.published
                      if (!published) return null
                      const active = location.pathname.endsWith(
                        `/${published.slug}`,
                      )
                      return (
                        <Link
                          key={note.id}
                          to={`/library/${category.slug}/${published.slug}`}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'library-chapter-link',
                            active && 'is-active',
                          )}
                        >
                          <span>{published.title}</span>
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
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <ArrowLeft size={17} />
            返回预览页
          </Link>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="library-sidebar-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭目录遮罩"
        />
      )}

      <main id="library-content" className="library-content">
        <div key={location.pathname} className="library-route-view">
          <Outlet />
        </div>
      </main>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
