import './database-isolation'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('reader and studio share theme and eye-care surfaces', async ({ page }) => {
  await page.goto('/library')
  const readerTheme = page.getByRole('button', {
    name: /主题与护眼背景/,
  })
  await expect(readerTheme).toBeVisible()
  await readerTheme.click()
  const captureDir = process.env.THEME_CAPTURE_DIR
  if (captureDir) await mkdir(captureDir, { recursive: true })
  if (captureDir) {
    await page.screenshot({
      path: path.join(captureDir, 'reader-menu-1280-light.png'),
      fullPage: false,
    })
  }

  const readerMenu = page.getByRole('menu')
  await readerMenu
    .getByRole('menuitemradio', { name: '浅豆绿' })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme-surface',
    'green',
  )
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe('rgb(237, 246, 238)')

  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const studioTheme = page.getByRole('button', {
    name: /主题与护眼背景/,
  })
  await expect(studioTheme).toBeVisible()
  await expect(studioTheme).toHaveClass(/theme-toggle/)
  await studioTheme.click()
  if (captureDir) {
    await page.screenshot({
      path: path.join(captureDir, 'studio-menu-1280-green.png'),
      fullPage: false,
    })
  }
  await page
    .getByRole('menu')
    .getByRole('menuitemradio', { name: '深色' })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  if (captureDir) {
    await page.screenshot({
      path: path.join(captureDir, 'studio-1280-dark.png'),
      fullPage: false,
    })
  }
  await page.setViewportSize({ width: 375, height: 812 })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth),
    )
    .toBeLessThanOrEqual(375)
  if (captureDir) {
    await page.screenshot({
      path: path.join(captureDir, 'studio-375-dark.png'),
      fullPage: false,
    })
  }

  await page.goto('/library')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: /主题与护眼背景/ })).toHaveClass(
    /theme-toggle/,
  )
})
