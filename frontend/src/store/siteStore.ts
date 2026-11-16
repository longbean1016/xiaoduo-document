import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  seedArticleViewEvents,
  seedAuthor,
  seedCategories,
  seedNotes,
} from '../data/seed'
import { hashPassword, makeId } from '../lib/utils'
import type {
  AuthorProfile,
  ArticleViewEvent,
  Category,
  ChapterSnapshot,
  CollaborationApplication,
  CollaborationInvite,
  Collaborator,
  Note,
  PublishedChapter,
  SaveResult,
  StudioRole,
  ThemeMode,
  UrlRedirect,
  VersionAuthor,
} from '../types'

const STUDIO_PASSWORD_HASH =
  'f2bc6b9fb8d708e4fb220784dc6378e912210388403e16c94dd5c9a0d4cf499d'
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const COLLABORATION_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface DraftInput {
  title: string
  categoryId: string
  markdown: string
  plainText: string
  expectedRevision: number
}

interface CategoryPatch {
  title?: string
  slug?: string
}

interface CollaborationApplicationInput {
  noteId: string
  name: string
  email: string
  note: string
}

interface CollaborationInviteInput {
  email: string
  displayName?: string
  noteIds: string[]
  source: CollaborationInvite['source']
  applicationId?: string
}

interface SiteState {
  author: AuthorProfile
  categories: Category[]
  notes: Note[]
  redirects: UrlRedirect[]
  collaborationApplications: CollaborationApplication[]
  collaborationInvites: CollaborationInvite[]
  collaborators: Collaborator[]
  articleViewEvents: ArticleViewEvent[]
  studioAuthed: boolean
  studioRole: StudioRole | null
  currentCollaboratorId: string | null
  themeMode: ThemeMode
  loginStudio: (password: string) => Promise<boolean>
  loginCollaborator: (email: string, password: string) => Promise<boolean>
  logoutStudio: () => void
  setThemeMode: (mode: ThemeMode) => void
  updateAuthor: (patch: Partial<AuthorProfile>) => void
  recordArticleView: (input: {
    noteId: string
    ip: string
    referrerDomain: string
  }) => boolean
  submitCollaborationApplication: (
    input: CollaborationApplicationInput,
  ) => 'created' | 'duplicate' | 'invalid'
  reviewCollaborationApplication: (
    applicationId: string,
    decision: 'approved' | 'rejected',
  ) => string | null
  createCollaborationInvite: (input: CollaborationInviteInput) => string | null
  acceptCollaborationInvite: (
    token: string,
    displayName: string,
    password: string,
  ) => Promise<'created' | 'expired' | 'invalid'>
  revokeCollaborationInvite: (inviteId: string) => void
  updateCollaboratorGrants: (
    collaboratorId: string,
    noteIds: string[],
  ) => boolean
  setCollaboratorStatus: (
    collaboratorId: string,
    status: Collaborator['status'],
  ) => void
  createCategory: (title: string, slug: string) => string | null
  updateCategory: (categoryId: string, patch: CategoryPatch) => boolean
  deleteCategory: (categoryId: string) => boolean
  moveCategory: (categoryId: string, direction: -1 | 1) => boolean
  reorderCategories: (categoryIds: string[]) => boolean
  createNote: (categoryId?: string) => string | null
  updateNoteDraft: (noteId: string, input: DraftInput) => SaveResult
  saveManualVersion: (noteId: string, label?: string) => string | null
  deleteVersion: (noteId: string, versionId: string) => boolean
  restoreVersion: (noteId: string, versionId: string) => SaveResult
  publishNote: (noteId: string) => boolean
  unpublishNote: (noteId: string) => void
  moveChapter: (noteId: string, direction: -1 | 1) => boolean
  trashNote: (noteId: string) => void
  restoreTrashedNote: (noteId: string) => void
  deleteNoteForever: (noteId: string) => void
  purgeExpiredTrash: () => void
  importMarkdown: (input: {
    title: string
    markdown: string
    plainText: string
    sourceFileName: string
    categoryId?: string
  }) => string | null
}

