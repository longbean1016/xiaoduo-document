import { useState } from 'react'
import { FilePlus2, FileText, Search, Upload } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { StudioSelect } from '../../components/studio/StudioSelect'
import { Dialog } from '../../components/ui/Dialog'
import { usePageTitle } from '../../lib/usePageTitle'
import { formatRelativeTime } from '../../lib/text'
import {
  hasUnpublishedChanges,
  useSiteStore,
} from '../../store/siteStore'

type Filter = 'all' | 'draft' | 'published'

export function StudioDashboardPage() {
  usePageTitle('写作台 · 知笺')
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const notes = useSiteStore((state) => state.notes)
  const categories = useSiteStore((state) => state.categories)
  const studioRole = useSiteStore((state) => state.studioRole)
  const currentCollaboratorId = useSiteStore(
    (state) => state.currentCollaboratorId,
  )
  const collaborators = useSiteStore((state) => state.collaborators)
  const createNote = useSiteStore((state) => state.createNote)
  const navigate = useNavigate()
  const isOwner = studioRole === 'owner'
  const collaborator = collaborators.find(
    (item) => item.id === currentCollaboratorId,
  )
  const authorizedNoteIds = isOwner
    ? null
    : new Set(collaborator?.noteIds ?? [])
  const accessibleNotes = notes.filter(
    (note) =>
      !note.trashedAt &&
      (!authorizedNoteIds || authorizedNoteIds.has(note.id)),
  )
  const orderedCategories = categories
    .filter(
      (category) =>
        isOwner ||
        accessibleNotes.some((note) => note.categoryId === category.id),
    )
    .slice()
    .sort((a, b) => a.order - b.order)
  const [newCategoryId, setNewCategoryId] = useState(
    orderedCategories[0]?.id ?? '',
  )
  const [createOpen, setCreateOpen] = useState(false)

  const normalizedQuery = query.trim().toLowerCase()
  const visible = accessibleNotes
    .filter(
      (note) =>
        categoryFilter === 'all' || note.categoryId === categoryFilter,
    )
    .filter((note) => {
      if (filter === 'published') return note.publicationState === 'published'
      if (filter === 'draft') return note.publicationState !== 'published'
      return true
    })
    .filter(
      (note) =>
        !normalizedQuery ||
        note.title.toLowerCase().includes(normalizedQuery) ||
        note.plainText.toLowerCase().includes(normalizedQuery),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const create = () => {
    if (!newCategoryId) return
    const id = createNote(newCategoryId)
    if (id) {
      setCreateOpen(false)
      navigate(`/studio/notes/${id}`)
    }
  }

  return (
    <div className="studio-page">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Content</p>
          <h1>写作台</h1>
          <p>
            {isOwner
              ? '草稿与公开章节都在这里。读者只会看到最近一次发布版本。'
              : '这里只展示你获得授权编辑的文章，其他内容不可见。'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="studio-secondary-button">
            <Upload size={18} />
            导入 Markdown
          </button>
          {isOwner && (
            <button
              type="button"
              className="studio-primary-button"
              onClick={() => setCreateOpen(true)}
              disabled={!newCategoryId}
            >
              <FilePlus2 size={19} />
              新建章节
            </button>
          )}
        </div>
      </header>

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建章节"
        description="确认后会创建一篇无标题章节草稿，并立即进入编辑器。"
      >
        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault()
            create()
          }}
        >
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
              disabled={!newCategoryId}
            >
              <FilePlus2 size={18} />
              创建草稿
            </button>
          </div>
        </form>
      </Dialog>

      <div className="studio-stats">
        <div>
          <span>全部章节</span>
          <strong>{accessibleNotes.length}</strong>
        </div>
        <div>
          <span>公开</span>
          <strong>
            {
              accessibleNotes.filter(
                (note) =>
                  note.publicationState === 'published',
              ).length
            }
          </strong>
        </div>
        <div>
          <span>草稿</span>
          <strong>
            {
              accessibleNotes.filter(
                (note) =>
                  note.publicationState !== 'published',
              ).length
            }
          </strong>
        </div>
        <div data-visual-dynamic>
          <span>最近整理</span>
          <strong className="!font-sans !text-sm">
            {accessibleNotes.length
              ? formatRelativeTime(
                  accessibleNotes
                    .slice()
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
                    .updatedAt,
                )
              : '—'}
          </strong>
        </div>
      </div>

      <div className="studio-toolbar">
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
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <StudioSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: '全部分类' },
              ...orderedCategories.map((category) => ({
                value: category.id,
                label: category.title,
              })),
            ]}
            ariaLabel="按分类筛选"
          />
          <label className="studio-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索章节"
            />
          </label>
        </div>
      </div>

      <div className="studio-note-table">
        <div className="studio-table-head">
          <span>章节</span>
          <span>分类</span>
          <span>状态</span>
          <span>最后保存</span>
        </div>
        {visible.map((note) => {
          const category = categories.find(
            (item) => item.id === note.categoryId,
          )
          const pendingUpdate =
            note.publicationState === 'published' &&
            hasUnpublishedChanges(note)
          return (
            <Link
              key={note.id}
              to={`/studio/notes/${note.id}`}
              className="studio-table-row"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <FileText
                    size={18}
                    className="shrink-0 text-[var(--muted-faint)]"
                  />
                  <span className="truncate text-[16px] font-medium text-[var(--ink)]">
                    {note.title}
                  </span>
                </span>
                <span className="mt-1 block truncate pl-6 text-[13px] text-[var(--muted)]">
                  {note.plainText || '还没有正文内容'}
                </span>
              </span>
              <span className="truncate text-[14px] text-[var(--muted)]">
                {category?.title}
              </span>
              <span>
                <span
                  className={`studio-status ${
                    note.publicationState === 'published' ? 'is-public' : ''
                  }`}
                >
                  {pendingUpdate
                    ? '待更新'
                    : note.publicationState === 'published'
                      ? '已发布'
                      : note.publicationState === 'unpublished'
                        ? '已撤回'
                        : '草稿'}
                </span>
              </span>
              <span
                className="text-[13px] text-[var(--muted-faint)]"
                data-visual-dynamic
              >
                {formatRelativeTime(note.updatedAt)}
              </span>
            </Link>
          )
        })}
        {!visible.length && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="font-display text-xl text-[var(--ink)]">
              没有匹配的章节
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {isOwner
                ? '换一个筛选条件，或者新建章节。'
                : '当前账号还没有匹配的授权文章。'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
