import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeOwnerMutation } from '@/lib/studio-request'
import { createDirectInvite } from '@/server/collaboration'

const schema = z.object({
  articleIds: z.array(z.string().min(1)).min(1),
})

export async function POST(request: Request) {
  const authorization = await authorizeOwnerMutation(request)
  if (authorization.error) return authorization.error
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INVITE' }, { status: 400 })
  }
  try {
    return NextResponse.json(
      { invite: await createDirectInvite(parsed.data) },
      { status: 201 },
    )
  } catch {
    return NextResponse.json({ error: 'ARTICLE_NOT_FOUND' }, { status: 404 })
  }
}
