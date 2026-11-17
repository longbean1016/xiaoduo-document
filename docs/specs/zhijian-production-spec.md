# 知笺正式产品规格

Status: ready-for-agent (local draft; project tracker not configured)

## Problem Statement

站主需要一个可以长期维护、公开阅读并按稳定目录组织的知识库，而不是依赖封闭平台或按时间排序的普通博客。现有 Vite 原型已经验证了分类阅读、文章编辑、版本历史、文章级协作和访问报表等交互，但数据、身份、权限和统计仍保存在浏览器本地，无法安全地供真实读者和协作者使用。

受邀协作者需要只看到和编辑被授权的文章，并能在保存、发布和版本记录中留下可追溯身份。站主需要保留撤回、永久删除、分类和授权管理的最终控制权，同时能够发现哪些文章被阅读、由谁产生访问，以及协作者是否真正完成了修订。

## Solution

将知笺实现为 Next.js App Router + TypeScript 的模块化单体。公开站提供预览页、两层分类目录、Markdown 章节阅读、全文搜索、RSS、站点地图和分享卡片。写作台使用邮箱密码认证、HttpOnly Cookie 会话和文章级授权；站主与协作者共享同一份当前草稿和不可变版本日志，协作者可以保存和发布获授权文章，站主保留撤回、永久删除、分类和授权管理。

正式版运行在腾讯云服务器，通过 Docker Compose 运行 Next.js 和 MySQL，Nginx 终止 TLS，图片通过短期签名直接上传阿里云 OSS。公开页使用 SSR/ISR 和发布后按需刷新；写作台使用 Route Handlers 与 TanStack Query。访问统计由自建访问事件和聚合表实现，IP 归属地使用本地 IP 数据库解析。

## User Stories

### Public Reading

1. As a 读者, I want a 预览页 that explains the knowledge library and links into it, so that I understand what I am entering.
2. As a 读者, I want a 固定左侧目录 with two-level 分类 → 章节 navigation, so that I can browse a stable knowledge structure.
3. As a 读者, I want the current category and chapter to be clearly highlighted, so that I know where I am without seeing parent categories falsely highlighted.
4. As a 读者, I want 分类 pages to list only publicly visible 章节, so that draft and unpublished content never leak.
5. As a 读者, I want a 章节 page rendered from canonical Markdown, so that headings, lists, quotes, code, tables, tasks, images and text styles are readable and consistent.
6. As a 读者, I want to see 字数, 浏览量 and the exact update time together, so that I can assess the article at a glance.
7. As a 读者, I want to see the 站主 author avatar/name and actual 贡献者 avatars/names in the same byline area, so that attribution is clear.
8. As a 读者, I want an independently scrollable page outline that follows the current section, so that I can navigate long articles.
9. As a 读者, I want previous/next chapter navigation based on manual category order, so that the library reads like a book.
10. As a 读者, I want full-text search across article titles and body content, so that I can find knowledge without browsing every category.
11. As a 读者, I want light and dark reading themes, so that the reading experience remains comfortable.
12. As a 读者, I want a responsive mobile reading experience, so that I can read, search and apply from a phone.
13. As a 读者, I want no “写作台” links in the public header or directory footer, so that the authoring area remains private and direct-entry only.
14. As a 读者, I want stable chapter URLs derived from category slug and title path, so that bookmarks remain meaningful.
15. As a 读者, I want old chapter URLs to redirect after a title or category slug change, so that existing links do not break.

### Invitations

16. As a 站主, I want invitations to contain article grants without requiring the collaborator's email or display name up front, so that I can create and deliver a capability link myself.
17. As a 站主, I want to copy the full invitation link and revoke it, so that only people who receive my private link can start activation.
18. As an invited person, I want the invitation link to remain usable until its first successful email OTP activation, so that it acts as a one-time admission credential.
22. As a 站主, I want to invite someone by selected article IDs, so that I can recruit trusted contributors proactively.
23. As a 站主, I want to manage article grants after activation without reissuing an invitation, so that permissions take effect immediately.
24. As a 站主, I want invitation states for pending, activated, expired and revoked, so that I can see whether access was accepted.
25. As an invited person, I want to enter my email and complete a 600-second OTP challenge, so that only the mailbox that receives the latest code can bind the invitation.
26. As an invited person, I want an expired invitation to fail clearly while an already activated account continues to work, so that invitation expiry has predictable scope.

