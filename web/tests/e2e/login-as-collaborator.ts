import { expect, type Page } from '@playwright/test'
import { auth } from '../../src/lib/auth'
import { createTestConnection } from '../test-db'

export async function loginAsCollaborator(page: Page, email: string) {
  const qqEmail = email.replace(/@example\.com$/i, '@qq.com')
  let sentCode = ''

  await page.route(
    '**/api/login/request-otp',
    async (route) => {
      sentCode = await auth.api.createVerificationOTP({
        body: { email: qqEmail, type: 'sign-in' },
      })
      await route.fulfill({ json: { sent: true } })
    },
  )

  if (qqEmail !== email) {
    const connection = await createTestConnection()
    try {
      await connection.query(
        `UPDATE auth_user SET email = ? WHERE email IN (?, ?)`,
        [qqEmail, email, qqEmail],
      )
    } finally {
      await connection.end()
    }
  }

  await page.goto('/studio/login')
  await page.getByLabel('邮箱地址').fill(qqEmail)
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect.poll(() => sentCode).toMatch(/^\d{6}$/)
  await page.getByLabel('验证码').fill(sentCode)
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
}