function currentVersionAuthor(state: SiteState): VersionAuthor {
  if (state.studioRole === 'collaborator' && state.currentCollaboratorId) {
    const collaborator = state.collaborators.find(
      (item) => item.id === state.currentCollaboratorId,
    )
    if (collaborator) {
      return {
        id: collaborator.id,
        name: collaborator.displayName,
        role: 'collaborator',
      }
    }
  }
  return {
    id: 'owner',
    name: state.author.name,
    role: 'owner',
  }
}

const clone = <T,>(value: T): T => structuredClone(value)

export function titleToChapterPath(title: string): string {
  return title
    .normalize('NFC')
    .trim()
    .replace(/[/\\?#%]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeCategorySlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function uniqueChapterSlug(
  title: string,
  categoryId: string,
  notes: Note[],
  excludeId?: string,
): string {
  const base = titleToChapterPath(title) || 'untitled'
  const existing = new Set(
    notes
      .filter(
        (note) =>
          note.id !== excludeId &&
          note.categoryId === categoryId &&
          !note.trashedAt,
      )
      .map((note) => note.slug),
  )
  if (!existing.has(base)) return base
  let suffix = 2
  while (existing.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function pathForPublished(
  published: PublishedChapter,
  categories: Category[],
): string {
  const category = categories.find((item) => item.id === published.categoryId)
  return `/library/${category?.slug ?? 'uncategorized'}/${published.slug}`
}

function addRedirect(
  redirects: UrlRedirect[],
  fromPath: string,
  toPath: string,
): UrlRedirect[] {
  if (fromPath === toPath) return redirects
  return [
    {
      id: makeId('redirect'),
      fromPath,
      toPath,
      createdAt: new Date().toISOString(),
    },
    ...redirects.filter((item) => item.fromPath !== fromPath),
  ]
}

function syncPublishedOrder(
  category: Category,
  publishedIds: Set<string>,
): string[] {
  const noteOrder = category.noteOrder ?? []
  const publishedNoteOrder = category.publishedNoteOrder ?? []
  const ordered = noteOrder.filter((id) => publishedIds.has(id))
  const remaining = publishedNoteOrder.filter(
    (id) => publishedIds.has(id) && !ordered.includes(id),
  )
  return [...ordered, ...remaining]
}

export function hasUnpublishedChanges(note: Note): boolean {
  if (!note.published || note.publicationState === 'unpublished') {
    return Boolean(note.published)
  }
  return (
    note.title !== note.published.title ||
    note.categoryId !== note.published.categoryId ||
    normalizeMarkdownForComparison(note.markdown) !==
      normalizeMarkdownForComparison(note.published.markdown)
  )
}

function normalizeMarkdownForComparison(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').trimEnd()
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function resolveArticleIpLocation(ip: string): string {
  if (
    ip === '127.0.0.1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('::1')
  ) {
    return '本地网络'
  }
  const mockLocations: Record<string, string> = {
    '113.65.18.42': '广东广州',
    '120.229.77.16': '广东深圳',
    '183.6.44.91': '广东广州',
    '14.120.56.203': '广东东莞',
    '223.104.67.18': '江苏南京',
    '58.60.112.9': '广东深圳',
    '119.123.201.77': '广东深圳',
  }
  if (mockLocations[ip]) return mockLocations[ip]
  if (ip.startsWith('2408:')) return '中国北京'
  return '未知地区'
}

function makeInvite(input: CollaborationInviteInput): CollaborationInvite {
  const timestamp = new Date()
  return {
    id: makeId('invite'),
    token: `${crypto.randomUUID().replaceAll('-', '')}${crypto
      .randomUUID()
      .replaceAll('-', '')}`,
    email: normalizeEmail(input.email),
    displayName: input.displayName?.trim() || undefined,
    noteIds: [...new Set(input.noteIds)],
    source: input.source,
    applicationId: input.applicationId,
    status: 'pending',
    createdAt: timestamp.toISOString(),
    expiresAt: new Date(
      timestamp.getTime() + COLLABORATION_INVITE_TTL_MS,
    ).toISOString(),
  }
}

function expirePendingInvites(
  invites: CollaborationInvite[],
): CollaborationInvite[] {
  const now = Date.now()
  return invites.map((invite) =>
    invite.status === 'pending' &&
    new Date(invite.expiresAt).getTime() <= now
      ? { ...invite, status: 'expired' }
      : invite,
  )
}

export function resolveRedirect(
  redirects: UrlRedirect[],
  fromPath: string,
): string | null {
  return redirects.find((item) => item.fromPath === fromPath)?.toPath ?? null
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set, get) => ({
      author: clone(seedAuthor),
      categories: clone(seedCategories),
      notes: clone(seedNotes),
      redirects: [],
      collaborationApplications: [],
      collaborationInvites: [],
      collaborators: [],
      articleViewEvents: clone(seedArticleViewEvents),
      studioAuthed: false,
      studioRole: null,
      currentCollaboratorId: null,
      themeMode: 'light',

      loginStudio: async (password) => {
        const passwordHash = await hashPassword(password)
        const valid = passwordHash === STUDIO_PASSWORD_HASH
        if (valid) {
          set({
            studioAuthed: true,
            studioRole: 'owner',
            currentCollaboratorId: null,
          })
        }
        return valid
      },

      loginCollaborator: async (email, password) => {
        const passwordHash = await hashPassword(password)
        const collaborator = get().collaborators.find(
          (item) =>
            item.email === normalizeEmail(email) &&
            item.status === 'active',
        )
        if (!collaborator || collaborator.passwordHash !== passwordHash) {
          return false
        }
        set({
          studioAuthed: true,
          studioRole: 'collaborator',
          currentCollaboratorId: collaborator.id,
        })
        return true
      },

      logoutStudio: () =>
        set({
          studioAuthed: false,
          studioRole: null,
          currentCollaboratorId: null,
        }),
      setThemeMode: (themeMode) => set({ themeMode }),
      updateAuthor: (patch) =>
        set((state) => ({ author: { ...state.author, ...patch } })),

      recordArticleView: ({ noteId, ip, referrerDomain }) => {
        const state = get()
        if (state.studioRole === 'owner') return false
        const note = state.notes.find((item) => item.id === noteId)
        if (
          !note ||
          note.trashedAt ||
          note.publicationState !== 'published'
        ) {
          return false
        }
        const now = Date.now()
        const duplicate = state.articleViewEvents.some(
          (event) =>
            event.noteId === noteId &&
            event.ip === ip &&
            now - new Date(event.visitedAt).getTime() < 30 * 60 * 1000,
        )
        if (duplicate) return false
        const day = new Date(now).toISOString().slice(0, 10)
        const event: ArticleViewEvent = {
          id: makeId('view'),
          noteId,
          visitedAt: new Date(now).toISOString(),
          ip,
          location: resolveArticleIpLocation(ip),
          referrerDomain: referrerDomain || '直接访问',
          visitorKey: `${ip}|${day}`,
        }
        const cutoff = now - 30 * 24 * 60 * 60 * 1000
        set({
          articleViewEvents: [
            event,
            ...state.articleViewEvents.filter(
              (item) => new Date(item.visitedAt).getTime() >= cutoff,
            ),
          ],
        })
        return true
      },

      submitCollaborationApplication: (input) => {
        const email = normalizeEmail(input.email)
        const name = input.name.trim()
        const note = input.note.trim()
        if (
          !isValidEmail(email) ||
          !name ||
          !get().notes.some((item) => item.id === input.noteId)
        ) {
          return 'invalid'
        }
        const duplicate = get().collaborationApplications.some(
          (application) =>
            application.status === 'pending' &&
            application.email === email &&
            application.noteId === input.noteId,
        )
        if (duplicate) return 'duplicate'

        const application: CollaborationApplication = {
          id: makeId('application'),
          noteId: input.noteId,
          name,
          email,
          note,
          status: 'pending',
          createdAt: new Date().toISOString(),
        }
        set((state) => ({
          collaborationApplications: [
            application,
            ...state.collaborationApplications,
          ],
        }))
        return 'created'
      },

      reviewCollaborationApplication: (applicationId, decision) => {
        const application = get().collaborationApplications.find(
          (item) => item.id === applicationId,
        )
        if (!application || application.status !== 'pending') return null
        const reviewedAt = new Date().toISOString()
        if (decision === 'rejected') {
          set((state) => ({
            collaborationApplications: state.collaborationApplications.map(
              (item) =>
                item.id === applicationId
                  ? { ...item, status: 'rejected', reviewedAt }
                  : item,
            ),
          }))
          return null
        }

        const invite = makeInvite({
          email: application.email,
          displayName: application.name,
          noteIds: [application.noteId],
          source: 'application',
          applicationId: application.id,
        })
        set((state) => ({
          collaborationApplications: state.collaborationApplications.map(
            (item) =>
              item.id === applicationId
                ? { ...item, status: 'approved', reviewedAt }
                : item,
          ),
          collaborationInvites: [invite, ...state.collaborationInvites],
        }))
        return invite.id
      },

      createCollaborationInvite: (input) => {
        const email = normalizeEmail(input.email)
        const validNotes = new Set(
          get()
            .notes.filter((note) => !note.trashedAt)
            .map((note) => note.id),
        )
        const noteIds = input.noteIds.filter((noteId) => validNotes.has(noteId))
        if (!isValidEmail(email) || !noteIds.length) return null
        const invite = makeInvite({ ...input, email, noteIds })
        set((state) => ({
          collaborationInvites: [invite, ...state.collaborationInvites],
        }))
        return invite.id
      },

      acceptCollaborationInvite: async (token, displayName, password) => {
        const normalizedDisplayName = displayName.trim()
        if (!normalizedDisplayName || password.length < 6) return 'invalid'
        const invites = expirePendingInvites(get().collaborationInvites)
        const invite = invites.find((item) => item.token === token)
        if (!invite) return 'invalid'
        if (invite.status === 'expired') {
          set({ collaborationInvites: invites })
          return 'expired'
        }
        if (invite.status !== 'pending') return 'invalid'

        const passwordHash = await hashPassword(password)
        const timestamp = new Date().toISOString()
        const existing = get().collaborators.find(
          (item) => item.email === invite.email,
        )
        const collaboratorId = existing?.id ?? makeId('collaborator')
        const collaborator: Collaborator = existing
          ? {
              ...existing,
              displayName: normalizedDisplayName,
              passwordHash,
              noteIds: [...new Set([...existing.noteIds, ...invite.noteIds])],
              status: 'active',
              updatedAt: timestamp,
            }
          : {
              id: collaboratorId,
              email: invite.email,
              displayName: normalizedDisplayName,
              passwordHash,
              noteIds: invite.noteIds,
              status: 'active',
              createdAt: timestamp,
              updatedAt: timestamp,
            }

        set((state) => ({
          collaborators: existing
            ? state.collaborators.map((item) =>
                item.id === collaborator.id ? collaborator : item,
              )
            : [collaborator, ...state.collaborators],
          collaborationInvites: invites.map((item) =>
            item.id === invite.id
              ? {
                  ...item,
                  status: 'activated',
                  activatedAt: timestamp,
                  collaboratorId,
                }
              : item,
          ),
          studioAuthed: true,
          studioRole: 'collaborator',
          currentCollaboratorId: collaboratorId,
        }))
        return 'created'
      },

      revokeCollaborationInvite: (inviteId) =>
        set((state) => ({
          collaborationInvites: state.collaborationInvites.map((invite) =>
            invite.id === inviteId && invite.status === 'pending'
              ? { ...invite, status: 'revoked' }
              : invite,
          ),
        })),

      updateCollaboratorGrants: (collaboratorId, noteIds) => {
        const collaborator = get().collaborators.find(
          (item) => item.id === collaboratorId,
        )
        if (!collaborator) return false
        const existingNoteIds = new Set(get().notes.map((note) => note.id))
        const nextNoteIds = noteIds.filter((noteId) =>
          existingNoteIds.has(noteId),
        )
        set((state) => ({
          collaborators: state.collaborators.map((item) =>
            item.id === collaboratorId
              ? {
                  ...item,
                  noteIds: [...new Set(nextNoteIds)],
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        }))
        return true
      },

      setCollaboratorStatus: (collaboratorId, status) =>
        set((state) => ({
          collaborators: state.collaborators.map((item) =>
            item.id === collaboratorId
              ? {
                  ...item,
                  status,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
          ...(state.currentCollaboratorId === collaboratorId &&
          status === 'suspended'
            ? {
                studioAuthed: false,
                studioRole: null,
                currentCollaboratorId: null,
              }
            : {}),
        })),

      createCategory: (title, slug) => {
        const normalizedTitle = title.trim()
        const normalizedSlug = normalizeCategorySlug(slug)
        if (!normalizedTitle || !normalizedSlug) return null
        if (get().categories.some((item) => item.slug === normalizedSlug)) {
          return null
        }
        const id = makeId('category')
        const category: Category = {
          id,
          title: normalizedTitle,
          slug: normalizedSlug,
          order: get().categories.length,
          noteOrder: [],
          publishedNoteOrder: [],
        }
        set((state) => ({ categories: [...state.categories, category] }))
        return id
      },

      updateCategory: (categoryId, patch) => {
        const current = get().categories.find((item) => item.id === categoryId)
        if (!current) return false
        const nextSlug =
          patch.slug !== undefined
            ? normalizeCategorySlug(patch.slug)
            : current.slug
        if (!nextSlug) return false
        if (
          get().categories.some(
            (item) => item.id !== categoryId && item.slug === nextSlug,
          )
        ) {
          return false
        }

        let redirects = get().redirects
        if (nextSlug !== current.slug) {
          redirects = addRedirect(
            redirects,
            `/library/${current.slug}`,
            `/library/${nextSlug}`,
          )
          for (const note of get().notes) {
            if (
              note.publicationState === 'published' &&
              note.published?.categoryId === categoryId
            ) {
              redirects = addRedirect(
                redirects,
                `/library/${current.slug}/${note.published.slug}`,
                `/library/${nextSlug}/${note.published.slug}`,
              )
            }
          }
        }
        set((state) => ({
          categories: state.categories.map((category) =>
            category.id === categoryId
              ? {
                  ...category,
                  ...(patch.title !== undefined
                    ? { title: patch.title.trim() || category.title }
                    : {}),
                  slug: nextSlug,
                }
              : category,
          ),
          redirects,
        }))
        return true
      },

      deleteCategory: (categoryId) => {
        if (get().notes.some((note) => note.categoryId === categoryId)) {
          return false
        }
        set((state) => ({
          categories: state.categories
            .filter((category) => category.id !== categoryId)
            .sort((a, b) => a.order - b.order)
            .map((category, index) => ({ ...category, order: index })),
        }))
        return true
      },

      moveCategory: (categoryId, direction) => {
        const ordered = get()
          .categories.slice()
          .sort((a, b) => a.order - b.order)
        const index = ordered.findIndex((item) => item.id === categoryId)
        const nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) {
          return false
        }
        const current = ordered[index]
        ordered[index] = ordered[nextIndex]
        ordered[nextIndex] = current
        set({
          categories: ordered.map((category, order) => ({
            ...category,
            order,
          })),
        })
        return true
      },

      reorderCategories: (categoryIds) => {
        const existingIds = new Set(get().categories.map((category) => category.id))
        const nextIds = new Set(categoryIds)
        if (
          categoryIds.length !== existingIds.size ||
          nextIds.size !== existingIds.size ||
          [...existingIds].some((id) => !nextIds.has(id))
        ) {
          return false
        }
        const categoryById = new Map(
          get().categories.map((category) => [category.id, category]),
        )
        set({
          categories: categoryIds.map((id, order) => ({
            ...categoryById.get(id)!,
            order,
          })),
        })
        return true
      },

      createNote: (categoryId) => {
        if (!categoryId) return null
        const category = get().categories.find((item) => item.id === categoryId)
        if (!category) return null
        const timestamp = new Date().toISOString()
        const id = makeId('note')
        const title = '无标题章节'
        const slug = uniqueChapterSlug(title, categoryId, get().notes)
        const note: Note = {
          id,
          title,
          categoryId,
          slug,
          markdown: '',
          plainText: '',
          revision: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          publicationState: 'draft',
          published: null,
          versions: [],
          trashedAt: null,
          trashedBy: null,
          trashedByName: null,
        }
        set((state) => ({
          notes: [note, ...state.notes],
          categories: state.categories.map((item) =>
            item.id === categoryId
              ? {
                  ...item,
                  noteOrder: [...item.noteOrder, note.id],
                }
              : item,
          ),
        }))
        return id
      },

      updateNoteDraft: (noteId, input) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note) return 'missing'
        if (note.revision !== input.expectedRevision) return 'conflict'
        if (!get().categories.some((item) => item.id === input.categoryId)) {
          return 'missing'
        }
        const slug = uniqueChapterSlug(
          input.title,
          input.categoryId,
          get().notes,
          noteId,
        )
        const timestamp = new Date().toISOString()
        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  title: input.title.trim() || '无标题章节',
                  categoryId: input.categoryId,
                  slug,
                  markdown: input.markdown,
                  plainText: input.plainText,
                  revision: item.revision + 1,
                  updatedAt: timestamp,
                }
              : item,
          ),
          categories: state.categories.map((category) => {
            const withoutNote = category.noteOrder.filter((id) => id !== noteId)
            if (category.id === input.categoryId) {
              return {
                ...category,
                noteOrder:
                  note.categoryId === input.categoryId
                    ? category.noteOrder
                    : [...withoutNote, noteId],
              }
            }
            return category.id === note.categoryId
              ? { ...category, noteOrder: withoutNote }
              : category
          }),
        }))
        return 'saved'
      },

      saveManualVersion: (noteId, label) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note) return null
        const author = currentVersionAuthor(get())
        const version: ChapterSnapshot = {
          id: makeId('version'),
          kind: 'manual',
          label: label?.trim() || undefined,
          title: note.title,
          categoryId: note.categoryId,
          slug: note.slug,
          markdown: note.markdown,
          plainText: note.plainText,
          createdAt: new Date().toISOString(),
          author,
        }
        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? { ...item, versions: [version, ...item.versions] }
              : item,
          ),
        }))
        return version.id
      },

      deleteVersion: (noteId, versionId) => {
        const note = get().notes.find((item) => item.id === noteId)
        const version = note?.versions.find((item) => item.id === versionId)
        if (!note || !version || version.kind !== 'manual') return false
        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  versions: item.versions.filter(
                    (candidate) => candidate.id !== versionId,
                  ),
                }
              : item,
          ),
        }))
        return true
      },

      restoreVersion: (noteId, versionId) => {
        const note = get().notes.find((item) => item.id === noteId)
        const version = note?.versions.find((item) => item.id === versionId)
        if (!note || !version) return 'missing'
        const slug = uniqueChapterSlug(
          version.title,
          version.categoryId,
          get().notes,
          noteId,
        )
        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  title: version.title,
                  categoryId: version.categoryId,
                  slug,
                  markdown: version.markdown,
                  plainText: version.plainText,
                  revision: item.revision + 1,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
          categories: state.categories.map((category) => {
            const withoutNote = category.noteOrder.filter((id) => id !== noteId)
            if (category.id === version.categoryId) {
              return {
                ...category,
                noteOrder:
                  note.categoryId === version.categoryId
                    ? category.noteOrder
                    : [...withoutNote, noteId],
              }
            }
            return category.id === note.categoryId
              ? { ...category, noteOrder: withoutNote }
              : category
          }),
        }))
        return 'saved'
      },

      publishNote: (noteId) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note || note.trashedAt) return false
        const category = get().categories.find(
          (item) => item.id === note.categoryId,
        )
        if (!category) return false

        const timestamp = new Date().toISOString()
        const versionId = makeId('published')
        const author = currentVersionAuthor(get())
        const published: PublishedChapter = {
          versionId,
          title: note.title,
          categoryId: note.categoryId,
          slug: note.slug,
          markdown: note.markdown,
          plainText: note.plainText,
          publishedAt: timestamp,
        }
        const publishedSnapshot: ChapterSnapshot = {
          id: versionId,
          kind: 'published',
          title: published.title,
          categoryId: published.categoryId,
          slug: published.slug,
          markdown: published.markdown,
          plainText: published.plainText,
          createdAt: timestamp,
          label: '更新线上版本',
          author,
        }
        let redirects = get().redirects
        if (note.published) {
          redirects = addRedirect(
            redirects,
            pathForPublished(note.published, get().categories),
            pathForPublished(published, get().categories),
          )
        }

        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  publicationState: 'published',
                  published,
                  versions: [publishedSnapshot, ...item.versions],
                  updatedAt: timestamp,
                }
              : item,
          ),
          categories: state.categories.map((item) => {
            if (item.id === category.id) {
              return {
                ...item,
                publishedNoteOrder: item.publishedNoteOrder.includes(noteId)
                  ? item.publishedNoteOrder
                  : [...item.publishedNoteOrder, noteId],
              }
            }
            if (note.published?.categoryId === item.id) {
              return {
                ...item,
                publishedNoteOrder: item.publishedNoteOrder.filter(
                  (id) => id !== noteId,
                ),
              }
            }
            return item
          }),
          redirects,
        }))
        return true
      },

      unpublishNote: (noteId) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note?.published) return
        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  publicationState: 'unpublished',
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
          categories: state.categories.map((category) => ({
            ...category,
            publishedNoteOrder: category.publishedNoteOrder.filter(
              (id) => id !== noteId,
            ),
          })),
        }))
      },

      moveChapter: (noteId, direction) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note) return false
        const category = get().categories.find(
          (item) => item.id === note.categoryId,
        )
        if (!category) return false
        const index = category.noteOrder.indexOf(noteId)
        const nextIndex = index + direction
        if (index < 0 || nextIndex < 0 || nextIndex >= category.noteOrder.length) {
          return false
        }
        const order = [...category.noteOrder]
        const current = order[index]
        order[index] = order[nextIndex]
        order[nextIndex] = current
        const publishedIds = new Set(
          get()
            .notes.filter(
              (item) =>
                item.publicationState === 'published' &&
                item.published?.categoryId === category.id,
            )
            .map((item) => item.id),
        )
        const withoutNote = {
          ...category,
          noteOrder: order,
        }
        set((state) => ({
          categories: state.categories.map((item) =>
            item.id === category.id
              ? {
                  ...item,
                  noteOrder: order,
                  publishedNoteOrder: syncPublishedOrder(
                    withoutNote,
                    publishedIds,
                  ),
                }
              : item,
          ),
        }))
        return true
      },

      trashNote: (noteId) => {
        const timestamp = new Date().toISOString()
        const actor = currentVersionAuthor(get())
        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  trashedAt: timestamp,
                  trashedBy: actor.id,
                  trashedByName: actor.name,
                  publicationState:
                    item.publicationState === 'published'
                      ? 'unpublished'
                      : item.publicationState,
                }
              : item,
          ),
          categories: state.categories.map((category) => ({
            ...category,
            noteOrder: category.noteOrder.filter((id) => id !== noteId),
            publishedNoteOrder: category.publishedNoteOrder.filter(
              (id) => id !== noteId,
            ),
          })),
        }))
      },

      restoreTrashedNote: (noteId) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note) return
        set((state) => ({
          notes: state.notes.map((item) =>
            item.id === noteId
              ? {
                  ...item,
                  trashedAt: null,
                  trashedBy: null,
                  trashedByName: null,
                }
              : item,
          ),
          categories: state.categories.map((category) =>
            category.id === note.categoryId &&
            !category.noteOrder.includes(noteId)
              ? { ...category, noteOrder: [...category.noteOrder, noteId] }
              : category,
          ),
        }))
      },

      deleteNoteForever: (noteId) => {
        const note = get().notes.find((item) => item.id === noteId)
        if (!note) return
        const publishedPath = note.published
          ? pathForPublished(note.published, get().categories)
          : null
        set((state) => ({
          notes: state.notes.filter((item) => item.id !== noteId),
          categories: state.categories.map((category) => ({
            ...category,
            noteOrder: category.noteOrder.filter((id) => id !== noteId),
            publishedNoteOrder: category.publishedNoteOrder.filter(
              (id) => id !== noteId,
            ),
          })),
          redirects: publishedPath
            ? state.redirects.filter(
                (redirect) =>
                  redirect.fromPath !== publishedPath &&
                  redirect.toPath !== publishedPath,
              )
            : state.redirects,
        }))
      },

      purgeExpiredTrash: () => {
        const cutoff = Date.now() - TRASH_RETENTION_MS
        const expired = get().notes.filter(
          (note) =>
            note.trashedAt && new Date(note.trashedAt).getTime() < cutoff,
        )
        if (!expired.length) return
        const expiredIds = new Set(expired.map((note) => note.id))
        set((state) => ({
          notes: state.notes.filter((note) => !expiredIds.has(note.id)),
          categories: state.categories.map((category) => ({
            ...category,
            noteOrder: category.noteOrder.filter((id) => !expiredIds.has(id)),
            publishedNoteOrder: category.publishedNoteOrder.filter(
              (id) => !expiredIds.has(id),
            ),
          })),
        }))
      },

      importMarkdown: ({
        title,
        markdown,
        plainText,
        sourceFileName,
        categoryId,
      }) => {
        if (!categoryId) return null
        const category = get().categories.find((item) => item.id === categoryId)
        if (!category) return null
        const timestamp = new Date().toISOString()
        const id = makeId('note')
        const normalizedTitle =
          title.trim() || sourceFileName.replace(/\.(md|markdown)$/i, '')
        const note: Note = {
          id,
          title: normalizedTitle,
          categoryId,
          slug: uniqueChapterSlug(normalizedTitle, categoryId, get().notes),
          markdown,
          plainText,
          revision: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
          publicationState: 'draft',
          published: null,
          versions: [],
          trashedAt: null,
          trashedBy: null,
          trashedByName: null,
          sourceFileName,
        }
        set((state) => ({
          notes: [note, ...state.notes],
          categories: state.categories.map((item) =>
            item.id === categoryId
              ? { ...item, noteOrder: [...item.noteOrder, note.id] }
              : item,
          ),
        }))
        return id
      },
    }),
    {
      name: 'zhijian-public-site-v7',
      version: 7,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<SiteState>
        return {
          author: state.author ?? clone(seedAuthor),
          categories: state.categories ?? clone(seedCategories),
          notes: (state.notes ?? clone(seedNotes)).map((note) => ({
            ...note,
            trashedBy: note.trashedBy ?? null,
            trashedByName: note.trashedByName ?? null,
          })),
          redirects: state.redirects ?? [],
          collaborationApplications:
            version < 3 ? [] : (state.collaborationApplications ?? []),
          collaborationInvites:
            version < 3 ? [] : (state.collaborationInvites ?? []),
          collaborators: version < 3 ? [] : (state.collaborators ?? []),
          articleViewEvents: (
            state.articleViewEvents ?? clone(seedArticleViewEvents)
          ).map((event) => ({
            ...event,
            location:
              !event.location || event.location === '未知地区'
                ? resolveArticleIpLocation(event.ip)
                : event.location,
          })),
          studioAuthed:
            version < 3 ? false : (state.studioAuthed ?? false),
          studioRole: version < 3 ? null : (state.studioRole ?? null),
          currentCollaboratorId:
            version < 3 ? null : (state.currentCollaboratorId ?? null),
          themeMode: state.themeMode ?? 'light',
        }
      },
      partialize: (state) => ({
        author: state.author,
        categories: state.categories,
        notes: state.notes,
        redirects: state.redirects,
        collaborationApplications: state.collaborationApplications,
        collaborationInvites: state.collaborationInvites,
        collaborators: state.collaborators,
        articleViewEvents: state.articleViewEvents,
        studioAuthed: state.studioAuthed,
        studioRole: state.studioRole,
        currentCollaboratorId: state.currentCollaboratorId,
        themeMode: state.themeMode,
      }),
    },
  ),
)

