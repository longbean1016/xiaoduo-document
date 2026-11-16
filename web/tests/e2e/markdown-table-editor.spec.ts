import './database-isolation'
import { expect, test } from '@playwright/test'
import { appOrigin } from './app-origin'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('editor supports pasted and inserted GFM tables', async ({
  context,
  page,
}) => {
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

  const firstCell = body.locator('table th').first()
  await firstCell.click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await expect
    .poll(() =>
      body.locator('table').evaluate(
        (table) =>
          (table.closest('.tableWrapper') ?? table).previousElementSibling
            ?.tagName ?? '',
      ),
    )
    .toBe('P')

  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: appOrigin,
  })
  await body.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Control+C')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('能力')
  expect(copied).toContain('Markdown')
  expect(copied).toContain('支持')

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

test('ArrowRight exits bold on the same line and Enter writes before the table', async ({
  page,
}) => {
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
      '**结论**\n\n| 对比项 | 状态 |\n| --- | --- |\n| 表格 | 支持 |\n',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  const strong = body.locator('strong')
  await expect(strong).toHaveText('结论')
  await strong.click()
  await page.keyboard.press('End')
  const paragraphsBefore = await body.locator(':scope > p').count()
  await page.keyboard.press('ArrowRight')
  await expect(body.locator(':scope > p')).toHaveCount(paragraphsBefore)
  await page.keyboard.type('同排普通文本')
  await expect(body).toContainText('结论同排普通文本')
  await expect
    .poll(() =>
      body.locator('table').evaluate(
        (table) =>
          (table.closest('.tableWrapper') ?? table).previousElementSibling
            ?.tagName ?? '',
      ),
    )
    .toBe('P')

  await page.keyboard.press('Enter')
  await expect(body.locator(':scope > p')).toHaveCount(
    paragraphsBefore + 1,
  )
  await page.keyboard.type('表格前普通行')
  await expect(body).toContainText('表格前普通行')
  await expect(strong).toHaveText('结论')
  await expect(body.locator('table')).toBeVisible()
})
