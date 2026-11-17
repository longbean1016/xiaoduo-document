import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyCollaboratorLoginOtp } from '@/server/email-otp'

const schema = z.object({
  email: z.string().trim().email().max(255),
  otp: z.string().regex(/^\d{6}$/),
})

const errorStatus: Record<string, number> = {
  ACCOUNT_SUSPENDED: 403,
  COLLABORATOR_NOT_FOUND: 404,
  INVALID_QQ_EMAIL: 400,
}

export async function POST(request: Request) {
  const appOrigin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100'
  if (request.headers.get('origin') !== appOrigin) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 })
  }
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_OTP' }, { status: 400 })
  }
  try {
    return await verifyCollaboratorLoginOtp({
      ...parsed.data,
      headers: request.headers,
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INVALID_OTP'
    return NextResponse.json(
      { error: errorStatus[code] ? code : 'INVALID_OTP' },
      { status: errorStatus[code] ?? 400 },
    )
  }
}
