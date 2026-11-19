import {
  ArrowUpRight,
  BarChart3,
  Bell,
  FileText,
  FolderTree,
  LogOut,
  Settings,
  Sparkles,
  Trash2,
  UsersRound,
} from 'lucide-react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AuthorAvatar } from '../AuthorAvatar'
import { BrandMark } from '../BrandMark'
import { useSiteStore } from '../../store/siteStore'
import { Dialog } from '../ui/Dialog'
import { StudioSelect } from './StudioSelect'

export function StudioLayout() {
  const author = useSiteStore((state) => state.author)
  const categories = useSiteStore((state) => state.categories)
  const studioRole = useSiteStore((state) => state.studioRole)
  const currentCollaboratorId = useSiteStore(
    (state) => state.currentCollaboratorId,
  )
  const collaborators = useSiteStore((state) => state.collaborators)
  const logout = useSiteStore((state) => state.logoutStudio)
  const createNote = useSiteStore((state) => state.createNote)
  const location = useLocation()
  const navigate = useNavigate()
  const isEditor = location.pathname.startsWith('/studio/notes/')
  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState(
    categories.slice().sort((a, b) => a.order - b.order)[0]?.id ?? '',
  )
  const isOwner = studioRole === 'owner'
  const currentCollaborator = collaborators.find(
    (item) => item.id === currentCollaboratorId,
  )
  const currentName = isOwner
    ? author.name
    : currentCollaborator?.displayName ?? '协作者'

  const startWriting = () => {
    if (!isOwner) return
    if (!categories.length) {
      toast.error('请先创建一个分类')
      navigate('/studio/categories')
      return
    }
    setNewCategoryId(
      categories.slice().sort((a, b) => a.order - b.order)[0]?.id ?? '',
    )
    setNewNoteOpen(true)
  }

  const createInCategory = () => {
    const id = createNote(newCategoryId)
    if (!id) {
      toast.error('请选择一个分类')
      return
    }
    setNewNoteOpen(false)
    navigate(`/studio/notes/${id}`)
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <div className="studio-shell">
      {!isEditor && (
        <div className="studio-mobile-bar">
          <BrandMark compact avatarUrl={author.avatarUrl} />
          <nav aria-label="写作台导航">
            <StudioMobileNav to="/studio" end icon={<FileText size={19} />}>
              内容
            </StudioMobileNav>
            <StudioMobileNav to="/studio/trash" icon={<Trash2 size={19} />}>
              回收
            </StudioMobileNav>
            {isOwner && (
              <>
                <StudioMobileNav
                  to="/studio/collaboration"
                  icon={<UsersRound size={19} />}
                >
                  协作
                </StudioMobileNav>
                <StudioMobileNav
                  to="/studio/analytics"
                  icon={<BarChart3 size={19} />}
                >
                  报表
                </StudioMobileNav>
                <StudioMobileNav
                  to="/studio/categories"
                  icon={<FolderTree size={19} />}
                >
                  分类
                </StudioMobileNav>
                <StudioMobileNav
                  to="/studio/settings"
                  icon={<Settings size={19} />}
                >
                  资料
                </StudioMobileNav>
                <StudioMobileNav
                  to="/studio/notifications"
                  icon={<Bell size={19} />}
                >
                  通知
                </StudioMobileNav>
              </>
            )}
          </nav>
          <Link
            to="/"
            className="studio-mobile-site-link"
            aria-label="打开公开站"
          >
            <span>公开站</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      <aside className="studio-sidebar">
        <div className="px-5 pb-5 pt-5">
          <BrandMark avatarUrl={author.avatarUrl} />
          <p className="mt-2 text-[12px] tracking-[0.18em] text-[var(--muted-faint)] uppercase">
            Writing studio
          </p>
        </div>

        {isOwner && (
          <div className="px-3">
            <button type="button" className="studio-new-button" onClick={startWriting}>
              <Sparkles size={19} />
              开始写作
            </button>
          </div>
        )}

        <nav className="mt-5 space-y-1 px-3">
          <StudioNav to="/studio" end icon={<FileText size={19} />}>
            内容
          </StudioNav>
          <StudioNav to="/studio/trash" icon={<Trash2 size={19} />}>
            回收站
          </StudioNav>
          {isOwner && (
            <>
              <StudioNav
                to="/studio/collaboration"
                icon={<UsersRound size={19} />}
              >
                协作管理
              </StudioNav>
              <StudioNav
                to="/studio/analytics"
                icon={<BarChart3 size={19} />}
              >
                访问报表
              </StudioNav>
              <StudioNav to="/studio/categories" icon={<FolderTree size={19} />}>
                分类管理
              </StudioNav>
              <StudioNav to="/studio/settings" icon={<Settings size={19} />}>
                个人资料
              </StudioNav>
            </>
          )}
        </nav>

        <div className="mt-auto border-t border-[var(--line)] p-3">
          <Link to="/" className="studio-site-link">
            查看公开站
            <ArrowUpRight size={17} />
          </Link>
          <div className="mt-4 flex items-center gap-2.5 px-2">
            <AuthorAvatar
              name={currentName}
              avatarUrl={isOwner ? author.avatarUrl : undefined}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-[var(--ink)]">
                {currentName}
              </span>
              <span className="mt-0.5 block text-[12px] text-[var(--muted-faint)]">
                {isOwner ? '站主' : '协作者'}
              </span>
            </span>
            {isOwner && (
              <Link
                to="/studio/notifications"
                className="studio-icon-button"
                aria-label="通知"
                title="通知"
              >
                <Bell size={19} />
              </Link>
            )}
            <button
              type="button"
              onClick={logout}
              className="studio-icon-button"
              aria-label="退出写作台"
              title="退出写作台"
            >
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </aside>

      <main className="studio-main">
        <div
          key={location.pathname}
          className={`studio-route-view ${isEditor ? 'is-editor' : ''}`}
        >
          <Outlet />
        </div>
      </main>

      <Dialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        title="新建章节"
        description="章节目录固定为“分类 → 章节”。新章节会追加到所选分类的末尾。"
      >
        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault()
            createInCategory()
          }}
        >
          <label className="text-xs font-medium text-[var(--ink-soft)]">
            所属分类
            <StudioSelect
              value={newCategoryId}
              onChange={setNewCategoryId}
              options={categories
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((category) => ({
                  value: category.id,
                  label: category.title,
                }))}
              ariaLabel="新建章节所属分类"
              className="mt-2 w-full"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => setNewNoteOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              className="studio-primary-button"
              disabled={!newCategoryId}
            >
              <Sparkles size={18} />
              创建并开始写作
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

function StudioMobileNav({
  to,
  end,
  icon,
  children,
}: {
  to: string
  end?: boolean
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = useLocation().pathname
  const fixtureRoute = to.replace(/^\/studio/, '/studio/visual-fixtures')
  const label = typeof children === 'string' ? children : to
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      title={label}
      className={({ isActive }) =>
        `studio-mobile-nav-link ${
          isActive || pathname === fixtureRoute ? 'is-active' : ''
        }`
      }
    >
      {icon}
      <span>{children}</span>
    </NavLink>
  )
}

function StudioNav({
  to,
  end,
  icon,
  children,
}: {
  to: string
  end?: boolean
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = useLocation().pathname
  const fixtureRoute = to.replace(/^\/studio/, '/studio/visual-fixtures')
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `studio-nav-link ${
          isActive || pathname === fixtureRoute ? 'is-active' : ''
        }`
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}
