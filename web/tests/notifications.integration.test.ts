import { beforeEach, describe, expect, it } from 'vitest'
import { grantArticle } from '@/server/article-access'
import { publishArticle } from '@/server/articles'
import {
  createDirectInvite,
} from '@/server/collaboration'
import {
  createNotification,
  listNotifications,
  markNotificationRead,
} from '@/server/notifications'
import { resetTestDatabase } from './test-db'
import { createTestConnection } from './test-db'

describe('owner notification center', () => {
  beforeEach(async () => {
    await resetTestDatabase()
  })

  it('deduplicates a business event and supports marking it read', async () => {
    const input = {
      eventKey: 'application:created:application-1',
      kind: 'application' as const,
      title: '新的协作申请',
      body: '协作者甲申请参与《写作不是归档》',
      href: '/studio/collaboration',
    }
    await createNotification(input)
    await createNotification(input)

    const notifications = await listNotifications()
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      ...input,
      readAt: null,
    })

    expect(await markNotificationRead(notifications[0].id)).toBe(true)
    expect((await listNotifications())[0].readAt).not.toBeNull()
  })

  it('records application, invitation, grant and collaborator publish events', async () => {
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
          '正文', '正文', 1, 'published', NOW(3), NOW(3)
        )`,
      )
      await connection.query(
        `INSERT INTO auth_user (
          id, name, email, email_verified, role, status, created_at, updated_at
        ) VALUES (
          'collaborator-1', '协作者甲', 'events@example.com', true,
          'collaborator', 'active', NOW(3), NOW(3)
        )`,
      )
    } finally {
      await connection.end()
    }

    await createNotification({
      eventKey: 'application:created:historical-application',
      kind: 'application',
      title: '历史协作申请',
      body: '协作者甲申请参与《写作不是归档》',
      href: '/studio/collaboration',
    })
    await createDirectInvite({
      email: 'invited@example.com',
      articleIds: ['article-1'],
    })
    await grantArticle({
      userId: 'collaborator-1',
      articleId: 'article-1',
    })
    await publishArticle('article-1', {
      id: 'collaborator-1',
      name: '协作者甲',
      role: 'collaborator',
    })

    expect(
      (await listNotifications()).map((item) => item.kind).sort(),
    ).toEqual(['application', 'grant', 'invitation', 'publish'])
  })
})
