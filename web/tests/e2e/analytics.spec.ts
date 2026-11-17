import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { loginAsCollaborator } from './login-as-collaborator'

test.beforeAll(async () => {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-22', '协作者二十二', 'analytics-22@example.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-22',
        'collaborator-22',
        'credential',
        'collaborator-22',
        await hashPassword('collaborator-password'),
      ],
    )
  } finally {
    await connection.end()
  }
})

test('counts public views and exposes details only to the owner', async ({
  browser,
}) => {
  const readerContext = await browser.newContext({
    extraHTTPHeaders: { 'x-real-ip': '120.24.78.68' },
  })
  const readerPage = await readerContext.newPage()
  const [firstView] = await Promise.all([
    readerPage.waitForResponse((response) =>
      response.url().endsWith('/api/public/articles/article-1/view'),
    ),
    readerPage.goto(
      '/library/attention-and-writing/写作不是归档',
      { referer: 'https://www.google.com/search?q=knowledge' },
    ),
  ])
  expect(firstView.status()).toBe(200)

  const [duplicateView] = await Promise.all([
    readerPage.waitForResponse((response) =>
      response.url().endsWith('/api/public/articles/article-1/view'),
    ),
    readerPage.reload(),
  ])
  expect(await duplicateView.json()).toMatchObject({
    counted: false,
    reason: 'duplicate',
  })
  await expect(readerPage.getByText(/1 次浏览/)).toBeVisible()
  await readerContext.close()

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await ownerPage.goto('/studio/login')
  await ownerPage.getByLabel('邮箱').fill('owner@example.com')
  await ownerPage.getByLabel('密码').fill('owner-test-password')
  await ownerPage.getByRole('button', { name: '进入写作台' }).click()
  await expect(ownerPage).toHaveURL(/\/studio$/)
  await ownerPage.getByRole('link', { name: '访问统计' }).click()
  await expect(
    ownerPage.getByRole('heading', { name: '访问报表', exact: true }),
  ).toBeVisible()
  await expect(
    ownerPage.getByRole('button', { name: '最近 30 天' }),
  ).toBeVisible()
  await ownerPage.getByRole('button', { name: '最近 7 天' }).click()
  await expect(ownerPage.getByText('120.24.78.68')).toBeVisible()
  await expect(ownerPage.getByText(/广东/)).toBeVisible()
  await expect(ownerPage.getByText('google.com')).toBeVisible()

  const collaboratorContext = await browser.newContext()
  const collaboratorPage = await collaboratorContext.newPage()
  await loginAsCollaborator(
    collaboratorPage,
    'analytics-22@example.com',
  )
  expect(
    (
      await collaboratorPage.request.get('/api/studio/analytics')
    ).status(),
  ).toBe(403)

  await collaboratorContext.close()
  await ownerContext.close()
})
