import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'
import { InvitationActivationForm } from '@/components/invitation-activation-form'
import { formatDateTime } from '@/lib/format-time'
import { getInvitationActivationPreview } from '@/server/collaboration'

export const dynamic = 'force-dynamic'

const statusMessages = {
  activated: '此邀请已经激活，请直接登录。',
  expired: '此邀请已过期，请联系站主重新邀请。',
  revoked: '此邀请已撤销，请联系站主。',
} as const

export default async function InvitationActivationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await getInvitationActivationPreview(token)

  if (!invite) {
    return (
      <InviteState
        title="邀请链接不存在"
        description="请向站主确认链接是否完整，或者重新生成邀请。"
      />
    )
  }

  if (invite.status !== 'pending') {
    return (
      <InviteState
        title={
          invite.status === 'activated'
            ? '这个邀请已经激活'
            : invite.status === 'expired'
              ? '邀请链接已过期'
              : '邀请已经被撤销'
        }
        description={statusMessages[invite.status]}
      />
    )
  }

  return (
    <main className="invite-accept-page">
      <div className="invite-accept-card">
        <Link href="/" className="invite-back-link">
          <ArrowLeft size={18} />
          返回知笺
        </Link>
        <p className="section-kicker mt-8">Collaboration invitation</p>
        <h1>接受协作邀请</h1>
        <p className="invite-accept-intro">
          输入邮箱并完成验证码验证，即可进入写作台。你只会看到下面这些被授权的文章。
        </p>
        {invite.email ? (
          <div className="invite-account-email">
            <Mail size={19} />
            <span>邀请已绑定：{invite.email}</span>
          </div>
        ) : null}
        <div className="invite-scope-list">
          <p>可编辑文章</p>
          {invite.articleTitles.map((title) => (
            <span key={title}>{title}</span>
          ))}
        </div>
        <InvitationActivationForm
          token={token}
          initialEmail={invite.email ?? ''}
          initialDisplayName={invite.displayName ?? ''}
          expiresAt={formatDateTime(invite.expiresAt.toISOString())}
        />
      </div>
    </main>
  )
}

function InviteState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <main className="invite-accept-page">
      <div className="invite-state-card">
        <p className="section-kicker">Collaboration invitation</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link href="/studio/login" className="invite-state-action">
          前往登录
        </Link>
      </div>
    </main>
  )
}
