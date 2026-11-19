import type { JSONContent } from '@tiptap/core'

export type ThemeMode = 'light' | 'dark'
export type PublicationState = 'draft' | 'published' | 'unpublished'
export type StudioRole = 'owner' | 'collaborator'

export interface Collaborator {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  passwordHash: string
  noteIds: string[]
  status: 'active' | 'suspended'
  createdAt: string
  updatedAt: string
}

export interface CollaborationApplication {
  id: string
  noteId: string
  name: string
  email: string
  note: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt?: string
}

export interface CollaborationInvite {
  id: string
  token: string
  email: string
  displayName?: string
  noteIds: string[]
  source: 'application' | 'direct'
  applicationId?: string
  status: 'pending' | 'activated' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string
  activatedAt?: string
  collaboratorId?: string
}

export interface VersionAuthor {
  id: string
  name: string
  role: StudioRole
}

export interface ArticleViewEvent {
  id: string
  noteId: string
  visitedAt: string
  ip: string
  location: string
  referrerDomain: string
  visitorKey: string
}

export interface AuthorProfile {
  name: string
  avatarUrl?: string
  role: string
  intro: string
  now: string
  location: string
  email: string
}

export interface Category {
  id: string
  title: string
  slug: string
  order: number
  noteOrder: string[]
  publishedNoteOrder: string[]
}

export interface ChapterSnapshot {
  id: string
  title: string
  categoryId: string
  slug: string
  markdown: string
  plainText: string
  createdAt: string
  label?: string
  kind: 'manual' | 'published'
  author?: VersionAuthor
}

export interface PublishedChapter {
  versionId: string
  title: string
  categoryId: string
  slug: string
  markdown: string
  plainText: string
  publishedAt: string
}

export interface Note {
  id: string
  title: string
  categoryId: string
  slug: string
  markdown: string
  plainText: string
  content?: JSONContent
  revision: number
  createdAt: string
  updatedAt: string
  publicationState: PublicationState
  published: PublishedChapter | null
  versions: ChapterSnapshot[]
  trashedAt: string | null
  trashedBy?: string | null
  trashedByName?: string | null
  sourceFileName?: string
}

export interface UrlRedirect {
  id: string
  fromPath: string
  toPath: string
  createdAt: string
}

export interface NoteUpdateInput {
  title: string
  categoryId: string
  markdown: string
  plainText: string
  expectedRevision: number
}

export type SaveResult = 'saved' | 'conflict' | 'missing'
