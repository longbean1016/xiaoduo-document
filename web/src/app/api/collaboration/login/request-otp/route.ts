import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveTrustedClientIp } from '@/server/analytics'
import { getOtpEmailSender } from '@/server/email'
import { requestCollaboratorLoginOtp } from '@/server/email-otp'

const schema = z.object({
  email: z.string().trim().email().max(255),
})

const errorStatus: Record<string, number> = {
  ACCOUNT_SUSPENDED: 403,
  COLLABORATOR_NOT_FOUND: 404,
  EMAIL_NOT_CONFIGURED: 503,
  OTP_COOLDOWN: 429,
  OTP_EMAIL_DAILY_LIMIT: 429,
  OTP_EMAIL_HOURLY_LIMIT: 429,
  OTP_IP_HOURLY_LIMIT: 429,
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
    await requestCollaboratorLoginOtp({
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
