'use client'

import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Eye, RotateCcw, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { parseDatabaseDateTime } from '@/lib/database-time'
import { countWords } from '@/lib/markdown-headings'
import { cn } from '@/lib/utils'

export interface VersionItem {
  id: string
  kind: 'manual' | 'published'
  label: string | null
  title: string
  authorName: string
  authorRole: 'owner' | 'collaborator'
  authorId?: string
  createdAt: string
  markdown: string
  plainText?: string
}

function formatVersionDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(parseDatabaseDateTime(value))
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(parseDatabaseDateTime(value))
}

export function VersionHistory({
  articleId,
  versions,
  draft,
  actorId,
  actorRole,
  onCompare,
}: {
  articleId: string
  versions: VersionItem[]
  draft: {
    title: string
    wordCount: number
    savedAt: string
  }
  actorId: string
  actorRole: 'owner' | 'collaborator'
  onCompare?: (version: VersionItem, previous: VersionItem) => void
}) {
  const router = useRouter()
  const [restoreTarget, setRestoreTarget] = useState<VersionItem | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<VersionItem | null>(
    null,
  )
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  async function restore() {
    if (!restoreTarget) return
    setPending(true)
    setMessage('')
    const response = await fetch(
      `/api/studio/articles/${articleId}/versions/${restoreTarget.id}/restore`,
      { method: 'POST' },
    )
    setPending(false)
    if (!response.ok) {
      setMessage('恢复版本失败。')
      return
    }
    setRestoreTarget(null)
    window.location.reload()
  }

  async function deleteVersion(version: VersionItem) {
    setPending(true)
    setMessage('')
    const response = await fetch(
      `/api/studio/articles/${articleId}/versions/${version.id}`,
      { method: 'DELETE' },
    )
    setPending(false)
    setDeleteTarget(null)
    if (!response.ok) {
      setMessage('删除版本失败。')
      return
    }
    router.refresh()
  }

  return (
    <div className="studio-version-history">
      <section className="studio-current-draft-card">
        <span className="studio-history-kind">当前草稿</span>
        <strong>{draft.title || '无标题章节'}</strong>
        <p data-visual-dynamic>
          最后保存于 {formatClock(draft.savedAt)} · {draft.wordCount} 字
        </p>
      </section>

      <ol className="studio-version-list" aria-label="共享版本日志">
        {versions.map((version, index) => {
          const previous =
            versions[index + 1] ?? versions[index - 1] ?? null
          return (
            <li
              key={version.id}
              className={cn(
                'studio-version-row',
                version.kind === 'published' ? 'is-published' : 'is-manual',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'studio-history-kind',
                      version.kind === 'published' && 'is-published',
                    )}
                  >
                    {version.kind === 'published' ? '发布版本' : '手动版本'}
                  </span>
                  <span className="studio-version-author">
                    <strong>{version.authorName}</strong>
                    <small
                      className={
                        version.authorRole === 'owner'
                          ? 'is-owner'
                          : 'is-collaborator'
                      }
                    >
                      {version.authorRole === 'owner' ? '站主' : '协作者'}
                    </small>
                  </span>
                  <time dateTime={version.createdAt}>
                    {formatVersionDate(version.createdAt)}
                  </time>
                </div>
                <strong className="mt-1.5 block truncate">
                  {version.label || version.title}
                </strong>
                <p className="mt-1 text-[11px] text-[var(--muted-faint)]">
                  {countWords(version.plainText ?? version.markdown)} 字 ·{' '}
                  {version.title}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {previous && onCompare ? (
                  <button
                    type="button"
                    className="studio-icon-button"
                    onClick={() => onCompare(version, previous)}
                    title="查看与上一版本的变化"
                    aria-label={`与 ${version.label || version.title} 对比上一版本`}
                  >
                    <Eye size={18} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="studio-icon-button"
                  onClick={() => setRestoreTarget(version)}
                  title="恢复到当前草稿"
                  aria-label={`恢复 ${version.label || version.title} 为当前草稿`}
                >
                  <RotateCcw size={18} />
                </button>
                {version.kind === 'manual' &&
                (actorRole === 'owner' || version.authorId === actorId) ? (
                  <button
                    type="button"
                    className="studio-icon-button hover:!text-[var(--rust)]"
                    disabled={pending}
                    onClick={() => setDeleteTarget(version)}
                    title="删除手动版本"
                    aria-label={`删除 ${version.label || version.title}`}
                  >
                    <Trash2 size={18} />
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {!versions.length ? (
        <p className="studio-version-empty">
          还没有历史版本。可以手动保存一个版本，或在发布时自动生成。
        </p>
      ) : null}
      {message ? (
        <p role="alert" className="studio-version-error">
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="删除这个手动版本？"
        description={
          deleteTarget
            ? `版本“${deleteTarget.label || deleteTarget.title}”及其快照将被永久删除，这个操作无法撤销。`
            : ''
        }
        confirmLabel="删除版本"
        pending={pending}
        onConfirm={() => {
          if (deleteTarget) void deleteVersion(deleteTarget)
        }}
      />

      <AlertDialog.Root
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null)
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay fixed inset-0 z-[90] bg-[#0d120f]/55 backdrop-blur-[2px]" />
          <AlertDialog.Content className="dialog-content fixed left-1/2 top-1/2 z-[91] w-[min(92vw,430px)] -translate-x-1/2 -translate-y-1/2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-2xl">
            <AlertDialog.Title className="font-display text-xl text-[var(--ink)]">
              恢复这个版本？
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs leading-6 text-[var(--muted)]">
              当前草稿会被这个版本覆盖，并回到可继续编辑的草稿状态。恢复不会直接改变线上页面。
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button type="button" className="studio-secondary-button">
                  取消
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className="studio-primary-button"
                  disabled={pending}
                  onClick={() => void restore()}
                >
                  恢复为草稿
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}
