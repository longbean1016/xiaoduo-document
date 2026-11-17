import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test, type Page } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { appOrigin } from './app-origin'
import { loginAsCollaborator } from './login-as-collaborator'

test.beforeAll(async () => {
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES
        ('collaborator-18a', '协作者 18A', 'trash-a@example.com', true,
         'collaborator', 'active', NOW(3), NOW(3)),
        ('collaborator-18b', '协作者 18B', 'trash-b@example.com', true,
         'collaborator', 'active', NOW(3), NOW(3))`,
    )
    for (const suffix of ['a', 'b']) {
      await connection.query(
        `INSERT INTO auth_account (
          id, account_id, provider_id, user_id, password, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          `account-collaborator-18${suffix}`,
          `collaborator-18${suffix}`,
          'credential',
          `collaborator-18${suffix}`,
          await hashPassword('collaborator-password'),
        ],
      )
    }
    await connection.query(
      `INSERT INTO article_grant (user_id, article_id, created_at) VALUES
        ('collaborator-18a', 'article-1', NOW(3)),
        ('collaborator-18b', 'article-2', NOW(3))`,
    )
  } finally {
    await connection.end()
  }
})

async function moveToTrash(page: Page, title: string) {
  await page.getByRole('button', { name: '删除', exact: true }).click()
  await page.getByRole('checkbox', { name: `选择 ${title}` }).check()
  await page.getByRole('button', { name: '移入回收站' }).click()
  await page
    .getByRole('alertdialog', { name: '删除这个章节？' })
    .getByRole('button', { name: '移入回收站' })
    .click()
}

test('collaborators batch restore only their own trash actor items', async ({
  browser,
}) => {
  const firstContext = await browser.newContext()
  const firstPage = await firstContext.newPage()
  await loginAsCollaborator(firstPage, 'trash-a@example.com')
  await moveToTrash(firstPage, '写作不是归档')
  await firstPage.getByRole('link', { name: '回收站' }).click()
  await expect(firstPage).toHaveURL(/\/studio\/trash$/)
  await expect(
    firstPage.getByRole('heading', { name: '写作不是归档' }),
  ).toBeVisible()
  await expect(firstPage.getByText('长期维护')).toHaveCount(0)
  await firstPage.getByRole('button', { name: '集中操作' }).click()
  await expect(
    firstPage.getByRole('button', { name: '永久删除' }),
  ).toHaveCount(0)

  const secondContext = await browser.newContext()
  const secondPage = await secondContext.newPage()
  await loginAsCollaborator(secondPage, 'trash-b@example.com')
  await moveToTrash(secondPage, '长期维护')
  await secondPage.getByRole('link', { name: '回收站' }).click()
  await expect(secondPage).toHaveURL(/\/studio\/trash$/)
  await expect(
    secondPage.getByRole('heading', { name: '长期维护' }),
  ).toBeVisible()
  await expect(secondPage.getByText('写作不是归档')).toHaveCount(0)
  expect(
    (
      await secondPage.request.post(
        '/api/studio/articles/article-1/restore',
        { headers: { origin: appOrigin } },
      )
    ).status(),
  ).toBe(404)
  expect(
    (
      await secondPage.request.delete(
        '/api/studio/articles/article-2',
        { headers: { origin: appOrigin } },
      )
    ).status(),
  ).toBe(403)

  await secondPage.getByRole('button', { name: '集中操作' }).click()
  await secondPage
    .getByRole('checkbox', { name: '选择 长期维护' })
    .check()
  await secondPage.getByRole('button', { name: '恢复所选' }).click()
  await expect(secondPage.getByText('回收站是空的')).toBeVisible()

  await firstPage
    .getByRole('checkbox', { name: '选择 写作不是归档' })
    .check()
  await firstPage.getByRole('button', { name: '恢复所选' }).click()
  await expect(firstPage.getByText('回收站是空的')).toBeVisible()

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await ownerPage.goto('/studio/login')
  await ownerPage.getByLabel('邮箱').fill('owner@example.com')
  await ownerPage.getByLabel('密码').fill('owner-test-password')
  await ownerPage.getByRole('button', { name: '进入写作台' }).click()
  await expect(ownerPage).toHaveURL(/\/studio$/)
  await moveToTrash(ownerPage, '写作不是归档')
  await ownerPage.getByRole('link', { name: '回收站' }).click()
  await expect(ownerPage).toHaveURL(/\/studio\/trash$/)
  await ownerPage.getByRole('button', { name: '集中操作' }).click()
  await expect(
    ownerPage.getByRole('button', { name: '永久删除' }),
  ).toBeVisible()

  await ownerContext.close()
  await secondContext.close()
  await firstContext.close()
})
