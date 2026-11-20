import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildChapterOpenGraph,
  buildRssXml,
  listReaderDiscoveryEntries,
} from '@/server/reader-discovery'
import { createTestConnection, resetTestDatabase } from './test-db'

describe('reader discovery outputs', () => {
  beforeEach(async () => {
    await resetTestDatabase()
    const connection = await createTestConnection()
    try {
      await connection.query(
        `INSERT INTO category (id, title, slug, position)
         VALUES ('category-1', '注意力与写作', 'attention-and-writing', 1)`,
      )
      await connection.query(
        `INSERT INTO article (
          id, category_id, title, path, position, markdown, plain_text,
          revision, publication_state, trashed_at, created_at, updated_at
        ) VALUES
          ('article-1', 'category-1', '公开文章', '公开文章', 1,
           '介绍\\n\\n![示意图](https://cdn.example.com/cover.webp)',
           '介绍 正文摘要', 1, 'published', NULL, NOW(3), NOW(3)),
          ('article-draft', 'category-1', '草稿', '草稿', 2,
           '草稿', '草稿', 1, 'draft', NULL, NOW(3), NOW(3)),
          ('article-trashed', 'category-1', '回收站', '回收站', 3,
           '回收站', '回收站', 1, 'published', NOW(3), NOW(3), NOW(3))`,
      )
      await connection.query(
        `INSERT INTO article_version (
          id, article_id, kind, title, category_id, category_slug, path,
          markdown, plain_text, author_id, author_name, author_role, created_at
        ) VALUES
          ('version-1', 'article-1', 'published', '公开文章', 'category-1',
           'attention-and-writing', '公开文章',
           '介绍\\n\\n![示意图](https://cdn.example.com/cover.webp)',
           '介绍 正文摘要', 'owner-1', '小多', 'owner', NOW(3)),
          ('version-2', 'article-1', 'published', '公开文章', 'category-1',
           'attention-and-writing', '公开文章', '版本正文', '版本正文',
           'collaborator-1', '协作者甲', 'collaborator',
           DATE_SUB(NOW(3), INTERVAL 1 SECOND))`,
      )
    } finally {
      await connection.end()
    }
  })

  it('lists only public chapters and builds complete share metadata', async () => {
    const entries = await listReaderDiscoveryEntries()
    expect(entries.map((entry) => entry.articleId)).toEqual(['article-1'])

    const openGraph = buildChapterOpenGraph(
      entries[0],
      {
        authorName: '小多',
        avatarUrl: null,
        roleTitle: '站主',
        intro: '',
        location: '',
      },
      'https://zhijian.example.com',
    )
    expect(openGraph).toMatchObject({
      title: '公开文章',
      author: '小多',
      contributors: ['协作者甲'],
      image: 'https://cdn.example.com/cover.webp',
      url: 'https://zhijian.example.com/library/attention-and-writing/公开文章',
    })
    expect(openGraph.description).toContain('正文摘要')
  })

  it('serializes escaped RSS containing only discovery entries', async () => {
    const entries = await listReaderDiscoveryEntries()
    const xml = buildRssXml(
      entries,
      'https://zhijian.example.com',
      '知笺',
    )
    expect(xml).toContain('<title>公开文章</title>')
    expect(xml).toContain('/library/attention-and-writing/公开文章')
    expect(xml).not.toContain('草稿')
    expect(xml).not.toContain('回收站')
    expect(xml).toContain('<rss version="2.0">')
  })
})
