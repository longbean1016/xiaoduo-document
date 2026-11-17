import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  datetime,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const category = mysqlTable(
  'category',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 120 }).notNull(),
    position: int('position').notNull().default(0),
  },
  (table) => [uniqueIndex('category_slug_unique').on(table.slug)],
)

export const article = mysqlTable(
  'article',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    categoryId: varchar('category_id', { length: 36 })
      .notNull()
      .references(() => category.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 300 }).notNull(),
    path: varchar('path', { length: 300 }).notNull(),
    position: int('position').notNull().default(0),
    markdown: mediumtext('markdown').notNull().default(''),
    plainText: mediumtext('plain_text').notNull().default(''),
    contentJson: mediumtext('content_json'),
    sourceFileName: varchar('source_file_name', { length: 255 }),
    revision: int('revision').notNull().default(1),
    publicationState: mysqlEnum('publication_state', [
      'draft',
      'published',
      'unpublished',
    ])
      .notNull()
      .default('draft'),
    trashedAt: datetime('trashed_at', { mode: 'string', fsp: 3 }),
    trashedById: varchar('trashed_by_id', { length: 36 }),
    trashedByName: varchar('trashed_by_name', { length: 120 }),
    createdAt: datetime('created_at', { mode: 'string', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'string', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('article_category_idx').on(table.categoryId, table.position),
    uniqueIndex('article_category_path_unique').on(
      table.categoryId,
      table.path,
    ),
  ],
)

