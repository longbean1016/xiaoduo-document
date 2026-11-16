'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  FilePlus2,
  FileText,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import { StudioSelect } from '@/components/ui/studio-select'
import { formatRelativeTime } from '@/lib/format-time'

interface CategoryItem {
  id: string
  title: string
}

interface ArticleItem {
  id: string
  title: string
  categoryId: string
  categoryTitle: string
  plainText: string
  publicationState: 'draft' | 'published' | 'unpublished'
  revision: number
  updatedAt: string
  pendingUpdate: boolean
}

type Filter = 'all' | 'draft' | 'published'
type SortDirection = 'asc' | 'desc'

export function ArticleDashboard({
  categories,
  articles,
  canManage,
}: {
  categories: CategoryItem[]
  articles: ArticleItem[]
  canManage: boolean
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [newCategoryId, setNewCategoryId] = useState(
    categories[0]?.id ?? '',
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importCategoryId, setImportCategoryId] = useState(
    categories[0]?.id ?? '',
  )
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [trashTargets, setTrashTargets] = useState<ArticleItem[]>([])

  useEffect(() => {
    const theme = window.localStorage.getItem('zhijian-theme')
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    }
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const visible = articles
    .filter(
      (article) =>
        categoryFilter === 'all' ||
        article.categoryId === categoryFilter,
    )
    .filter((article) => {
      if (filter === 'published') {
        return article.publicationState === 'published'
      }
      if (filter === 'draft') {
        return article.publicationState !== 'published'
      }
      return true
    })
    .filter(
      (article) =>
        !normalizedQuery ||
        article.title.toLowerCase().includes(normalizedQuery) ||
        article.plainText.toLowerCase().includes(normalizedQuery) ||
        article.categoryTitle.toLowerCase().includes(normalizedQuery),
    )
    .sort((a, b) => {
      const comparison = a.updatedAt.localeCompare(b.updatedAt)
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const publishedCount = articles.filter(
    (article) => article.publicationState === 'published',
  ).length
  const draftCount = articles.length - publishedCount
  const latest = articles
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const selectedVisibleCount = visible.filter((article) =>
    selectedIds.has(article.id),
  ).length
  const allVisibleSelected =
    visible.length > 0 && selectedVisibleCount === visible.length

  function resetSelection() {
    setSelectedIds(new Set())
  }

  function changeFilter(value: Filter) {
    setFilter(value)
    resetSelection()
  }

  function changeCategory(value: string) {
    setCategoryFilter(value)
    resetSelection()
  }

  function changeQuery(value: string) {
    setQuery(value)
    resetSelection()
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        for (const article of visible) next.delete(article.id)
      } else {
        for (const article of visible) next.add(article.id)
      }
      return next
    })
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => !current)
    resetSelection()
    setMessage('')
  }

  function clearFilters() {
    setFilter('all')
    setQuery('')
    setCategoryFilter('all')
    resetSelection()
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newCategoryId) return
    setMessage('')
    setPending(true)
    try {
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
      if (!response.ok || !payload.article) {
        setMessage(
          payload.error === 'CATEGORY_NOT_FOUND'
            ? '请先创建分类。'
            : '创建章节失败，请重试。',
        )
        return
      }
      setCreateOpen(false)
      router.push(`/studio/notes/${payload.article.id}`)
    } catch {
      setMessage('创建章节失败，请重试。')
    } finally {
      setPending(false)
    }
  }

  async function importMarkdown(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setPending(true)
    const data = new FormData(event.currentTarget)
    data.set('categoryId', importCategoryId)
    try {
      const response = await fetch('/api/studio/articles/import', {
        method: 'POST',
        body: data,
      })
      const payload = (await response.json()) as {
        article?: { id: string }
        error?: string
      }
      if (!response.ok || !payload.article) {
        const errors: Record<string, string> = {
          EMPTY_MARKDOWN: 'Markdown 文件内容为空。',
          UNSUPPORTED_FILE: '请选择 .md 或 .markdown 文件。',
          MARKDOWN_TOO_LARGE: 'Markdown 文件超过 2 MB。',
        }
        setMessage(errors[payload.error ?? ''] ?? '导入失败，请重试。')
        return
      }
      router.push(`/studio/notes/${payload.article.id}`)
    } catch {
      setMessage('导入失败，请重试。')
    } finally {
      setPending(false)
    }
  }

  function askTrashSelected() {
    const targets = articles.filter((article) => selectedIds.has(article.id))
    if (targets.length) setTrashTargets(targets)
  }

  async function trashSelected() {
    if (!trashTargets.length) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/studio/articles/bulk-trash', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ids: trashTargets.map((article) => article.id),
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok) {
        setMessage(
          payload.error === 'FORBIDDEN_ARTICLE'
            ? '部分章节已无权操作，请刷新后重试。'
            : '删除失败，请重试。',
        )
        return
      }
      setTrashTargets([])
      setSelectedIds(new Set())
      setSelectionMode(false)
      router.refresh()
    } catch {
      setMessage('删除失败，请重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="studio-page">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Content</p>
          <h1>写作台</h1>
          <p>
            {canManage
              ? '草稿与公开章节都在这里。读者只会看到最近一次发布版本。'
              : '这里只展示你获得授权编辑的文章，其他内容不可见。'}
          </p>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => {
                setMessage('')
                setImportOpen(true)
              }}
            >
              <Upload size={18} />
              导入 Markdown
            </button>
            <button
              type="button"
              className="studio-primary-button"
              onClick={() => {
                setMessage('')
                setCreateOpen(true)
              }}
              disabled={!newCategoryId || pending}
            >
              <FilePlus2 size={19} />
              新建章节
            </button>
          </div>
        ) : null}
      </header>

      {message && !importOpen && !createOpen && !trashTargets.length ? (
        <p className="studio-dashboard-message" role="alert">
          {message}
        </p>
      ) : null}

      <div className="studio-stats">
        <div>
          <span>全部章节</span>
          <strong>{articles.length}</strong>
        </div>
        <div>
          <span>公开</span>
          <strong>{publishedCount}</strong>
        </div>
        <div>
          <span>草稿</span>
          <strong>{draftCount}</strong>
        </div>
        <div data-visual-dynamic>
          <span>最近整理</span>
          <strong className="studio-stat-relative">
            {latest ? formatRelativeTime(latest.updatedAt) : '—'}
          </strong>
        </div>
      </div>

      <div
        className={`studio-toolbar${
          selectionMode ? ' is-selection-mode' : ''
        }`}
      >
        <div className="studio-toolbar-row">
          <div className="studio-toolbar-filters">
            <div className="segmented-control">
              {(
                [
                  ['all', '全部'],
                  ['draft', '草稿'],
                  ['published', '已发布'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? 'is-active' : ''}
                  aria-pressed={filter === value}
                  onClick={() => changeFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <StudioSelect
              value={categoryFilter}
              onChange={changeCategory}
              options={[
                { value: 'all', label: '全部分类' },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.title,
                })),
              ]}
              ariaLabel="按分类筛选"
            />
          </div>
          <div className="studio-toolbar-actions">
            <label className="studio-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                placeholder="搜索章节"
              />
            </label>
            <div
              className="studio-sort-control"
              role="group"
              aria-label="按最后保存时间排序"
            >
              <button
                type="button"
                className={sortDirection === 'asc' ? 'is-active' : ''}
                aria-label="按时间正序"
                aria-pressed={sortDirection === 'asc'}
                title="按最后保存时间正序"
                onClick={() => setSortDirection('asc')}
              >
                <ArrowUp size={15} />
                <span>正序</span>
              </button>
              <button
                type="button"
                className={sortDirection === 'desc' ? 'is-active' : ''}
                aria-label="按时间倒序"
                aria-pressed={sortDirection === 'desc'}
                title="按最后保存时间倒序"
                onClick={() => setSortDirection('desc')}
              >
                <ArrowDown size={15} />
                <span>倒序</span>
              </button>
            </div>
            <button
              type="button"
              className={`studio-delete-mode-button${
                selectionMode ? ' is-active' : ''
              }`}
              aria-pressed={selectionMode}
              disabled={!articles.length || pending}
              onClick={toggleSelectionMode}
            >
              {selectionMode ? <X size={16} /> : <Trash2 size={16} />}
              {selectionMode ? '退出删除' : '删除'}
            </button>
          </div>
        </div>
        {selectionMode ? (
          <div className="studio-selection-bar">
            <div className="studio-selection-summary" aria-live="polite">
              <span className="studio-selection-count">{selectedIds.size}</span>
              <span>
                {selectedIds.size
                  ? `已选择 ${selectedIds.size} 个章节`
                  : '请选择要删除的章节'}
              </span>
              <span className="studio-selection-hint">
                点击文章行或左侧圆框进行选择
              </span>
            </div>
            <div className="studio-selection-actions">
              <button
                type="button"
                className="studio-secondary-button"
                disabled={!visible.length}
                onClick={toggleSelectAllVisible}
              >
                {allVisibleSelected ? '取消全选' : '全选当前'}
              </button>
              <button
                type="button"
                className="studio-danger-button"
                disabled={!selectedIds.size || pending}
                onClick={askTrashSelected}
              >
                <Trash2 size={16} />
                移入回收站
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={`studio-note-table${selectionMode ? ' is-selecting' : ''}`}
      >
        <div className="studio-table-head" aria-hidden="true">
          <span>章节</span>
          <span>分类</span>
          <span>状态</span>
          <span>最后保存</span>
        </div>
        {visible.map((article) => (
          <div
            key={article.id}
            className={[
              'studio-table-row',
              selectionMode ? 'is-selecting' : '',
              selectedIds.has(article.id) ? 'is-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={
              selectionMode ? () => toggleSelection(article.id) : undefined
            }
          >
            {selectionMode ? (
              <label
                className="studio-row-checkbox"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(article.id)}
                  aria-label={`选择 ${article.title}`}
                  onChange={() => toggleSelection(article.id)}
                />
                <span aria-hidden="true" />
              </label>
            ) : null}
            <Link
              href={`/studio/notes/${article.id}`}
              className="studio-row-main"
              onClick={(event) => {
                if (selectionMode) event.preventDefault()
              }}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <FileText
                    size={18}
                    className="shrink-0 text-[var(--muted-faint)]"
                  />
                  <span className="truncate text-[16px] font-medium text-[var(--ink)]">
                    {article.title}
                  </span>
                </span>
                <span className="mt-1 block truncate pl-6 text-[13px] text-[var(--muted)]">
                  {article.plainText || '还没有正文内容'}
                </span>
              </span>
            </Link>
            <span className="truncate text-[14px] text-[var(--muted)]">
              {article.categoryTitle}
            </span>
            <span>
              <span
                className={`studio-status ${
                  article.publicationState === 'published'
                    ? 'is-public'
                    : ''
                }`}
              >
                {article.pendingUpdate
                  ? '待更新'
                  : article.publicationState === 'published'
                    ? '已发布'
                    : article.publicationState === 'unpublished'
                      ? '已撤回'
                      : '草稿'}
              </span>
            </span>
            <span
              className="text-[13px] text-[var(--muted-faint)]"
              data-visual-dynamic
            >
              {formatRelativeTime(article.updatedAt)}
            </span>
          </div>
        ))}
        {!visible.length ? (
          <div className="studio-empty-state">
            <p>没有匹配的章节</p>
            <span>换一个筛选条件，或者重置后查看全部内容。</span>
            <button type="button" onClick={clearFilters}>
              清除筛选
            </button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={trashTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setTrashTargets([])
        }}
        title={
          trashTargets.length > 1
            ? '删除所选章节？'
            : '删除这个章节？'
        }
        description={
          trashTargets.length > 1
            ? `所选的 ${trashTargets.length} 个章节会移入回收站，并保留 30 天。`
            : trashTargets[0]
              ? `章节“${trashTargets[0].title}”会移入回收站，并保留 30 天。`
              : ''
        }
        confirmLabel="移入回收站"
        pending={pending}
        onConfirm={() => void trashSelected()}
      />

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建章节"
        description="确认后会创建一篇无标题章节草稿，并立即进入编辑器。"
      >
        <form className="p-5" onSubmit={create}>
          <label className="text-xs font-medium text-[var(--ink-soft)]">
            所属分类
            <StudioSelect
              value={newCategoryId}
              onChange={setNewCategoryId}
              options={categories.map((category) => ({
                value: category.id,
                label: category.title,
              }))}
              ariaLabel="新建章节所属分类"
              className="mt-2 w-full"
            />
          </label>
          {message ? (
            <p className="mt-3 text-xs text-[var(--rust)]" role="alert">
              {message}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => setCreateOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              className="studio-primary-button"
              disabled={pending || !newCategoryId}
            >
              <FilePlus2 size={18} />
              {pending ? '正在创建…' : '创建草稿'}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入 Markdown"
        description="导入会创建新的章节草稿，不会覆盖现有内容。"
      >
        <form className="studio-import-dialog" onSubmit={importMarkdown}>
          <label>
            <span>导入分类</span>
            <StudioSelect
              value={importCategoryId}
              onChange={setImportCategoryId}
              options={categories.map((category) => ({
                value: category.id,
                label: category.title,
              }))}
              ariaLabel="导入分类"
            />
          </label>
          <label>
            <span>Markdown 文件</span>
            <input
              name="file"
              type="file"
              accept=".md,.markdown"
              required
            />
          </label>
          {message ? <p role="alert">{message}</p> : null}
          <div>
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => setImportOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              className="studio-primary-button"
              disabled={pending || !importCategoryId}
            >
              <Upload size={18} />
              {pending ? '正在导入…' : '导入为草稿'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
