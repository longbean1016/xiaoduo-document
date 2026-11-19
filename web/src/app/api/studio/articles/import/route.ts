import { NextResponse } from 'next/server'
import { authorizeStudioMutation } from '@/lib/studio-request'
import {
  grantArticle,
  listAccessibleCategories,
  studioActorFromUser,
} from '@/server/article-access'
import { importMarkdownDraft } from '@/server/article-import'

export async function POST(request: Request) {
  const authorization = await authorizeStudioMutation(request)
  if (authorization.error) return authorization.error
  const actor = studioActorFromUser(authorization.session.user)
  const form = await request.formData()
  const categoryId = String(form.get('categoryId') ?? '')
  const file = form.get('file')
  if (!categoryId || !(file instanceof File)) {
    return NextResponse.json({ error: 'INVALID_IMPORT' }, { status: 400 })
  }
  const accessibleCategories = await listAccessibleCategories(actor)
  if (
    !accessibleCategories.some((category) => category.id === categoryId)
  ) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  try {
    const imported = await importMarkdownDraft({
      categoryId,
      fileName: file.name,
      markdown: await file.text(),
    })
    if (actor.role === 'collaborator') {
      await grantArticle({ userId: actor.id, articleId: imported.id })
    }
    return NextResponse.json({ article: imported }, { status: 201 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    return NextResponse.json(
      { error: code },
      { status: code === 'UNSUPPORTED_FILE' ? 415 : 400 },
    )
  }
}
