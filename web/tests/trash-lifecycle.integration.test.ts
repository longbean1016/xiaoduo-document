import { beforeEach, describe, expect, it } from 'vitest'
import {
  getArticleDraft,
  listArticleVersions,
  listTrash,
  listTrashForActor,
  permanentlyDeleteArticle,
  permanentlyDeleteArticles,
  publishArticle,
  purgeExpiredTrash,
  restoreTrashArticle,
  restoreTrashArticlesForActor,
  restoreTrashArticleForActor,
  trashArticle,
  trashArticles,
} from '@/server/articles'
import { deleteCategory } from '@/server/categories'
import { getPublicChapterByPath } from '@/lib/public-library'
import { createTestConnection, resetTestDatabase } from './test-db'

const actor = { id: 'owner-1', name: '小多', role: 'owner' as const }

describe('trash lifecycle', () => {
  beforeEach(async () => {
    await resetTestDatabase()
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO category (id, title, slug, position)
         VALUES ('category-1', '注意力与写作', 'attention-and-writing', 1)`,
      )
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, position, markdown, plain_text,
          revision, publication_state, created_at, updated_at
        ) VALUES (
          'article-1', 'category-1', '写作不是归档', '写作不是归档', 1,
          '## 初稿', '初稿', 1, 'draft', NOW(3), NOW(3)
        )`,
      )
    } finally {
      await connection.end()
    }
    await publishArticle('article-1', actor)
  })

  it('trashes, restores, and permanently deletes an article with versions', async () => {
    expect(await trashArticle('article-1', actor)).toBe(true)
    expect(
      await getPublicChapterByPath('attention-and-writing', '写作不是归档'),
    ).toBeNull()
    expect(await listTrash()).toHaveLength(1)
    expect(await deleteCategory('category-1')).toBe(false)

    expect(await restoreTrashArticle('article-1')).toBe(true)
    expect((await getArticleDraft('article-1'))?.publicationState).toBe(
      'unpublished',
    )

    expect(await permanentlyDeleteArticle('article-1')).toBe(true)
    expect(await getArticleDraft('article-1')).toBeNull()
    expect(await listArticleVersions('article-1')).toHaveLength(0)
  })

  it('moves multiple articles to trash in one operation', async () => {
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, position, markdown, plain_text,
          revision, publication_state, created_at, updated_at
        ) VALUES (
          'article-2', 'category-1', '长期维护', '长期维护', 2,
          '正文', '正文', 1, 'draft', NOW(3), NOW(3)
        )`,
      )
    } finally {
      await connection.end()
    }

    expect(
      await trashArticles(['article-1', 'article-2'], actor),
    ).toBe(2)
    expect((await listTrash()).map((item) => item.id).sort()).toEqual([
      'article-1',
      'article-2',
    ])
  })

  it('batch restores and permanently deletes multiple trash articles', async () => {
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, position, markdown, plain_text,
          revision, publication_state, created_at, updated_at
        ) VALUES (
          'article-2', 'category-1', '长期维护', '长期维护', 2,
          '正文', '正文', 1, 'draft', NOW(3), NOW(3)
        )`,
      )
    } finally {
      await connection.end()
    }

    expect(
      await trashArticles(['article-1', 'article-2'], actor),
    ).toBe(2)
    expect(
      await restoreTrashArticlesForActor(
        ['article-1', 'article-2'],
        actor,
      ),
    ).toBe(2)
    expect(await listTrash()).toHaveLength(0)
    expect((await getArticleDraft('article-1'))?.publicationState).toBe(
      'unpublished',
    )

    expect(
      await trashArticles(['article-1', 'article-2'], actor),
    ).toBe(2)
    expect(
      await permanentlyDeleteArticles(['article-1', 'article-2']),
    ).toBe(2)
    expect(await getArticleDraft('article-1')).toBeNull()
    expect(await getArticleDraft('article-2')).toBeNull()
    expect(await listTrash()).toHaveLength(0)
  })
  it('purges only trash older than 30 days', async () => {
    const connection = await createTestConnection()
    try {
      await connection.query(
        `UPDATE article SET trashed_at = DATE_SUB(NOW(3), INTERVAL 31 DAY),
          trashed_by_id = 'owner-1', trashed_by_name = '小多'
         WHERE id = 'article-1'`,
      )
    } finally {
      await connection.end()
    }
    expect(await purgeExpiredTrash()).toBe(1)
    expect(await getArticleDraft('article-1')).toBeNull()
  })

  it('shows and restores trash only for its actor and retains owner visibility', async () => {
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, position, markdown, plain_text,
          revision, publication_state, created_at, updated_at
        ) VALUES (
          'article-2', 'category-1', '长期维护', '长期维护', 2,
          '正文', '正文', 1, 'draft', NOW(3), NOW(3)
        )`,
      )
      await connection.query(
        `INSERT INTO auth_user (
          id, name, email, email_verified, role, status, created_at, updated_at
        ) VALUES
          ('collaborator-1', '协作者甲', 'one@example.com', true,
           'collaborator', 'active', NOW(3), NOW(3)),
          ('collaborator-2', '协作者乙', 'two@example.com', true,
           'collaborator', 'active', NOW(3), NOW(3))`,
      )
      await connection.query(
        `INSERT INTO article_grant (user_id, article_id, created_at) VALUES
          ('collaborator-1', 'article-1', NOW(3)),
          ('collaborator-2', 'article-2', NOW(3))`,
      )
    } finally {
      await connection.end()
    }
    const first = {
      id: 'collaborator-1',
      name: '协作者甲',
      role: 'collaborator' as const,
    }
    const second = {
      id: 'collaborator-2',
      name: '协作者乙',
      role: 'collaborator' as const,
    }

    await trashArticle('article-1', first)
    await trashArticle('article-2', second)
    expect(
      (await listTrashForActor(first)).map((item) => item.id),
    ).toEqual(['article-1'])
    expect(
      (await listTrashForActor(second)).map((item) => item.id),
    ).toEqual(['article-2'])
    expect(await listTrashForActor(actor)).toHaveLength(2)

    expect(await restoreTrashArticleForActor('article-1', second)).toBe(
      false,
    )
    expect(await restoreTrashArticleForActor('article-1', first)).toBe(true)
    expect(await listTrashForActor(actor)).toHaveLength(1)
  })
})
