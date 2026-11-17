import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('public library and studio use the Xiaoduo round portrait mark', async ({
  page,
}) => {
  await page.goto('/library')

  const publicBrand = page.locator('.library-brand')
  await expect(
    publicBrand.getByText('小多笔记', { exact: true }),
  ).toBeVisible()
  const publicIcon = publicBrand.locator('.brand-mark-icon')
  await expect(publicIcon).toHaveCSS('border-radius', '50%')
  const publicImage = publicIcon.locator('img')
  await expect(publicImage).toHaveAttribute('src', /xiaoduo-mark/)
  await expect
    .poll(() =>
      publicImage.evaluate((image) => {
        const element = image as HTMLImageElement
        return element.complete && element.naturalWidth > 0
      }),
    )
    .toBe(true)

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(publicIcon).toBeVisible()
  await expect(
    publicBrand.getByText('小多笔记', { exact: true }),
  ).toBeHidden()

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const studioBrand = page.locator('.studio-sidebar .brand-mark')
  await expect(
    studioBrand.getByText('小多写作台', { exact: true }),
  ).toBeVisible()
  await expect(studioBrand.locator('.brand-mark-icon')).toBeVisible()
})

test('public library and studio expose Xiaoduo titles and favicon', async ({
  page,
  request,
}) => {
  await page.goto('/library')
  await expect(page).toHaveTitle('小多笔记')

  const faviconHref = await page
    .locator('link[rel="icon"]')
    .first()
    .getAttribute('href')
  expect(faviconHref).toBeTruthy()
  const favicon = await request.get(faviconHref!)
  expect(favicon.ok()).toBe(true)
  expect(favicon.headers()['content-type']).toContain('image/png')

  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await expect(page).toHaveTitle('小多写作台')
})
