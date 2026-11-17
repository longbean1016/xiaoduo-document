import './database-isolation'
import { expect, test } from '@playwright/test'
import { appOrigin } from './app-origin'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner deletes a manual version but not a published version', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const created = await page.request.post(
    '/api/studio/articles/article-1/versions',
    {
      headers: { origin: appOrigin },
      data: { label: '待删除版本' },
    },
  )
  expect(created.status()).toBe(201)
  const createdPayload = (await created.json()) as {
    version: { id: string }
  }

  const deleted = await page.request.delete(
    `/api/studio/articles/article-1/versions/${createdPayload.version.id}`,
    { headers: { origin: appOrigin } },
  )
  expect(deleted.status()).toBe(200)

  const published = await page.request.delete(
    '/api/studio/articles/article-1/versions/version-1',
    { headers: { origin: appOrigin } },
  )
  expect(published.status()).toBe(409)
})

test('owner deletes a manual version from the shared history dialog', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  const created = await page.request.post(
    '/api/studio/articles/article-1/versions',
    {
      headers: { origin: appOrigin },
      data: { label: '界面删除版本' },
    },
  )
  expect(created.status()).toBe(201)

  await page.goto('/studio/notes/article-1')
  await page.getByRole('button', { name: '版本历史' }).click()
  const history = page.getByRole('dialog', { name: '版本历史' })
  await expect(history.getByText('界面删除版本')).toBeVisible()
  await history
    .getByRole('button', { name: '删除 界面删除版本' })
    .click()
  const deleteDialog = page.getByRole('alertdialog', {
    name: '删除这个手动版本？',
  })
  await expect(deleteDialog).toBeVisible()
  await deleteDialog.getByRole('button', { name: '取消' }).click()
  await expect(history.getByText('界面删除版本')).toBeVisible()

  await history
    .getByRole('button', { name: '删除 界面删除版本' })
    .click()
  await deleteDialog.getByRole('button', { name: '删除版本' }).click()
  await expect(history.getByText('界面删除版本')).toHaveCount(0)
})
