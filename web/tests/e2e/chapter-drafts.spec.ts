import './database-isolation'
import { expect, test } from '@playwright/test'
import { seedTestDatabase } from '../seed-test-db'

test.beforeEach(async () => {
  await seedTestDatabase()
})

test('owner creates and autosaves a shared chapter draft', async ({ page }) => {
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page
    .getByRole('button', { name: '新建章节', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: '新建章节' })
    .getByRole('button', { name: '创建草稿' })
    .click()
  await expect(page).toHaveURL(/\/studio\/notes\//)

  await page.getByLabel('章节标题').fill('自动保存测试')
  await page.getByRole('textbox', { name: '章节正文' }).fill('## 自动保存\n\n测试内容')
  await expect(page.getByRole('status')).toContainText('草稿已保存')

  await page.getByRole('textbox', { name: '章节正文' }).press(
    'ControlOrMeta+KeyS',
  )
  await expect(page.getByRole('status')).toContainText('草稿已保存')

  await page.reload()
  await expect(page.getByLabel('章节标题')).toHaveValue('自动保存测试')
  await expect(page.getByRole('textbox', { name: '章节正文' })).toContainText(
    '自动保存',
  )
  await expect(page.getByRole('textbox', { name: '章节正文' })).toContainText(
    '测试内容',
  )
})

test('owner edits a draft through the prototype workspace controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')

  await expect(
    page.getByRole('button', { name: '所属分类' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '二级标题' }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: '章节正文' })
    .fill('## 从记录开始\n\n草稿内容\n\n## 持续修订\n\n继续整理')
  const draftToc = page.getByRole('navigation', { name: '当前草稿目录' })
  await expect(draftToc).toContainText('从记录开始')
  await expect(draftToc).toContainText('持续修订')
})

test('owner inserts a todo block from the slash menu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio/login')
  await page.getByRole('button', { name: '站主密码登录' }).click()
  await page.getByLabel('邮箱').fill('owner@example.com')
  await page.getByLabel('密码').fill('owner-test-password')
  await page.getByRole('button', { name: '进入写作台' }).click()
  await expect(page).toHaveURL(/\/studio$/)

  await page.goto('/studio/notes/article-1')
  const body = page.getByRole('textbox', { name: '章节正文' })
  await body.fill('')
  await body.click()
  await page.keyboard.type('/待办')

  const slashMenu = page.getByRole('listbox', { name: '插入内容块' })
  await expect(slashMenu).toBeVisible()
  await expect(
    slashMenu.getByRole('option', { name: /待办事项/ }),
  ).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(body.locator('ul[data-type="taskList"]')).toBeVisible()
  await page.keyboard.type('写完这段再保存')
  await page.keyboard.press('ControlOrMeta+KeyS')
  await expect(page.getByRole('status').first()).toContainText('草稿已保存')

  await page.reload()
  await expect(
    page
      .getByRole('textbox', { name: '章节正文' })
      .locator('ul[data-type="taskList"]'),
  ).toContainText('写完这段再保存')
})
