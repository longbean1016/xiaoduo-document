import { beforeEach, describe, expect, it } from 'vitest'
import {
  approveApplication,
  createDirectInvite,
  listApplications,
  listInvites,
  submitApplication,
} from '@/server/collaboration'
import { createTestConnection, resetTestDatabase } from './test-db'

describe('collaboration applications and invites', () => {
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
        ) VALUES
          ('article-1', 'category-1', '写作不是归档', '写作不是归档', 1,
           '正文', '正文', 1, 'published', NOW(3), NOW(3)),
          ('article-2', 'category-1', '长期维护', '长期维护', 2,
           '正文', '正文', 1, 'published', NOW(3), NOW(3))`,
      )
    } finally {
      await connection.end()
    }
  })

  it('prevents duplicate pending applications and approves one into an invite', async () => {
    const application = await submitApplication({
      articleId: 'article-1',
      name: '协作者甲',
      email: 'collab@example.com',
      note: '希望补充案例',
    })
    if (application === 'duplicate') throw new Error('unexpected duplicate')
    expect(await submitApplication({
      articleId: 'article-1',
      name: '协作者甲',
      email: 'collab@example.com',
      note: '重复申请',
    })).toBe('duplicate')
    expect(await approveApplication(application.id)).toMatchObject({
      email: 'collab@example.com',
      articleIds: ['article-1'],
      source: 'application',
    })
    expect((await listApplications())[0]?.status).toBe('approved')
    expect((await listInvites())[0]).not.toHaveProperty('tokenHash')
  })

  it('creates a direct multi-article invite', async () => {
    const invite = await createDirectInvite({
      articleIds: ['article-1', 'article-2'],
    })
    expect(invite.email).toBeNull()
    expect(invite.articleIds).toEqual(['article-1', 'article-2'])
    expect(invite.token).toHaveLength(64)
    expect(invite.status).toBe('pending')
  })
})
