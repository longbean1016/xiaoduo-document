import './database-isolation'
import { expect, test } from '@playwright/test'

test('owner publishes a chapter and readers see the current public version', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  await page.getByLabel('章节标题').fill('公开测试章节')
  await page
    .getByRole('textbox', { name: '章节正文' })
    .fill('## 公开小节\n\n这是读者应该看到的正文。')
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
  await expect(page.getByRole('button', { name: '已是最新' })).toBeDisabled()

  await page.goto('/library/attention-and-writing/公开测试章节')
  await expect(
    page.getByRole('heading', { level: 1, name: '公开测试章节' }),
  ).toBeVisible()
  await expect(page.getByText('这是读者应该看到的正文。')).toBeVisible()
  await expect(page.locator('.chapter-byline strong')).toHaveText('小多')
  await expect(page.getByRole('heading', { level: 2, name: '公开小节' })).toBeVisible()
  await expect(page.getByLabel('本章目录')).toBeVisible()
})
