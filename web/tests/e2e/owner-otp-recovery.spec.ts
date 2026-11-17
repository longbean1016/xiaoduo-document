import './database-isolation'
import { expect, test } from '@playwright/test'
import { auth } from '../../src/lib/auth'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner can use email OTP recovery as a password-free backup', async ({
  page,
}) => {
  let sentCode = ''
  await page.route(
    '**/api/owner/recovery/request-otp',
    async (route) => {
      sentCode = await auth.api.createVerificationOTP({
        body: { email: 'owner@example.com', type: 'sign-in' },
      })
      await route.fulfill({ json: { sent: true } })
    },
  )

  await page.goto('/studio/login')
  await page.getByRole('tab', { name: '站主验证码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
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
