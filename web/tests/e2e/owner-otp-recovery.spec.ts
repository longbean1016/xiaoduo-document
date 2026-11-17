import './database-isolation'
import { expect, test } from '@playwright/test'
import { auth } from '../../src/lib/auth'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'owner-qq', 'QQ站主', 'owner@qq.com', true,
        'owner', 'active', NOW(3), NOW(3)
      )`,
    )
  } finally {
    await connection.end()
  }
})

test('owner can use email OTP recovery as a password-free backup', async ({
  page,
}) => {
  let sentCode = ''
  await page.route(
    '**/api/login/request-otp',
    async (route) => {
      sentCode = await auth.api.createVerificationOTP({
        body: { email: 'owner@qq.com', type: 'sign-in' },
      })
      await route.fulfill({ json: { sent: true } })
    },
  )

  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@qq.com')
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect.poll(() => sentCode).toMatch(/^\d{6}$/)

  await page.getByLabel('验证码').fill(sentCode)
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await expect(
    page.getByRole('heading', { name: '写作台' }),
  ).toBeVisible()

  const sessionCookie = (await page.context().cookies()).find((cookie) =>
    cookie.name.includes('session_token'),
  )
  expect(sessionCookie?.httpOnly).toBe(true)
})
