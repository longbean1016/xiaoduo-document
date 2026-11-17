import { expect, type Page } from '@playwright/test'
import { auth } from '../../src/lib/auth'

export async function loginAsCollaborator(page: Page, email: string) {
  let sentCode = ''

  await page.route(
    '**/api/collaboration/login/request-otp',
    async (route) => {
      sentCode = await auth.api.createVerificationOTP({
        body: { email, type: 'sign-in' },
      })
      await route.fulfill({ json: { sent: true } })
    },
  )

  await page.goto('/studio/login')
  await page.getByRole('tab', { name: '协作者验证码登录' }).click()
  await page.getByLabel('邮箱').fill(email)
  await page.getByRole('button', { name: '发送验证码' }).click()
  await expect.poll(() => sentCode).toMatch(/^\d{6}$/)
  await page.getByLabel('验证码').fill(sentCode)
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
}
