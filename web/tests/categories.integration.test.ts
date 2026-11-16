import { beforeEach, describe, expect, it } from 'vitest'
import {
  createCategory,
  deleteCategory,
  listCategories,
  moveCategory,
  reorderCategories,
  updateCategory,
} from '@/server/categories'
import { createTestConnection, resetTestDatabase } from './test-db'

describe('category service', () => {
  beforeEach(async () => {
    await resetTestDatabase()
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO category (id, title, slug, position) VALUES
          ('category-1', '注意力与写作', 'attention-and-writing', 1),
          ('category-2', '工具与方法', 'tools', 2)`,
      )
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, position, markdown, plain_text,
          revision, publication_state, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          'article-1',
          'category-1',
          '已有章节',
          '已有章节',
          1,
          '## 小节\n\n正文',
          '小节 正文',
          1,
          'draft',
        ],
      )
    } finally {
      await connection.end()
    }
  })

  it('creates a category at the end and rejects duplicate slugs', async () => {
    await createCategory({
      title: '阅读与思考',
      slug: 'reading',
    })

    const categories = await listCategories()
    expect(categories.map((item) => item.slug)).toEqual([
      'attention-and-writing',
      'tools',
      'reading',
    ])
    expect(categories.at(-1)?.position).toBe(3)

    await expect(
      createCategory({ title: '重复标识', slug: 'reading' }),
    ).rejects.toThrow('SLUG_TAKEN')
  })

  it('updates category fields and preserves manual order', async () => {
    await updateCategory('category-2', {
      title: '工具、方法与流程',
      slug: 'workflow',
    })

    expect((await listCategories()).map((item) => item.title)).toEqual([
      '注意力与写作',
      '工具、方法与流程',
    ])
    expect((await listCategories())[1]?.slug).toBe('workflow')
  })

  it('persists a complete category order and rejects incomplete orders', async () => {
    expect(
      await reorderCategories(['category-2', 'category-1']),
    ).toBe(true)
    expect((await listCategories()).map((item) => item.id)).toEqual([
      'category-2',
      'category-1',
    ])
    expect((await listCategories()).map((item) => item.position)).toEqual([
      1, 2,
    ])

    expect(await reorderCategories(['category-1'])).toBe(false)
    expect(
      await reorderCategories(['category-1', 'missing-category']),
    ).toBe(false)
    expect(
      await reorderCategories(['category-1', 'category-1']),
    ).toBe(false)
    expect((await listCategories()).map((item) => item.id)).toEqual([
      'category-2',
      'category-1',
    ])
  })

  it('reorders categories and refuses to delete a non-empty category', async () => {
    expect(await deleteCategory('category-1')).toBe(false)
    expect(await deleteCategory('category-2')).toBe(true)

    await moveCategory('category-1', 1)
    const remaining = await listCategories()
    expect(remaining.map((item) => item.id)).toEqual(['category-1'])

    const materials = await createCategory({
      title: '新材料',
      slug: 'materials',
    })
    await moveCategory(materials.id, -1)
    expect((await listCategories()).map((item) => item.slug)).toEqual([
      'materials',
      'attention-and-writing',
    ])
  })
})
