import './database-isolation'
import { expect, type Page, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.use({ viewport: { width: 375, height: 812 } })

test.beforeEach(async () => {
  await seedTestDatabase()
})

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth),
    )
    .toBeLessThanOrEqual(375)
}

test('public preview fits the 375px viewport in both themes', async ({
  page,
}) => {
  await page.goto('/')

  await expectNoHorizontalOverflow(page)
  await page
    .getByRole('button', { name: /主题与护眼背景/ })
    .click()
  await page
    .getByRole('menu')
    .getByRole('menuitemradio', { name: '深色' })
    .click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoHorizontalOverflow(page)
})

test('studio dashboard fits the 375px viewport in both themes', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByLabel('密码').press('Enter')
  await expect(page).toHaveURL(/\/studio$/)

  await expectNoHorizontalOverflow(page)
  await page.evaluate(() => {
    window.localStorage.setItem('zhijian-theme', 'dark')
  })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expectNoHorizontalOverflow(page)
})
