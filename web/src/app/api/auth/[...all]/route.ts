import { toNextJsHandler } from 'better-auth/next-js'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db/client'
import { user } from '@/db/schema'

const handlers = toNextJsHandler(auth.handler)

export const { GET, PATCH, PUT, DELETE } = handlers

export async function POST(request: Request) {
  const pathname = new URL(request.url).pathname
  if (pathname.endsWith('/sign-in/email')) {
    const payload = (await request
      .clone()
      .json()
      .catch(() => null)) as { email?: unknown } | null
    const email =
      typeof payload?.email === 'string'
        ? payload.email.trim().toLowerCase()
        : ''
    const [account] = email
      ? await db
          .select({ role: user.role, status: user.status })
          .from(user)
          .where(eq(user.email, email))
          .limit(1)
      : []
    if (
      !account ||
      account.role !== 'owner' ||
      account.status !== 'active'
    ) {
      return NextResponse.json(
        {
          code: 'OWNER_PASSWORD_LOGIN_ONLY',
          message: '协作者请使用邮箱验证码登录。',
        },
        { status: 403 },
      )
    }
  }
  return handlers.POST(request)
}
