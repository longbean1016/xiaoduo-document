import './database-isolation'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { appOrigin } from './app-origin'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'

const readingMarkdown = `## 阅读渲染

**公开粗体**

| 能力 | 状态 |
| --- | --- |
| 表格 | 支持 |

\`\`\`java
public class Demo {
  public static void main(String[] args) {
    System.out.println("hello");
  }
}
\`\`\`

\`\`\`custom-unknown
unknown language stays readable
\`\`\`

\`\`\`mermaid
graph TD
  A[开始] --> B[结束]
\`\`\`
`

test.beforeEach(async () => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      'UPDATE article SET markdown = ?, plain_text = ? WHERE id = ?',
      [readingMarkdown, '阅读渲染 公开粗体 表格 支持', 'article-1'],
    )
    await connection.query(
      `UPDATE article_version
       SET markdown = ?, plain_text = ?
       WHERE id = ?`,
      [readingMarkdown, '阅读渲染 公开粗体 表格 支持', 'version-1'],
    )
  } finally {
    await connection.end()
  }
})

test('public reader renders rich Markdown, code and Mermaid', async ({
  context,
  page,
}) => {
  await page.goto('/library/attention-and-writing/写作不是归档')

  const article = page.locator('.markdown-body')
  await expect(
    article.getByRole('heading', { name: '阅读渲染' }),
  ).toBeVisible()
  await expect(article.locator('strong')).toHaveText('公开粗体')
  await expect(article.locator('table')).toContainText('支持')
  await expect(article.locator('pre code.language-java')).toBeVisible()
  await expect(article.locator('.hljs-keyword').first()).toBeVisible()
  const codeLines = article
    .locator('.markdown-code-block')
    .first()
    .locator('.markdown-code-line')
  await expect(codeLines).toHaveCount(5)
  await expect
    .poll(() =>
      codeLines.evaluateAll((lines) =>
        lines.map((line) => line.getAttribute('data-line')),
      ),
    )
    .toEqual(['1', '2', '3', '4', '5'])
  expect(
    await article
      .locator('pre code.language-java')
      .evaluate((element) => getComputedStyle(element).fontSize),
  ).toBe('13px')
  expect(
    await article
      .locator('pre code.language-java')
      .evaluate((element) => getComputedStyle(element).lineHeight),
  ).toBe('20.8px')
  expect(
    await article
      .locator('.markdown-code-block pre')
      .first()
      .evaluate((element) => getComputedStyle(element).paddingLeft),
  ).toBe('0px')
  expect(
    await article
      .locator('.markdown-code-block')
      .first()
      .evaluate((element) => getComputedStyle(element).borderRadius),
  ).toBe('6px')
  expect(
    await article
      .locator('.markdown-code-block-header')
      .first()
      .evaluate((element) => getComputedStyle(element).minHeight),
  ).toBe('32px')
  expect(
    await article
      .locator('.markdown-code-line')
      .first()
      .evaluate((element) => getComputedStyle(element, '::before').width),
  ).toBe('42px')
  expect(
    await article
      .locator('.markdown-code-block')
      .first()
      .evaluate((element) => {
        const codeElement = element.querySelector(
          '.markdown-code-line-content',
        )
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
  const copyButton = article
    .locator('.markdown-code-block')
    .first()
    .getByRole('button', { name: '复制代码' })
  await expect(copyButton).toHaveAttribute('data-copy-ready', 'true')
  await copyButton.click()
  await expect(
    article
      .locator('.markdown-code-block')
      .first()
      .getByRole('button', { name: 'Copied' }),
  ).toContainText('Copied')
  expect(
    (
      await page.evaluate(() => navigator.clipboard.readText())
    ).replace(/\r\n?/g, '\n'),
  ).toBe(
    'public class Demo {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}',
  )
  await expect(
    article.locator('pre code.language-custom-unknown'),
  ).toContainText('unknown language stays readable')
  await expect(
    article.locator('pre code.language-custom-unknown .hljs-keyword'),
  ).toHaveCount(0)
  await expect(article.locator('.mermaid-diagram svg')).toBeVisible()
  await expect(article.locator('.mermaid-diagram svg script')).toHaveCount(0)

  const captureDir = process.env.MARKDOWN_CAPTURE_DIR
  if (captureDir) await mkdir(captureDir, { recursive: true })

  for (const width of [1280, 768, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
    await page.reload()
    await expect(article.locator('.mermaid-diagram svg')).toBeVisible()
    for (const [theme, background] of [
      ['light', 'rgb(241, 248, 244)'],
      ['dark', 'rgb(23, 32, 27)'],
    ] as const) {
      await page.evaluate((nextTheme) => {
        document.documentElement.dataset.theme = nextTheme
      }, theme)
      expect(
        await article
          .locator('.markdown-code-block')
          .first()
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      ).toBe(background)
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth,
          ),
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
