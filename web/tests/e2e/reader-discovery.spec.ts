import './database-isolation'
import { expect, test } from '@playwright/test'

test('RSS, sitemap and share metadata follow published content', async ({
  page,
}) => {
  let response = await page.request.get('/rss.xml')
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('写作不是归档')

  response = await page.request.get('/sitemap.xml')
  expect(response.status()).toBe(200)
  expect(await response.text()).toContain('/library/attention-and-writing/')

  await page.goto('/library/attention-and-writing/写作不是归档')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    '写作不是归档',
  )
  await expect(
    page.locator('meta[property="og:description"]'),
  ).toHaveAttribute('content', /来自 MySQL 的公开章节/)
  const imageUrl = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content')
  expect(imageUrl).toBeTruthy()
  const imageResponse = await page.request.get(imageUrl!)
  expect(imageResponse.status()).toBe(200)
  expect(imageResponse.headers()['content-type']).toContain('image/png')

  await page.goto('/studio/login')

  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.goto('/studio/notes/article-1')
  await page.getByLabel('章节标题').fill('RSS 新标题')
  await page
    .getByRole('textbox', { name: '章节正文' })
    .fill('## 新内容\n\n发布后外部表示立即更新。')
  await page
    .getByRole('textbox', { name: '章节正文' })
    .press('ControlOrMeta+KeyS')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  const [publishResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/studio/articles/article-1/publish'),
    ),
    page.getByRole('button', { name: /发布章节|更新发布/ }).click(),
  ])
  expect(publishResponse.status()).toBe(200)
  await expect(page.getByRole('button', { name: '已是最新' })).toBeVisible()

  response = await page.request.get('/rss.xml')
  expect(await response.text()).toContain('RSS 新标题')
  response = await page.request.get('/sitemap.xml')
  const sitemap = await response.text()
  expect(sitemap).toContain('/RSS-新标题')
  expect(sitemap).not.toContain('/写作不是归档')
})
