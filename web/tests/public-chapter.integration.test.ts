import { beforeAll, describe, expect, it } from 'vitest'
import { getPublicChapterByPath } from '@/lib/public-library'
import { createTestConnection, resetTestDatabase } from './test-db'

describe('public chapter service', () => {
  beforeAll(async () => {
    await resetTestDatabase()
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO category (id, title, slug, position) VALUES (?, ?, ?, ?)`,
        ['category-1', '注意力与写作', 'attention-and-writing', 1],
      )
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, markdown, plain_text, revision,
          publication_state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          'article-1',
          'category-1',
          '写作不是归档',
          '写作不是归档',
          '# 写作不是归档\n\n这是来自 MySQL 的公开章节。\n',
          '写作不是归档 这是来自 MySQL 的公开章节。',
          1,
          'published',
        ],
      )
      await connection.query(
        `INSERT INTO article_version (
          id, article_id, kind, title, path, markdown, plain_text,
          author_id, author_name, author_role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          'version-1',
          'article-1',
          'published',
          '写作不是归档',
          '写作不是归档',
          '# 写作不是归档\n\n这是来自 MySQL 的公开章节。\n',
          '写作不是归档 这是来自 MySQL 的公开章节。',
          'owner-1',
          '小多',
          'owner',
        ],
      )
      await connection.query(
        `INSERT INTO article_version (
          id, article_id, kind, title, path, markdown, plain_text,
          author_id, author_name, author_role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          'version-2',
          'article-1',
          'manual',
          '写作不是归档',
          '写作不是归档',
          '# 写作不是归档\n\n协作者保存过的版本。\n',
          '写作不是归档 协作者保存过的版本。',
          'collaborator-1',
          '协作者甲',
          'collaborator',
        ],
      )
      await connection.query(
        `INSERT INTO auth_user (
          id, name, email, email_verified, image, role, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          'collaborator-1',
          '协作者新昵称',
          'collaborator@example.com',
          true,
          '/xiaoduo-mark.jpg',
          'collaborator',
          'active',
        ],
      )
      await connection.query(
        `INSERT INTO article_version (
          id, article_id, kind, title, path, markdown, plain_text,
          author_id, author_name, author_role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          'version-3',
          'article-1',
          'manual',
          '写作不是归档',
          '写作不是归档',
          '# 写作不是归档\n\n同一协作者再次保存。\n',
          '写作不是归档 同一协作者再次保存。',
          'collaborator-1',
          '协作者新昵称',
          'collaborator',
        ],
      )
    } finally {
      await connection.end()
    }
  })

  it('reads the published canonical Markdown from MySQL by public path', async () => {
    const chapter = await getPublicChapterByPath(
      'attention-and-writing',
      '写作不是归档',
    )

    expect(chapter).toMatchObject({
      title: '写作不是归档',
      categorySlug: 'attention-and-writing',
      path: '写作不是归档',
    })
    expect(chapter?.markdown).toContain('这是来自 MySQL 的公开章节')
    expect(chapter?.contributors).toEqual([
      {
        id: 'collaborator-1',
        name: '协作者新昵称',
        avatarUrl: '/xiaoduo-mark.jpg',
        role: 'collaborator',
      },
    ])
  })
})
