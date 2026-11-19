import './database-isolation'
import { expect, test } from '@playwright/test'

test('reader opens a published chapter served from the database', async ({
  page,
}) => {
  await page.goto('/library/attention-and-writing/写作不是归档')

  await expect(
    page.getByRole('heading', { level: 1, name: '写作不是归档' }),
  ).toBeVisible()
  await expect(page.getByText('这是来自 MySQL 的公开章节。')).toBeVisible()
})

test('chapter byline uses icons for authors and metadata', async ({
  page,
}) => {
  await page.goto('/library/attention-and-writing/写作不是归档')

  const byline = page.locator('.chapter-byline')
  for (const icon of ['author', 'words', 'views', 'updated']) {
    await expect(
      byline.locator(`[data-meta-icon="${icon}"]`),
    ).toBeVisible()
  }
  await expect(byline).toContainText('小多')
  await expect(byline).toContainText('字')
  await expect(byline).toContainText('次浏览')
  await expect(byline).toContainText('更新于')

  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({
      width,
      height: width === 375 ? 812 : 900,
    })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth),
        )
        .toBeLessThanOrEqual(width)
      await expect(byline.locator('[data-meta-icon="views"]')).toBeVisible()
    }
  }
})
