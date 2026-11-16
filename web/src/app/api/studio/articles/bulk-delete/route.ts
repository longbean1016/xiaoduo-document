import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeOwnerMutation } from '@/lib/studio-request'
import { listTrash, permanentlyDeleteArticles } from '@/server/articles'

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

export async function POST(request: Request) {
  const authorization = await authorizeOwnerMutation(request)
  if (authorization.error) return authorization.error

  const parsed = bulkDeleteSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_ARTICLE_IDS' },
      { status: 400 },
    )
  }

  const articleIds = [...new Set(parsed.data.ids)]
  const trash = await listTrash()
  const trashIds = new Set(trash.map((article) => article.id))
  if (articleIds.some((id) => !trashIds.has(id))) {
    return NextResponse.json(
      { error: 'INVALID_TRASH_SELECTION' },
      { status: 409 },
    )
  }

  const deleted = await permanentlyDeleteArticles(articleIds)
  revalidatePath('/studio/trash')
  revalidatePath('/library')
  revalidatePath('/rss.xml')
  revalidatePath('/sitemap.xml')
  revalidatePath('/')
  return NextResponse.json({ deleted })
}
