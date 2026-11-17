import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'
import { appOrigin } from './app-origin'
import { loginAsCollaborator } from './login-as-collaborator'

const origin = appOrigin

test.beforeEach(async () => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-matrix', '权限协作者', 'matrix@example.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-matrix',
        'collaborator-matrix',
        'credential',
        'collaborator-matrix',
        await hashPassword('collaborator-password'),
      ],
    )
    await connection.query(
      `INSERT INTO article_grant (user_id, article_id, created_at)
       VALUES ('collaborator-matrix', 'article-1', NOW(3))`,
    )
  } finally {
    await connection.end()
  }
})

async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
}

test('owner, collaborator and reader capabilities follow the permission matrix', async ({
  browser,
}) => {
  const readerContext = await browser.newContext()
  const readerPage = await readerContext.newPage()
  expect(
    (
      await readerPage.request.get(
        '/library/attention-and-writing/写作不是归档',
      )
    ).status(),
  ).toBe(200)
  expect(
    (
      await readerPage.request.put(
        '/api/studio/articles/article-1/draft',
        {
          headers: { origin },
          data: {
            title: '越权',
            categoryId: 'category-1',
            contentJson: { type: 'doc', content: [] },
            markdown: '',
            plainText: '',
            expectedRevision: 1,
          },
        },
      )
    ).status(),
  ).toBe(403)
  expect(
    (await readerPage.request.get('/api/studio/analytics')).status(),
  ).toBe(403)
  expect(
    (
      await readerPage.request.post('/api/collaboration/applications', {
        headers: { origin },
        data: {
          articleId: 'article-1',
          name: '读者申请',
          email: 'matrix-reader@example.com',
          note: '申请参与',
        },
      })
    ).status(),
  ).toBe(410)

  const collaboratorContext = await browser.newContext()
  const collaboratorPage = await collaboratorContext.newPage()
  await loginAsCollaborator(collaboratorPage, 'matrix@example.com')
  await expect(
    collaboratorPage.getByRole('link', { name: '写作不是归档' }),
  ).toBeVisible()
  await expect(collaboratorPage.getByRole('button', { name: '新建章节' })).toHaveCount(
    0,
  )
  expect(
    (
      await collaboratorPage.request.put(
        '/api/studio/articles/article-1/draft',
        {
          headers: { origin },
          data: {
            title: '写作不是归档',
            categoryId: 'category-1',
            contentJson: { type: 'doc', content: [] },
            markdown: '协作者矩阵修订',
            plainText: '协作者矩阵修订',
            expectedRevision: 1,
          },
        },
      )
    ).status(),
  ).toBe(200)
  expect(
    (
      await collaboratorPage.request.post(
        '/api/studio/articles/article-1/versions',
        { headers: { origin }, data: { label: '矩阵快照' } },
      )
    ).status(),
  ).toBe(201)
  expect(
    (
      await collaboratorPage.request.post(
        '/api/studio/articles/article-1/publish',
        { headers: { origin } },
      )
    ).status(),
  ).toBe(200)
  expect(
    (
      await collaboratorPage.request.post(
        '/api/studio/articles/article-1/trash',
        { headers: { origin } },
      )
    ).status(),
  ).toBe(200)
  expect(
    (
      await collaboratorPage.request.post(
        '/api/studio/articles/article-1/restore',
        { headers: { origin } },
      )
    ).status(),
  ).toBe(200)
  for (const response of [
    await collaboratorPage.request.post(
      '/api/studio/articles/article-1/withdraw',
      { headers: { origin } },
    ),
    await collaboratorPage.request.post('/api/studio/articles', {
      headers: { origin },
      data: { categoryId: 'category-1', title: '越权创建' },
    }),
    await collaboratorPage.request.post('/api/studio/categories', {
      headers: { origin },
      data: { title: '越权分类', slug: 'forbidden-category' },
    }),
    await collaboratorPage.request.post(
      '/api/studio/collaboration/grants',
      {
        headers: { origin },
        data: {
          userId: 'collaborator-matrix',
          articleId: 'article-2',
        },
      },
    ),
    await collaboratorPage.request.post('/api/studio/collaboration/invites', {
      headers: { origin },
      data: { email: 'forbidden@example.com', articleIds: ['article-1'] },
    }),
    await collaboratorPage.request.get('/api/studio/analytics'),
    await collaboratorPage.request.get('/api/studio/notifications'),
    await collaboratorPage.request.get('/api/studio/export'),
    await collaboratorPage.request.delete(
      '/api/studio/articles/article-1',
      { headers: { origin } },
    ),
  ]) {
    expect(response.status()).toBe(403)
    expect((await response.text()).toLowerCase()).not.toContain('password')
  }

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await login(ownerPage, 'owner@example.com', 'owner-test-password')
  expect(
    (await ownerPage.request.get('/api/studio/categories')).status(),
  ).toBe(200)
  expect(
    (await ownerPage.request.get('/api/studio/analytics')).status(),
  ).toBe(200)
  const created = await ownerPage.request.post('/api/studio/articles', {
    headers: { origin },
    data: { categoryId: 'category-1', title: '权限矩阵临时章节' },
  })
  expect(created.status()).toBe(201)
  const createdPayload = (await created.json()) as {
    article: { id: string }
  }
  expect(
    (
      await ownerPage.request.post(
        `/api/studio/articles/${createdPayload.article.id}/withdraw`,
        { headers: { origin } },
      )
    ).status(),
  ).toBe(200)
  expect(
    (
      await ownerPage.request.delete(
        `/api/studio/articles/${createdPayload.article.id}`,
        { headers: { origin } },
      )
    ).status(),
  ).toBe(200)

  await ownerContext.close()
  await collaboratorContext.close()
  await readerContext.close()
})
