import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('editor supports pasted and inserted GFM tables', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  const body = page.getByRole('textbox', { name: '章节正文' })
  await body.fill('')
  await body.click()
  await body.evaluate((element) => {
    const clipboard = new DataTransfer()
    clipboard.setData(
      'text/plain',
      '| 能力 | 状态 |\n| --- | --- |\n| Markdown | 支持 |\n',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  await expect(body.locator('table')).toBeVisible()
  await expect(body.locator('table')).toContainText('Markdown')
  await expect(
    page.getByRole('button', { name: '插入表格' }),
  ).toBeVisible()

  await body.fill('')
  await page.getByRole('button', { name: '插入表格' }).click()
  await expect(body.locator('table')).toBeVisible()
  await expect(body.locator('table th')).toHaveCount(3)

  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: '章节正文' }).locator('table'),
  ).toBeVisible()

  await page.setViewportSize({ width: 375, height: 812 })
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark'
  })
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth,
      ),
    )
    .toBeLessThanOrEqual(375)
})