### Collaboration

27. As a 协作者, I want to log in with my registered email and a latest-only OTP through an HttpOnly Cookie session, so that I do not manage another password.
28. As a 协作者, I want the writing desk to list only articles in my 文章授权, so that unauthorized drafts and categories are not exposed.
29. As a 协作者, I want categories to appear only when they contain an authorized article, so that the writing desk remains scoped.
30. As a 协作者, I want direct access to an unauthorized article to show a permission error, so that hiding links is not the only protection.
31. As a 协作者, I want to edit title and Markdown content for authorized articles, so that I can complete real revisions.
32. As a 协作者, I want approximately 800ms autosave plus Ctrl/Cmd+S draft save, so that I do not lose work.
33. As a 协作者, I want to save manual versions and publish or update an authorized article online, so that my work can become public.
34. As a 协作者, I want to see shared version history with version authors and compare each version to the previous one, so that I can understand what changed.
35. As a 协作者, I want change navigation that jumps to the exact block and focuses the editable draft, so that I can adjust changes quickly.
36. As a 协作者, I want a revision conflict when another editor saved first, so that I cannot silently overwrite their work.
37. As a 协作者, I want to move an authorized article into my own recycle bin and restore it, so that accidental removal can be reversed.
38. As a 协作者, I want to see only articles I moved to the recycle bin, so that my temporary removals are separated from other editors.
39. As a 协作者, I want to be blocked from creating articles, managing categories, inviting people, permanently deleting articles, viewing analytics or seeing other users' recycle bins, so that article grants cannot escalate into site control.
40. As a 协作者, I want to log out and have the server session revoked, so that shared devices do not retain access.

### Owner Writing and Administration

41. As the 站主, I want to log in separately from collaborators, so that final administrative authority remains explicit.
42. As the 站主, I want to edit author nickname/avatar and site profile information, so that public attribution remains current.
43. As the 站主, I want to create, rename, reorder and delete empty categories, so that the public knowledge book remains organized.
44. As the 站主, I want category names and order changes to take effect immediately, so that navigation changes do not require article publishing.
45. As the 站主, I want to create new chapters only by choosing a category, so that the fixed two-level structure is preserved.
46. As the 站主, I want new chapters appended to the category end, with manual up/down ordering, so that automatic timestamps do not reshuffle the book.
47. As the 站主, I want to import Markdown as a new draft and insert images, so that existing material can be brought in efficiently.
48. As the 站主, I want to publish, update, withdraw and permanently delete any article, so that I retain final control.
49. As the 站主, I want to view all collaborators' recycle-bin items and permanently delete them, so that orphaned content can be cleaned up.
50. As the 站主, I want a unified collaboration-management page for applications, invitations, collaborators and article grants, so that access can be administered in one place.
51. As the 站主, I want to update collaborator grants immediately, suspend accounts and restore accounts, so that access reflects current trust.
52. As the 站主, I want to generate a one-time password-reset link manually, so that collaborators can recover accounts without an automatic email service.
53. As the 站主, I want a notification center for pending applications, invitation state, grant changes and collaborator publications, so that I know when action or awareness is needed.
54. As the 站主, I want to export the whole library as Markdown and metadata JSON, so that content remains portable without depending on database tools.

### Versions and Content Safety

55. As an article editor, I want autosave to update only the current draft, so that automatic typing does not pollute the version log.
56. As an article editor, I want manual saves and every publish/update to append immutable version records, so that history reflects deliberate checkpoints and public releases.
57. As an article editor, I want each version to record author ID, display-name snapshot and role, so that attribution survives future name or role changes.
58. As an article editor, I want a detailed block-level diff with inline added/removed text, so that I can understand actual changes rather than only counts.
59. As an article editor, I want the diff navigator to jump between changes without automatically opening the change list, so that previous/next remains a direct navigation action.
60. As an article editor, I want restoring a version to return it to the current draft before publishing, so that public content is not changed implicitly.
61. As a content editor, I want safe Markdown rendering with sanitized raw HTML, so that pasted or imported content cannot execute scripts.

