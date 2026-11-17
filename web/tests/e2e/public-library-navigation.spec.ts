import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'
import { createTestConnection } from '../test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('reader navigates the public library and adjacent chapters', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 500 })
  await page.goto('/')
  await page.getByRole('link', { name: '进入笔记库' }).click()
  await expect(page).toHaveURL(/\/library$/)
  await expect(
    page.getByRole('navigation', { name: '笔记目录' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: '工具与方法' })).toHaveCount(0)

  await page
    .getByRole('navigation', { name: '笔记目录' })
    .getByRole('link', { name: '写作不是归档' })
    .click()
  await expect(
    page.getByRole('heading', { level: 1, name: '写作不是归档' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: '面包屑' }),
  ).toContainText('注意力与写作')
  await expect(
    page.getByRole('link', { name: '写作不是归档' }),
  ).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('.chapter-byline strong')).toHaveText('小多')
  await expect(page.locator('.chapter-byline')).toContainText(/\d+ 字/)
  await expect(
    page.getByRole('link', { name: /下一章.*长期维护/ }),
  ).toHaveAttribute(
    'href',
    '/library/attention-and-writing/长期维护',
  )

  const chapterToc = page.getByLabel('本章目录')
  const firstSection = chapterToc.getByRole('link', {
    name: '从记录开始',
  })
  const secondSection = chapterToc.getByRole('link', {
    name: '持续修订',
  })
  await firstSection.click()
  await expect(firstSection).toHaveAttribute('aria-current', 'location')
  await page.locator('#library-content').evaluate((element) => {
    element.scrollTo({ top: element.scrollHeight })
  })
  await expect(secondSection).toHaveAttribute('aria-current', 'location')

  await page.goto('/library/tools')
  await expect(
    page.getByText('这个分类暂时没有公开章节。'),
  ).toBeVisible()
})

test('collaboration application entry is removed from public chapters', async ({
  page,
}) => {
  await page.goto('/library/attention-and-writing/写作不是归档')
  await expect(
    page.getByText('愿意一起完善这篇笔记？'),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '申请参与编辑' }),
  ).toHaveCount(0)
})

test('library index reflects published data without rebuilding the app', async ({
  page,
}) => {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO category (id, title, slug, position)
       VALUES (?, ?, ?, ?)`,
      ['category-live', '实时发布分类', 'live-published', 99],
    )
    await connection.query(
      `INSERT INTO article (
        id, category_id, title, path, position, markdown, plain_text,
        revision, publication_state, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'article-live',
        'category-live',
        '构建后发布的章节',
        '构建后发布的章节',
        1,
        '实时数据库内容',
        '实时数据库内容',
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
        'version-live',
        'article-live',
        'published',
        '构建后发布的章节',
        'category-live',
        '构建后发布的章节',
        '实时数据库内容',
        '实时数据库内容',
        'owner-1',
        '小多',
        'owner',
      ],
    )
  } finally {
    await connection.end()
  }

  await page.goto('/library')
  await expect(
    page
      .locator('.chapter-list-row')
      .filter({ hasText: '实时发布分类' }),
  ).toBeVisible()
  await expect(page.getByText('笔记库还是空的')).toHaveCount(0)
})
