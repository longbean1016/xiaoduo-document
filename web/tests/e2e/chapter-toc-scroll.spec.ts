import './database-isolation'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} active chapter section stays visible inside the page toc`, async ({
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
  const lastSection = toc.getByRole('link', { name: '第 36 节' })
  const scrollRoot = page.locator('#library-content')

  await scrollRoot.evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight })
  })

  await expect(lastSection).toHaveAttribute('aria-current', 'location')
  await expect
    .poll(async () =>
      toc.evaluate((element) => {
        const active = element.querySelector<HTMLElement>(
          'a[aria-current="location"]',
        )
        if (!active) return false
        const tocRect = element.getBoundingClientRect()
        const activeRect = active.getBoundingClientRect()
        return (
          element.scrollTop > 0 &&
          activeRect.top >= tocRect.top - 1 &&
          activeRect.bottom <= tocRect.bottom + 1
        )
      }),
    )
    .toBe(true)
  expect(
    await scrollRoot.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0)
  })
}
