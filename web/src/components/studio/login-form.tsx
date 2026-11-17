'use client'

import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { isValidQQMailboxEmail } from '@/lib/qq-email'

type LoginMode = 'otp' | 'password'

const INVALID_EMAIL_MESSAGE =
  '请输入有效的 QQ 邮箱、Foxmail 邮箱或 QQ VIP 邮箱。'

const otpErrors: Record<string, string> = {
  ACCOUNT_SUSPENDED: '此账号已停用，请联系站主。',
  EMAIL_NOT_CONFIGURED: '邮件服务暂未配置，请联系站主。',
  INVALID_OTP: '验证码无效或已过期，请重新获取。',
  INVALID_QQ_EMAIL: INVALID_EMAIL_MESSAGE,
  OTP_COOLDOWN: '请稍后再重新发送验证码。',
  OTP_EMAIL_DAILY_LIMIT: '该邮箱今天发送次数过多，请明天再试。',
  OTP_EMAIL_HOURLY_LIMIT: '该邮箱发送过于频繁，请稍后再试。',
  OTP_IP_HOURLY_LIMIT: '当前网络发送过于频繁，请稍后再试。',
  STUDIO_ACCOUNT_NOT_FOUND: '该 QQ 邮箱尚未开通站主或协作者账号。',
}

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<LoginMode>('otp')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [codeSent, setCodeSent] = useState(false)
  const [notice, setNotice] = useState('')
  const [emailError, setEmailError] = useState('')
  const [error, setError] = useState('')
  const [sendPending, setSendPending] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => {
      setCooldown((current) => Math.max(0, current - 1))
    }, 1_000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function changeMode(nextMode: LoginMode) {
    setMode(nextMode)
    setError('')
    setEmailError('')
    setNotice('')
    setOtp('')
    setCodeSent(false)
    setCooldown(0)
  }

  function validateEmail() {
    if (isValidQQMailboxEmail(email)) {
      setEmailError('')
      return true
    }
    setEmailError(INVALID_EMAIL_MESSAGE)
    return false
  }

  async function sendCode() {
    setError('')
    setNotice('')
    if (!validateEmail()) return

    setSendPending(true)
    try {
      const response = await fetch('/api/login/request-otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        setError(
          otpErrors[payload.error ?? ''] ?? '验证码发送失败，请稍后重试。',
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (mode === 'otp') {
      if (!validateEmail()) return
      if (!/^\d{6}$/.test(otp)) {
        setError('请输入 6 位验证码。')
        return
      }
    }

    setPending(true)
    try {
      const response = await fetch(
        mode === 'otp'
          ? '/api/login/verify-otp'
          : '/api/auth/sign-in/email',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(
            mode === 'otp'
              ? { email: email.trim(), otp }
              : { email, password },
          ),
        },
      )
      if (!response.ok) {
        if (mode === 'password') {
          setError('邮箱或密码不正确，或账号已停用。')
        } else {
          const payload = (await response.json()) as { error?: string }
          setError(
            otpErrors[payload.error ?? ''] ??
              '验证码无效或已过期，请重新获取。',
          )
        }
        return
      }
      router.replace('/studio')
      router.refresh()
    } catch {
      setError(
        mode === 'otp'
          ? '验证码校验失败，请稍后重试。'
          : '登录失败，请稍后重试。',
      )
    } finally {
      setPending(false)
    }
  }

  const sendLabel =
    cooldown > 0
      ? `重新发送（${cooldown}s）`
      : codeSent
        ? '重新发送验证码'
        : '发送验证码'

  return (
    <main className="studio-login-prototype">
      <div className="studio-login-collage">
        <div className="studio-login-ruled-sheet" aria-hidden="true">
          <span className="studio-login-tape kraft" />
          <span className="studio-login-sheet-rule" />
        </div>
        <div className="studio-login-grid-sheet" aria-hidden="true">
          <span className="studio-login-tape green" />
          <span className="studio-login-grid-caption">
            NO. 08 / XIAODUO DRAFT
          </span>
        </div>

        <aside className="studio-login-memo" aria-hidden="true">
          <span className="studio-login-paperclip" />
          <strong>MEMO</strong>
          <span className="studio-login-memo-accent" />
          <span className="studio-login-memo-line" />
          <span className="studio-login-memo-line short" />
        </aside>

        <aside className="studio-login-note" aria-hidden="true">
          <div>
            <strong>NOTE</strong>
            <span className="studio-login-pin" />
          </div>
          <span />
          <span />
          <span />
        </aside>

        <section className="studio-login-card">
          <span
            className="studio-login-tape green card-tape"
            aria-hidden="true"
          />

          <header className="studio-login-card-header">
            <p>{mode === 'otp' ? 'EMAIL SIGN IN' : 'OWNER ACCESS'}</p>
            <h1>进入写作台</h1>
          </header>

          <form className="studio-login-form-v2" onSubmit={onSubmit}>
            <label
              className="studio-login-field"
              htmlFor="studio-login-email"
            >
              <span>邮箱地址</span>
              <span className="studio-login-input-wrap">
                <Mail className="studio-login-input-icon" size={19} />
                <input
                  id="studio-login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={
                    emailError ? 'studio-login-email-error' : undefined
                  }
                  onBlur={() => {
                    if (mode === 'otp' && email) validateEmail()
                  }}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setEmailError('')
                    setCodeSent(false)
                    setNotice('')
                  }}
                  placeholder={
                    mode === 'otp'
                      ? 'name@qq.com'
                      : '请输入站主邮箱'
                  }
                />
              </span>
            </label>
            {emailError ? (
              <p
                id="studio-login-email-error"
                className="studio-login-field-error"
                role="alert"
              >
                {emailError}
              </p>
            ) : null}

            {mode === 'otp' ? (
              <div className="studio-login-field">
                <label htmlFor="studio-login-otp">验证码</label>
                <div className="studio-login-code-row">
                  <span className="studio-login-input-wrap">
                    <ShieldCheck
                      className="studio-login-input-icon"
                      size={19}
                    />
                    <input
                      id="studio-login-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, ''))
                      }
                      placeholder="6 位数字"
                    />
                  </span>
                  <button
                    type="button"
                    className="studio-login-code-action"
                    disabled={sendPending || cooldown > 0}
                    onClick={sendCode}
                  >
                    {sendPending ? (
                      <LoaderCircle className="animate-spin" size={17} />
                    ) : null}
                    {sendPending ? '正在发送…' : sendLabel}
                  </button>
                </div>
                <div className="studio-login-fallback-row">
                  <button
                    type="button"
                    className="studio-login-fallback"
                    onClick={() => changeMode('password')}
                  >
                    站主密码登录
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label
                  className="studio-login-field"
                  htmlFor="studio-login-password"
                >
                  <span>密码</span>
                  <span className="studio-login-input-wrap">
                    <KeyRound
                      className="studio-login-input-icon"
                      size={19}
                    />
                    <input
                      id="studio-login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="请输入站主密码"
                    />
                    <button
                      type="button"
                      className="studio-login-password-toggle"
                      aria-label={showPassword ? '隐藏明文' : '显示明文'}
                      title={showPassword ? '隐藏明文' : '显示明文'}
                      aria-pressed={showPassword}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        setShowPassword((current) => !current)
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={19} />
                      ) : (
                        <Eye size={19} />
                      )}
                    </button>
                  </span>
                </label>
                <div className="studio-login-fallback-row">
                  <button
                    type="button"
                    className="studio-login-fallback"
                    onClick={() => changeMode('otp')}
                  >
                    返回验证码登录
                  </button>
                </div>
              </>
            )}

            {notice ? (
              <p className="studio-login-notice" role="status">
                {notice}
              </p>
            ) : null}
            {error ? (
              <p className="studio-login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="studio-login-submit"
              disabled={pending}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" size={20} />
              ) : (
                <>
                  <span>进入写作台</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <footer className="studio-login-card-footer" />
        </section>
      </div>
    </main>
  )
}
