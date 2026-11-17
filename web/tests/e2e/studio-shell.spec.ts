import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner starts writing from the studio shell dialog', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.getByRole('button', { name: '开始写作' }).click()
  const dialog = page.getByRole('dialog', { name: '新建章节' })
  await expect(dialog).toBeVisible()
  const categorySelect = dialog.getByRole('button', {
    name: '新建章节所属分类',
  })
  await categorySelect.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('menuitem', { name: '注意力与写作' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  const [created] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/studio/articles'),
    ),
    dialog
      .getByRole('button', { name: '创建并开始写作' })
      .click(),
  ])
  expect(created.status()).toBe(201)
  const payload = (await created.json()) as { article: { id: string } }
  await expect(page).toHaveURL(
    new RegExp(`/studio/notes/${payload.article.id}$`),
  )
  await expect(page.getByLabel('章节标题')).toHaveValue('无标题章节')
})
