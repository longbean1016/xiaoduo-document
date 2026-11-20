import { NextResponse } from 'next/server'
import { authorizeArticleMutation } from '@/lib/studio-request'
import { importMarkdownIntoArticle } from '@/server/article-import'

export async function POST(request: Request) {
  const form = await request.formData()
  const articleId = String(form.get('articleId') ?? '')
  const file = form.get('file')
  if (!articleId || !(file instanceof File)) {
    return NextResponse.json({ error: 'INVALID_IMPORT' }, { status: 400 })
  }
  const authorization = await authorizeArticleMutation(request, articleId)
  if (authorization.error) return authorization.error
  try {
    const imported = await importMarkdownIntoArticle({
      articleId,
      fileName: file.name,
      markdown: await file.text(),
    })
    return NextResponse.json({ article: imported }, { status: 200 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    return NextResponse.json(
      { error: code },
      {
        status:
          code === 'UNSUPPORTED_FILE'
            ? 415
            : code === 'ARTICLE_NOT_FOUND'
              ? 404
              : 400,
      },
    )
  }
}
