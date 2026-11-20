import './database-isolation'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} active chapter section is centered in the page toc`, async ({
    page,
  }) => {
    const sections = Array.from(
      { length: 36 },
      (_, index) =>
        `## 第 ${index + 1} 节\n\n${'这一节用于验证长目录跟随滚动。'.repeat(8)}`,
    ).join('\n\n')
    const markdown = `# 长目录文章\n\n${sections}\n`
    const plainText = markdown.replace(/[#*_`>-]/g, ' ')
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO category (id, title, slug, position)
         VALUES (?, ?, ?, ?)`,
        ['category-toc-long', '长目录', 'long-toc', 99],
      )
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, markdown, plain_text, revision,
          publication_state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          'article-toc-long',
          'category-toc-long',
          '长目录文章',
          '长目录文章',
          markdown,
          plainText,
          1,
          'published',
        ],
      )
      await connection.query(
        `INSERT INTO article_version (
          id, article_id, kind, title, category_id, path, markdown, plain_text,
          author_id, author_name, author_role, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
        [
          'version-toc-long',
          'article-toc-long',
          'published',
          '长目录文章',
          'category-toc-long',
          '长目录文章',
          markdown,
          plainText,
          'owner-1',
          '小多',
          'owner',
        ],
      )
    } finally {
      await connection.end()
    }

    await page.addInitScript((mode) => {
      window.localStorage.setItem('zhijian-theme', mode)
    }, theme)
    await page.setViewportSize({ width: 1440, height: 700 })
    await page.goto('/library/long-toc/长目录文章')

    const toc = page.getByLabel('本章目录')
    const middleSection = toc.getByRole('link', { name: '第 18 节' })
    const scrollRoot = page.locator('#library-content')

    await scrollRoot.evaluate((element) => {
      const heading = document.getElementById('第-18-节')
      if (!heading) throw new Error('missing heading')
      element.scrollTop +=
        heading.getBoundingClientRect().top -
        element.getBoundingClientRect().top -
        120
    })

    await expect(middleSection).toHaveAttribute(
      'aria-current',
      'location',
    )
    await expect
      .poll(async () =>
        toc.evaluate((element) => {
          const active = element.querySelector<HTMLElement>(
            'a[aria-current="location"]',
          )
          if (!active) return Number.POSITIVE_INFINITY
          const tocRect = element.getBoundingClientRect()
          const activeRect = active.getBoundingClientRect()
          return Math.abs(
            activeRect.top +
              activeRect.height / 2 -
              (tocRect.top + element.clientHeight / 2),
          )
        }),
      )
      .toBeLessThanOrEqual(4)
  })
}

test('studio editor centers the active heading in its toc', async ({
  page,
}) => {
  const sections = Array.from(
    { length: 36 },
    (_, index) =>
      `## 第 ${index + 1} 节\n\n${'这一节用于验证写作台目录居中。'.repeat(8)}`,
  ).join('\n\n')
  const markdown = `# 长目录文章\n\n${sections}\n`
  const plainText = markdown.replace(/[#*_`>-]/g, ' ')
  const connection = await createTestConnection()
  try {
    await connection.query(
      `UPDATE article
       SET markdown = ?, plain_text = ?, content_json = NULL,
           revision = revision + 1, updated_at = NOW(3)
       WHERE id = 'article-1'`,
      [markdown, plainText],
    )
  } finally {
    await connection.end()
  }

  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.setViewportSize({ width: 1440, height: 700 })
  await page.goto('/studio/notes/article-1')

  const workspace = page.locator('.studio-editor-workspace.is-editing')
  const toc = page.locator('.studio-editor-toc')
  const middleSection = toc.getByRole('button', { name: '第 18 节' })

  await workspace.evaluate((element) => {
    const editor = document.querySelector<HTMLElement>(
      '[aria-label="章节正文"]',
    )
    const heading = Array.from(
      editor?.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5') ?? [],
    ).find((item) => item.textContent === '第 18 节')
    if (!heading) throw new Error('missing editor heading')
    element.scrollTop +=
      heading.getBoundingClientRect().top -
      element.getBoundingClientRect().top -
      120
  })

  await expect(middleSection).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect
    .poll(async () =>
      toc.evaluate((element) => {
        const active = element.querySelector<HTMLElement>(
          'button[aria-current="location"]',
        )
        if (!active) return Number.POSITIVE_INFINITY
        const tocRect = element.getBoundingClientRect()
        const activeRect = active.getBoundingClientRect()
        return Math.abs(
          activeRect.top +
            activeRect.height / 2 -
            (tocRect.top + element.clientHeight / 2),
        )
      }),
    )
    .toBeLessThanOrEqual(4)
})
