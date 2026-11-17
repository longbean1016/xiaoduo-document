import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { appOrigin } from './app-origin'
import { loginAsCollaborator } from './login-as-collaborator'

const origin = appOrigin

test.beforeAll(async () => {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-14', '协作者甲', 'granted@example.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-14',
        'collaborator-14',
        'credential',
        'collaborator-14',
        await hashPassword('collaborator-password'),
      ],
    )
  } finally {
    await connection.end()
  }
})

test('owner grants one article and collaborator cannot access the rest', async ({
  page,
  browser,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const createdResponse = await page.request.post('/api/studio/articles', {
    headers: { origin },
    data: {
      categoryId: 'category-2',
      title: '工具边界',
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = (await createdResponse.json()) as {
    article: { id: string }
  }

  await page.goto('/studio/collaboration')
  await page.getByRole('tab', { name: '协作者' }).click()
  const collaboratorRow = page
    .locator('.collaborator-row')
    .filter({ hasText: '协作者甲' })
  await collaboratorRow.getByRole('button', { name: '管理授权' }).click()
  const grantDialog = page.getByRole('dialog', { name: '管理文章授权' })
  await grantDialog
    .getByRole('checkbox', { name: /写作不是归档/ })
    .check()
  await grantDialog.getByRole('button', { name: '保存授权' }).click()
  await expect(page.getByText('文章授权已更新')).toBeVisible()

  const collaboratorContext = await browser.newContext()
  const collaboratorPage = await collaboratorContext.newPage()
  await loginAsCollaborator(collaboratorPage, 'granted@example.com')
  await expect(
    collaboratorPage.getByRole('heading', { name: '写作台' }),
  ).toBeVisible()
  await expect(
    collaboratorPage.getByRole('link', { name: '写作不是归档' }),
  ).toBeVisible()
  await expect(collaboratorPage.getByText('工具边界')).toHaveCount(0)
  await expect(collaboratorPage.getByText('工具与方法')).toHaveCount(0)
  await expect(
    collaboratorPage
      .locator('.studio-sidebar')
      .getByRole('link', { name: '分类' }),
  ).toHaveCount(0)
  await expect(
    collaboratorPage
      .locator('.studio-sidebar')
      .getByRole('link', { name: '协作' }),
  ).toHaveCount(0)

  await collaboratorPage.goto(`/studio/notes/${created.article.id}`)
  await expect(
    collaboratorPage.getByRole('heading', { name: '无权访问此章节' }),
  ).toBeVisible()

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
            markdown: '协作者修订',
            plainText: '协作者修订',
            expectedRevision: 1,
          },
        },
      )
    ).status(),
  ).toBe(200)
  expect(
    (
      await collaboratorPage.request.put(
        '/api/studio/articles/article-1/draft',
        {
          headers: { origin },
          data: {
            title: '写作不是归档',
            categoryId: 'category-2',
            contentJson: { type: 'doc', content: [] },
            markdown: '越权换分类',
            plainText: '越权换分类',
            expectedRevision: 2,
          },
        },
      )
    ).status(),
  ).toBe(403)

  const forbiddenSave = await collaboratorPage.request.put(
    `/api/studio/articles/${created.article.id}/draft`,
    {
      headers: { origin },
      data: {
        title: '越权修改',
        categoryId: 'category-2',
        contentJson: { type: 'doc', content: [] },
        markdown: '',
        plainText: '',
        expectedRevision: 1,
      },
    },
  )
  expect(forbiddenSave.status()).toBe(403)
  expect(
    (
      await collaboratorPage.request.post(
        `/api/studio/articles/${created.article.id}/images`,
        {
          headers: { origin },
          data: { contentType: 'image/webp', size: 1024 },
        },
      )
    ).status(),
  ).toBe(403)
  expect(
    (
      await collaboratorPage.request.post(
        `/api/studio/articles/${created.article.id}/publish`,
        { headers: { origin } },
      )
    ).status(),
  ).toBe(403)
  expect(
    (
      await collaboratorPage.request.post(
        `/api/studio/articles/${created.article.id}/versions`,
        {
          headers: { origin },
          data: { label: '越权版本' },
        },
      )
    ).status(),
  ).toBe(403)
  expect(
    (
      await collaboratorPage.request.post('/api/studio/categories', {
        headers: { origin },
        data: { title: '越权分类', slug: 'forbidden-category' },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await collaboratorPage.request.post(
        '/api/studio/collaboration/invites',
        {
        headers: { origin },
        data: {
          email: 'forbidden@example.com',
          articleIds: ['article-1'],
        },
        },
      )
    ).status(),
  ).toBe(403)
  expect(
    (
      await collaboratorPage.request.delete(
        '/api/studio/articles/article-1',
        {
        headers: { origin },
        },
      )
    ).status(),
  ).toBe(403)

  await collaboratorPage.goto('/studio/collaboration')
  await expect(collaboratorPage).toHaveURL(/\/studio$/)
  await expect(
    collaboratorPage.getByRole('heading', { name: '写作台' }),
  ).toBeVisible()

  await collaboratorRow.getByRole('button', { name: '管理授权' }).click()
  await grantDialog
    .getByRole('checkbox', { name: /写作不是归档/ })
    .uncheck()
  await grantDialog.getByRole('button', { name: '保存授权' }).click()
  await page
    .getByRole('alertdialog', { name: '撤销文章授权？' })
    .getByRole('button', { name: '撤销授权' })
    .click()
  await expect(page.getByText('文章授权已更新')).toBeVisible()
  await collaboratorPage.goto('/studio')
  await expect(
    collaboratorPage.getByRole('link', { name: '写作不是归档' }),
  ).toHaveCount(0)
  await collaboratorContext.close()
})
