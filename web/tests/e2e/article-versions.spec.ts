import './database-isolation'
import { expect, test } from '@playwright/test'

test('owner saves and restores a manual version', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  await page.getByLabel('章节标题').fill('版本测试标题')
  await page.getByRole('textbox', { name: '章节正文' }).fill('版本测试内容')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')

  await page.getByRole('button', { name: '保存版本' }).click()
  const saveDialog = page.getByRole('dialog', {
    name: '保存一个手动版本',
  })
  await saveDialog.getByLabel('版本说明').fill('测试快照')
  await saveDialog.getByRole('button', { name: '保存版本' }).click()

  const history = page.getByRole('dialog', { name: '版本历史' })
  await expect(history.getByText('测试快照')).toBeVisible()
  await expect(
    history
      .getByRole('listitem')
      .filter({ hasText: '测试快照' })
      .filter({ hasText: '小多' }),
  ).toContainText('站主')
  await history.getByRole('button', { name: '关闭' }).click()

  await page.getByLabel('章节标题').fill('被恢复覆盖的标题')
  await page.getByRole('textbox', { name: '章节正文' }).fill('被恢复覆盖的内容')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')

  await page.getByRole('button', { name: '版本历史' }).click()
  await history
    .getByRole('button', { name: '恢复 测试快照 为当前草稿' })
    .click()
  await page.getByRole('button', { name: '恢复为草稿' }).click()
  await expect(page.getByLabel('章节标题')).toHaveValue('版本测试标题')
  await expect(page.getByRole('textbox', { name: '章节正文' })).toContainText(
    '版本测试内容',
  )
})