### Analytics

62. As the 站主, I want one public view to count at most once per article/IP within 30 minutes, so that refreshes do not inflate totals.
63. As the 站主, I want owner visits excluded and collaborator public visits included, so that metrics reflect readers while avoiding author preview noise.
64. As the 站主, I want bot, prefetch and background requests excluded from analytics, so that totals are meaningful.
65. As the 站主, I want total views, unique visitors, 7/30-day trends, article rankings, last-visit times and recent visit records, so that I can understand content usage.
66. As the 站主, I want recent visits to show article, full visitor IP, coarse IP location, referrer domain and time with explicit column labels, so that the report is understandable.
67. As the 站主, I want IP location resolved to province/city through a local IP database, so that results are stable and do not require an external lookup on every request.
68. As the 站主, I want access details and full IP retained for 30 days only, with aggregate metrics retained longer, so that storage does not grow indefinitely.
69. As a 协作者 or 读者, I want analytics and IP details hidden from me, so that sensitive visitor information remains owner-only.

### Reader Discovery and Publishing

70. As a 读者, I want a public RSS feed, so that I can subscribe without an account or email address.
71. As a 读者, I want Open Graph share cards with article title, description, author and preview image, so that links shared to other platforms look complete.
72. As a search engine, I want a sitemap containing public article URLs and update times, so that public content can be discovered and indexed.
73. As a 读者, I want RSS, sitemap and share metadata to update immediately when a published version changes, so that external representations stay current.
74. As a 读者, I want search, RSS and SEO output to include only published, nontrashed articles, so that private or withdrawn content is not exposed.

### Operations and Quality

75. As the 站主, I want the public site to use SSR/ISR and on-demand revalidation after publish, so that public pages are fast without waiting for a full rebuild.
76. As the 站主, I want the writing desk to use explicit Route Handlers and frequent autosave endpoints, so that editing state does not depend on page navigations.
77. As the 站主, I want structured logs, Sentry error monitoring and a health check, so that runtime failures are visible.
78. As the 站主, I want APIs and database queries to enforce permissions server-side, so that client-side route hiding is not treated as security.
79. As a user, I want keyboard-operable dialogs, menus, editor controls and navigation with readable contrast, so that the product remains accessible.
80. As the 站主, I want the MVP to explicitly run without automated database backups or OSS object versioning, so that the accepted data-loss risk is not hidden.

## Implementation Decisions

