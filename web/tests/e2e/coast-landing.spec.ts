import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('public landing uses the full-screen coast scene', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: '一片海， 几分牵挂。' }),
  ).toBeVisible()
  await expect(page.getByText('小多个人笔记')).toBeVisible()
  await expect(
    page.getByText('路上的风景、读过的句子，和偶尔牵挂的人。'),
  ).toBeVisible()
  await expect(page.getByText(/\d{2} \/ \d{2} · \d{2}:\d{2}/)).toBeVisible()

  const coastImage = page.locator('.coast-landing-image img')
  await expect(coastImage).toBeVisible()
  await expect
    .poll(() =>
      coastImage.evaluate((image) => {
        const element = image as HTMLImageElement
        return element.complete && element.naturalWidth
      }),
    )
    .toBeGreaterThan(1000)

  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
    await page.reload()
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value
      }, theme)
      await expect(
        page.getByRole('heading', { name: '一片海， 几分牵挂。' }),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: '进入笔记库' }),
      ).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width)
    }
  }

  await page.getByRole('link', { name: '进入笔记库' }).click()
  await expect(page).toHaveURL(/\/library$/)
})
