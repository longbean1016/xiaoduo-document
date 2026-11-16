import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('editor highlights fenced code and allows changing its language', async ({
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
      '```typescript\nconst answer: number = 42\n```\n',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  const code = body.locator('pre code')
  await expect(code).toContainText('const answer: number = 42')
  await expect(code.locator('.hljs-keyword').first()).toHaveText('const')
  await code.click()

  const languageButton = page.getByRole('button', {
    name: '代码语言',
  })
  await expect(languageButton).toBeVisible()
  const saveRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().endsWith('/api/studio/articles/article-1/draft') &&
      Boolean(request.postData()?.includes('javascript')),
  )
  await languageButton.click()
  await page.getByRole('menuitem', { name: 'JavaScript' }).click()
  await expect(code).toHaveClass(/language-javascript/)
  const saveRequest = await saveRequestPromise
  const savedDraft = saveRequest.postDataJSON() as { markdown: string }
  expect(savedDraft.markdown).toContain('```javascript')

  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: '章节正文' }).locator('pre code'),
  ).toHaveClass(/language-javascript/)
})
