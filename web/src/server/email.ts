import nodemailer from 'nodemailer'
import type { OtpEmailSender } from './email-otp'

let smtpSender: OtpEmailSender | null = null

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error('EMAIL_NOT_CONFIGURED')
  return value
}

export function createSmtpOtpSender(): OtpEmailSender {
  const host = requiredEnv('SMTP_HOST')
  const port = Number(requiredEnv('SMTP_PORT'))
  const user = requiredEnv('SMTP_USER')
  const pass = requiredEnv('SMTP_PASS')
  const from = requiredEnv('MAIL_FROM')
  const secure = (process.env.SMTP_SECURE ?? 'true') === 'true'
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })

  return {
    async sendOtp({ email, code, expiresInSeconds }) {
      await transport.sendMail({
        from,
        to: email,
        subject: '知笺登录验证码',
        text: [
          `你的知笺验证码是：${code}`,
          `验证码 ${Math.floor(expiresInSeconds / 60)} 分钟内有效。`,
          '如果不是你本人操作，请忽略这封邮件。',
        ].join('\n'),
        html: `
          <div style="font-family:sans-serif;line-height:1.7;color:#1d352b">
            <p>你的知笺验证码是：</p>
            <p style="font:700 28px/1.4 monospace;letter-spacing:6px">${code}</p>
            <p>验证码 ${Math.floor(expiresInSeconds / 60)} 分钟内有效。</p>
            <p style="color:#708076">如果不是你本人操作，请忽略这封邮件。</p>
          </div>
        `,
      })
    },
  }
}

export function getOtpEmailSender(): OtpEmailSender {
  smtpSender ??= createSmtpOtpSender()
  return smtpSender
}
