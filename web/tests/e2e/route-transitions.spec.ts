import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('library and studio routes use the prototype reveal transition', async ({
  page,
}) => {
  await page.goto('/library')
  const libraryRoute = page.locator('.library-route-view')
  await expect
    .poll(() =>
      libraryRoute.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    )
    .toBe('route-reveal')

  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const studioRoute = page.locator('.studio-route-view')
  await expect
    .poll(() =>
      studioRoute.evaluate(
        (element) => getComputedStyle(element).animationName,
      ),
    )
    .toBe('route-reveal')
})
