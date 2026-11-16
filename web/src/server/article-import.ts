import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { article } from '@/db/schema'
import { toDatabaseDateTime } from '@/lib/database-time'
import { createArticleDraft, type ArticleDraft } from './articles'

function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/[*_~`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function importMarkdownDraft(input: {
  categoryId: string
  fileName: string
  markdown: string
}): Promise<ArticleDraft> {
  if (!/\.(md|markdown)$/i.test(input.fileName)) {
    throw new Error('UNSUPPORTED_FILE')
  }
  const markdown = input.markdown.trim()
  if (!markdown) throw new Error('EMPTY_MARKDOWN')
  if (markdown.length > 2_000_000) throw new Error('MARKDOWN_TOO_LARGE')

  const title =
    input.fileName.replace(/\.(md|markdown)$/i, '').trim() || '导入章节'
  const created = await createArticleDraft({
    categoryId: input.categoryId,
    title,
  })
  const plainText = plainTextFromMarkdown(markdown)
  await db
    .update(article)
    .set({
      markdown,
      plainText,
      contentJson: null,
      sourceFileName: input.fileName,
      updatedAt: toDatabaseDateTime(),
    })
    .where(eq(article.id, created.id))

  return {
    ...created,
    markdown,
    plainText,
    contentJson: null,
    sourceFileName: input.fileName,
  }
}
