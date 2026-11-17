import './database-isolation'
import { expect, test } from '@playwright/test'

test('owner imports Markdown as an editable draft', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.getByRole('button', { name: '导入 Markdown' }).click()
  const importDialog = page.getByRole('dialog', {
    name: '导入 Markdown',
  })
  await importDialog.getByLabel('Markdown 文件').setInputFiles({
    name: '导入的章节.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('## 导入小节\n\n从文件导入的正文。'),
  })
  await importDialog
    .getByRole('button', { name: '导入为草稿' })
    .click()
  await expect(page.getByLabel('章节标题')).toHaveValue('导入的章节')
  await expect(page.getByRole('textbox', { name: '章节正文' })).toContainText(
    '从文件导入的正文。',
  )
})
