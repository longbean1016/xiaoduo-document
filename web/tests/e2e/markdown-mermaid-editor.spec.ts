import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('editor renders Mermaid diagrams and can reveal the source', async ({
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
      '```mermaid\ngraph TD\n  A[想法] --> B[笔记]\n  B --> C[发布]\n```\n',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  const diagram = page.locator('.mermaid-diagram svg')
  await expect(diagram).toBeVisible()
  await page.getByRole('button', { name: '查看源码' }).click()
  await expect(body.locator('pre code')).toContainText('graph TD')
  await page.getByRole('button', { name: '显示图表' }).click()
  await expect(diagram).toBeVisible()

  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  await page.reload()
  await expect(page.locator('.mermaid-diagram svg')).toBeVisible()
})

test('invalid Mermaid stays recoverable on a dark 375px editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.evaluate(() => {
    window.localStorage.setItem('zhijian-theme', 'dark')
  })

  await page.goto('/studio/notes/article-1')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const body = page.getByRole('textbox', { name: '章节正文' })
  await body.fill('')
  await body.click()
  await body.evaluate((element) => {
    const clipboard = new DataTransfer()
    clipboard.setData(
      'text/plain',
      '```mermaid\ngraph TD\n  A[broken\n```\n',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  await expect(page.locator('.mermaid-diagram-error')).toBeVisible()
  await expect(
    page.locator('.mermaid-diagram-error pre').filter({
      hasText: 'A[broken',
    }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth,
      ),
    )
    .toBeLessThanOrEqual(375)
})

test('Mermaid stays inside the editor across responsive themes', async ({
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
      '```mermaid\ngraph TD\n  A[想法] --> B[笔记]\n```\n',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((nextTheme) => {
        window.localStorage.setItem('zhijian-theme', nextTheme)
        document.documentElement.dataset.theme = nextTheme
        document.documentElement.style.colorScheme = nextTheme
        window.dispatchEvent(new Event('zhijian-theme-change'))
      }, theme)
      const diagram = page.locator('.mermaid-diagram svg')
      await expect(diagram).toBeVisible()
      await expect(
        page.locator('.mermaid-diagram svg script'),
      ).toHaveCount(0)
      await expect(
        page.locator('.mermaid-diagram svg a[href^="javascript:"]'),
      ).toHaveCount(0)
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth,
          ),
        )
        .toBeLessThanOrEqual(width)
    }
  }
})
