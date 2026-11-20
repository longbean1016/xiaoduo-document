import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { article } from '@/db/schema'
import { toDatabaseDateTime } from '@/lib/database-time'
import { getArticleDraft, type ArticleDraft } from './articles'

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

export async function importMarkdownIntoArticle(input: {
  articleId: string
  fileName: string
  markdown: string
}): Promise<ArticleDraft> {
  if (!/\.(md|markdown)$/i.test(input.fileName)) {
    throw new Error('UNSUPPORTED_FILE')
  }
  const markdown = input.markdown.trim()
  if (!markdown) throw new Error('EMPTY_MARKDOWN')
  if (markdown.length > 2_000_000) throw new Error('MARKDOWN_TOO_LARGE')

  const current = await getArticleDraft(input.articleId)
  if (!current) throw new Error('ARTICLE_NOT_FOUND')
  const plainText = plainTextFromMarkdown(markdown)
  await db
    .update(article)
    .set({
      markdown,
      plainText,
      contentJson: null,
      sourceFileName: input.fileName,
      revision: current.revision + 1,
      updatedAt: toDatabaseDateTime(),
    })
    .where(eq(article.id, input.articleId))

  const updated = await getArticleDraft(input.articleId)
  if (!updated) throw new Error('UPDATE_FAILED')
  return updated
}
