import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db/client'
import { siteProfile, user } from '@/db/schema'
import { requireStudioSession } from '@/lib/server-session'

const profileSchema = z.object({
  authorName: z.string().trim().min(1).max(120),
  avatarUrl: z.string().trim().max(2048).optional().default(''),
  roleTitle: z.string().trim().min(1).max(120),
  intro: z.string().trim().max(5000),
  nowText: z.string().trim().max(5000),
  location: z.string().trim().max(120),
  email: z.string().trim().email().max(255),
})

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return origin === (process.env.APP_ORIGIN ?? 'http://127.0.0.1:3100')
}

export async function PUT(request: Request) {
  const session = await requireStudioSession()
  if (!session) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'invalid origin' }, { status: 403 })
  }

  const parsed = profileSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid profile', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  if (session.user.role === 'owner') {
    await db
      .update(siteProfile)
      .set({
        ...parsed.data,
        avatarUrl: parsed.data.avatarUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(siteProfile.id, 'primary'))
  } else {
    await db
      .update(user)
      .set({
        name: parsed.data.authorName,
        image: parsed.data.avatarUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))
  }

  return NextResponse.json({ saved: true })
}
