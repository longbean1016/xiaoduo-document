import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('editor renders pasted inline Markdown as rich text', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  const body = page.getByRole('textbox', { name: '章节正文' })
  await body.fill('')
  await body.click()
  await body.evaluate((element) => {
    const clipboard = new DataTransfer()
    clipboard.setData(
      'text/plain',
      '**粘贴粗体** 和 `行内代码` 以及 ~~删除线~~',
    )
    clipboard.setData(
      'text/html',
      '<span>**粘贴粗体** 和 `行内代码` 以及 ~~删除线~~</span>',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  await expect(body.locator('strong')).toHaveText('粘贴粗体')
  await expect(body.locator('code')).toHaveText('行内代码')
  await expect(body.locator('s')).toHaveText('删除线')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')

  await page.reload()
  const reloadedBody = page.getByRole('textbox', { name: '章节正文' })
  await expect(reloadedBody.locator('strong')).toHaveText('粘贴粗体')
  await expect(reloadedBody.locator('code')).toHaveText('行内代码')
  await expect(reloadedBody.locator('s')).toHaveText('删除线')
})

test('editor converts typed Markdown inline syntax', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  const body = page.getByRole('textbox', { name: '章节正文' })
  await body.fill('')
  await body.click()
  await page.keyboard.type('**键盘粗体**')

  await expect(body.locator('strong')).toHaveText('键盘粗体')
})
