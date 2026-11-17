import './database-isolation'
import { expect, test } from '@playwright/test'
import { createTestConnection } from '../test-db'
import { appOrigin } from './app-origin'

const origin = appOrigin

test('stale editor compares both versions and adopts the saved draft', async ({
  page,
}) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)
  await page.goto('/studio/notes/article-1')
  const connection = await createTestConnection()
  let currentRevision = 1
  try {
    const [result] = await connection.query(
      'SELECT revision FROM article WHERE id = ?',
      ['article-1'],
    )
    const rows = result as Array<{ revision: number }>
    currentRevision = rows[0].revision
  } finally {
    await connection.end()
  }

  const savedResponse = await page.request.put(
    '/api/studio/articles/article-1/draft',
    {
      headers: { origin },
      data: {
        title: '另一位编辑者的标题',
        categoryId: 'category-1',
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '另一位编辑者已经保存的正文' },
              ],
            },
          ],
        },
        markdown: '另一位编辑者已经保存的正文',
        plainText: '另一位编辑者已经保存的正文',
        expectedRevision: currentRevision,
      },
    },
  )
  expect(savedResponse.status()).toBe(200)

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/studio/articles/article-1/draft') &&
      response.status() === 409,
  )
  await page.getByLabel('章节标题').fill('我的冲突编辑')
  await page
    .getByRole('textbox', { name: '章节正文' })
    .fill('我的尚未保存正文')
  await page.keyboard.press('ControlOrMeta+KeyS')
  const conflictResponse = await conflictResponsePromise
  expect(conflictResponse.status()).toBe(409)

  await expect(
    page.getByRole('heading', { name: '协作者冲突' }),
  ).toBeVisible()
  await expect(
    page.locator('.conflict-compare').getByText('另一位编辑者已经保存的正文'),
  ).toBeVisible()
  await expect(
    page.locator('.conflict-compare').getByText('我的尚未保存正文'),
  ).toBeVisible()

  await page.getByRole('button', { name: '采用已保存版本' }).click()
  await expect(page.getByLabel('章节标题')).toHaveValue('另一位编辑者的标题')
  await expect(
    page.getByRole('textbox', { name: '章节正文' }),
  ).toContainText('另一位编辑者已经保存的正文')
  await expect(
    page.getByRole('heading', { name: '协作者冲突' }),
  ).toHaveCount(0)

  const thirdSave = await page.request.put(
    '/api/studio/articles/article-1/draft',
    {
      headers: { origin },
      data: {
        title: '第三个已保存版本',
        categoryId: 'category-1',
        contentJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '第三次服务端保存' }],
            },
          ],
        },
        markdown: '第三次服务端保存',
        plainText: '第三次服务端保存',
        expectedRevision: currentRevision + 1,
      },
    },
  )
  expect(thirdSave.status()).toBe(200)

  const secondConflictPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/studio/articles/article-1/draft') &&
      response.status() === 409,
  )
  await page.getByLabel('章节标题').fill('我的覆盖编辑')
  await page
    .getByRole('textbox', { name: '章节正文' })
    .fill('我的覆盖正文')
  await page.keyboard.press('ControlOrMeta+KeyS')
  const secondConflict = await secondConflictPromise
  expect(secondConflict.status()).toBe(409)
  const [keptResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().endsWith('/api/studio/articles/article-1/draft'),
    ),
    page.getByRole('button', { name: '保留我的编辑并覆盖' }).click(),
  ])
  expect(keptResponse.status()).toBe(200)
  await expect(page.getByRole('status')).toContainText('草稿已保存')

  await page.reload()
  await expect(page.getByLabel('章节标题')).toHaveValue('我的覆盖编辑')
  await expect(
    page.getByRole('textbox', { name: '章节正文' }),
  ).toContainText('我的覆盖正文')
})
