import './database-isolation'
import { expect, type Locator, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

async function cssPixels(locator: Locator, property: string) {
  return locator.evaluate(
    (element, name) =>
      Number.parseFloat(
        window.getComputedStyle(element).getPropertyValue(name),
      ),
    property,
  )
}

async function iconWidth(locator: Locator) {
  const box = await locator.locator('svg').first().boundingBox()
  return box?.width ?? 0
}

test('public reading surfaces use the larger type and icon scale', async ({
  page,
}) => {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, image, role, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'collaborator-byline',
        '周行',
        'byline@example.com',
        true,
        '/xiaoduo-mark.jpg',
        'collaborator',
        'active',
      ],
    )
    await connection.query(
      `INSERT INTO article_version (
        id, article_id, kind, title, category_id, path, markdown, plain_text,
        author_id, author_name, author_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))`,
      [
        'version-byline-contributor',
        'article-1',
        'published',
        '写作不是归档',
        'category-1',
        '写作不是归档',
        '## 从记录开始\n\n这是来自 MySQL 的公开章节。\n',
        '写作不是归档 这是来自 MySQL 的公开章节。',
        'collaborator-byline',
        '周行',
        'collaborator',
      ],
    )
  } finally {
    await connection.end()
  }

  await page.goto('/library/attention-and-writing/写作不是归档')

  const prose = page.getByText('这是来自 MySQL 的公开章节。')
  const authors = page.getByRole('group', { name: '作者' })
  const chapterLink = page
    .getByRole('navigation', { name: '笔记目录' })
    .getByRole('link', { name: '写作不是归档' })
  const searchButton = page.getByRole('button', { name: '搜索' })

  expect(await cssPixels(prose, 'font-size')).toBeGreaterThanOrEqual(19)
  await expect(
    authors.locator('strong').filter({ hasText: '小多' }),
  ).toHaveCount(1)
  await expect(
    authors.locator('strong').filter({ hasText: '周行' }),
  ).toHaveCount(1)
  const authorItems = authors.locator('.chapter-author')
  await expect(authorItems).toHaveCount(2)
  await expect(
    authorItems.nth(1).locator('.author-avatar img'),
  ).toHaveAttribute('src', '/xiaoduo-mark.jpg')
  expect(
    await authorItems
      .nth(0)
      .evaluate((element) => getComputedStyle(element).borderLeftWidth),
  ).toBe('0px')
  expect(
    await authorItems
      .nth(1)
      .evaluate((element) => getComputedStyle(element).borderLeftWidth),
  ).toBe('1px')
  await expect(
    page.getByText('协作者', { exact: true }),
  ).toHaveCount(0)
  await expect(authors.getByText('41 字')).toHaveCount(0)
  expect(await cssPixels(chapterLink, 'font-size')).toBeGreaterThanOrEqual(14)
  expect(await iconWidth(searchButton)).toBeGreaterThanOrEqual(18)
})

test('studio navigation and actions use the larger type and icon scale', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()

  const navigation = page.getByRole('navigation', {
    name: '写作台导航',
  })
  const contentLink = navigation.getByRole('link', { name: '内容' })
  const importButton = page.getByRole('button', {
    name: '导入 Markdown',
  })

  expect(await cssPixels(contentLink, 'font-size')).toBeGreaterThanOrEqual(14)
  expect(await iconWidth(contentLink)).toBeGreaterThanOrEqual(18)
  expect(await cssPixels(importButton, 'font-size')).toBeGreaterThanOrEqual(14)
  expect(await iconWidth(importButton)).toBeGreaterThanOrEqual(18)
})
