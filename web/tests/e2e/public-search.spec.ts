import './database-isolation'
import { expect, test } from '@playwright/test'

test('reader searches only public chapters', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: '搜索' }).click()
  const search = page
    .getByRole('dialog', { name: '搜索知笺' })
    .getByLabel('搜索公开章节')
  await search.fill('持续修订')
  await search.press('Enter')

  await expect(page).toHaveURL(/\/search\?q=/)
  await expect(
    page
      .locator('.search-results-page')
      .getByRole('link', { name: /长期维护/ }),
  ).toBeVisible()
  await expect(page.getByText('未发布草稿')).toHaveCount(0)
})

test('focused search input has no visible outline edge', async ({ page }) => {
  await page.goto('/library')
  await page.getByRole('button', { name: '搜索' }).click()
  const dialog = page.getByRole('dialog', { name: '搜索知笺' })
  const search = dialog.getByLabel('搜索公开章节')
  await search.click()
  await expect(search).toBeFocused()

  const styles = await search.evaluate((element) => {
    const input = getComputedStyle(element)
    const form = getComputedStyle(element.closest('form')!)
    return {
      inputOutline: input.outlineStyle,
      inputShadow: input.boxShadow,
      formOutline: form.outlineStyle,
      formShadow: form.boxShadow,
    }
  })
  expect(styles.inputOutline).toBe('none')
  expect(styles.inputShadow).toBe('none')
  expect(styles.formOutline).toBe('none')
  expect(styles.formShadow).toBe('none')
})
