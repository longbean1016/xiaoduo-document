import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner manages categories and manual order', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/categories')
  await expect(
    page.getByRole('heading', { level: 1, name: '分类', exact: true }),
  ).toBeVisible()
  await expect(
    page.locator('.category-editor').first().getByText('2 篇章节'),
  ).toBeVisible()
  await expect(
    page.locator('.category-editor').nth(1).getByText('0 篇章节'),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '删除 注意力与写作' }),
  ).toBeDisabled()
  await page.getByLabel('分类名称', { exact: true }).fill('阅读测试')
  await page
    .getByLabel('分类英文网址标识', { exact: true })
    .fill('reading-test')
  await page.getByRole('button', { name: '新建分类' }).click()
  await expect(page.getByLabel('分类名称 阅读测试')).toBeVisible()

  await page.getByLabel('分类名称 阅读测试').fill('阅读与测试')
  await page.getByLabel('分类网址标识 阅读测试').fill('reading-and-test')
  await page
    .getByRole('button', { name: '保存分类' })
    .last()
    .click()
  await expect(page.getByLabel('分类名称 阅读与测试')).toBeVisible()

  await page.getByRole('button', { name: '下移 注意力与写作' }).click()
  await expect(
    page.locator('.category-editor').first().locator('input').first(),
  ).toHaveValue('工具与方法')

  await page.getByRole('button', { name: '删除 阅读与测试' }).click()
  const deleteDialog = page.getByRole('alertdialog', {
    name: '删除这个分类？',
  })
  await expect(deleteDialog).toBeVisible()
  await deleteDialog.getByRole('button', { name: '取消' }).click()
  await expect(page.getByLabel('分类名称 阅读与测试')).toBeVisible()

  await page.getByRole('button', { name: '删除 阅读与测试' }).click()
  await deleteDialog.getByRole('button', { name: '删除分类' }).click()
  await expect(page.getByLabel('分类名称 阅读与测试')).toHaveCount(0)
})
