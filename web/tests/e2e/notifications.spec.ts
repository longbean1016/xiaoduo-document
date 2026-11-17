import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { appOrigin } from './app-origin'
import { loginAsCollaborator } from './login-as-collaborator'

test.beforeAll(async () => {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-20', '协作者二十', 'notify-20@example.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-20',
        'collaborator-20',
        'credential',
        'collaborator-20',
        await hashPassword('collaborator-password'),
      ],
    )
    await connection.query(
      `INSERT INTO notification (
        id, event_key, kind, title, body, href, read_at, created_at
      ) VALUES (
        'historical-application-notification',
        'application:created:historical-application',
        'application',
        '历史协作申请',
        '申请通知测试申请参与《写作不是归档》',
        '/studio/collaboration',
        NULL,
        NOW(3)
      )`,
    )
  } finally {
    await connection.end()
  }
})

test('owner can review a historical application notification', async ({
  page,
  browser,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.getByRole('link', { name: '通知' }).click()
  await expect(
    page.getByRole('heading', { name: '通知中心' }),
  ).toBeVisible()
  const notification = page
    .getByRole('listitem')
    .filter({ hasText: '申请通知测试' })
  await expect(notification).toBeVisible()
  await expect(notification.locator('p').first()).toHaveText('协作申请')
  await page
    .getByRole('button', { name: '标记已读 历史协作申请' })
    .first()
    .click()
  await expect(
    notification.getByText('已读', { exact: true }),
  ).toBeVisible()

  const collaboratorContext = await browser.newContext()
  const collaboratorPage = await collaboratorContext.newPage()
  await loginAsCollaborator(collaboratorPage, 'notify-20@example.com')
  expect(
    (
      await collaboratorPage.request.get('/api/studio/notifications', {
        headers: { origin: appOrigin },
      })
    ).status(),
  ).toBe(403)
  await collaboratorPage.goto('/studio/notifications')
  await expect(collaboratorPage).toHaveURL(/\/studio$/)

  await collaboratorContext.close()
})
