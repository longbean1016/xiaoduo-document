import './database-isolation'
import { expect, test } from '@playwright/test'
import { auth } from '../../src/lib/auth'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'
import { appOrigin } from './app-origin'

test.beforeEach(async () => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-53', '验证码协作者', 'writer@qq.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
  } finally {
    await connection.end()
  }
})

test('validates QQ mail before sending and logs in from one OTP form', async ({
  page,
}) => {
  let requestCount = 0
  let sentCode = ''
  await page.route('**/api/login/request-otp', async (route) => {
    requestCount += 1
    sentCode = await auth.api.createVerificationOTP({
      body: { email: 'writer@qq.com', type: 'sign-in' },
    })
    await route.fulfill({ json: { sent: true } })
  })

  await page.goto('/studio/login')
  await expect(page.getByRole('tab')).toHaveCount(0)

  expect(
    (
      await page.request.post('/api/login/request-otp', {
        headers: { origin: appOrigin },
        data: { email: 'tester@gmail.com' },
      })
    ).status(),
  ).toBe(400)
  expect(
    (
      await page.request.post('/api/login/verify-otp', {
        headers: { origin: appOrigin },
        data: { email: 'tester@gmail.com', otp: '123456' },
      })
    ).status(),
  ).toBe(400)

  await page.getByLabel('邮箱地址').fill('tester@gmail.com')
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect(
    page.getByText('请输入有效的 QQ 邮箱、Foxmail 邮箱或 QQ VIP 邮箱。'),
  ).toBeVisible()
  expect(requestCount).toBe(0)

  await page.getByLabel('邮箱地址').fill('writer@qq.com')
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect.poll(() => sentCode).toMatch(/^\d{6}$/)
  expect(requestCount).toBe(1)

  await page.getByLabel('验证码').fill(sentCode)
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
})

test('owner password login remains available below the OTP controls', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱地址').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
})
