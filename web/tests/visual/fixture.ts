const fixedNow = '2026-11-13T12:00:00.000Z'
const publishedAt = '2026-11-13T09:30:00.000Z'
const updatedAt = '2026-11-13T11:45:00.000Z'

const author = {
  name: '林默',
  avatarUrl: undefined,
  role: '独立开发与产品设计',
  intro: '我在广州写代码，也整理关于工具、注意力和阅读的长期笔记。',
  now: '最近在整理工具如何减少选择，同时保留人的判断。',
  location: '广州',
  email: 'hello@zhijian.site',
}

const categories = [
  {
    id: 'theme-attention',
    title: '注意力与写作',
    slug: 'attention-and-writing',
    order: 0,
    noteOrder: [
      'note-keep-thinking',
      'note-writing-not-archive',
      'note-unfinished',
    ],
    publishedNoteOrder: [
      'note-keep-thinking',
      'note-writing-not-archive',
    ],
  },
  {
    id: 'theme-tools',
    title: '工具的边界',
    slug: 'tools-and-interfaces',
    order: 1,
    noteOrder: ['note-quiet-editor', 'note-product-skeleton'],
    publishedNoteOrder: ['note-quiet-editor'],
  },
]

const notes = [
  {
    id: 'note-keep-thinking',
    title: '把想法留在纸上',
    slug: 'keep-thinking-on-paper',
    markdown:
      '有些想法诞生时并不完整。先写下来，给它们一点生长的时间。\n\n## 记录先于理解\n\n写下来的第一句话并不准确，它的作用是为继续修改留下位置。\n\n> 先写清楚，再想明白。\n\n## 让笔记拥有时间\n\n把笔记看成一份持续修订的记录，而不是一次发布完成的作品。\n\n- [x] 为重要想法保留问题\n- [ ] 每隔一段时间重读\n- [ ] 允许内容暂时保持未完成',
    plainText:
      '有些想法诞生时并不完整 先写下来 记录先于理解 写下来的第一句话并不准确 先写清楚 再想明白',
    categoryId: 'theme-attention',
    revision: 3,
    createdAt: '2026-10-24T09:00:00.000Z',
    updatedAt,
    publicationState: 'published',
    published: {
      versionId: 'published-note-keep-2',
      title: '把想法留在纸上',
      categoryId: 'theme-attention',
      slug: 'keep-thinking-on-paper',
      markdown:
        '有些想法诞生时并不完整。先写下来，给它们一点生长的时间。\n\n## 记录先于理解\n\n写下来的第一句话并不准确，它的作用是为继续修改留下位置。\n\n> 先写清楚，再想明白。\n\n## 让笔记拥有时间\n\n把笔记看成一份持续修订的记录，而不是一次发布完成的作品。\n\n- [x] 为重要想法保留问题\n- [ ] 每隔一段时间重读\n- [ ] 允许内容暂时保持未完成',
      plainText:
        '有些想法诞生时并不完整 先写下来 记录先于理解 写下来的第一句话并不准确 先写清楚 再想明白',
      publishedAt,
    },
    versions: [
      {
        id: 'published-note-keep-2',
        kind: 'published',
        title: '把想法留在纸上',
        categoryId: 'theme-attention',
        slug: 'keep-thinking-on-paper',
        markdown:
          '有些想法诞生时并不完整。先写下来，给它们一点生长的时间。\n\n## 记录先于理解\n\n写下来的第一句话并不准确，它的作用是为继续修改留下位置。\n\n> 先写清楚，再想明白。\n\n## 让笔记拥有时间\n\n把笔记看成一份持续修订的记录，而不是一次发布完成的作品。\n\n- [x] 为重要想法保留问题\n- [ ] 每隔一段时间重读\n- [ ] 允许内容暂时保持未完成',
        plainText:
          '有些想法诞生时并不完整 先写下来 记录先于理解 写下来的第一句话并不准确 先写清楚 再想明白',
        createdAt: publishedAt,
        author: { id: 'owner', name: '林默', role: 'owner' },
      },
      {
        id: 'manual-note-keep-1',
        kind: 'manual',
        label: '协作者补充',
        title: '把想法留在纸上',
        categoryId: 'theme-attention',
        slug: 'keep-thinking-on-paper',
        markdown: '有些想法诞生时并不完整。先写下来，给它们一点生长的时间。',
        plainText: '有些想法诞生时并不完整',
        createdAt: '2026-11-12T08:00:00.000Z',
        author: { id: 'collaborator-1', name: '周行', role: 'collaborator' },
      },
    ],
    trashedAt: null,
    trashedBy: null,
    trashedByName: null,
  },
  {
    id: 'note-writing-not-archive',
    title: '写作不是归档',
    slug: 'writing-is-not-archiving',
    markdown:
      '如果一篇笔记写完后再也没有被打开，它更接近仓库，而不是思考的一部分。\n\n## 用改写代替收集\n\n每次重读时，把内容压缩成一句更准确的判断。',
    plainText:
      '如果一篇笔记写完后再也没有被打开 它更接近仓库 而不是思考的一部分 用改写代替收集 每次重读时 把内容压缩成一句更准确的判断',
    categoryId: 'theme-attention',
    revision: 1,
    createdAt: '2026-10-25T09:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
    publicationState: 'published',
    published: {
      versionId: 'published-note-writing-1',
      title: '写作不是归档',
      categoryId: 'theme-attention',
      slug: 'writing-is-not-archiving',
      markdown:
        '如果一篇笔记写完后再也没有被打开，它更接近仓库，而不是思考的一部分。\n\n## 用改写代替收集\n\n每次重读时，把内容压缩成一句更准确的判断。',
      plainText:
        '如果一篇笔记写完后再也没有被打开 它更接近仓库 而不是思考的一部分 用改写代替收集 每次重读时 把内容压缩成一句更准确的判断',
      publishedAt: '2026-11-12T10:00:00.000Z',
    },
    versions: [],
    trashedAt: null,
    trashedBy: null,
    trashedByName: null,
  },
  {
    id: 'note-unfinished',
    title: '一段没有写完的冬天记录',
    slug: 'unfinished-winter',
    markdown: '十二月的风从河面吹过来，带着一点潮湿的铁锈味。',
    plainText: '十二月的风从河面吹过来',
    categoryId: 'theme-attention',
    revision: 1,
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-13T11:20:00.000Z',
    publicationState: 'draft',
    published: null,
    versions: [],
    trashedAt: null,
    trashedBy: null,
    trashedByName: null,
  },
  {
    id: 'note-quiet-editor',
    title: '一块安静的编辑界面',
    slug: 'a-quiet-editor',
    markdown:
      '写作时最需要的不是功能，而是一种不会不断提醒你还有很多功能的环境。\n\n## 功能退到需要时\n\n文字应该是界面里最稳定的元素。',
    plainText:
      '写作时最需要的不是功能 而是一种不会不断提醒你还有很多功能的环境 功能退到需要时 文字应该是界面里最稳定的元素',
    categoryId: 'theme-tools',
    revision: 1,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-11-11T09:00:00.000Z',
    publicationState: 'published',
    published: {
      versionId: 'published-note-quiet-1',
      title: '一块安静的编辑界面',
      categoryId: 'theme-tools',
      slug: 'a-quiet-editor',
      markdown:
        '写作时最需要的不是功能，而是一种不会不断提醒你还有很多功能的环境。\n\n## 功能退到需要时\n\n文字应该是界面里最稳定的元素。',
      plainText:
        '写作时最需要的不是功能 而是一种不会不断提醒你还有很多功能的环境 功能退到需要时 文字应该是界面里最稳定的元素',
      publishedAt: '2026-11-11T09:00:00.000Z',
    },
    versions: [],
    trashedAt: null,
    trashedBy: null,
    trashedByName: null,
  },
  {
    id: 'note-product-skeleton',
    title: '知笺的产品骨架',
    slug: 'product-skeleton',
    markdown: '知笺不是多人笔记平台，而是一个人的公开知识网站和私人写作后台。',
    plainText: '知笺不是多人笔记平台',
    categoryId: 'theme-tools',
    revision: 1,
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-11-09T09:00:00.000Z',
    publicationState: 'draft',
    published: null,
    versions: [],
    trashedAt: null,
    trashedBy: null,
    trashedByName: null,
  },
]

