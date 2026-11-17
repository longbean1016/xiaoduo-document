import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { activateInvitationWithOtp } from '@/server/email-otp'

const schema = z.object({
  token: z.string().min(1).max(256),
  email: z.string().trim().email().max(255),
  name: z.string().trim().min(1).max(120),
  otp: z.string().regex(/^\d{6}$/),
})

const errorStatus: Record<string, number> = {
  ACCOUNT_SUSPENDED: 403,
  INVITE_EXPIRED: 410,
  INVITE_NOT_FOUND: 404,
  INVITE_NOT_PENDING: 409,
  INVALID_QQ_EMAIL: 400,
  OWNER_ACCOUNT: 403,
}

export async function POST(request: Request) {
  const appOrigin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100'
  if (request.headers.get('origin') !== appOrigin) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_ACTIVATION' }, { status: 400 })
  }
  try {
    await activateInvitationWithOtp(parsed.data)
    return await auth.api.signInEmailOTP({
      asResponse: true,
      body: { email: parsed.data.email, otp: parsed.data.otp },
      headers: request.headers,
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_OTP'
    return NextResponse.json(
      { error: code },
      { status: errorStatus[code] ?? 400 },
    )
  }
}
