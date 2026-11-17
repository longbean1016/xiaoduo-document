import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'
import { appOrigin } from './app-origin'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner creates a manually shared link from article grants only', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/collaboration')
  await page.getByRole('tab', { name: '邀请记录' }).click()
  const form = page.locator('.collaboration-invite-form')
  await expect(form.getByLabel('邮箱')).toHaveCount(0)
  await expect(form.getByLabel('昵称预设')).toHaveCount(0)
  await form
    .getByRole('checkbox', { name: '授权文章 写作不是归档' })
    .check()

  const [created] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/studio/collaboration/invites'),
    ),
    form.getByRole('button', { name: '生成邀请链接' }).click(),
  ])
  expect(created.status()).toBe(201)
  expect((await created.json()).invite.email).toBeNull()
  await expect(
    page.getByRole('textbox', { name: '邀请链接', exact: true }),
  ).toHaveValue(/\/collaborate\/accept\//)
  await expect(
    page.locator('.collaboration-invite-row').getByText('未绑定邮箱'),
  ).toBeVisible()

  const direct = await page.request.post(
    '/api/studio/collaboration/invites',
    {
      headers: { origin: appOrigin },
      data: { articleIds: ['article-2'] },
    },
  )
  expect(direct.status()).toBe(201)
})
