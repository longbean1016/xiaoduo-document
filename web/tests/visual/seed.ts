import { createHash } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { createTestConnection, prepareTestDatabase } from '../test-db'
import { visualFixture } from './fixture'

const fixture = visualFixture
const dateTime = (value: string) => value.slice(0, 23).replace('T', ' ')

await prepareTestDatabase()

const connection = await createTestConnection()
try {
  const ownerPassword = await hashPassword('owner-test-password')
  const collaboratorPassword = await hashPassword('collaborator-password')

  await connection.query(
    `INSERT INTO auth_user (
      id, name, email, email_verified, role, status, created_at, updated_at
    ) VALUES
      ('owner-1', '林默', 'owner@example.com', true, 'owner', 'active', ?, ?),
      ('collaborator-1', '周行', 'zhou@qq.com', true, 'collaborator',
       'active', ?, ?)`,
    [
      dateTime('2026-01-01T00:00:00.000Z'),
      dateTime(fixture.fixedNow),
      dateTime('2026-11-01T09:00:00.000Z'),
      dateTime('2026-11-12T09:00:00.000Z'),
    ],
  )
  await connection.query(
    `INSERT INTO auth_account (
      id, account_id, provider_id, user_id, password, created_at, updated_at
    ) VALUES
      ('owner-account-1', 'owner-1', 'credential', 'owner-1', ?, ?, ?),
      ('collaborator-account-1', 'collaborator-1', 'credential',
       'collaborator-1', ?, ?, ?)`,
    [
      ownerPassword,
      dateTime('2026-01-01T00:00:00.000Z'),
      dateTime(fixture.fixedNow),
      collaboratorPassword,
      dateTime('2026-11-01T09:00:00.000Z'),
      dateTime('2026-11-12T09:00:00.000Z'),
    ],
  )
  await connection.query(
    `INSERT INTO site_profile (
      id, author_name, avatar_url, role_title, intro, now_text, location, email,
      updated_at
    ) VALUES ('primary', ?, NULL, ?, ?, ?, ?, ?, ?)`,
    [
      fixture.prototypeState.author.name,
      fixture.prototypeState.author.role,
      fixture.prototypeState.author.intro,
      fixture.prototypeState.author.now,
      fixture.prototypeState.author.location,
      fixture.prototypeState.author.email,
      dateTime(fixture.fixedNow),
    ],
  )

  for (const category of fixture.prototypeState.categories) {
    await connection.query(
      `INSERT INTO category (id, title, slug, position)
       VALUES (?, ?, ?, ?)`,
      [category.id, category.title, category.slug, category.order + 1],
    )
  }

  for (const note of fixture.prototypeState.notes) {
    const position =
      fixture.prototypeState.categories
        .find((category) => category.id === note.categoryId)
        ?.noteOrder.indexOf(note.id) ?? 0
    await connection.query(
      `INSERT INTO article (
        id, category_id, title, path, position, markdown, plain_text,
        content_json, source_file_name, revision, publication_state,
        trashed_at, trashed_by_id, trashed_by_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        note.id,
        note.categoryId,
        note.title,
        note.slug,
        position + 1,
        note.markdown,
        note.plainText,
        note.revision,
        note.publicationState,
        note.trashedAt,
        note.trashedBy,
        note.trashedByName,
        dateTime(note.createdAt),
        dateTime(note.updatedAt),
      ],
    )

    if (note.published) {
      await connection.query(
        `INSERT INTO article_version (
          id, article_id, kind, title, category_id, category_slug, path,
          label, markdown, plain_text, content_json, author_id, author_name,
          author_role, created_at
        ) VALUES (?, ?, 'published', ?, ?, ?, ?, NULL, ?, ?, NULL,
                  'owner-1', ?, 'owner', ?)`,
        [
          note.published.versionId,
          note.id,
          note.published.title,
          note.categoryId,
          fixture.prototypeState.categories.find(
            (category) => category.id === note.categoryId,
          )?.slug,
          note.published.slug,
          note.published.markdown,
          note.published.plainText,
          fixture.prototypeState.author.name,
          dateTime(note.published.publishedAt),
        ],
      )
    }
  }

  const manualVersion = fixture.prototypeState.notes[0].versions.find(
    (version) => version.kind === 'manual',
  )
  if (manualVersion) {
    await connection.query(
      `INSERT INTO article_version (
        id, article_id, kind, title, category_id, category_slug, path,
        label, markdown, plain_text, content_json, author_id, author_name,
        author_role, created_at
      ) VALUES (?, 'note-keep-thinking', 'manual', ?, 'theme-attention',
                'attention-and-writing', 'keep-thinking-on-paper', ?, ?, ?,
                NULL, 'collaborator-1', '周行', 'collaborator', ?)`,
      [
        manualVersion.id,
        manualVersion.title,
        manualVersion.label,
        manualVersion.markdown,
        manualVersion.plainText,
        dateTime(manualVersion.createdAt),
      ],
    )
  }

  await connection.query(
    `INSERT INTO article_grant (user_id, article_id, created_at)
     VALUES ('collaborator-1', 'note-keep-thinking', ?)`,
    [dateTime('2026-11-01T09:00:00.000Z')],
  )

  for (const invite of fixture.prototypeState.collaborationInvites) {
    await connection.query(
      `INSERT INTO collaboration_invite (
        id, token_hash, email, display_name, source, application_id, status,
        expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        invite.id,
        createHash('sha256').update(invite.token).digest('hex'),
        invite.email,
        invite.displayName,
        invite.source,
        invite.status,
        dateTime(invite.expiresAt),
        dateTime(invite.createdAt),
      ],
    )
    await connection.query(
      `INSERT INTO collaboration_invite_article (invite_id, article_id)
       VALUES (?, ?)`,
      [invite.id, invite.noteIds[0]],
    )
  }

  await connection.query(
    `INSERT INTO collaboration_password_reset (
      id, user_id, email, token_hash, status, expires_at, created_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [
      'visual-password-reset',
      'collaborator-1',
      'zhou@qq.com',
      createHash('sha256').update('visual-reset-token').digest('hex'),
      dateTime('2099-11-13T13:00:00.000Z'),
      dateTime('2026-11-13T12:00:00.000Z'),
    ],
  )

  for (const application of fixture.prototypeState.collaborationApplications) {
    await connection.query(
      `INSERT INTO collaboration_application (
        id, article_id, name, email, note, status, created_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        application.id,
        application.noteId,
        application.name,
        application.email,
        application.note,
        application.status,
        dateTime(application.createdAt),
      ],
    )
  }

  for (const event of fixture.prototypeState.articleViewEvents) {
    await connection.query(
      `INSERT INTO article_view_event (
        id, article_id, visitor_ip, visitor_hash, location, referrer_domain,
        visited_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.noteId,
        event.ip,
        event.visitorKey,
        event.location,
        event.referrerDomain,
        dateTime(event.visitedAt),
      ],
    )
    const metricDate = event.visitedAt.slice(0, 10)
    await connection.query(
      `INSERT INTO daily_article_metric (
        article_id, metric_date, views, unique_visitors, last_visited_at
      ) VALUES (?, ?, 1, 1, ?)
      ON DUPLICATE KEY UPDATE
        views = views + 1,
        unique_visitors = unique_visitors + 1,
        last_visited_at = GREATEST(last_visited_at, VALUES(last_visited_at))`,
      [event.noteId, metricDate, dateTime(event.visitedAt)],
    )
  }

  for (const notification of fixture.production.notifications) {
    await connection.query(
      `INSERT INTO notification (
        id, event_key, kind, title, body, href, read_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notification.id,
        notification.eventKey,
        notification.kind,
        notification.title,
        notification.body,
        notification.href,
        notification.readAt,
        dateTime(notification.createdAt),
      ],
    )
  }
} finally {
  await connection.end()
}
