import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTrustedClientIp } from '@/server/analytics'
import { getOtpEmailSender } from '@/server/email'
import { requestInviteOtp } from '@/server/email-otp'

const schema = z.object({
  token: z.string().min(1).max(256),
  email: z.string().trim().email().max(255),
})

const errorStatus: Record<string, number> = {
  ACCOUNT_SUSPENDED: 403,
  INVITE_EXPIRED: 410,
  INVITE_NOT_FOUND: 404,
  INVITE_NOT_PENDING: 409,
  OTP_COOLDOWN: 429,
  OTP_EMAIL_DAILY_LIMIT: 429,
  OTP_EMAIL_HOURLY_LIMIT: 429,
  OTP_IP_HOURLY_LIMIT: 429,
  OWNER_ACCOUNT: 403,
}

export async function POST(request: Request) {
  const appOrigin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100'
  if (request.headers.get('origin') !== appOrigin) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_EMAIL' }, { status: 400 })
  }
  try {
    await requestInviteOtp({
      ...parsed.data,
      ip: resolveTrustedClientIp(request.headers),
      mailer: getOtpEmailSender(),
    })
    return NextResponse.json({ sent: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'OTP_SEND_FAILED'
    return NextResponse.json(
      { error: code },
      { status: errorStatus[code] ?? 500 },
    )
  }
}
