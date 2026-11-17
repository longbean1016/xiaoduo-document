'use client'

import {
  LoaderCircle,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { isValidQQMailboxEmail } from '@/lib/qq-email'

const errors: Record<string, string> = {
  ACCOUNT_SUSPENDED: '此账号已停用，请联系站主。',
  EMAIL_NOT_CONFIGURED: '邮件服务暂未配置，请联系站主。',
  INVALID_ACTIVATION: '请填写有效的邮箱、昵称和 6 位验证码。',
  INVALID_OTP: '验证码无效或已过期，请重新获取。',
  INVALID_QQ_EMAIL:
    '请输入有效的 QQ 邮箱、Foxmail 邮箱或 QQ VIP 邮箱。',
  INVITE_EXPIRED: '此邀请已过期，请联系站主重新邀请。',
  INVITE_NOT_FOUND: '邀请链接无效。',
  INVITE_NOT_PENDING: '此邀请已经激活或失效，请返回登录。',
  OTP_COOLDOWN: '请稍后再重新发送验证码。',
  OTP_EMAIL_DAILY_LIMIT: '该邮箱今天发送次数过多，请明天再试。',
  OTP_EMAIL_HOURLY_LIMIT: '该邮箱发送过于频繁，请稍后再试。',
  OTP_IP_HOURLY_LIMIT: '当前网络发送过于频繁，请稍后再试。',
  OTP_SEND_FAILED: '验证码发送失败，请稍后重试。',
  OWNER_ACCOUNT: '站主账号不能通过邀请激活。',
}

export function InvitationActivationForm({
  token,
  initialEmail,
  initialDisplayName,
  expiresAt,
}: {
  token: string
  initialEmail: string
  initialDisplayName: string
  expiresAt: string
}) {
  const router = useRouter()
  const [email, setEmail] = useState(initialEmail)
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [codeSent, setCodeSent] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [sendPending, setSendPending] = useState(false)
  const [verifyPending, setVerifyPending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => {
      setCooldown((current) => Math.max(0, current - 1))
    }, 1_000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function sendCode() {
    setError('')
    setNotice('')
    if (!isValidQQMailboxEmail(email)) {
      setError(errors.INVALID_QQ_EMAIL)
      return
    }

    setSendPending(true)
    try {
      const response = await fetch(
        '/api/collaboration/invites/request-otp',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, email }),
        },
      )
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(
          errors[payload.error ?? ''] ?? '验证码发送失败，请稍后重试。',
        )
        return
      }
      setCodeSent(true)
      setCooldown(60)
      setNotice('验证码已发送，10 分钟内有效。')
    } catch {
      setError('验证码发送失败，请稍后重试。')
    } finally {
      setSendPending(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!isValidQQMailboxEmail(email)) {
      setError(errors.INVALID_QQ_EMAIL)
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setError('请输入 6 位验证码。')
      return
    }

    setVerifyPending(true)
    try {
      const response = await fetch(
        '/api/collaboration/invites/verify-otp',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            token,
            email,
            name: displayName,
            otp,
          }),
        },
      )
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(
          errors[payload.error ?? ''] ??
            '验证码无效或已过期，请重新获取。',
        )
        return
      }
      router.replace('/studio')
      router.refresh()
    } catch {
      setError('激活失败，请稍后重试。')
    } finally {
      setVerifyPending(false)
    }
  }

  const sendLabel =
    cooldown > 0
      ? `重新发送（${cooldown}s）`
      : codeSent
        ? '重新发送验证码'
        : '发送验证码'

  return (
    <form className="invite-activation-form" onSubmit={submit}>
      <label className="invite-field">
        <span>邮箱</span>
        <div className="invite-input-wrap">
          <Mail size={19} />
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={255}
            value={email}
            aria-invalid={
              error === errors.INVALID_QQ_EMAIL || undefined
            }
            onBlur={() => {
              if (email && !isValidQQMailboxEmail(email)) {
                setError(errors.INVALID_QQ_EMAIL)
              }
            }}
            onChange={(event) => {
              setEmail(event.target.value)
              setCodeSent(false)
              setNotice('')
              if (error === errors.INVALID_QQ_EMAIL) setError('')
            }}
            placeholder="name@qq.com"
            required
          />
        </div>
      </label>
      <label className="invite-field">
        <span>昵称</span>
        <div className="invite-input-wrap">
          <UserRound size={19} />
          <input
            name="displayName"
            autoComplete="nickname"
            maxLength={120}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="写作台显示的昵称"
            required
          />
        </div>
      </label>
      <div className="invite-field">
        <label htmlFor="invite-activation-otp">验证码</label>
        <div className="invite-code-row">
          <div className="invite-input-wrap">
            <ShieldCheck size={19} />
            <input
              id="invite-activation-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, ''))
              }
              placeholder="6 位数字"
              required
            />
          </div>
          <button
            type="button"
            className="invite-code-action"
            disabled={sendPending || cooldown > 0}
            onClick={sendCode}
          >
            {sendPending ? (
              <LoaderCircle className="animate-spin" size={17} />
            ) : null}
            {sendPending ? '正在发送…' : sendLabel}
          </button>
        </div>
      </div>
      <p className="invite-expiry">邀请将在 {expiresAt} 过期。</p>
      {notice ? (
        <p role="status" className="invite-form-notice">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="invite-form-error">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="invite-submit-button"
        disabled={verifyPending}
      >
        {verifyPending ? (
          <LoaderCircle className="animate-spin" size={19} />
        ) : null}
        {verifyPending ? '正在验证…' : '激活并进入写作台'}
      </button>
    </form>
  )
}
