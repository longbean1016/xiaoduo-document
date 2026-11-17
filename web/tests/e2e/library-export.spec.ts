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
        'collaborator-24', '协作者二十四', 'export-24@example.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-24',
        'collaborator-24',
        'credential',
        'collaborator-24',
        await hashPassword('collaborator-password'),
      ],
    )
  } finally {
    await connection.end()
  }
})

test('owner downloads a complete ZIP while collaborators cannot', async ({
  page,
  browser,
}) => {
  expect((await page.request.get('/api/studio/export')).status()).toBe(403)

  await page.goto('/studio/login')

  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.goto('/studio/settings')
  await expect(
    page.getByRole('link', { name: '下载整站导出 ZIP' }),
  ).toBeVisible()
  const downloadResponse = await page.request.get('/api/studio/export')
  expect(downloadResponse.status()).toBe(200)
  expect(downloadResponse.headers()['content-type']).toContain(
    'application/zip',
  )
  expect(downloadResponse.headers()['content-disposition']).toContain(
    'zhijian-export-',
  )
  const body = await downloadResponse.body()
  expect(body.subarray(0, 2).toString()).toBe('PK')

  const collaboratorContext = await browser.newContext()
  const collaboratorPage = await collaboratorContext.newPage()
  await loginAsCollaborator(collaboratorPage, 'export-24@example.com')
  expect(
    (await collaboratorPage.request.get('/api/studio/export')).status(),
  ).toBe(403)
  await collaboratorContext.close()
})
