import './database-isolation'
import { expect, test } from '@playwright/test'
import type { RowDataPacket } from 'mysql2/promise'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'
import { appOrigin } from './app-origin'

type ApplicationRow = RowDataPacket & {
  id: string
  status: string
}

test.beforeEach(async () => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO collaboration_application (
        id, article_id, name, email, note, status, created_at, reviewed_at
      ) VALUES (
        'historical-application', 'article-1', '历史申请者',
        'history@example.com', '保留用于审计', 'pending', NOW(3), NULL
      )`,
    )
  } finally {
    await connection.end()
  }
})

test('collaboration applications are gone while historical records remain', async ({
  page,
}) => {
  await page.goto('/library/attention-and-writing/写作不是归档')
  await expect(
    page.getByRole('button', { name: '申请参与编辑' }),
  ).toHaveCount(0)

  expect(
    (
      await page.request.post('/api/collaboration/applications', {
        headers: { origin: appOrigin },
        data: {
          articleId: 'article-1',
          name: '新申请者',
          email: 'new@example.com',
          note: '不应被接受',
        },
      })
    ).status(),
  ).toBe(410)

  await page.goto('/studio/login')

  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/collaboration')
  await expect(
    page.getByRole('tab', { name: '申请审核' }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: '邀请记录' }),
  ).toBeVisible()
  expect(
    (
      await page.request.post(
        '/api/studio/collaboration/applications/historical-application',
        {
          headers: { origin: appOrigin },
          data: { decision: 'approve' },
        },
      )
    ).status(),
  ).toBe(410)

  const connection = await createTestConnection()
  try {
    const [rows] = await connection.query<ApplicationRow[]>(
      `SELECT id, status FROM collaboration_application WHERE id = ?`,
      ['historical-application'],
    )
    expect(rows).toEqual([
      { id: 'historical-application', status: 'pending' },
    ])
  } finally {
    await connection.end()
  }
})