- Use a Next.js App Router modular monolith with TypeScript, React, Tailwind CSS, Radix primitives and Lucide icons.
- Use Server Components and SSR/ISR for public pages; use client components, Route Handlers and TanStack Query for interactive studio pages.
- Use MySQL 8.4 with Drizzle ORM and checked-in SQL migrations.
- Use a mature TypeScript authentication library, preferably Better Auth after a compatibility spike, with database-backed sessions and HttpOnly cookies.
- Deploy Next.js standalone output, Nginx and MySQL with Docker Compose on one Tencent Cloud server. Keep OSS for images.
- Do not split frontend and backend services for the MVP. Frontend/backend remain logical layers in the same repository and deployment.
- Do not add Redis, BullMQ, microservices, or a separate search service. Run cleanup and daily aggregation through a lightweight Cron worker.
- Define `site_profile`, account, collaborator, category, article, article_grant, article_version, collaboration_application, collaboration_invite, notification, url_redirect, article_view_event, daily_article_metric and session data.
- Keep the legacy `collaboration_application` table for historical audit but stop creating new applications.
- Keep one current draft per article and a monotonically increasing article revision. Saves with stale revisions return a conflict and must enter comparison rather than overwrite.
- Store article content as Tiptap JSON, canonical Markdown, and plain text. Public pages render canonical Markdown, not a read-only Tiptap instance.
- Store manual and published versions as immutable records with author ID, author display-name snapshot and role.
- Define invitation state as pending, activated, expired or revoked. Pending invitations have no email binding; the first successful OTP activation binds an email, claimed user and article grants.
- Permit OTP activation only through a valid invitation link, and permit ordinary collaborator OTP login only for an existing active collaborator mailbox.
- Make each new OTP invalidate the previous code. Use a 600-second expiry, 60-second resend cooldown, five attempts, five sends per rolling hour, ten per rolling 24 hours per mailbox and ten per rolling hour per IP.
- Keep article grants as the permission atom. Derive visible studio categories from granted articles; do not grant permissions at category level in the MVP.
- Allow owner and fully authorized collaborators to publish or update that article. Keep withdraw, permanent deletion, category management, analytics and grant management owner-only.
- Record trash actor ID and display-name snapshot. Collaborators see and restore only their own trash items; owner sees all and is the only role allowed to permanently delete.
- Treat unfiltered IP plus coarse province/city as owner-only analytics data. Do not expose analytics through collaborator routes or public APIs.
- Use full visitor IP only from a trusted proxy chain and never trust arbitrary client-supplied forwarded headers.
- Exclude owner visits from analytics, include collaborator public visits, and deduplicate by article/IP within 30 minutes.
- Derive unique visitors from a daily salted hash of visitor IP and browser information; do not create a cross-day cookie or device identity.
- Retain raw view events and IP for 30 days; delete them with Cron and retain aggregates longer.
- Use MySQL FULLTEXT with the `ngram` parser for Chinese/English article title and body search.
- Use direct-to-OSS signed uploads after browser compression. Do not expose long-lived OSS credentials to the browser.
- Use Next.js Metadata for Open Graph cards, `ImageResponse` for generated share images, a Route Handler for RSS, and `sitemap` generation for public URLs.
- Revalidate public article, category, RSS and sitemap caches after publish, withdraw, category change or redirect change.
- Keep the public URL shape `/library/{category-slug}/{title-path}` and create redirects after published title/category slug changes.
- Keep the public category tree at two levels; article body H1–H5 are section headings, not routable categories.
- Display owner author information and actual version contributors in the same public byline area. Contributors are derived from version author records, not from grants.
- Exclude related-article recommendations, tags, comments, likes, follows, real-time co-editing, AI authoring, knowledge graph, general team documents and Office files.
- Do not show writing-desk links in the public site. `/studio` is reached by direct URL or approved invitation.
- Do not auto-send invitation links. Use the configurable SMTP adapter for invitation activation and collaborator login OTP messages only.
- Use Vitest, React Testing Library and Playwright. Use a dedicated MySQL schema/database for integration tests.
- Use structured JSON logs, Sentry and a health endpoint. Do not deploy Prometheus, Grafana or Loki in the MVP.
- Do not enable automated MySQL backups or OSS versioning in the MVP. Record the accepted risk that database/disk failure may cause unrecoverable loss.
- Run production on one Tencent Cloud server with Docker Compose. The database must not expose port 3306 publicly; only Nginx exposes HTTP/HTTPS.

### Permission Matrix

| Capability | 站主 | 协作者 | 读者 |
| --- | --- | --- | --- |
| Read published articles | Yes | Yes | Yes |
| Submit application | No application entry after login | No application entry after login | Yes |
| Edit authorized article | All | Granted only | No |
| Autosave draft | All | Granted only | No |
| Save manual version | All | Granted only | No |
| Publish/update | All | Granted only | No |
| Withdraw | Yes | No | No |
| Create article | Yes | No | No |
| Manage categories | Yes | No | No |
| Manage grants/invites | Yes | No | No |
| View analytics/IP | Yes | No | No |
| Move to trash | All | Granted only | No |
| See recycle bin | All | Own items only | No |
| Restore trash | All | Own items only | No |
| Permanently delete | Yes | No | No |

### API Boundary

