import './database-isolation'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'
import { appOrigin } from './app-origin'
import { loginAsCollaborator } from './login-as-collaborator'

test('owner imports Markdown as an editable draft', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.getByRole('button', { name: '导入 Markdown' }).click()
  const importDialog = page.getByRole('dialog', {
    name: '导入 Markdown',
  })
  await importDialog.getByLabel('Markdown 文件').setInputFiles({
    name: '导入的章节.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('## 导入小节\n\n从文件导入的正文。'),
  })
  await importDialog
    .getByRole('button', { name: '导入为草稿' })
    .click()
  await expect(page.getByLabel('章节标题')).toHaveValue('导入的章节')
  await expect(page.getByRole('textbox', { name: '章节正文' })).toContainText(
    '从文件导入的正文。',
  )
})

test('collaborator imports Markdown and receives access to the draft', async ({
  page,
}) => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-import', '导入协作者', 'import@example.com',
        true, 'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO article_grant (user_id, article_id, created_at)
       VALUES ('collaborator-import', 'article-1', NOW(3))`,
    )
  } finally {
    await connection.end()
  }

  await loginAsCollaborator(page, 'import@example.com')
  const forbiddenImport = await page.request.post(
    '/api/studio/articles/import',
    {
      headers: { origin: appOrigin },
      multipart: {
        categoryId: 'category-2',
        file: {
          name: '越权导入.md',
          mimeType: 'text/markdown',
          buffer: Buffer.from('# 不应创建'),
        },
      },
    },
  )
  expect(forbiddenImport.status()).toBe(403)

  await expect(
    page.getByRole('button', { name: '导入 Markdown' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '新建章节', exact: true }),
  ).toHaveCount(0)

  await page.getByRole('button', { name: '导入 Markdown' }).click()
  const importDialog = page.getByRole('dialog', {
    name: '导入 Markdown',
  })
  await importDialog.getByLabel('Markdown 文件').setInputFiles({
    name: '协作者导入.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('## 协作者导入\n\n协作者可以继续编辑。'),
  })
  await importDialog
    .getByRole('button', { name: '导入为草稿' })
    .click()

  await expect(page.getByLabel('章节标题')).toHaveValue('协作者导入')
  await expect(
    page.getByRole('button', { name: '导入 Markdown' }),
  ).toBeVisible()
  const articleId = page.url().split('/').at(-1)
  expect(articleId).toBeTruthy()

  const verify = await createTestConnection()
  try {
    const [grants] = await verify.query(
      `SELECT user_id, article_id FROM article_grant WHERE article_id = ?`,
      [articleId],
    )
    expect(grants).toEqual([
      expect.objectContaining({
        user_id: 'collaborator-import',
        article_id: articleId,
      }),
    ])
  } finally {
    await verify.end()
  }
})
