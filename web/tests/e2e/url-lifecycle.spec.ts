import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner update keeps old URL and withdrawal removes public access', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  await page.getByLabel('章节标题').fill('旧地址测试')
  await page.getByRole('textbox', { name: '章节正文' }).fill('## 内容\n\n第一版')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  const [publishResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/studio\/articles\/article-1\/publish$/.test(
          response.url(),
        ),
    ),
    page
      .getByRole('button', { name: /发布章节|更新发布/ })
      .click(),
  ])
  expect(publishResponse.status()).toBe(200)
  await expect(
    page.getByRole('button', { name: '撤回公开访问' }),
  ).toBeVisible()

  await page.getByLabel('章节标题').fill('新地址测试')
  await page.getByRole('textbox', { name: '章节正文' }).press(
    'ControlOrMeta+KeyS',
  )
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  const [updateResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/studio\/articles\/article-1\/publish$/.test(
          response.url(),
        ),
    ),
    page.getByRole('button', { name: '更新发布' }).click(),
  ])
  expect(updateResponse.status()).toBe(200)

  await page.goto('/library/attention-and-writing/旧地址测试')
  await expect
    .poll(() => decodeURIComponent(new URL(page.url()).pathname))
    .toContain('/library/attention-and-writing/新地址测试')
  await expect(
    page.getByRole('heading', { level: 1, name: '新地址测试' }),
  ).toBeVisible()

  await page.goto('/studio/notes/article-1')
  await page.getByRole('button', { name: '撤回公开访问' }).click()
  const withdrawDialog = page.getByRole('alertdialog', {
    name: '撤回公开访问？',
  })
  await expect(withdrawDialog).toBeVisible()
  const [withdrawResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/studio\/articles\/article-1\/withdraw$/.test(
          response.url(),
        ),
    ),
    withdrawDialog.getByRole('button', { name: '确认撤回' }).click(),
  ])
  expect(withdrawResponse.status()).toBe(200)
  const response = await page.goto(
    '/library/attention-and-writing/新地址测试',
  )
  expect(response?.status()).toBe(404)
})