const collaborators = [
  {
    id: 'collaborator-1',
    email: 'zhou@qq.com',
    displayName: '周行',
    noteIds: ['note-keep-thinking'],
    status: 'active',
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-12T09:00:00.000Z',
  },
]

const contributors = [
  {
    id: 'collaborator-1',
    name: '周行',
    role: 'collaborator',
    noteIds: ['note-keep-thinking'],
  },
]

const collaborationInvites = [
  {
    id: 'invite-1',
    token: 'visual-invite-token',
    email: 'invitee@qq.com',
    displayName: '受邀协作者',
    noteIds: ['note-keep-thinking'],
    source: 'direct',
    status: 'pending',
    createdAt: '2026-11-12T09:00:00.000Z',
    expiresAt: '2026-11-19T09:00:00.000Z',
  },
]

const collaborationApplications = [
  {
    id: 'application-1',
    noteId: 'note-writing-not-archive',
    name: '协作申请人',
    email: 'applicant@example.com',
    note: '希望补充一个案例。',
    status: 'pending',
    createdAt: '2026-11-12T11:00:00.000Z',
  },
]

const articleViewEvents = [
  {
    id: 'view-1',
    noteId: 'note-keep-thinking',
    visitedAt: '2026-11-12T12:00:00.000Z',
    ip: '113.65.18.42',
    location: '广东广州',
    referrerDomain: 'google.com',
    visitorKey: 'visual-visitor-1',
  },
  {
    id: 'view-2',
    noteId: 'note-keep-thinking',
    visitedAt: '2026-11-11T12:00:00.000Z',
    ip: '120.229.77.16',
    location: '广东深圳',
    referrerDomain: '直接访问',
    visitorKey: 'visual-visitor-2',
  },
  {
    id: 'view-3',
    noteId: 'note-writing-not-archive',
    visitedAt: '2026-11-10T12:00:00.000Z',
    ip: '183.6.44.91',
    location: '广东广州',
    referrerDomain: 'baidu.com',
    visitorKey: 'visual-visitor-3',
  },
]

export const visualFixture = {
  fixedNow,
  maskSelectors: [
    'time',
    '[data-visual-dynamic]',
    '.article-view-count',
  ],
  prototypeStorageKey: 'zhijian-public-site-v7',
  contributors,
  prototypeState: {
    author,
    categories,
    notes,
    redirects: [],
    collaborationApplications,
    collaborationInvites,
    collaborators,
    articleViewEvents,
    studioAuthed: false,
    studioRole: null,
    currentCollaboratorId: null,
    themeMode: 'light',
  },
  production: {
    notifications: [
      {
        id: 'notification-1',
        eventKey: 'visual:application:1',
        kind: 'application',
        title: '新的协作申请',
        body: '协作申请人申请参与《写作不是归档》',
        href: '/studio/collaboration',
        readAt: null,
        createdAt: '2026-11-12T11:00:00.000Z',
      },
    ],
  },
} as const
