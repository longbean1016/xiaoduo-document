import './database-isolation'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
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

test('literal bold inserted without keyboard rules is normalized', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  const body = page.getByRole('textbox', { name: '章节正文' })
  await body.fill('**中文粗体**')
  await expect(body.locator('strong')).toHaveText('中文粗体')

  await body.fill('这是 **混合粗体** 文本')
  await expect(body.locator('strong')).toHaveText('混合粗体')
  await expect(body).not.toContainText('**')
})

test('contextual Markdown markers reveal and close a bold range', async ({
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
      request.url().endsWith('/api/studio/articles/article-1/draft') &&
      Boolean(request.postData()?.includes('这是粗体')),
  )
  await page.keyboard.type('**这是粗体**')

  const strong = body.locator('strong')
  await expect(strong).toHaveText('这是粗体')
  await expect
    .poll(() => body.locator('.markdown-context-marker').allTextContents())
    .toEqual(['**', '**'])
  const savedDraft = (await saveRequestPromise).postDataJSON() as {
    markdown: string
  }
  expect(savedDraft.markdown).toContain('**这是粗体**')
  expect(savedDraft.markdown).not.toContain('******')

  const captureDir = process.env.MARKDOWN_MARKER_CAPTURE_DIR
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
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'light'
  })

  await page.keyboard.type('后面是普通文本')
  await expect(strong).toHaveText('这是粗体')
  await expect(body).toContainText('后面是普通文本')
  await expect(body.locator('.markdown-context-marker')).toHaveCount(0)

  await strong.click()
  await expect
    .poll(() => body.locator('.markdown-context-marker').allTextContents())
    .toEqual(['**', '**'])

  await page.keyboard.press('End')
  await expect(body.locator('.markdown-context-marker')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Markdown 源码' })).toHaveCount(
    0,
  )
})

test('contextual Markdown markers cover common inline marks', async ({
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
  await page.keyboard.type('*斜体* ~~删除线~~ `行内代码` 普通文本')

  const markerText = () =>
    body.locator('.markdown-context-marker').allTextContents()
  await expect(body.locator('.markdown-context-marker')).toHaveCount(0)

  await body.locator('em').click()
  await expect.poll(markerText).toEqual(['*', '*'])

  await body.locator('s').click()
  await expect.poll(markerText).toEqual(['~~', '~~'])

  await body.locator('code').click()
  await expect.poll(markerText).toEqual(['`', '`'])

  await page.keyboard.press('End')
  await expect(body.locator('.markdown-context-marker')).toHaveCount(0)
})

test('contextual Markdown markers reveal link syntax', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  const body = page.getByRole('textbox', { name: '章节正文' })
  await body.fill('')
  await body.click()
  await page.keyboard.type('链接文字')
  await page.keyboard.press('Control+A')
  await page.getByRole('button', { name: '链接' }).click()
  const dialog = page.getByRole('dialog', { name: '添加链接' })
  await dialog.getByLabel('链接地址').fill('https://example.com')
  await dialog.getByRole('button', { name: '应用' }).click()

  const link = body.getByRole('link', { name: '链接文字' })
  await expect(link).toBeVisible()
  await link.click()
  await expect
    .poll(() =>
      body.locator('.markdown-context-marker').allTextContents(),
    )
    .toEqual(['[', '](https://example.com)'])
})

test('contextual Markdown markers reveal active heading and quote prefixes', async ({
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
      '## 上下文标题\n\n> 上下文引用\n\n普通文本',
    )
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  const markerText = () =>
    body.locator('.markdown-context-marker').allTextContents()
  await expect(body.locator('.markdown-context-marker')).toHaveCount(0)

  await body.getByRole('heading', { name: '上下文标题' }).click()
  await expect.poll(markerText).toEqual(['## '])

  await body.getByText('上下文引用', { exact: true }).click()
  await expect.poll(markerText).toEqual(['> '])

  await body.getByText('普通文本', { exact: true }).click()
  await expect(body.locator('.markdown-context-marker')).toHaveCount(0)
})

test('contextual heading and quote markers can be deleted', async ({
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
    clipboard.setData('text/plain', '## 标题\n\n> 引用\n\n普通文本')
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })

  await body.getByRole('heading', { name: '标题' }).click()
  await page.keyboard.press('Home')
  await expect
    .poll(() => body.locator('.markdown-context-marker').allTextContents())
    .toEqual(['## '])
  await page.keyboard.press('Backspace')
  await expect(body.getByRole('heading', { name: '标题' })).toHaveCount(0)
  await expect(body.getByText('标题', { exact: true })).toBeVisible()

  await body.getByText('引用', { exact: true }).click()
  await page.keyboard.press('Home')
  await expect
    .poll(() => body.locator('.markdown-context-marker').allTextContents())
    .toEqual(['> '])
  await page.keyboard.press('Backspace')
  await expect(body.locator('blockquote')).toHaveCount(0)
  await expect(body.getByText('引用', { exact: true })).toBeVisible()
})

test('inline marker deletion keeps content and exits bold formatting', async ({
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
  await page.keyboard.type('**粗体内容**后面普通文本')
  const strong = body.locator('strong')
  const markers = body.locator('.markdown-context-marker')

  const strongBox = await strong.boundingBox()
  if (!strongBox) throw new Error('找不到粗体文本位置')
  await page.mouse.click(
    strongBox.x + strongBox.width - 1,
    strongBox.y + strongBox.height / 2,
  )
  await expect(markers).toHaveCount(2)
  await page.keyboard.press('Delete')
  await expect(body.locator('strong')).toHaveCount(0)
  await expect(body).toContainText('粗体内容后面普通文本')

  await body.fill('')
  await body.click()
  await page.keyboard.type('**可退格粗体**后面普通文本')
  const secondStrong = body.locator('strong')
  await secondStrong.click()
  await page.keyboard.press('Home')
  await expect(markers).toHaveCount(2)
  await page.keyboard.press('Backspace')
  await expect(body.locator('strong')).toHaveCount(0)
  await expect(body).toContainText('可退格粗体后面普通文本')

  await body.fill('')
  await body.click()
  await page.keyboard.type('**粗体后继续**')
  await page.keyboard.press('End')
  await page.keyboard.type('普通文本')
  await expect(body.locator('strong')).toHaveText('粗体后继续')
  await expect(body).toContainText('普通文本')
})
