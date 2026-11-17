import './database-isolation'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Locator } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

function markerValues(markers: Locator) {
  return markers.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-marker-text') ?? ''),
  )
}

test('editor renders pasted inline Markdown as rich text', async ({
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
  await page.getByRole('button', { name: '站主密码登录' }).click()
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

test('typing inside empty bold markers does not duplicate the first letter', async ({
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
  await page.keyboard.type('****')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.insertText('甲')

  await expect(body.locator('strong')).toHaveText('甲')
  await expect(body).toHaveText('甲')
})

test('empty inline formatting keeps its Markdown markers visible', async ({
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
  await page.keyboard.type('**甲**')
  const strong = body.locator('strong')
  await expect(strong).toHaveText('甲')
  await strong.click()
  await page.keyboard.press('End')
  await page.keyboard.press('Backspace')

  await expect
    .poll(() => markerValues(body.locator('.markdown-context-marker')))
    .toEqual(['**', '**'])
})

test('italic Markdown renders at the beginning of a paragraph', async ({
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
  await page.keyboard.type('*段首斜体*')

  const italic = body.locator('em')
  await expect(italic).toHaveText('段首斜体')
  await expect(italic).toHaveCSS('font-style', 'italic')
  await expect
    .poll(() =>
      italic.evaluate((element) =>
        getComputedStyle(element).getPropertyValue('font-synthesis'),
      ),
    )
    .toBe('style')
  await expect(body.locator('ul')).toHaveCount(0)

  await body.fill('')
  await body.click()
  await page.keyboard.type('_下划线斜体_')
  await expect(body.locator('em')).toHaveText('下划线斜体')
})

test('plain text with unmatched markers stays literal', async ({ page }) => {
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
  await page.getByRole('button', { name: '站主密码登录' }).click()
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
  await page.getByRole('button', { name: '站主密码登录' }).click()
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
    .poll(() => markerValues(body.locator('.markdown-context-marker')))
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
    .poll(() => markerValues(body.locator('.markdown-context-marker')))
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
  await page.getByRole('button', { name: '站主密码登录' }).click()
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
    markerValues(body.locator('.markdown-context-marker'))
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
  await page.getByRole('button', { name: '站主密码登录' }).click()
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
    .poll(() => markerValues(body.locator('.markdown-context-marker')))
    .toEqual(['[', '](https://example.com)'])
})

test('contextual Markdown markers reveal active heading and quote prefixes', async ({
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
    markerValues(body.locator('.markdown-context-marker'))
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
    .poll(() => markerValues(body.locator('.markdown-context-marker')))
    .toEqual(['## '])
  await page.keyboard.press('Backspace')
  await expect(body.getByRole('heading', { name: '标题' })).toHaveCount(0)
  await expect(body.getByText('标题', { exact: true })).toBeVisible()

  await body.getByText('引用', { exact: true }).click()
  await page.keyboard.press('Home')
  await expect
    .poll(() => markerValues(body.locator('.markdown-context-marker')))
    .toEqual(['> '])
  await page.keyboard.press('Backspace')
  await expect(body.locator('blockquote')).toHaveCount(0)
  await expect(body.getByText('引用', { exact: true })).toBeVisible()
})

test('inline marker deletion keeps content and exits bold formatting', async ({
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

test('ArrowRight enters then exits an inline mark at the last line', async ({
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
  await page.keyboard.type('**最后一行粗体**')
  const strong = body.locator('strong')
  await expect(strong).toHaveText('最后一行粗体')

  await strong.click()
  await page.keyboard.press('End')
  const paragraphsBefore = await body.locator(':scope > p').count()
  await page.keyboard.press('ArrowRight')
  await expect(body.locator(':scope > p')).toHaveCount(paragraphsBefore)
  await page.keyboard.type('续写')
  await expect(strong).toHaveText('最后一行粗体续写')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(body.locator(':scope > p')).toHaveCount(
    paragraphsBefore + 1,
  )
  await page.keyboard.type('下一行普通文本')

  await expect(strong).toHaveText('最后一行粗体续写')
  await expect(body).toContainText('下一行普通文本')
  await expect(strong).not.toContainText('下一行普通文本')
})

test('ArrowRight enters a marked range before exiting its trailing marker', async ({
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
  await page.keyboard.type('**1**')
  const strong = body.locator('strong')
  await expect(strong).toHaveText('1')

  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('2')
  await expect(strong).toHaveText('12')

  await page.keyboard.press('ArrowRight')
  await expect(body.locator('.markdown-context-marker')).toHaveCount(0)
  await page.keyboard.type('普通')
  await expect(strong).toHaveText('12')
  await expect(body).toContainText('12普通')
})

test('ArrowRight enters then exits every common inline mark on the same line', async ({
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
  const cases = [
    { content: '斜体内容', markdown: '*斜体内容*', selector: 'em' },
    {
      content: '删除线内容',
      markdown: '~~删除线内容~~',
      selector: 's',
    },
    {
      content: '行内代码内容',
      markdown: '`行内代码内容`',
      selector: 'code',
    },
  ]

  for (const item of cases) {
    await body.fill('')
    await body.click()
    await page.keyboard.type(item.markdown)

    const marked = body.locator(item.selector)
    await expect(marked).toHaveText(item.content)
    await marked.click()
    await page.keyboard.press('End')
    const paragraphsBefore = await body.locator(':scope > p').count()
    await page.keyboard.press('ArrowRight')
    await expect(body.locator(':scope > p')).toHaveCount(paragraphsBefore)
    await page.keyboard.type('续写')
    await expect(marked).toHaveText(`${item.content}续写`)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.type('同排普通文本')

    await expect(marked).toHaveText(`${item.content}续写`)
    await expect(body).toContainText(`${item.content}续写同排普通文本`)
  }

  await body.fill('')
  await body.click()
  await page.keyboard.type('链接内容')
  await page.keyboard.press('Control+A')
  await page.getByRole('button', { name: '链接' }).click()
  const dialog = page.getByRole('dialog', { name: '添加链接' })
  await dialog.getByLabel('链接地址').fill('https://example.com')
  await dialog.getByRole('button', { name: '应用' }).click()

  const link = body.getByRole('link', { name: '链接内容' })
  const paragraphsBefore = await body.locator(':scope > p').count()
  const linkBox = await link.boundingBox()
  if (!linkBox) throw new Error('找不到链接文本位置')
  await page.mouse.click(
    linkBox.x + linkBox.width - 1,
    linkBox.y + linkBox.height / 2,
  )
  await page.keyboard.press('End')
  await page.keyboard.press('ArrowRight')
  await expect(body.locator(':scope > p')).toHaveCount(paragraphsBefore)
  await page.keyboard.type('续写')
  await expect(link).toHaveText('链接内容续写')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('同排普通文本')

  await expect(link).toHaveText('链接内容续写')
  await expect(body).toHaveText(/链接内容续写\s*同排普通文本/)
})

test('ArrowLeft reaches the first heading prefix without creating a paragraph', async ({
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
  await body.fill('## 第二节')

  const heading = body.getByRole('heading', { name: '第二节' })
  const paragraphsBefore = await body.locator(':scope > p').count()
  await heading.click()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowLeft')
  await expect(body.locator(':scope > p')).toHaveCount(paragraphsBefore)
  await expect(heading).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(body.locator(':scope > p')).toHaveCount(
    paragraphsBefore + 1,
  )
  await page.keyboard.type('标题前面的普通内容')

  await expect(body).toContainText('标题前面的普通内容')
  await expect(heading).toBeVisible()
  await expect
    .poll(() =>
      heading.evaluate(
        (element) => element.previousElementSibling?.tagName ?? '',
      ),
    )
    .toBe('P')
})

test('typing at the first heading character inserts before it', async ({
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
  await page.getByRole('button', { name: '二级标题' }).click()
  await page.keyboard.type('我怕时间哦')
  const heading = body.getByRole('heading', { name: '我怕时间哦' })
  await heading.click()
  await page.keyboard.press('Home')
  await page.keyboard.type('前')

  await expect(
    body.getByRole('heading', { name: '前我怕时间哦' }),
  ).toBeVisible()
})

test('a single blank line uses compact vertical spacing', async ({ page }) => {
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
    clipboard.setData('text/plain', '我\n\n## 我怕时间哦\n')
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    )
  })
  const paragraph = body.getByText('我', { exact: true })
  const heading = body.getByRole('heading', { name: '我怕时间哦' })
  const paragraphBox = await paragraph.boundingBox()
  const headingBox = await heading.boundingBox()
  if (!paragraphBox || !headingBox) throw new Error('找不到间距测量元素')

  expect(headingBox.y - (paragraphBox.y + paragraphBox.height)).toBeLessThan(
    40,
  )
})

test('ArrowUp does not create a paragraph at the first block', async ({
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
  await page.keyboard.type('原来的第一段')
  const originalBlock = body.getByText('原来的第一段', { exact: true })
  await originalBlock.click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Backspace')

  const firstParagraph = body.getByText('原来的第一段', { exact: true })
  await expect(firstParagraph).toHaveText('原来的第一段')
  await firstParagraph.click()
  await page.keyboard.press('Home')
  const paragraphsBefore = await body.locator(':scope > p').count()
  await page.keyboard.press('ArrowUp')
  await expect(body.locator(':scope > p')).toHaveCount(paragraphsBefore)
  await expect(firstParagraph).toHaveText('原来的第一段')
  await expect(body).toContainText('原来的第一段')
})
