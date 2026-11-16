'use client'

import { CheckSquare2, RotateCcw, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { parseDatabaseDateTime } from '@/lib/database-time'

interface TrashItem {
  id: string
  title: string
  categoryTitle: string
  plainText: string
  trashedAt: string | null
  trashedByName: string | null
}

function relativeTime(value: string | null): string {
  if (!value) return ''
  const diff = Date.now() - parseDatabaseDateTime(value).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return '今天'
  if (days === 1) return '1 天前'
  return `${days} 天前`
}

export function TrashManager({
  initialItems,
  canDelete,
  isOwner,
}: {
  initialItems: TrashItem[]
  canDelete: boolean
  isOwner: boolean
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [now] = useState(() => Date.now())

  const allSelected =
    initialItems.length > 0 && selectedIds.size === initialItems.length

  function resetSelection() {
    setSelectedIds(new Set())
    setSelectionMode(false)
    setDeleteOpen(false)
  }

  function toggleSelectionMode() {
    setSelectionMode((current) => !current)
    setSelectedIds(new Set())
    setMessage('')
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(initialItems.map((item) => item.id)),
    )
  }

  async function restoreSelected() {
    if (!selectedIds.size) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/studio/articles/bulk-restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        restored?: number
        error?: string
      }
      if (!response.ok) {
        setMessage(
          payload.error === 'FORBIDDEN_ARTICLE'
            ? '部分章节已无权恢复，请刷新后重试。'
            : '恢复失败，请重试。',
        )
        return
      }
      setMessage(
        `已恢复 ${payload.restored ?? selectedIds.size} 个章节为未发布草稿。`,
      )
      resetSelection()
      router.refresh()
    } catch {
      setMessage('恢复失败，请重试。')
    } finally {
      setPending(false)
    }
  }

  async function permanentlyDeleteSelected() {
    if (!selectedIds.size) return
    setPending(true)
    setMessage('')
    try {
      const response = await fetch('/api/studio/articles/bulk-delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        deleted?: number
        error?: string
      }
      if (!response.ok) {
        setMessage(
          payload.error === 'INVALID_TRASH_SELECTION'
            ? '部分章节已不在回收站，请刷新后重试。'
            : '永久删除失败，请重试。',
        )
        return
      }
      setMessage(
        `已永久删除 ${payload.deleted ?? selectedIds.size} 个章节。`,
      )
      resetSelection()
      router.refresh()
    } catch {
      setMessage('永久删除失败，请重试。')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="studio-page max-w-[980px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Trash</p>
          <h1>回收站</h1>
          <p>
            {isOwner
              ? '集中选择章节后批量恢复，或永久删除。内容保留 30 天，恢复后需要重新发布。'
              : '集中选择你移入的章节后批量恢复。内容保留 30 天，恢复后需要重新发布。'}
          </p>
        </div>
      </header>

      {message ? (
        <p className="trash-feedback" role="status">
          {message}
        </p>
      ) : null}

      {initialItems.length ? (
        <div className="studio-trash-toolbar">
          <div className="studio-trash-toolbar-main">
            <div className="studio-trash-toolbar-count">
              <strong>{initialItems.length}</strong>
              <span>个章节等待处理</span>
            </div>
            <button
              type="button"
              className={`studio-delete-mode-button${
                selectionMode ? ' is-active' : ''
              }`}
              aria-pressed={selectionMode}
              disabled={pending}
              onClick={toggleSelectionMode}
            >
              {selectionMode ? <X size={16} /> : <CheckSquare2 size={16} />}
              {selectionMode ? '退出选择' : '集中操作'}
            </button>
          </div>

          {selectionMode ? (
            <div className="studio-selection-bar">
              <div className="studio-selection-summary" aria-live="polite">
                <span className="studio-selection-count">
                  {selectedIds.size}
                </span>
                <span>
                  {selectedIds.size
                    ? `已选择 ${selectedIds.size} 个章节`
                    : '请选择要处理的章节'}
                </span>
                <span className="studio-selection-hint">
                  点击章节行或左侧圆框进行选择
                </span>
              </div>
              <div className="studio-selection-actions">
                <button
                  type="button"
                  className="studio-secondary-button"
                  disabled={pending || !initialItems.length}
                  onClick={toggleSelectAll}
                >
                  {allSelected ? '取消全选' : '全选全部'}
                </button>
                <button
                  type="button"
                  className="studio-primary-button"
                  disabled={!selectedIds.size || pending}
                  onClick={() => void restoreSelected()}
                >
                  <RotateCcw size={16} />
                  恢复所选
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    className="studio-danger-button"
                    disabled={!selectedIds.size || pending}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 size={16} />
                    永久删除
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="studio-trash-list">
        {initialItems.map((item) => {
          const daysLeft = Math.max(
            0,
            30 -
              Math.floor(
                (now - parseDatabaseDateTime(item.trashedAt ?? '').getTime()) /
                  86_400_000,
              ),
          )
          const selected = selectedIds.has(item.id)

          return (
            <article
              key={item.id}
              className={[
                'studio-trash-row',
                selectionMode ? 'is-selecting' : '',
                selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={
                selectionMode ? () => toggleSelected(item.id) : undefined
              }
            >
              {selectionMode ? (
                <label
                  className="studio-row-checkbox"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    aria-label={`选择 ${item.title}`}
                    onChange={() => toggleSelected(item.id)}
                  />
                  <span aria-hidden="true" />
                </label>
              ) : null}
              <span className="studio-trash-icon">
                <Trash2 size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <h2>{item.title}</h2>
                <p>
                  {item.categoryTitle} · {item.plainText || '没有正文'}
                </p>
              </div>
              <div className="studio-trash-meta">
                <span>{relativeTime(item.trashedAt)}删除</span>
                {isOwner ? (
                  <span>由 {item.trashedByName ?? '站主'} 移入</span>
                ) : null}
                <span>{daysLeft} 天后永久删除</span>
              </div>
            </article>
          )
        })}

        {!initialItems.length ? (
          <div className="studio-trash-empty">
            <Trash2 size={26} />
            <p>回收站是空的</p>
            <span>移到这里的章节会保留 30 天。</span>
            <span className="sr-only">回收站为空。</span>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={
          selectedIds.size > 1
            ? '永久删除所选章节？'
            : '永久删除这个章节？'
        }
        description={
          selectedIds.size > 1
            ? `所选的 ${selectedIds.size} 个章节及其全部历史版本、原网址都会被删除，这个操作无法撤销。`
            : '章节正文、全部历史版本和原网址都会被删除，这个操作无法撤销。'
        }
        confirmLabel="永久删除"
        pending={pending}
        onConfirm={() => void permanentlyDeleteSelected()}
      />
    </div>
  )
}
