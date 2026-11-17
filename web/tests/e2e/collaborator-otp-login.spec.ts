import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { appOrigin } from './app-origin'
import { loginAsCollaborator } from './login-as-collaborator'

test.beforeEach(async () => {
  const { seedTestDatabase } = await import('../seed-test-db')
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-50', '验证码协作者', 'otp@qq.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-50',
        'collaborator-50',
        'credential',
        'collaborator-50',
        await hashPassword('old-collaborator-password'),
      ],
    )
    await connection.query(
      `INSERT INTO article_grant (user_id, article_id, created_at)
       VALUES ('collaborator-50', 'article-1', NOW(3))`,
    )
  } finally {
    await connection.end()
  }
})

test('collaborator signs in with email OTP while password login is rejected', async ({
  page,
}) => {
  const passwordLogin = await page.request.post(
    '/api/auth/sign-in/email',
    {
      headers: { origin: appOrigin },
      data: {
        email: 'otp@qq.com',
        password: 'old-collaborator-password',
      },
    },
  )
  expect(passwordLogin.status()).toBe(403)
  expect(
    (
      await page.request.post('/api/collaboration/invites/accept', {
        headers: { origin: appOrigin },
        data: {
          token: 'legacy-token',
          displayName: '旧密码协作者',
          password: 'old-collaborator-password',
        },
      })
    ).status(),
  ).toBe(410)

  await loginAsCollaborator(page, 'otp@qq.com')
  await expect(
    page.getByRole('link', { name: '写作不是归档' }),
  ).toBeVisible()

  const sessionCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.includes('session_token'),
  )
  expect(sessionCookie?.httpOnly).toBe(true)
})
