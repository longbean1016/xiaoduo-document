import './database-isolation'
import { hashPassword } from 'better-auth/crypto'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { seedTestDatabase } from '../seed-test-db'
import { appOrigin } from './app-origin'
import { loginAsCollaborator } from './login-as-collaborator'

test.beforeEach(async () => {
  await seedTestDatabase()
  const connection = await createTestConnection()
  try {
    await connection.query(
      `INSERT INTO auth_user (
        id, name, email, email_verified, role, status, created_at, updated_at
      ) VALUES (
        'collaborator-19', '协作者十九', 'managed-19@example.com', true,
        'collaborator', 'active', NOW(3), NOW(3)
      )`,
    )
    await connection.query(
      `INSERT INTO auth_account (
        id, account_id, provider_id, user_id, password, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [
        'account-collaborator-19',
        'collaborator-19',
        'credential',
        'collaborator-19',
        await hashPassword('old-collaborator-password'),
      ],
    )
    await connection.query(
      `INSERT INTO article_grant (user_id, article_id, created_at)
       VALUES ('collaborator-19', 'article-1', NOW(3))`,
    )
  } finally {
    await connection.end()
  }
})

test('owner suspends and restores a collaborator account', async ({
  browser,
}) => {
  const collaboratorContext = await browser.newContext()
  const collaboratorPage = await collaboratorContext.newPage()
  await loginAsCollaborator(collaboratorPage, 'managed-19@example.com')

  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await ownerPage.goto('/studio/login')
  await ownerPage.getByLabel('邮箱').fill('owner@example.com')
  await ownerPage.getByLabel('密码').fill('owner-test-password')
  await ownerPage.getByRole('button', { name: '进入写作台' }).click()
  await expect(ownerPage).toHaveURL(/\/studio$/)
  await ownerPage.goto('/studio/collaboration')
  await expect(
    ownerPage.getByRole('tab', { name: '申请审核' }),
  ).toBeVisible()
  await expect(
    ownerPage.getByRole('tab', { name: '邀请记录' }),
  ).toBeVisible()
  await ownerPage.getByRole('tab', { name: '协作者' }).click()
  await ownerPage
    .getByRole('button', { name: '暂停账号 协作者十九' })
    .click()
  await expect(ownerPage.getByText('账号已暂停')).toBeVisible()

  await collaboratorPage.goto('/studio')
  await expect(collaboratorPage).toHaveURL(/\/studio\/login/)

  await ownerPage
    .getByRole('button', { name: '恢复账号 协作者十九' })
    .click()
  await expect(ownerPage.getByText('账号已恢复')).toBeVisible()

  await loginAsCollaborator(collaboratorPage, 'managed-19@example.com')
  await expect(
    collaboratorPage.getByRole('link', { name: '写作不是归档' }),
  ).toBeVisible()

  await expect(
    ownerPage.getByRole('button', {
      name: '生成重置链接 协作者十九',
    }),
  ).toHaveCount(0)
  expect(
    (
      await ownerPage.request.post(
        '/api/studio/collaboration/collaborators/collaborator-19/password-reset',
        { headers: { origin: appOrigin } },
      )
    ).status(),
  ).toBe(410)

  await ownerContext.close()
  await collaboratorContext.close()
})

test('owner confirms before revoking an article grant', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/collaboration')
  await page.getByRole('tab', { name: '协作者' }).click()
  await page.getByRole('button', { name: '管理授权' }).click()

  const editor = page.getByRole('dialog', { name: '管理文章授权' })
  const grant = editor.getByRole('checkbox', {
    name: '授权文章 写作不是归档',
  })
  await expect(grant).toBeChecked()
  await grant.uncheck()
  await editor.getByRole('button', { name: '保存授权' }).click()

  const confirm = page.getByRole('alertdialog', {
    name: '撤销文章授权？',
  })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: '取消' }).click()
  await expect(grant).toBeChecked()

  await grant.uncheck()
  await editor.getByRole('button', { name: '保存授权' }).click()
  const [revoked] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        response.url().endsWith('/api/studio/collaboration/grants'),
    ),
    confirm.getByRole('button', { name: '撤销授权' }).click(),
  ])
  expect(revoked.status()).toBe(200)
  await expect(page.getByText('文章授权已更新')).toBeVisible()

  await page.reload()
  await page.getByRole('tab', { name: '协作者' }).click()
  await page.getByRole('button', { name: '管理授权' }).click()
  await expect(
    page
      .getByRole('dialog', { name: '管理文章授权' })
      .getByRole('checkbox', { name: '授权文章 写作不是归档' }),
  ).not.toBeChecked()
})

test('owner confirms before revoking a pending invitation', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const created = await page.request.post(
    '/api/studio/collaboration/invites',
    {
      headers: { origin: appOrigin },
      data: {
        articleIds: ['article-1'],
      },
    },
  )
  expect(created.status()).toBe(201)

  await page.goto('/studio/collaboration')
  await page.getByRole('tab', { name: '邀请记录' }).click()
  const inviteRow = page
    .locator('.collaboration-invite-row')
    .filter({ hasText: '未绑定邮箱' })
    .last()
  const revokeButton = inviteRow.getByRole('button', {
    name: '撤销邀请',
  })
  await revokeButton.focus()
  await page.keyboard.press('Enter')

  const confirm = page.getByRole('alertdialog', {
    name: '撤销这个邀请？',
  })
  await expect(confirm).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirm).toBeHidden()
  await expect(revokeButton).toBeFocused()

  await revokeButton.click()
  await confirm.getByRole('button', { name: '取消' }).click()
  await expect(inviteRow.getByText('待激活')).toBeVisible()

  await revokeButton.click()
  const [revoked] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/revoke'),
    ),
    confirm.getByRole('button', { name: '撤销邀请' }).click(),
  ])
  expect(revoked.status()).toBe(200)
  await expect(inviteRow.getByText('已撤销')).toBeVisible()
})
