import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'
import { loginAsCollaborator } from './login-as-collaborator'

test.beforeEach(async () => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-dashboard', '协作者首页', 'dashboard@example.com',
        true, 'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-dashboard',
        'collaborator-dashboard',
        'credential',
        'collaborator-dashboard',
        await hashPassword('collaborator-password'),
      ],
    )
    await connection.query(
      `INSERT INTO article_grant (user_id, article_id, created_at)
       VALUES ('collaborator-dashboard', 'article-1', NOW(3))`,
    )
  } finally {
    await connection.end()
  }
})

test('owner filters and searches accessible chapters', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await expect(
    page.getByRole('heading', { level: 1, name: '写作台' }),
  ).toBeVisible()
  const stats = page.locator('.studio-stats')
  await expect(stats.getByText('全部章节')).toBeVisible()
  await expect(stats.getByText('公开', { exact: true })).toBeVisible()
  await expect(stats.getByText('草稿', { exact: true })).toBeVisible()
  await expect(stats.getByText('最近整理')).toBeVisible()
  await expect(
    page.getByRole('button', { name: '导入 Markdown' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '新建章节', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /写作不是归档/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /长期维护/ }),
  ).toBeVisible()

  await page.getByRole('button', { name: '已发布' }).click()
  await expect(
    page.getByRole('link', { name: /写作不是归档/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: '草稿' }).click()
  await expect(page.getByText('没有匹配的章节')).toBeVisible()
  await page.getByRole('button', { name: '清除筛选' }).click()

  const search = page.getByPlaceholder('搜索章节')
  await search.fill('长期')
  await expect(
    page.getByRole('link', { name: /长期维护/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /写作不是归档/ }),
  ).toHaveCount(0)

  await search.fill('不存在的章节')
  await expect(page.getByText('没有匹配的章节')).toBeVisible()
  await page.getByRole('button', { name: '清除筛选' }).click()
  await expect(
    page.getByRole('link', { name: /长期维护/ }),
  ).toBeVisible()
})

test('owner selects one or multiple chapters before moving them to trash', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const toolbar = page.locator('.studio-toolbar')
  await expect(toolbar).toHaveCSS('position', 'sticky')
  await expect(
    page.getByRole('button', { name: '按时间倒序' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '按时间正序' }).click()
  await expect(
    page.getByRole('button', { name: '按时间正序' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('button', { name: '按时间倒序' }),
  ).toHaveAttribute('aria-pressed', 'false')

  await page.getByRole('button', { name: '删除', exact: true }).click()
  const firstCheckbox = page.getByRole('checkbox', {
    name: '选择 写作不是归档',
  })
  const secondCheckbox = page.getByRole('checkbox', {
    name: '选择 长期维护',
  })
  await expect(firstCheckbox).toBeVisible()
  await expect(secondCheckbox).toBeVisible()

  await secondCheckbox.check()
  await expect(page.getByText('已选择 1 个章节')).toBeVisible()
  await page.getByRole('button', { name: '移入回收站' }).click()

  const singleConfirm = page.getByRole('alertdialog', {
    name: '删除这个章节？',
  })
  await expect(singleConfirm).toBeVisible()
  await singleConfirm.getByRole('button', { name: '取消' }).click()
  await expect(
    page.getByRole('link', { name: /长期维护/ }),
  ).toBeVisible()

  await firstCheckbox.check()
  await expect(page.getByText('已选择 2 个章节')).toBeVisible()
  await page.getByRole('button', { name: '移入回收站' }).click()
  const multiConfirm = page.getByRole('alertdialog', {
    name: '删除所选章节？',
  })
  await expect(multiConfirm).toBeVisible()
  await multiConfirm.getByRole('button', { name: '移入回收站' }).click()
  await expect(
    page.getByRole('link', { name: /写作不是归档/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: /长期维护/ }),
  ).toHaveCount(0)
})

test('owner confirms category before creating a chapter draft', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  let createRequests = 0
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith('/api/studio/articles')
    ) {
      createRequests += 1
    }
  })

  await page
    .getByRole('button', { name: '新建章节', exact: true })
    .click()
  const createDialog = page.getByRole('dialog', { name: '新建章节' })
  await expect(createDialog).toBeVisible()
  expect(createRequests).toBe(0)
  await createDialog.getByRole('button', { name: '取消' }).click()
  await expect(createDialog).toBeHidden()
  expect(createRequests).toBe(0)

  await page
    .getByRole('button', { name: '新建章节', exact: true })
    .click()
  const [created] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/studio/articles'),
    ),
    createDialog.getByRole('button', { name: '创建草稿' }).click(),
  ])
  expect(created.status()).toBe(201)
  const payload = (await created.json()) as { article: { id: string } }
  await expect(page).toHaveURL(
    new RegExp(`/studio/notes/${payload.article.id}$`),
  )
  await expect(page.getByLabel('章节标题')).toHaveValue('无标题章节')
})

test('collaborator sees only authorized chapters and no owner actions', async ({
  page,
}) => {
  await loginAsCollaborator(page, 'dashboard@example.com')

  await expect(
    page.getByRole('heading', { level: 1, name: '写作台' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /写作不是归档/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /长期维护/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '导入 Markdown' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '新建章节', exact: true }),
  ).toHaveCount(0)
})
