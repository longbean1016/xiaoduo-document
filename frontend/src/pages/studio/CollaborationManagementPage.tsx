import { useMemo, useState } from 'react'
import {
  Ban,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  MailPlus,
  RotateCcw,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog } from '../../components/ui/Dialog'
import { AuthorAvatar } from '../../components/AuthorAvatar'
import { formatDateTime, formatRelativeTime } from '../../lib/text'
import { usePageTitle } from '../../lib/usePageTitle'
import { cn } from '../../lib/utils'
import { useSiteStore } from '../../store/siteStore'
import type { CollaborationInvite, Collaborator } from '../../types'

type Section = 'applications' | 'invitations' | 'collaborators'

function inviteUrl(token: string) {
  return `${window.location.origin}/collaborate/accept/${token}`
}

export function CollaborationManagementPage() {
  usePageTitle('协作管理 · 知笺')
  const applications = useSiteStore((state) => state.collaborationApplications)
  const invites = useSiteStore((state) => state.collaborationInvites)
  const collaborators = useSiteStore((state) => state.collaborators)
  const notes = useSiteStore((state) => state.notes)
  const categories = useSiteStore((state) => state.categories)
  const reviewApplication = useSiteStore(
    (state) => state.reviewCollaborationApplication,
  )
  const createInvite = useSiteStore(
    (state) => state.createCollaborationInvite,
  )
  const revokeInvite = useSiteStore(
    (state) => state.revokeCollaborationInvite,
  )
  const updateGrants = useSiteStore(
    (state) => state.updateCollaboratorGrants,
  )
  const setCollaboratorStatus = useSiteStore(
    (state) => state.setCollaboratorStatus,
  )
  const [section, setSection] = useState<Section>('applications')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])
  const [editingCollaborator, setEditingCollaborator] =
    useState<Collaborator | null>(null)
  const [editNoteIds, setEditNoteIds] = useState<string[]>([])
  const [now] = useState(() => Date.now())
  const activeNotes = useMemo(
    () =>
      notes
        .filter((note) => !note.trashedAt)
        .sort((a, b) => {
          const categoryA = categories.find(
            (category) => category.id === a.categoryId,
          )
          const categoryB = categories.find(
            (category) => category.id === b.categoryId,
          )
          return (
            (categoryA?.order ?? 0) - (categoryB?.order ?? 0) ||
            a.title.localeCompare(b.title, 'zh-CN')
          )
        }),
    [categories, notes],
  )
  const pendingApplications = applications.filter(
    (application) => application.status === 'pending',
  )

  const copyInvite = async (invite: CollaborationInvite) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.token))
      toast.success('邀请链接已复制')
    } catch {
      toast.error('浏览器没有复制权限，请手动打开邀请记录')
    }
  }

  const toggleSelectedNote = (noteId: string) => {
    setSelectedNoteIds((current) =>
      current.includes(noteId)
        ? current.filter((id) => id !== noteId)
        : [...current, noteId],
    )
  }

  const createDirectInvite = () => {
    const inviteId = createInvite({
      email: inviteEmail,
      displayName: inviteName,
      noteIds: selectedNoteIds,
      source: 'direct',
    })
    if (!inviteId) {
      toast.error('请填写有效邮箱并至少选择一篇文章')
      return
    }
    const invite = useSiteStore
      .getState()
      .collaborationInvites.find((item) => item.id === inviteId)
    if (invite) void copyInvite(invite)
    setInviteEmail('')
    setInviteName('')
    setSelectedNoteIds([])
    setSection('invitations')
    toast.success('邀请已生成')
  }

  const approve = (applicationId: string) => {
    const inviteId = reviewApplication(applicationId, 'approved')
    if (!inviteId) return
    const invite = useSiteStore
      .getState()
      .collaborationInvites.find((item) => item.id === inviteId)
    if (invite) void copyInvite(invite)
    setSection('invitations')
    toast.success('申请已通过，邀请链接已复制')
  }

  const reject = (applicationId: string) => {
    reviewApplication(applicationId, 'rejected')
    toast.success('申请已拒绝')
  }

  const openGrantEditor = (collaborator: Collaborator) => {
    setEditingCollaborator(collaborator)
    setEditNoteIds(collaborator.noteIds)
  }

  return (
    <div className="studio-page max-w-[1120px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Collaboration</p>
          <h1>协作管理</h1>
          <p>
            申请和主动邀请都通过一次性链接激活账号。协作者只能编辑被明确授权的文章。
          </p>
        </div>
        <div className="collaboration-header-counts">
          <span>{pendingApplications.length} 个待审核申请</span>
          <span>{collaborators.filter((item) => item.status === 'active').length} 名协作者</span>
        </div>
      </header>

      <div className="collaboration-tabs">
        {(
          [
            ['applications', '申请审核', ClipboardCheck],
            ['invitations', '邀请记录', MailPlus],
            ['collaborators', '协作者', Users],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            className={section === value ? 'is-active' : ''}
            onClick={() => setSection(value)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {section === 'applications' && (
        <section className="collaboration-section">
          <div className="collaboration-section-heading">
            <div>
              <h2>待审核申请</h2>
              <p>申请只关联发起时所在的文章，通过后不会获得其他文章权限。</p>
            </div>
          </div>
          <div className="collaboration-list">
            {applications.map((application) => {
              const note = notes.find((item) => item.id === application.noteId)
              return (
                <article
                  key={application.id}
                  className="collaboration-application-row"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{application.name}</strong>
                      <span className={cn('studio-status', application.status === 'pending' && 'is-public')}>
                        {application.status === 'pending'
                          ? '待审核'
                          : application.status === 'approved'
                            ? '已通过'
                            : '已拒绝'}
                      </span>
                      <time>{formatRelativeTime(application.createdAt)}</time>
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--muted)]">
                      {application.email} · 申请编辑「{note?.title ?? '文章已删除'}」
                    </p>
                    <p className="collaboration-application-note">
                      {application.note || '没有填写申请说明'}
                    </p>
                  </div>
                  {application.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="studio-secondary-button"
                        onClick={() => reject(application.id)}
                      >
                        <X size={17} />
                        拒绝
                      </button>
                      <button
                        type="button"
                        className="studio-primary-button"
                        onClick={() => approve(application.id)}
                      >
                        <Check size={17} />
                        通过
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
            {!applications.length && (
              <CollaborationEmpty
                title="还没有协作申请"
                description="读者会在公开文章底部看到申请入口。"
              />
            )}
          </div>
        </section>
      )}

      {section === 'invitations' && (
        <>
          <section className="collaboration-section">
            <div className="collaboration-section-heading">
              <div>
                <h2>主动邀请</h2>
                <p>填写邮箱并勾选文章，生成链接后由你手动发送。</p>
              </div>
            </div>
            <div className="collaboration-invite-form">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span>邮箱</span>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="name@example.com"
                  />
                </label>
                <label>
                  <span>昵称预设</span>
                  <input
                    value={inviteName}
                    onChange={(event) => setInviteName(event.target.value)}
                    placeholder="可留空，由对方填写"
                  />
                </label>
              </div>
              <div className="collaboration-article-picker">
                <p>选择可编辑文章</p>
                {activeNotes.map((note) => {
                  const category = categories.find(
                    (item) => item.id === note.categoryId,
                  )
                  return (
                    <label key={note.id}>
                      <input
                        type="checkbox"
                        checked={selectedNoteIds.includes(note.id)}
                        onChange={() => toggleSelectedNote(note.id)}
                      />
                      <span>{note.title}</span>
                      <small>{category?.title}</small>
                    </label>
                  )
                })}
              </div>
              <button
                type="button"
                className="studio-primary-button"
                onClick={createDirectInvite}
              >
                <MailPlus size={18} />
                生成邀请链接
              </button>
            </div>
          </section>

          <section className="collaboration-section">
            <div className="collaboration-section-heading">
              <div>
                <h2>邀请记录</h2>
                <p>已经激活的邀请不会因链接过期而影响账号登录。</p>
              </div>
            </div>
            <div className="collaboration-list">
              {invites.map((invite) => {
                const expired =
                  invite.status === 'pending' &&
                  new Date(invite.expiresAt).getTime() <= now
                const status = expired ? 'expired' : invite.status
                return (
                  <article key={invite.id} className="collaboration-invite-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{invite.email}</strong>
                        <span className="studio-status">
                          {status === 'pending'
                            ? '待激活'
                            : status === 'activated'
                              ? '已激活'
                              : status === 'revoked'
                                ? '已撤销'
                                : '已过期'}
                        </span>
                      </div>
                      <p>
                        {invite.noteIds.length} 篇文章 ·{' '}
                        {formatDateTime(invite.expiresAt)} 过期
                      </p>
                      {status === 'pending' && (
                        <div className="collaboration-invite-link-row">
                          <input
                            readOnly
                            value={inviteUrl(invite.token)}
                            aria-label="邀请链接"
                            onFocus={(event) =>
                              event.currentTarget.select()
                            }
                          />
                          <button
                            type="button"
                            className="studio-icon-button"
                            onClick={() => void copyInvite(invite)}
                            title="复制邀请链接"
                            aria-label="复制邀请链接"
                          >
                            <Copy size={18} />
                          </button>
                          <Link
                            to={`/collaborate/accept/${invite.token}`}
                            className="studio-secondary-button"
                          >
                            打开
                            <ExternalLink size={16} />
                          </Link>
                        </div>
                      )}
                    </div>
                    {status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="studio-icon-button hover:!text-[var(--rust)]"
                          onClick={() => revokeInvite(invite.id)}
                          title="撤销邀请"
                          aria-label="撤销邀请"
                        >
                          <Ban size={18} />
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
              {!invites.length && (
                <CollaborationEmpty
                  title="还没有邀请记录"
                  description="审核申请或主动邀请后，链接会出现在这里。"
                />
              )}
            </div>
          </section>
        </>
      )}

      {section === 'collaborators' && (
        <section className="collaboration-section">
          <div className="collaboration-section-heading">
            <div>
              <h2>协作者</h2>
              <p>授权变更即时生效。停用后账号仍保留，但无法继续登录写作台。</p>
            </div>
          </div>
          <div className="collaboration-list">
            {collaborators.map((collaborator) => (
              <article key={collaborator.id} className="collaborator-row">
                <AuthorAvatar
                  name={collaborator.displayName}
                  avatarUrl={collaborator.avatarUrl}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <strong>{collaborator.displayName}</strong>
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
                    {collaborator.email} · {collaborator.noteIds.length} 篇授权文章
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
                    setCollaboratorStatus(
                      collaborator.id,
                      collaborator.status === 'active' ? 'suspended' : 'active',
                    )
                  }
                  title={
                    collaborator.status === 'active' ? '停用账号' : '恢复账号'
                  }
                  aria-label={
                    collaborator.status === 'active' ? '停用账号' : '恢复账号'
                  }
                >
                  {collaborator.status === 'active' ? (
                    <Ban size={19} />
                  ) : (
                    <RotateCcw size={19} />
                  )}
                </button>
              </article>
            ))}
            {!collaborators.length && (
              <CollaborationEmpty
                title="还没有协作者"
                description="邀请被激活后会出现在这里。"
              />
            )}
          </div>
        </section>
      )}

      <Dialog
        open={Boolean(editingCollaborator)}
        onOpenChange={(open) => {
          if (!open) setEditingCollaborator(null)
        }}
        title="管理文章授权"
        description={
          editingCollaborator
            ? `${editingCollaborator.displayName} 只会看到下面被勾选的文章。`
            : undefined
        }
      >
        <div className="p-4">
          <div className="collaboration-article-picker is-dialog">
            {activeNotes.map((note) => {
              const category = categories.find(
                (item) => item.id === note.categoryId,
              )
              return (
                <label key={note.id}>
                  <input
                    type="checkbox"
                    checked={editNoteIds.includes(note.id)}
                    onChange={() =>
                      setEditNoteIds((current) =>
                        current.includes(note.id)
                          ? current.filter((id) => id !== note.id)
                          : [...current, note.id],
                      )
                    }
                  />
                  <span>{note.title}</span>
                  <small>{category?.title}</small>
                </label>
              )
            })}
          </div>
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
              onClick={() => {
                if (!editingCollaborator) return
                updateGrants(editingCollaborator.id, editNoteIds)
                setEditingCollaborator(null)
                toast.success('文章授权已更新')
              }}
            >
              <UserRoundCheck size={18} />
              保存授权
            </button>
          </div>
        </div>
      </Dialog>
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
