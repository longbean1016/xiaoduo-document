'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AuthorAvatar } from '@/components/author-avatar'
import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { StudioSelect } from '@/components/ui/studio-select'
import { ThemePicker } from '@/components/theme-picker'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { signOutAction } from '@/app/actions/auth'

interface CategoryItem {
  id: string
  title: string
  position: number
}

export function StudioShell({
  children,
  role,
  currentName,
  avatarUrl,
  brandAvatarUrl,
  categories,
}: {
  children: React.ReactNode
  role: 'owner' | 'collaborator'
  currentName: string
  avatarUrl?: string | null
  brandAvatarUrl?: string | null
  categories: CategoryItem[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const isOwner = role === 'owner'
  const isEditor = pathname.startsWith('/studio/notes/')
  const orderedCategories = [...categories].sort(
    (left, right) => left.position - right.position,
  )
  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState(
    orderedCategories[0]?.id ?? '',
  )
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [signOutOpen, setSignOutOpen] = useState(false)
  const signOutFormRef = useRef<HTMLFormElement>(null)

  function startWriting() {
    if (!isOwner) return
    if (!orderedCategories.length) {
      toast.error('请先创建一个分类')
      router.push('/studio/categories')
      return
    }
    setNewCategoryId(orderedCategories[0].id)
    setCreateError('')
    setNewNoteOpen(true)
  }

  async function createArticle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newCategoryId) {
      setCreateError('请选择分类。')
      return
    }
    setCreating(true)
    setCreateError('')
    const response = await fetch('/api/studio/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        categoryId: newCategoryId,
        title: '无标题章节',
      }),
    })
    const payload = (await response.json()) as {
      article?: { id: string }
      error?: string
    }
    setCreating(false)
    if (!response.ok || !payload.article) {
      setCreateError(
        payload.error === 'CATEGORY_NOT_FOUND'
          ? '请先创建分类。'
          : '创建章节失败，请重试。',
      )
      return
    }
    setNewNoteOpen(false)
    router.push(`/studio/notes/${payload.article.id}`)
    router.refresh()
  }

  return (
    <>
      <div className="studio-shell">
      {!isEditor ? (
        <div className="studio-theme-picker-fixed">
          <ThemePicker />
        </div>
      ) : null}
      {!isEditor ? (
        <div className="studio-mobile-bar">
          <BrandMark
            compact
            label="小多写作台"
            avatarUrl={brandAvatarUrl}
          />
          <nav aria-label="写作台导航">
            <StudioMobileNav
              to="/studio"
              end
              icon={<FileText size={19} />}
              label="内容"
              pathname={pathname}
            />
            <StudioMobileNav
              to="/studio/trash"
              icon={<Trash2 size={19} />}
              label="回收"
              pathname={pathname}
            />
            <StudioMobileNav
              to="/studio/settings"
              icon={<Settings size={19} />}
              label="资料"
              pathname={pathname}
            />
            {isOwner ? (
              <>
                <StudioMobileNav
                  to="/studio/collaboration"
                  icon={<UsersRound size={19} />}
                  label="协作"
                  pathname={pathname}
                />
                <StudioMobileNav
                  to="/studio/analytics"
                  icon={<BarChart3 size={19} />}
                  label="报表"
                  pathname={pathname}
                />
                <StudioMobileNav
                  to="/studio/categories"
                  icon={<FolderTree size={19} />}
                  label="分类"
                  pathname={pathname}
                />
                <StudioMobileNav
                  to="/studio/notifications"
                  icon={<Bell size={19} />}
                  label="通知"
                  pathname={pathname}
                />
              </>
            ) : null}
          </nav>
          <Link
            href="/"
            className="studio-mobile-site-link"
            aria-label="打开公开站"
          >
            <span>公开站</span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      ) : null}

      <aside className="studio-sidebar">
        <div className="px-5 pb-5 pt-5">
          <BrandMark
            label="小多写作台"
            avatarUrl={brandAvatarUrl}
          />
        </div>

        {isOwner ? (
          <div className="px-3">
            <button
              type="button"
              className="studio-new-button"
              onClick={startWriting}
            >
              <Sparkles size={21} />
              <span className="studio-new-label">开始写作</span>
            </button>
          </div>
        ) : null}

        <nav className="mt-5 space-y-1 px-3" aria-label="写作台导航">
          <StudioNav
            to="/studio"
            end
            icon={<FileText size={19} />}
            pathname={pathname}
          >
            内容
          </StudioNav>
          <StudioNav
            to="/studio/trash"
            icon={<Trash2 size={19} />}
            pathname={pathname}
          >
            回收站
          </StudioNav>
          <StudioNav
            to="/studio/settings"
            icon={<Settings size={19} />}
            pathname={pathname}
          >
            个人资料
          </StudioNav>
          {isOwner ? (
            <>
              <StudioNav
                to="/studio/collaboration"
                icon={<UsersRound size={19} />}
                pathname={pathname}
              >
                协作管理
              </StudioNav>
              <StudioNav
                to="/studio/analytics"
                icon={<BarChart3 size={19} />}
                pathname={pathname}
                ariaLabel="访问统计"
              >
                访问报表
              </StudioNav>
              <StudioNav
                to="/studio/categories"
                icon={<FolderTree size={19} />}
                pathname={pathname}
              >
                分类管理
              </StudioNav>
            </>
          ) : null}
        </nav>

        <div className="mt-auto border-t border-[var(--line)] p-3">
          <Link href="/" className="studio-site-link">
            查看公开站
            <ArrowUpRight size={17} />
          </Link>
          <div className="mt-4 flex items-center gap-2.5 px-2">
            <AuthorAvatar
              name={currentName}
              avatarUrl={avatarUrl}
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
            {isOwner ? (
              <Link
                href="/studio/notifications"
                className="studio-icon-button"
                aria-label="通知"
                title="通知"
              >
                <Bell size={19} />
              </Link>
            ) : null}
            <form ref={signOutFormRef} action={signOutAction}>
              <button
                type="button"
                className="studio-icon-button"
                aria-label="退出写作台"
                title="退出写作台"
                onClick={() => setSignOutOpen(true)}
              >
                <LogOut size={19} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="studio-main">
        <div
          key={pathname}
          className={cn(
            'studio-route-view',
            isEditor && 'is-editor',
          )}
        >
          {children}
        </div>
      </main>

      <Dialog
        open={newNoteOpen}
        onOpenChange={setNewNoteOpen}
        title="新建章节"
        description="章节目录固定为“分类 → 章节”。新章节会追加到所选分类的末尾。"
      >
        <form className="p-5" onSubmit={createArticle}>
          <label className="text-xs font-medium text-[var(--ink-soft)]">
            所属分类
            <StudioSelect
              value={newCategoryId}
              onChange={setNewCategoryId}
              options={orderedCategories.map((category) => ({
                value: category.id,
                label: category.title,
              }))}
              ariaLabel="新建章节所属分类"
              className="mt-2 w-full"
            />
          </label>
          {createError ? (
            <p className="mt-3 text-xs text-[var(--rust)]" role="alert">
              {createError}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewNoteOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={creating || !newCategoryId}>
              <Sparkles size={18} />
              {creating ? '正在创建…' : '创建并开始写作'}
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="退出登录？"
        description={
          role === 'owner'
            ? '退出后需要重新输入邮箱和密码才能进入写作台。'
            : '退出后需要重新通过邮箱验证码进入写作台。'
        }
        confirmLabel="退出登录"
        onConfirm={() => signOutFormRef.current?.requestSubmit()}
      />
      </div>
      <Toaster />
    </>
  )
}

function StudioMobileNav({
  to,
  end,
  icon,
  label,
  pathname,
}: {
  to: string
  end?: boolean
  icon: React.ReactNode
  label: string
  pathname: string
}) {
  const active = end ? pathname === to : pathname.startsWith(to)
  return (
    <Link
      href={to}
      aria-label={label}
      title={label}
      className={cn('studio-mobile-nav-link', active && 'is-active')}
      data-end={end ? 'true' : undefined}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}

function StudioNav({
  to,
  end,
  icon,
  pathname,
  ariaLabel,
  children,
}: {
  to: string
  end?: boolean
  icon: React.ReactNode
  pathname: string
  ariaLabel?: string
  children: React.ReactNode
}) {
  const active = end ? pathname === to : pathname.startsWith(to)
  const label =
    ariaLabel ?? (typeof children === 'string' ? children : to)
  return (
    <Link
      href={to}
      aria-label={label}
      className={cn('studio-nav-link', active && 'is-active')}
    >
      {icon}
      <span className="studio-nav-label">{children}</span>
    </Link>
  )
}
