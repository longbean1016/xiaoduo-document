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
  const codeBlock = body.locator('.editor-code-block')
  expect(
    await codeBlock.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe('rgb(241, 248, 244)')
  expect(
    await codeBlock.locator('pre').evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe('rgb(241, 248, 244)')
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark'
  })
  expect(
    await codeBlock.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe('rgb(23, 32, 27)')
  expect(
    await codeBlock.locator('pre').evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe('rgb(23, 32, 27)')
  await code.click()

  const languageInput = codeBlock.getByLabel('代码语言')
  await expect(languageInput).toBeVisible()
  await expect(languageInput).toHaveValue('typescript')
  const saveRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().endsWith('/api/studio/articles/article-1/draft') &&
      Boolean(request.postData()?.includes('java')),
  )
  await languageInput.fill('java')
  await languageInput.press('Enter')
  await expect(code).toHaveClass(/language-java/)
  const saveRequest = await saveRequestPromise
  const savedDraft = saveRequest.postDataJSON() as { markdown: string }
  expect(savedDraft.markdown).toContain('```java')

  await expect(page.getByRole('status').first()).toContainText('草稿已保存')
  await page.reload()
  await expect(
    page.getByRole('textbox', { name: '章节正文' }).locator('pre code'),
  ).toHaveClass(/language-java/)

  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
    for (const [theme, background] of [
      ['light', 'rgb(241, 248, 244)'],
      ['dark', 'rgb(23, 32, 27)'],
    ] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      expect(
        await codeBlock.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      ).toBe(background)
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth,
          ),
        )
        .toBeLessThanOrEqual(width)
    }
  }
})

test('code block header accepts manual language and typed fences set language', async ({
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
  await page.keyboard.type('```python ')
  await page.keyboard.type('print("hello_world!")')
  const code = body.locator('pre code')
  await expect(code).toHaveClass(/language-python/)

  const block = body.locator('.editor-code-block')
  const languageInput = block.getByLabel('代码语言')
  await expect(languageInput).toHaveValue('python')
  await languageInput.fill('java')
  await languageInput.press('Enter')
  await expect(code).toHaveClass(/language-java/)

  await body.fill('')
  await body.click()
  await page.getByRole('button', { name: '代码块' }).click()
  await expect(
    body.locator('.editor-code-block').getByLabel('代码语言'),
  ).toHaveValue('text')
})
