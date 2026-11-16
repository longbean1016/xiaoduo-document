import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeStudioMutation } from '@/lib/studio-request'
import {
  listAccessibleArticles,
  studioActorFromUser,
} from '@/server/article-access'
import { trashArticles } from '@/server/articles'

const bulkTrashSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

export async function POST(request: Request) {
  const authorization = await authorizeStudioMutation(request)
  if (authorization.error) return authorization.error

  const parsed = bulkTrashSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_ARTICLE_IDS' },
      { status: 400 },
    )
  }

  const actor = studioActorFromUser(authorization.session.user)
  const articleIds = [...new Set(parsed.data.ids)]
  const accessible = await listAccessibleArticles(actor)
  const accessibleIds = new Set(accessible.map((article) => article.id))
  if (articleIds.some((id) => !accessibleIds.has(id))) {
    return NextResponse.json(
      { error: 'FORBIDDEN_ARTICLE' },
      { status: 403 },
    )
  }

  const trashed = await trashArticles(articleIds, {
    id: actor.id,
    name: authorization.session.user.name,
    role: actor.role,
  })
  revalidatePath('/studio')
  revalidatePath('/library')
  revalidatePath('/')
  return NextResponse.json({ trashed })
}