- Public APIs expose only published, nontrashed articles and public author/contributor metadata.
- Studio APIs derive the actor from the server session; no client-supplied actor ID or role is trusted.
- Draft save accepts expected revision and returns saved, conflict, or forbidden.
- Publish and manual version APIs capture the version author server-side.
- Invitation acceptance validates token state, email binding and expiry in one transaction.
- Grant removal must invalidate subsequent article reads and writes immediately.
- Analytics endpoints are owner-only and return no raw IP to public or collaborator callers.
- Every mutating handler applies authorization, Zod validation, CSRF/session protections and rate limiting where applicable.

## Testing Decisions

Good tests verify externally observable behavior and invariants rather than component internals, SQL implementation details or private function calls. Existing unit tests for the store, Markdown headings, Markdown formatting and Markdown rendering are prior art for deterministic content behavior. Playwright has no existing prior art in the prototype and will establish the end-to-end seam for the production implementation.

### Proposed Seams

1. **HTTP and browser seam**: Playwright drives the real Next.js application and MySQL test database through public reading, application, approval, invitation activation, collaborator editing/publishing and owner analytics.
2. **Application-service and database seam**: integration tests call the server service/Route Handler boundary with a real MySQL test database to verify transactions, grants, revisions, session identity, invitation expiry, trash ownership and cache invalidation.
3. **Pure diff seam**: unit tests generate Markdown diffs without React, database or network dependencies.

These seams should be confirmed with the user before implementation because they place most confidence in two high-level boundaries and keep mocking low.

### Required Coverage

- Permission matrix: every capability above is tested for owner, collaborator and reader behavior.
- Direct URL access to unauthorized article APIs fails even when the UI link is hidden.
- Two editors saving the same revision produce one saved update and one conflict.
- Manual save and publish append versions with the correct author snapshot.
- A collaborator publish updates the public version, RSS and public caches.
- Invitation approval, direct invitation, activation, expiry, revocation and existing-account login.
- Suspended collaborators cannot log in or continue an active session.
- Categories and articles use manual ordering; automatic timestamp changes do not reorder them.
- Old URLs redirect after published title/category slug changes.
- Public pages omit draft, withdrawn, trashed and unauthorized content.
- Trash shows only the actor's items to collaborators and all items to owner; only owner can permanently delete.
- Analytics excludes owner, includes collaborator visits, deduplicates 30-minute repeats, filters bots and purges raw records after 30 days.
- Markdown raw HTML is sanitized and unsafe scripts/styles cannot execute.
- Markdown diff pairs modified blocks, reports added/removed/modified, and navigates without opening the detail list on previous/next.
- RSS and sitemap include only public articles and update after publish/withdraw.
- Full-text search handles Chinese and English and never returns unauthorized content.
- Keyboard and accessibility checks cover dialogs, menus, editor toolbar state, focus return and mobile navigation.

## Out of Scope

- Multiple isolated personal knowledge spaces or multi-tenant accounts.
- Public self-registration.
- Real-time co-editing, operational transforms or CRDT collaboration.
- Per-collaborator private drafts and merge workflows.
- Comments, likes, follows, social profiles or community moderation.
- Category-level authorization.
- More than two directory levels.
- Related-article recommendations, tags and knowledge graph navigation.
- AI writing, AI summaries, semantic search and vector databases.
- General Word/PDF/Office/archive attachment management.
- MDX components authored inside articles.
- Automatic invitation email and automatic password-reset email.
- Custom domains, subscriptions, payments or commercial plans.
- Automated database backups and OSS object versioning in the MVP.
- Prometheus, Grafana, Loki, Redis or queue infrastructure.

## Further Notes

- The current Vite/Zustand application is an interaction prototype, not the production persistence model. Existing visual decisions and domain rules should be migrated, not copied wholesale.
- The Next.js implementation must begin with data migration and permission tests before recreating all studio screens.
- Public article rendering, editor content, version snapshots and export all use canonical Markdown as the shared compatibility boundary.
- The no-backup decision is an explicit accepted risk. The implementation should document the lack of recovery when database/disk corruption or accidental destructive SQL occurs.
- Issue tracking is configured as a local Markdown tracker under `.scratch/zhijian-production/issues/`. This file remains the authoritative local spec.