export function publicNotes(notes: Note[]): Note[] {
  return notes
    .filter(
      (note) =>
        note.publicationState === 'published' &&
        note.published !== null &&
        note.trashedAt === null,
    )
    .sort((a, b) =>
      (b.published?.publishedAt ?? '').localeCompare(
        a.published?.publishedAt ?? '',
      ),
    )
}

export function categoryNotes(category: Category, notes: Note[]): Note[] {
  const published = notes.filter(
    (note) =>
      note.publicationState === 'published' &&
      note.published?.categoryId === category.id &&
      note.trashedAt === null,
  )
  const byId = new Map(published.map((note) => [note.id, note]))
  const publishedNoteOrder = category.publishedNoteOrder ?? []
  const ordered = publishedNoteOrder
    .map((id) => byId.get(id))
    .filter((note): note is Note => Boolean(note))
  const extras = published.filter(
    (note) => !publishedNoteOrder.includes(note.id),
  )
  return [...ordered, ...extras]
}

export function chapterPublicPath(
  note: Note,
  categories: Category[],
): string | null {
  if (!note.published) return null
  return pathForPublished(note.published, categories)
}

export function categoryPublicPath(category: Category): string {
  return `/library/${category.slug}`
}

export function articleViewCount(
  events: ArticleViewEvent[],
  noteId: string,
): number {
  return events.filter((event) => event.noteId === noteId).length
}
