'use client'

import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useState,
  type FormEvent,
} from 'react'

const credentials = {
  owner: {
    email: 'owner@example.com',
    password: 'owner-test-password',
  },
  collaborator: {
    email: 'collaborator@example.com',
    password: 'collaborator-test-password',
  },
} as const

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState<string>(credentials.owner.email)
  const [password, setPassword] = useState<string>(credentials.owner.password)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const response = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    setPending(false)

    if (!response.ok) {
      setError('邮箱或密码不正确，或账号已停用。')
      return
    }
    router.replace('/studio')
    router.refresh()
  }

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
          <span className="studio-login-tape green card-tape" aria-hidden="true" />

          <header className="studio-login-card-header">
            <p>STUDIO ACCESS</p>
            <h1>进入写作台</h1>
          </header>

          <div className="studio-login-role-tabs" aria-label="登录入口">
            <button type="button" className="is-active">
              要登进来喽~
            </button>
          </div>

          <form className="studio-login-form-v2" onSubmit={onSubmit}>
            <label className="studio-login-field" htmlFor="studio-login-email">
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
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="请输入您的邮箱"
                />
              </span>
            </label>

            <label className="studio-login-field" htmlFor="studio-login-password">
              <span className="studio-login-password-heading">
                <span>
                  密码
                </span>
                <button
                  type="button"
                  className="studio-login-forgot"
                  tabIndex={-1}
                >
                  忘记密码？
                </button>
              </span>
              <span className="studio-login-input-wrap">
                <KeyRound className="studio-login-input-icon" size={19} />
                <input
                  id="studio-login-password"
                  name="password"
                  aria-label="密码"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                />
                <button
                  type="button"
                  className="studio-login-password-toggle"
                  aria-label={showPassword ? '隐藏明文' : '显示明文'}
                  title={showPassword ? '隐藏明文' : '显示明文'}
                  aria-pressed={showPassword}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>

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