export const articleVersion = mysqlTable(
  'article_version',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    articleId: varchar('article_id', { length: 36 })
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', ['manual', 'published']).notNull(),
    title: varchar('title', { length: 300 }).notNull(),
    categoryId: varchar('category_id', { length: 36 }).references(
      () => category.id,
      { onDelete: 'restrict' },
    ),
    categorySlug: varchar('category_slug', { length: 120 }),
    path: varchar('path', { length: 300 }).notNull(),
    label: varchar('label', { length: 200 }),
    markdown: mediumtext('markdown').notNull(),
    plainText: mediumtext('plain_text').notNull(),
    contentJson: mediumtext('content_json'),
    authorId: varchar('author_id', { length: 36 }).notNull(),
    authorName: varchar('author_name', { length: 120 }).notNull(),
    authorRole: mysqlEnum('author_role', ['owner', 'collaborator']).notNull(),
    createdAt: datetime('created_at', { mode: 'string', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('article_version_article_idx').on(table.articleId, table.createdAt),
  ],
)

export const user = mysqlTable(
  'auth_user',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: varchar('image', { length: 2048 }),
    role: mysqlEnum('role', ['owner', 'collaborator'])
      .notNull()
      .default('collaborator'),
    status: mysqlEnum('status', ['active', 'suspended'])
      .notNull()
      .default('active'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [uniqueIndex('auth_user_email_unique').on(table.email)],
)

export const session = mysqlTable(
  'auth_session',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull(),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('auth_session_token_unique').on(table.token),
    index('auth_session_user_idx').on(table.userId),
  ],
)

export const account = mysqlTable(
  'auth_account',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    providerId: varchar('provider_id', { length: 64 }).notNull(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: mediumtext('access_token'),
    refreshToken: mediumtext('refresh_token'),
    idToken: mediumtext('id_token'),
    accessTokenExpiresAt: datetime('access_token_expires_at', {
      mode: 'date',
      fsp: 3,
    }),
    refreshTokenExpiresAt: datetime('refresh_token_expires_at', {
      mode: 'date',
      fsp: 3,
    }),
    scope: mediumtext('scope'),
    password: varchar('password', { length: 255 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('auth_account_user_idx').on(table.userId),
    uniqueIndex('auth_account_provider_account_unique').on(
      table.providerId,
      table.accountId,
    ),
  ],
)

export const verification = mysqlTable(
  'auth_verification',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    value: mediumtext('value').notNull(),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('auth_verification_identifier_idx').on(table.identifier),
  ],
)

export const siteProfile = mysqlTable('site_profile', {
  id: varchar('id', { length: 36 }).primaryKey(),
  authorName: varchar('author_name', { length: 120 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 2048 }),
  roleTitle: varchar('role_title', { length: 120 }).notNull().default('站主'),
  intro: mediumtext('intro').notNull().default(''),
  nowText: mediumtext('now_text').notNull().default(''),
  location: varchar('location', { length: 120 }).notNull().default(''),
  email: varchar('email', { length: 255 }).notNull().default(''),
  updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
})

export const urlRedirect = mysqlTable(
  'url_redirect',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    fromPath: varchar('from_path', { length: 512 }).notNull(),
    toPath: varchar('to_path', { length: 1024 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [uniqueIndex('url_redirect_from_unique').on(table.fromPath)],
)

export const collaborationApplication = mysqlTable(
  'collaboration_application',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    articleId: varchar('article_id', { length: 36 })
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    note: mediumtext('note').notNull().default(''),
    status: mysqlEnum('status', ['pending', 'approved', 'rejected'])
      .notNull()
      .default('pending'),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    reviewedAt: datetime('reviewed_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [
    index('collaboration_application_article_idx').on(
      table.articleId,
      table.status,
    ),
    uniqueIndex('collaboration_application_pending_unique').on(
      table.articleId,
      table.email,
      table.status,
    ),
  ],
)

export const collaborationInvite = mysqlTable(
  'collaboration_invite',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    email: varchar('email', { length: 255 }),
    displayName: varchar('display_name', { length: 120 }),
    claimedUserId: varchar('claimed_user_id', { length: 36 }).references(
      () => user.id,
      { onDelete: 'set null' },
    ),
    claimedAt: datetime('claimed_at', { mode: 'date', fsp: 3 }),
    source: mysqlEnum('source', ['application', 'direct']).notNull(),
    applicationId: varchar('application_id', { length: 36 }).references(
      () => collaborationApplication.id,
      { onDelete: 'set null' },
    ),
    status: mysqlEnum('status', [
      'pending',
      'activated',
      'expired',
      'revoked',
    ])
      .notNull()
      .default('pending'),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('collaboration_invite_token_unique').on(table.tokenHash),
    index('collaboration_invite_email_idx').on(table.email),
  ],
)

export const emailOtpRequest = mysqlTable(
  'email_otp_request',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    purpose: mysqlEnum('purpose', [
      'invite_activation',
      'collaborator_login',
      'owner_recovery',
    ]).notNull(),
    ipAddress: varchar('ip_address', { length: 64 }).notNull(),
    requestedAt: datetime('requested_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('email_otp_request_email_time_idx').on(
      table.email,
      table.requestedAt,
    ),
    index('email_otp_request_ip_time_idx').on(
      table.ipAddress,
      table.requestedAt,
    ),
  ],
)

export const collaborationInviteArticle = mysqlTable(
  'collaboration_invite_article',
  {
    inviteId: varchar('invite_id', { length: 36 })
      .notNull()
      .references(() => collaborationInvite.id, { onDelete: 'cascade' }),
    articleId: varchar('article_id', { length: 36 })
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('collaboration_invite_article_unique').on(
      table.inviteId,
      table.articleId,
    ),
  ],
)

export const articleGrant = mysqlTable(
  'article_grant',
  {
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    articleId: varchar('article_id', { length: 36 })
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('article_grant_user_article_unique').on(
      table.userId,
      table.articleId,
    ),
    index('article_grant_article_idx').on(table.articleId),
  ],
)

export const collaborationPasswordReset = mysqlTable(
  'collaboration_password_reset',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    status: mysqlEnum('status', ['pending', 'used', 'expired'])
      .notNull()
      .default('pending'),
    expiresAt: datetime('expires_at', { mode: 'date', fsp: 3 }).notNull(),
    usedAt: datetime('used_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('collaboration_password_reset_token_unique').on(
      table.tokenHash,
    ),
    index('collaboration_password_reset_user_idx').on(
      table.userId,
      table.status,
    ),
  ],
)

export const notification = mysqlTable(
  'notification',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    eventKey: varchar('event_key', { length: 255 }).notNull(),
    kind: mysqlEnum('kind', [
      'application',
      'invitation',
      'grant',
      'publish',
    ]).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: mediumtext('body').notNull(),
    href: varchar('href', { length: 1024 }),
    readAt: datetime('read_at', { mode: 'date', fsp: 3 }),
    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    uniqueIndex('notification_event_key_unique').on(table.eventKey),
    index('notification_created_at_idx').on(table.createdAt),
  ],
)

export const articleViewEvent = mysqlTable(
  'article_view_event',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    articleId: varchar('article_id', { length: 36 })
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    visitorIp: varchar('visitor_ip', { length: 64 }).notNull(),
    visitorHash: varchar('visitor_hash', { length: 64 }).notNull(),
    location: varchar('location', { length: 120 }).notNull(),
    referrerDomain: varchar('referrer_domain', { length: 255 }).notNull(),
    visitedAt: datetime('visited_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => [
    index('article_view_event_article_time_idx').on(
      table.articleId,
      table.visitedAt,
    ),
    index('article_view_event_ip_time_idx').on(
      table.visitorIp,
      table.visitedAt,
    ),
  ],
)

export const dailyArticleMetric = mysqlTable(
  'daily_article_metric',
  {
    articleId: varchar('article_id', { length: 36 })
      .notNull()
      .references(() => article.id, { onDelete: 'cascade' }),
    metricDate: date('metric_date', { mode: 'string' }).notNull(),
    views: int('views').notNull().default(0),
    uniqueVisitors: int('unique_visitors').notNull().default(0),
    lastVisitedAt: datetime('last_visited_at', { mode: 'date', fsp: 3 }),
  },
  (table) => [
    uniqueIndex('daily_article_metric_article_date_unique').on(
      table.articleId,
      table.metricDate,
    ),
    index('daily_article_metric_date_idx').on(table.metricDate),
  ],
)
