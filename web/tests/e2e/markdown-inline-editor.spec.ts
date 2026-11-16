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
  const saveRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().endsWith('/api/studio/articles/article-1/draft'),
  )
  await body.evaluate((element) => {
    const clipboard = new DataTransfer()
    clipboard.setData(
      'text/plain',
      '**粘贴粗体**、*粘贴斜体*、`行内代码` 以及 ~~删除线~~',
    )
    clipboard.setData(
      'text/html',
      '<span>**粘贴粗体**、*粘贴斜体*、`行内代码` 以及 ~~删除线~~</span>',
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
  await expect(body.locator('em')).toHaveText('粘贴斜体')
  await expect(body.locator('code')).toHaveText('行内代码')
  await expect(body.locator('s')).toHaveText('删除线')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  const saveRequest = await saveRequestPromise
  const savedDraft = saveRequest.postDataJSON() as { markdown: string }
  expect(savedDraft.markdown).toContain('**粘贴粗体**')
  expect(savedDraft.markdown).toContain('*粘贴斜体*')
  expect(savedDraft.markdown).toContain('`行内代码`')
  expect(savedDraft.markdown).toContain('~~删除线~~')

  await page.reload()
  const reloadedBody = page.getByRole('textbox', { name: '章节正文' })
  await expect(reloadedBody.locator('strong')).toHaveText('粘贴粗体')
  await expect(reloadedBody.locator('em')).toHaveText('粘贴斜体')
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
  await body.fill('')
  await body.click()
  await page.keyboard.type('`键盘代码` ~~键盘删除~~ *键盘斜体*')
  await expect(body.locator('code')).toHaveText('键盘代码')
  await expect(body.locator('s')).toHaveText('键盘删除')
  await expect(body.locator('em')).toHaveText('键盘斜体')
})

test('plain text with unmatched markers stays literal', async ({ page }) => {
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
    clipboard.setData('text/plain', '这是普通文本：2 * 3 = 6')
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  await expect(body).toContainText('这是普通文本：2 * 3 = 6')
  await expect(body.locator('strong, em, code, s')).toHaveCount(0)
})
