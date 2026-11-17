import './database-isolation'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { appOrigin } from './app-origin'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('editor highlights fenced code and allows changing its language', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
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
  await page.getByRole('button', { name: '站主密码登录' }).click()
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

test('editor code blocks use compact aligned metrics and line numbers', async ({
  context,
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
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
      '```python\nimport sys\n\ndef solution():\n  return []\n```\n',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  const block = body.locator('.editor-code-block')
  const code = block.locator('pre code')
  const lineNumbers = block.locator('.editor-code-line-numbers span')
  await expect(lineNumbers).toHaveText(['1', '2', '3', '4'])
  await expect(code).not.toContainText('1')
  expect(await code.evaluate((element) => getComputedStyle(element).fontSize)).toBe(
    '13px',
  )
  expect(
    await code.evaluate((element) => getComputedStyle(element).lineHeight),
  ).toBe('20.8px')
  expect(
    await block.locator('pre').evaluate((element) => getComputedStyle(element).padding),
  ).toBe('12px 14px')
  expect(
    await block.evaluate(
      (element) => getComputedStyle(element).borderRadius,
    ),
  ).toBe('6px')
  expect(
    await block
      .locator('.editor-code-block-header')
      .evaluate((element) => getComputedStyle(element).minHeight),
  ).toBe('32px')
  expect(
    await block
      .locator('.editor-code-line-numbers')
      .evaluate((element) => getComputedStyle(element).width),
  ).toBe('42px')
  expect(
    await block.evaluate((element) => {
      const codeElement = element.querySelector('pre code')
      if (!codeElement) return -1
      return Math.round(
        codeElement.getBoundingClientRect().left -
          element.getBoundingClientRect().left,
      )
    }),
  ).toBe(57)

  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: appOrigin,
  })
  const copyButton = block.getByRole('button', { name: '复制代码' })
  await expect(copyButton).toHaveAttribute('data-copy-ready', 'true')
  await copyButton.click()
  await expect(block.getByRole('button', { name: 'Copied' })).toContainText(
    'Copied',
  )
  expect(
    (
      await page.evaluate(() => navigator.clipboard.readText())
    ).replace(/\r\n?/g, '\n'),
  ).toBe('import sys\n\ndef solution():\n  return []')

  const captureDir = process.env.MARKDOWN_CODE_CAPTURE_DIR
  if (captureDir) await mkdir(captureDir, { recursive: true })
  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      await expect
        .poll(() =>
          page.evaluate(() => document.documentElement.scrollWidth),
        )
        .toBeLessThanOrEqual(width)
      if (captureDir) {
        await page.screenshot({
          path: path.join(captureDir, `${width}-${theme}.png`),
          fullPage: true,
        })
      }
    }
  }
})
