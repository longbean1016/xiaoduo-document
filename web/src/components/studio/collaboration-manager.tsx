'use client'

import {
  Ban,
  Copy,
  ExternalLink,
  MailPlus,
  RotateCcw,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog } from '@/components/ui/dialog'
import {
  formatDateTime,
} from '@/lib/format-time'
import { cn } from '@/lib/utils'

type Section = 'invitations' | 'collaborators'

interface Invite {
  id: string
  email: string | null
  displayName: string | null
  articleIds: string[]
  source: 'application' | 'direct'
  status: 'pending' | 'activated' | 'expired' | 'revoked'
  expiresAt: string | Date
  createdAt: string | Date
  token?: string
}

interface Article {
  id: string
  title: string
  categoryTitle: string
}

interface Collaborator {
  id: string
  name: string
  email: string
  status: 'active' | 'suspended'
}

interface ArticleGrant {
  userId: string
  userName: string
  articleId: string
  articleTitle: string
}

function inviteUrl(token: string): string {
  return `${window.location.origin}/collaborate/accept/${token}`
}

export function CollaborationManager({
  invites,
  articles,
  collaborators,
  grants,
}: {
  invites: Invite[]
  articles: Article[]
  collaborators: Collaborator[]
  grants: ArticleGrant[]
}) {
  const router = useRouter()
  const [section, setSection] = useState<Section>('invitations')
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([])
  const [generatedInviteLink, setGeneratedInviteLink] = useState('')
  const [editingCollaborator, setEditingCollaborator] =
    useState<Collaborator | null>(null)
  const [editArticleIds, setEditArticleIds] = useState<string[]>([])
  const [inviteRevokeTarget, setInviteRevokeTarget] =
    useState<Invite | null>(null)
  const [grantRemovalTarget, setGrantRemovalTarget] = useState<{
    collaborator: Collaborator
    proposedArticleIds: string[]
    existingArticleIds: string[]
    removedArticleIds: string[]
  } | null>(null)
  const [message, setMessage] = useState('')

  async function copy(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(success)
    } catch {
      setMessage('浏览器没有复制权限，请手动复制链接')
    }
  }

  async function createInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedArticleIds.length) {
      setMessage('请至少选择一篇文章')
      return
    }
    const response = await fetch('/api/studio/collaboration/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        articleIds: selectedArticleIds,
      }),
    })
    const payload = (await response.json()) as {
      invite?: { token: string }
    }
    if (payload.invite?.token) {
      setGeneratedInviteLink(inviteUrl(payload.invite.token))
    }
    setMessage(response.ok ? '邀请已生成' : '邀请生成失败')
    if (response.ok) {
      setSelectedArticleIds([])
    }
    router.refresh()
  }

  async function revokeInvite(invite: Invite) {
    const response = await fetch(
      `/api/studio/collaboration/invites/${invite.id}/revoke`,
      { method: 'POST' },
    )
    setInviteRevokeTarget(null)
    setMessage(response.ok ? '邀请已撤销' : '撤销邀请失败')
    router.refresh()
  }

  async function updateStatus(
    userId: string,
    status: 'active' | 'suspended',
  ) {
    const response = await fetch(
      `/api/studio/collaboration/collaborators/${userId}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    )
    setMessage(
      response.ok
        ? status === 'suspended'
          ? '账号已暂停'
          : '账号已恢复'
        : '账号状态更新失败',
    )
    router.refresh()
  }

  function openGrantEditor(collaborator: Collaborator) {
    setEditingCollaborator(collaborator)
    setEditArticleIds(
      grants
        .filter((grant) => grant.userId === collaborator.id)
        .map((grant) => grant.articleId),
    )
  }

  async function applyGrants(
    collaborator: Collaborator,
    articleIds: string[],
    existingArticleIds: string[],
  ) {
    const added = articleIds.filter(
      (id) => !existingArticleIds.includes(id),
    )
    const removed = existingArticleIds.filter(
      (id) => !articleIds.includes(id),
    )
    for (const articleId of added) {
      await fetch('/api/studio/collaboration/grants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: collaborator.id,
          articleId,
        }),
      })
    }
    for (const articleId of removed) {
      await fetch('/api/studio/collaboration/grants', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: collaborator.id,
          articleId,
        }),
      })
    }
    setGrantRemovalTarget(null)
    setEditingCollaborator(null)
    setMessage('文章授权已更新')
    router.refresh()
  }

  async function saveGrants() {
    if (!editingCollaborator) return
    const existingArticleIds = grants
      .filter((grant) => grant.userId === editingCollaborator.id)
      .map((grant) => grant.articleId)
    const removedArticleIds = existingArticleIds.filter(
      (id) => !editArticleIds.includes(id),
    )
    if (removedArticleIds.length) {
      setGrantRemovalTarget({
        collaborator: editingCollaborator,
        proposedArticleIds: editArticleIds,
        existingArticleIds,
        removedArticleIds,
      })
      return
    }
    await applyGrants(
      editingCollaborator,
      editArticleIds,
      existingArticleIds,
    )
  }

  return (
    <div className="studio-page max-w-[1120px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Collaboration</p>
          <h1>协作管理</h1>
          <p>
            主动生成一次性邀请链接并发送给协作者。协作者只能编辑被明确授权的文章。
          </p>
        </div>
        <div className="collaboration-header-counts">
          <span>
            {
              collaborators.filter(
                (collaborator) => collaborator.status === 'active',
              ).length
            }{' '}
            名协作者
          </span>
        </div>
      </header>

      {message ? (
        <p className="collaboration-feedback" role="status">
          {message}
        </p>
      ) : null}
      {generatedInviteLink ? (
        <label className="collaboration-generated-link">
          <span>邀请链接</span>
          <input
            readOnly
            value={generatedInviteLink}
            aria-label="邀请链接"
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="studio-icon-button"
            aria-label="复制邀请链接"
            onClick={() => void copy(generatedInviteLink, '邀请链接已复制')}
          >
            <Copy size={18} />
          </button>
        </label>
      ) : null}
      <div className="collaboration-tabs" role="tablist" aria-label="协作管理">
        {(
          [
            ['invitations', '邀请记录', MailPlus],
            ['collaborators', '协作者', Users],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={section === value}
            className={section === value ? 'is-active' : ''}
            onClick={() => setSection(value)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {section === 'invitations' ? (
        <>
          <section className="collaboration-section">
            <div className="collaboration-section-heading">
              <div>
                <h2>主动邀请</h2>
                <p>只选择文章授权，生成一次性链接后由你主动发送。</p>
              </div>
            </div>
            <form className="collaboration-invite-form" onSubmit={createInvite}>
              <ArticlePicker
                articles={articles}
                selected={selectedArticleIds}
                onChange={setSelectedArticleIds}
                title="选择可编辑文章"
              />
              <button type="submit" className="studio-primary-button">
                <MailPlus size={18} />
                生成邀请链接
              </button>
            </form>
          </section>
          <section className="collaboration-section">
            <div className="collaboration-section-heading">
              <div>
                <h2>邀请记录</h2>
                <p>已经激活的邀请不会因链接过期而影响账号登录。</p>
              </div>
            </div>
            <div className="collaboration-list">
              {invites.map((invite) => (
                <article key={invite.id} className="collaboration-invite-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{invite.email ?? '未绑定邮箱'}</strong>
                      <span className="studio-status">
                        {invite.status === 'pending'
                          ? '待激活'
                          : invite.status === 'activated'
                            ? '已激活'
                            : invite.status === 'revoked'
                              ? '已撤销'
                              : '已过期'}
                      </span>
                    </div>
                    <p>
                      {invite.articleIds.length} 篇文章 ·{' '}
                      {formatDateTime(
                        invite.expiresAt instanceof Date
                          ? invite.expiresAt.toISOString()
                          : invite.expiresAt,
                      )}{' '}
                      过期
                    </p>
                  </div>
                  {invite.status === 'pending' ? (
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/collaborate/accept/${invite.token ?? ''}`}
                        className={cn(
                          'studio-secondary-button',
                          !invite.token && 'pointer-events-none opacity-40',
                        )}
                        aria-disabled={!invite.token}
                      >
                        打开
                        <ExternalLink size={16} />
                      </Link>
                      <button
                        type="button"
                        className="studio-icon-button hover:!text-[var(--rust)]"
                        onClick={() => setInviteRevokeTarget(invite)}
                        aria-label="撤销邀请"
                      >
                        <Ban size={18} />
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
              {!invites.length ? (
                <CollaborationEmpty
                  title="还没有邀请记录"
                  description="生成邀请链接后，记录会出现在这里。"
                />
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      {section === 'collaborators' ? (
        <section className="collaboration-section">
          <div className="collaboration-section-heading">
            <div>
              <h2>协作者</h2>
              <p>授权变更即时生效。停用后账号仍保留，但无法继续登录写作台。</p>
            </div>
          </div>
          <div className="collaboration-list">
            {collaborators.map((collaborator) => {
              const count = grants.filter(
                (grant) => grant.userId === collaborator.id,
              ).length
              return (
                <article key={collaborator.id} className="collaborator-row">
                  <span className="collaborator-avatar">
                    {collaborator.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <strong>{collaborator.name}</strong>
                      <span
                        className={cn(
                          'studio-status',
                          collaborator.status === 'active' && 'is-public',
                        )}
                      >
                        {collaborator.status === 'active' ? '正常' : '已停用'}
                      </span>
                    </div>
                    <p>
                      {collaborator.email} · {count} 篇授权文章
                    </p>
                  </div>
                  <button
                    type="button"
                    className="studio-secondary-button"
                    onClick={() => openGrantEditor(collaborator)}
                  >
                    管理授权
                  </button>
                  <button
                    type="button"
                    className="studio-icon-button"
                    onClick={() =>
                      void updateStatus(
                        collaborator.id,
                        collaborator.status === 'active'
                          ? 'suspended'
                          : 'active',
                      )
                    }
                    aria-label={`${collaborator.status === 'active' ? '暂停' : '恢复'}账号 ${collaborator.name}`}
                    title={
                      collaborator.status === 'active'
                        ? '停用账号'
                        : '恢复账号'
                    }
                  >
                    {collaborator.status === 'active' ? (
                      <Ban size={19} />
                    ) : (
                      <RotateCcw size={19} />
                    )}
                  </button>
                </article>
              )
            })}
            {!collaborators.length ? (
              <CollaborationEmpty
                title="还没有协作者"
                description="邀请被激活后会出现在这里。"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <Dialog
        open={Boolean(editingCollaborator)}
        onOpenChange={(open) => {
          if (!open) setEditingCollaborator(null)
        }}
        title="管理文章授权"
        description={
          editingCollaborator
            ? `${editingCollaborator.name} 只会看到下面被勾选的文章。`
            : undefined
        }
      >
        <div className="p-4">
          <ArticlePicker
            articles={articles}
            selected={editArticleIds}
            onChange={setEditArticleIds}
            title="可编辑文章"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => setEditingCollaborator(null)}
            >
              取消
            </button>
            <button
              type="button"
              className="studio-primary-button"
              onClick={() => void saveGrants()}
            >
              <UserRoundCheck size={18} />
              保存授权
            </button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(grantRemovalTarget)}
        onOpenChange={(open) => {
          if (!open && grantRemovalTarget) {
            setEditArticleIds(grantRemovalTarget.existingArticleIds)
            setGrantRemovalTarget(null)
          }
        }}
        title="撤销文章授权？"
        description={
          grantRemovalTarget
            ? `${grantRemovalTarget.collaborator.name} 将失去这些章节的编辑权限：${grantRemovalTarget.removedArticleIds
                .map(
                  (articleId) =>
                    articles.find((article) => article.id === articleId)
                      ?.title ?? articleId,
                )
                .join('、')}。`
            : ''
        }
        confirmLabel="撤销授权"
        onConfirm={() => {
          if (grantRemovalTarget) {
            void applyGrants(
              grantRemovalTarget.collaborator,
              grantRemovalTarget.proposedArticleIds,
              grantRemovalTarget.existingArticleIds,
            )
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(inviteRevokeTarget)}
        onOpenChange={(open) => {
          if (!open) setInviteRevokeTarget(null)
        }}
        title="撤销这个邀请？"
        description={
          inviteRevokeTarget
            ? `发给 ${inviteRevokeTarget.email} 的一次性邀请链接会立即失效。`
            : ''
        }
        confirmLabel="撤销邀请"
        onConfirm={() => {
          if (inviteRevokeTarget) void revokeInvite(inviteRevokeTarget)
        }}
      />
    </div>
  )
}

function ArticlePicker({
  articles,
  selected,
  onChange,
  title,
}: {
  articles: Article[]
  selected: string[]
  onChange: (ids: string[]) => void
  title: string
}) {
  return (
    <div className="collaboration-article-picker">
      <p>{title}</p>
      {articles.map((article) => (
        <label key={article.id}>
          <input
            type="checkbox"
            aria-label={`授权文章 ${article.title}`}
            checked={selected.includes(article.id)}
            onChange={() =>
              onChange(
                selected.includes(article.id)
                  ? selected.filter((id) => id !== article.id)
                  : [...selected, article.id],
              )
            }
          />
          <span>{article.title}</span>
          <small>{article.categoryTitle}</small>
        </label>
      ))}
    </div>
  )
}

function CollaborationEmpty({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="collaboration-empty">
      <Users size={24} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}
