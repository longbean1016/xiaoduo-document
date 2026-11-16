'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { BubbleMenu } from '@tiptap/react/menus'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import DragHandle from '@tiptap/extension-drag-handle-react'
import type { Editor, JSONContent } from '@tiptap/core'
import {
  ArrowLeft,
  Bold,
  Check,
  CheckSquare2,
  ChevronRight,
  Code2,
  CodeXml,
  Columns2,
  Eye,
  EyeOff,
  FileUp,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Highlighter,
  History,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  Save,
  Send,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createEditorExtensions } from '@/components/editor/extensions'
import { Dialog } from '@/components/ui/dialog'
import { Hint } from '@/components/ui/tooltip'
import { StudioSelect } from '@/components/ui/studio-select'
import { VersionHistory, type VersionItem } from './version-history'
import { MarkdownDiffView } from './markdown-diff-view'
import { compressImageForUpload } from '@/lib/image-compression'
import { countWords, markdownHeadings } from '@/lib/markdown-headings'
import { normalizeCurrentMarkdownBlock } from '@/lib/markdown-normalize'
import type { MarkdownDiffChange } from '@/lib/markdown-diff'
import { cn } from '@/lib/utils'

interface CategoryItem {
  id: string
  title: string
  slug: string
  position: number
}

interface ArticleItem {
  id: string
  title: string
  categoryId: string
  categoryTitle: string
  categorySlug: string
  path: string
  position: number
  contentJson: string | null
  markdown: string
  plainText: string
  revision: number
  publicationState: 'draft' | 'published' | 'unpublished'
  updatedAt: string
}

interface ConflictSnapshot {
  currentTitle: string
  currentMarkdown: string
  currentContentJson: string | null
  currentCategoryId: string
  currentRevision: number
  localTitle: string
  localMarkdown: string
  localCategoryId: string
}

interface Comparison {
  title: string
  oldMarkdown: string
  newMarkdown: string
  mode: 'version' | 'draft'
  oldMeta?: string
  newMeta?: string
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error'

function initialContent(article: ArticleItem): JSONContent | string {
  if (article.contentJson) {
    try {
      return JSON.parse(article.contentJson) as JSONContent
    } catch {
      return article.markdown
    }
  }
  return article.markdown
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatVersionDate(iso: string): string {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(iso)
    ? iso
    : `${iso.replace(' ', 'T')}Z`
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(new Date(normalized))
}

export function ChapterEditor({
  article,
  categories,
  versions,
  role,
  actorId,
}: {
  article: ArticleItem
  categories: CategoryItem[]
  versions: VersionItem[]
  role: 'owner' | 'collaborator'
  actorId: string
}) {
  const router = useRouter()
  const isOwner = role === 'owner'
  const [title, setTitle] = useState(article.title)
  const [categoryId, setCategoryId] = useState(article.categoryId)
  const [saveState, setSaveState] = useState<SaveState>('dirty')
  const [savedAt, setSavedAt] = useState(article.updatedAt)
  const [publicationState, setPublicationState] = useState(
    article.publicationState,
  )
  const [conflict, setConflict] = useState<ConflictSnapshot | null>(null)
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [focusMessage, setFocusMessage] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [imageMessage, setImageMessage] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [versionLabel, setVersionLabel] = useState('')
  const [versionPending, setVersionPending] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [sourceValue, setSourceValue] = useState('')
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [draftTick, setDraftTick] = useState(0)
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const titleRef = useRef(title)
  const categoryRef = useRef(categoryId)
  const revisionRef = useRef(article.revision)
  const dirtyRef = useRef(false)
  const editVersionRef = useRef(0)
  const savingRef = useRef(false)
  const conflictRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const normalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const saveNowRef = useRef<(force?: boolean) => Promise<boolean>>(
    async () => false,
  )
  const editorRef = useRef<Editor | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const markdownInputRef = useRef<HTMLInputElement>(null)
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const tocLockRef = useRef(false)
  const tocTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor(
    {
      extensions: createEditorExtensions({ editable: true }),
      content: initialContent(article),
      contentType: article.contentJson ? 'json' : 'markdown',
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: 'zhijian-prose markdown-body studio-prose',
          'aria-label': '章节正文',
          'data-save-state': saveState,
        },
        handlePaste: (_view, event) => {
          const clipboard = event.clipboardData
          if (!clipboard) return false
          const text = clipboard.getData('text/plain')
          const html = clipboard.getData('text/html')
          if (!text) return false
          const htmlText = html
            ? new DOMParser()
                .parseFromString(html, 'text/html')
                .body.textContent?.trim()
            : ''
          if (htmlText && htmlText !== text.trim()) return false
          const looksLikeMarkdown =
            /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|~~~|---|\|.+\|)/.test(
              text,
            ) ||
            /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~|`[^`\n]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/.test(
              text,
            )
          const currentEditor = editorRef.current
          if (!looksLikeMarkdown || !currentEditor) return false
          try {
            const parsed = currentEditor.storage.markdown.manager.parse(text)
            currentEditor.chain().focus().insertContent(parsed).run()
            return true
          } catch {
            return false
          }
        },
      },
    },
    [article.id],
  )

  const markDirty = useCallback(() => {
    if (conflictRef.current) return
    editVersionRef.current += 1
    dirtyRef.current = true
    setSaveState('dirty')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void saveNowRef.current()
    }, 800)
  }, [])

  useEffect(() => {
    editorRef.current = editor
    if (!editor) return
    const onUpdate = () => {
      setDraftTick((current) => current + 1)
      markDirty()
      if (normalizeTimerRef.current) {
        clearTimeout(normalizeTimerRef.current)
      }
      normalizeTimerRef.current = setTimeout(() => {
        normalizeCurrentMarkdownBlock(editor)
      }, 80)
    }
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      if (normalizeTimerRef.current) {
        clearTimeout(normalizeTimerRef.current)
      }
      editorRef.current = null
    }
  }, [editor, markDirty])

  const saveNow = useCallback(
    async (force = false) => {
      if (!editor || savingRef.current || (conflictRef.current && !force)) {
        return false
      }
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      const savedEditVersion = editVersionRef.current
      savingRef.current = true
      setSaveState('saving')
      try {
        const response = await fetch(
          `/api/studio/articles/${article.id}/draft`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              title: titleRef.current,
              categoryId: categoryRef.current,
              contentJson: editor.getJSON(),
              markdown: editor.getMarkdown(),
              plainText: editor.getText(),
              expectedRevision: revisionRef.current,
            }),
          },
        )
        const payload = (await response.json()) as {
          result?: string
          current?: {
            title: string
            markdown: string
            contentJson: string | null
            categoryId: string
            revision: number
            updatedAt?: string
          }
        }
        if (response.status === 409) {
          if (timerRef.current) clearTimeout(timerRef.current)
          conflictRef.current = true
          setConflict({
            currentTitle: payload.current?.title ?? '',
            currentMarkdown: payload.current?.markdown ?? '',
            currentContentJson: payload.current?.contentJson ?? null,
            currentCategoryId:
              payload.current?.categoryId ?? article.categoryId,
            currentRevision:
              payload.current?.revision ?? revisionRef.current,
            localTitle: titleRef.current,
            localMarkdown: editor.getMarkdown(),
            localCategoryId: categoryRef.current,
          })
          setSaveState('conflict')
          return false
        }
        if (!response.ok || payload.result !== 'saved') {
          setSaveState('error')
          return false
        }
        revisionRef.current += 1
        const editCompletedDuringSave =
          editVersionRef.current !== savedEditVersion
        dirtyRef.current = editCompletedDuringSave
        conflictRef.current = false
        setSaveState(editCompletedDuringSave ? 'dirty' : 'saved')
        setSavedAt(new Date().toISOString())
        if (editCompletedDuringSave) {
          timerRef.current = setTimeout(() => {
            void saveNowRef.current()
          }, 800)
        }
        router.refresh()
        return true
      } catch {
        setSaveState('error')
        return false
      } finally {
        savingRef.current = false
      }
    },
    [article.categoryId, article.id, editor, router],
  )

  useEffect(() => {
    saveNowRef.current = saveNow
  }, [saveNow])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveNow()
      }
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && saveState !== 'error' && saveState !== 'conflict') {
        return
      }
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [saveNow, saveState])

  useEffect(() => {
    const openImagePicker = () => imageInputRef.current?.click()
    window.addEventListener('zhijian:pick-image', openImagePicker)
    return () => {
      window.removeEventListener('zhijian:pick-image', openImagePicker)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (tocTimerRef.current) clearTimeout(tocTimerRef.current)
    }
  }, [])

  const markdown = editor?.getMarkdown() ?? article.markdown
  const editorHeadings = markdownHeadings(markdown)
  const minEditorHeadingLevel = editorHeadings.length
    ? Math.min(...editorHeadings.map((heading) => heading.level))
    : 1

  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    let frame = 0
    const updateActiveHeading = () => {
      if (tocLockRef.current) return
      const currentEditor = editorRef.current
      if (!currentEditor) return
      let editorElement: HTMLElement
      try {
        editorElement = currentEditor.view.dom
      } catch {
        return
      }
      const headingElements = Array.from(
        editorElement.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5'),
      )
      if (!editorHeadings.length || !headingElements.length) return
      const top =
        workspace.getBoundingClientRect().top +
        Math.min(360, workspace.clientHeight * 0.42)
      let current = editorHeadings[0]?.id ?? null
      headingElements.forEach((element, index) => {
        if (element.getBoundingClientRect().top <= top) {
          current = editorHeadings[index]?.id ?? current
        }
      })
      if (
        workspace.scrollTop + workspace.clientHeight >=
        workspace.scrollHeight - 4
      ) {
        current = editorHeadings.at(-1)?.id ?? current
      }
      setActiveHeadingId(current)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateActiveHeading)
    }
    frame = requestAnimationFrame(updateActiveHeading)
    workspace.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      workspace.removeEventListener('scroll', onScroll)
    }
  }, [draftTick, editorHeadings])

  const currentCategory = categories.find(
    (category) => category.id === categoryId,
  )
  const wordCount = editor ? countWords(editor.getText()) : countWords(article.plainText)
  const publicPath =
    publicationState === 'published'
      ? `/library/${article.categorySlug}/${article.path}`
      : null
  const latestPublished = versions.find(
    (version) => version.kind === 'published',
  )
  const differsFromPublished =
    publicationState === 'published' &&
    Boolean(
      latestPublished &&
        (title !== latestPublished.title ||
          markdown !== latestPublished.markdown),
    )
  const pendingChanges =
    differsFromPublished ||
    saveState === 'dirty' ||
    saveState === 'saving' ||
    saveState === 'conflict' ||
    saveState === 'error'

  function adoptSavedDraft() {
    if (!editor || !conflict) return
    const content = conflict.currentContentJson
      ? (JSON.parse(conflict.currentContentJson) as JSONContent)
      : conflict.currentMarkdown
    editor.commands.setContent(content, { emitUpdate: false })
    titleRef.current = conflict.currentTitle
    categoryRef.current = conflict.currentCategoryId
    revisionRef.current = conflict.currentRevision
    setTitle(conflict.currentTitle)
    setCategoryId(conflict.currentCategoryId)
    conflictRef.current = false
    dirtyRef.current = false
    setConflict(null)
    setSaveState('idle')
  }

  async function keepLocalDraft() {
    if (!conflict) return
    revisionRef.current = conflict.currentRevision
    conflictRef.current = false
    setConflict(null)
    setSaveState('dirty')
    await saveNow(true)
  }

  function compareVersions(version: VersionItem, previous: VersionItem) {
    setHistoryOpen(false)
    const authorRole = (item: VersionItem) =>
      item.authorRole === 'owner' ? '站主' : '协作者'
    setComparison({
      title: `${version.authorName} · ${authorRole(version)} · ${formatVersionDate(version.createdAt)} · ${version.label || version.title}`,
      oldMarkdown: previous.markdown,
      newMarkdown: version.markdown,
      mode: 'version',
      oldMeta: `${previous.authorName} · ${authorRole(previous)} · ${formatVersionDate(previous.createdAt)}`,
      newMeta: `${version.authorName} · ${authorRole(version)} · ${formatVersionDate(version.createdAt)}`,
    })
    setFocusMessage('')
  }

  function compareCurrentDraft() {
    if (!editor || !versions[0]) return
    setComparison({
      title: `${versions[0].label || versions[0].title} 对比当前草稿`,
      oldMarkdown: versions[0].markdown,
      newMarkdown: editor.getMarkdown(),
      mode: 'draft',
    })
    setFocusMessage('')
  }

  function focusDraft(change: MarkdownDiffChange) {
    if (!editor) return
    if (!change.after) {
      setFocusMessage('删除内容在当前草稿中无对应位置')
      return
    }
    const target = change.after.text.slice(0, 24)
    if (!target) {
      setFocusMessage('当前草稿中未找到对应位置')
      return
    }
    let found = false
    editor.state.doc.descendants((node, position) => {
      if (found || !node.isTextblock) return
      const offset = node.textContent.indexOf(target)
      if (offset < 0) return
      const from = position + 1 + offset
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to: from + target.length })
        .scrollIntoView()
        .run()
      found = true
      return false
    })
    setFocusMessage(found ? '已定位到当前草稿' : '当前草稿中未找到对应位置')
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !editor) return
    setImageBusy(true)
    setImageMessage('')
    try {
      const compressed = await compressImageForUpload(file)
      const response = await fetch(
        `/api/studio/articles/${article.id}/images`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contentType: compressed.contentType,
            size: compressed.blob.size,
          }),
        },
      )
      const payload = (await response.json()) as {
        upload?: {
          uploadUrl: string
          publicUrl: string
          contentType: string
        }
        error?: string
      }
      if (!response.ok || !payload.upload) {
        throw new Error(
          payload.error === 'OSS_NOT_CONFIGURED'
            ? '图片存储尚未配置'
            : '图片签名失败',
        )
      }
      const uploadResponse = await fetch(payload.upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': payload.upload.contentType },
        body: compressed.blob,
      })
      if (!uploadResponse.ok) throw new Error('图片上传失败，请重试')
      editor
        .chain()
        .focus()
        .setImage({
          src: payload.upload.publicUrl,
          alt: file.name,
          title: file.name,
        })
        .run()
      setImageMessage('图片已插入')
    } catch (error) {
      setImageMessage(
        error instanceof Error ? error.message : '图片插入失败',
      )
    } finally {
      setImageBusy(false)
    }
  }

  async function publish() {
    if (!titleRef.current.trim()) {
      toast.error('发布前请填写章节标题')
      return
    }
    while (savingRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    if (!(await saveNow())) return
    const response = await fetch(
      `/api/studio/articles/${article.id}/publish`,
      { method: 'POST' },
    )
    if (!response.ok) {
      setSaveState('error')
      toast.error('发布失败，请重试')
      return
    }
    setPublicationState('published')
    setSaveState('saved')
    toast.success(
      publicationState === 'published' ? '线上版本已更新' : '章节已发布',
    )
    router.refresh()
  }

  async function withdraw() {
    const response = await fetch(
      `/api/studio/articles/${article.id}/withdraw`,
      { method: 'POST' },
    )
    if (!response.ok) {
      toast.error('撤回失败，请重试')
      return
    }
    setPublicationState('unpublished')
    setWithdrawOpen(false)
    toast.success('章节已撤回，公开访问已关闭')
    router.refresh()
  }

  async function saveVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setVersionPending(true)
    const response = await fetch(
      `/api/studio/articles/${article.id}/versions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: versionLabel.trim() }),
      },
    )
    setVersionPending(false)
    if (!response.ok) {
      toast.error('保存版本失败，请重试')
      return
    }
    setVersionLabel('')
    setVersionDialogOpen(false)
    setHistoryOpen(true)
    toast.success('已保存当前版本')
    router.refresh()
  }

  async function moveToTrash() {
    const response = await fetch(
      `/api/studio/articles/${article.id}/trash`,
      { method: 'POST' },
    )
    if (!response.ok) {
      toast.error('移入回收站失败，请重试')
      return
    }
    toast.success('章节已移到回收站')
    router.push('/studio')
    router.refresh()
  }

  async function importMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const data = new FormData()
    data.set('file', file)
    data.set('categoryId', categoryRef.current)
    const response = await fetch('/api/studio/articles/import', {
      method: 'POST',
      body: data,
    })
    const payload = (await response.json()) as {
      article?: { id: string }
      error?: string
    }
    if (!response.ok || !payload.article) {
      toast.error(
        payload.error === 'EMPTY_MARKDOWN'
          ? 'Markdown 文件内容为空'
          : payload.error === 'MARKDOWN_TOO_LARGE'
            ? 'Markdown 文件超过 2 MB'
            : 'Markdown 导入失败',
      )
      return
    }
    toast.success('Markdown 已导入为章节草稿')
    router.push(`/studio/notes/${payload.article.id}`)
    router.refresh()
  }

  function openLinkDialog() {
    if (!editor) return
    setLinkValue(editor.getAttributes('link').href ?? '')
    setLinkOpen(true)
  }

  function openSourceDialog() {
    if (!editor) return
    setSourceValue(editor.getMarkdown())
    setSourceOpen(true)
  }

  function applyMarkdownSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    editor.commands.setContent(sourceValue, {
      contentType: 'markdown',
      emitUpdate: true,
    })
    setSourceOpen(false)
    markDirty()
  }

  function scrollToHeading(headingId: string, index: number) {
    const heading = editorRef.current?.view.dom.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5',
    )[index]
    const workspace = workspaceRef.current
    if (!heading || !workspace) return
    tocLockRef.current = true
    if (tocTimerRef.current) clearTimeout(tocTimerRef.current)
    tocTimerRef.current = setTimeout(() => {
      tocLockRef.current = false
    }, 700)
    setActiveHeadingId(headingId)
    const targetTop =
      workspace.scrollTop +
      heading.getBoundingClientRect().top -
      workspace.getBoundingClientRect().top -
      34
    workspace.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }

  const saveLabel: Record<SaveState, string> = {
    idle: '尚未修改',
    dirty: '等待自动保存',
    saving: '正在保存草稿',
    saved: `草稿已保存 ${formatClock(savedAt)}`,
    conflict: '草稿版本冲突',
    error: '保存失败，请重试',
  }

  return (
    <div className="studio-editor-page">
      <header className="studio-editor-topbar">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="studio-icon-button"
            onClick={async () => {
              await saveNow()
              router.push('/studio')
            }}
            aria-label="返回写作台"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="studio-editor-breadcrumb flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--muted-faint)]">
              <span className="truncate">{currentCategory?.title ?? '未分类'}</span>
              <ChevronRight size={15} />
              <span className="max-w-[230px] truncate text-[var(--ink-soft)]">
                {title || '无标题章节'}
              </span>
            </div>
            <p
              role="status"
              data-save-state={saveState}
              className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-faint)]"
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  saveState === 'saved' && 'bg-[var(--accent)]',
                  saveState === 'dirty' && 'bg-[var(--gold)]',
                  saveState === 'saving' && 'animate-pulse bg-[var(--gold)]',
                  (saveState === 'conflict' || saveState === 'error') &&
                    'bg-[var(--rust)]',
                )}
              />
              {saveLabel[saveState]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="studio-view-switch studio-desktop-compare-switch">
            <button
              type="button"
              className={comparison ? '' : 'is-active'}
              onClick={() => {
                setComparison(null)
                setFocusMessage('')
              }}
            >
              编辑
            </button>
            <button
              type="button"
              className={comparison ? 'is-active' : ''}
              onClick={compareCurrentDraft}
              disabled={!versions.length}
              aria-label="对照当前草稿"
            >
              <Columns2 size={17} />
              对照
            </button>
          </div>
          <button
            type="button"
            className="studio-icon-button studio-mobile-compare-button"
            onClick={compareCurrentDraft}
            disabled={!versions.length}
            aria-label="打开对照模式"
            title="对照线上版本"
          >
            <Columns2 size={20} />
          </button>

          <div className="hidden items-center gap-1 sm:flex">
            {isOwner ? (
              <Hint label="导入 Markdown">
                <button
                  type="button"
                  className="studio-icon-button"
                  onClick={() => markdownInputRef.current?.click()}
                  aria-label="导入 Markdown"
                >
                  <FileUp size={20} />
                </button>
              </Hint>
            ) : null}
            <Hint label="版本历史">
              <button
                type="button"
                className="studio-icon-button"
                onClick={() => setHistoryOpen(true)}
                aria-label="版本历史"
              >
                <History size={20} />
              </button>
            </Hint>
            <Hint label="保存版本">
              <button
                type="button"
                className="studio-icon-button"
                onClick={() => setVersionDialogOpen(true)}
                aria-label="保存版本"
              >
                <Save size={20} />
              </button>
            </Hint>
          </div>

          {publicationState === 'published' && publicPath ? (
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="studio-secondary-button studio-topbar-public-link"
            >
              <Eye size={18} />
              查看
            </a>
          ) : null}

          {publicationState === 'published' ? (
            <>
              <button
                type="button"
                className="studio-primary-button"
                onClick={() => void publish()}
                disabled={!pendingChanges && saveState === 'saved'}
                aria-label={
                  pendingChanges || saveState !== 'saved'
                    ? '更新发布'
                    : undefined
                }
              >
                <Send size={18} />
                {!pendingChanges && saveState === 'saved'
                  ? '已是最新'
                  : '更新线上'}
              </button>
              {isOwner ? (
                <button
                  type="button"
                  className="studio-icon-button studio-topbar-unpublish"
                  onClick={() => setWithdrawOpen(true)}
                  aria-label="撤回公开访问"
                  title="撤回公开访问"
                >
                  <Eye size={20} />
                </button>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="studio-primary-button"
              onClick={() => void publish()}
            >
              <Send size={18} />
              发布章节
            </button>
          )}
          {!isOwner ? (
            <span className="collaborator-editor-badge">协作编辑</span>
          ) : null}
        </div>
      </header>

      <div className="studio-editor-body">
        <div
          ref={workspaceRef}
          className="studio-editor-workspace is-editing"
        >
          <section className="studio-draft-pane" aria-label="当前草稿">
            <div
              className="studio-writing-sheet"
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  void saveNow()
                }
              }}
            >
              <input
                value={title}
                onChange={(event) => {
                  titleRef.current = event.target.value
                  setTitle(event.target.value)
                  markDirty()
                }}
                onBlur={() => void saveNow()}
                className="studio-title-input"
                placeholder="无标题章节"
                aria-label="章节标题"
              />

              <div className="studio-document-meta">
                {isOwner ? (
                  <StudioSelect
                    value={categoryId}
                    onChange={(value) => {
                      categoryRef.current = value
                      setCategoryId(value)
                      markDirty()
                    }}
                    options={categories.map((category) => ({
                      value: category.id,
                      label: category.title,
                    }))}
                    ariaLabel="所属分类"
                    className="!h-[26px] !min-w-[112px] !text-[12px]"
                  />
                ) : (
                  <span className="studio-readonly-category">
                    {currentCategory?.title ?? article.categoryTitle}
                  </span>
                )}
                <span>{wordCount} 字</span>
                <span className="hidden sm:inline">
                  {publicationState === 'published'
                    ? pendingChanges
                      ? '有未发布的修改'
                      : '与线上版本一致'
                    : publicationState === 'unpublished'
                      ? '当前未公开'
                      : '尚未发布'}
                </span>
              </div>

              <StudioToolbar
                editor={editor}
                onLink={openLinkDialog}
                onImage={() => imageInputRef.current?.click()}
                onSource={openSourceDialog}
                imageBusy={imageBusy}
              />

              <EditorContent editor={editor} />
              {editor ? (
                <DragHandle
                  editor={editor}
                  className="drag-handle"
                  nested={false}
                >
                  <BlockTypeMenu editor={editor} />
                </DragHandle>
              ) : null}

              <div className="studio-document-footer">
                <span>
                  {isOwner
                    ? currentCategory
                      ? `当前分类：${currentCategory.title}`
                      : '章节会追加到分类末尾'
                    : '已授权文章'}
                </span>
                <span className="truncate normal-case tracking-normal">
                  {currentCategory
                    ? `/library/${currentCategory.slug}/${article.path}`
                    : article.path}
                </span>
              </div>

              {imageMessage ? (
                <p
                  role={imageMessage === '图片已插入' ? 'status' : 'alert'}
                  className={cn(
                    'mt-3 text-[13px]',
                    imageMessage === '图片已插入'
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--rust)]',
                  )}
                >
                  {imageMessage}
                </p>
              ) : null}
              {focusMessage ? <p role="status">{focusMessage}</p> : null}

              {conflict ? (
                <section
                  className="draft-conflict"
                  aria-labelledby="conflict-title"
                >
                  <div>
                    <p className="eyebrow">Revision conflict</p>
                    <h2 id="conflict-title">协作者冲突</h2>
                    <p>当前草稿已被其他编辑者更新。请明确选择保留哪份内容。</p>
                  </div>
                  <div className="conflict-compare">
                    <article>
                      <h3>已保存版本</h3>
                      <p>{conflict.currentTitle}</p>
                      <pre>{conflict.currentMarkdown}</pre>
                    </article>
                    <article>
                      <h3>我的未保存编辑</h3>
                      <p>{conflict.localTitle}</p>
                      <pre>{conflict.localMarkdown}</pre>
                    </article>
                  </div>
                  <div className="conflict-actions">
                    <button type="button" onClick={adoptSavedDraft}>
                      采用已保存版本
                    </button>
                    <button
                      type="button"
                      onClick={() => void keepLocalDraft()}
                    >
                      保留我的编辑并覆盖
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          </section>

          <aside className="chapter-toc studio-editor-toc">
            <p className="section-kicker">On this page</p>
            {editorHeadings.length ? (
              <nav aria-label="当前草稿目录">
                {editorHeadings.map((heading, index) => (
                  <button
                    key={`${heading.id}-${index}`}
                    type="button"
                    className={cn(
                      heading.level === minEditorHeadingLevel &&
                        'is-top-level',
                      activeHeadingId === heading.id && 'is-current',
                    )}
                    data-level={heading.level}
                    style={{
                      paddingLeft: `${(heading.level - minEditorHeadingLevel) * 16}px`,
                    }}
                    aria-current={
                      activeHeadingId === heading.id ? 'location' : undefined
                    }
                    onClick={() => scrollToHeading(heading.id, index)}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            ) : (
              <p className="studio-editor-toc-empty">还没有小标题</p>
            )}
          </aside>
        </div>

      </div>

      <div className="studio-mobile-editor-dock">
        <button type="button" onClick={() => setHistoryOpen(true)}>
          <History size={20} />
          <span>历史</span>
        </button>
        <button type="button" onClick={() => setVersionDialogOpen(true)}>
          <Save size={20} />
          <span>版本</span>
        </button>
        <button type="button" onClick={() => setTrashOpen(true)}>
          <Trash2 size={20} />
          <span>回收</span>
        </button>
        {isOwner ? (
          <button
            type="button"
            onClick={() => markdownInputRef.current?.click()}
          >
            <FileUp size={20} />
            <span>导入</span>
          </button>
        ) : null}
        {publicationState === 'published' && publicPath ? (
          <a href={publicPath} target="_blank" rel="noreferrer">
            <Eye size={20} />
            <span>查看</span>
          </a>
        ) : null}
        {isOwner && publicationState === 'published' ? (
          <button type="button" onClick={() => setWithdrawOpen(true)}>
            <EyeOff size={20} />
            <span>撤回</span>
          </button>
        ) : null}
      </div>

      <button
        type="button"
        className="studio-editor-danger-link"
        onClick={() => setTrashOpen(true)}
      >
        <Trash2 size={16} />
        移到回收站
      </button>

      {editor ? (
        <BubbleMenu
          editor={editor}
          className="bubble-menu"
          shouldShow={({ state }) => !state.selection.empty}
        >
          <ToolbarButton
            label="加粗"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={18} />
          </ToolbarButton>
          <ToolbarButton
            label="斜体"
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={18} />
          </ToolbarButton>
          <ToolbarButton
            label="代码"
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code2 size={18} />
          </ToolbarButton>
          <ToolbarButton label="链接" onClick={openLinkDialog}>
            <Link2 size={18} />
          </ToolbarButton>
        </BubbleMenu>
      ) : null}

      <input
        ref={imageInputRef}
        id="chapter-image-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={imageBusy}
        onChange={(event) => void uploadImage(event)}
        className="hidden"
      />
      <label className="sr-only" htmlFor="chapter-image-input">
        选择正文图片
      </label>
      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        className="hidden"
        onChange={(event) => void importMarkdown(event)}
      />

      <Dialog
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        title="Markdown 源码"
        description="直接编辑 canonical Markdown；应用后继续以富文本显示。"
      >
        <form className="markdown-source-dialog" onSubmit={applyMarkdownSource}>
          <label>
            <span>Markdown 源码</span>
            <textarea
              autoFocus
              value={sourceValue}
              onChange={(event) => setSourceValue(event.target.value)}
              aria-label="Markdown 源码"
              spellCheck={false}
            />
          </label>
          <div>
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => setSourceOpen(false)}
            >
              取消
            </button>
            <button type="submit" className="studio-primary-button">
              应用源码
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="添加链接"
        description="链接会作为行内 Markdown 保存。"
      >
        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!editor) return
            if (!linkValue.trim()) {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
            } else {
              editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: linkValue.trim() })
                .run()
            }
            setLinkOpen(false)
          }}
        >
          <label className="text-xs font-medium text-[var(--ink-soft)]">
            链接地址
            <input
              autoFocus
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              placeholder="https://example.com"
              className="mt-2 h-10 w-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm outline-none"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => {
                editor?.chain().focus().extendMarkRange('link').unsetLink().run()
                setLinkOpen(false)
              }}
            >
              移除
            </button>
            <button type="submit" className="studio-primary-button">
              应用
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(comparison)}
        onOpenChange={(open) => {
          if (!open) {
            setComparison(null)
            setFocusMessage('')
          }
        }}
        title="版本变化"
        description={comparison?.title}
        className="version-diff-dialog !w-[min(94vw,1040px)]"
      >
        <h2 className="sr-only">版本差异</h2>
        {comparison ? (
          <MarkdownDiffView
            title={comparison.title}
            oldMarkdown={comparison.oldMarkdown}
            newMarkdown={comparison.newMarkdown}
            mode={comparison.mode}
            oldMeta={comparison.oldMeta}
            newMeta={comparison.newMeta}
            onNavigate={comparison.mode === 'draft' ? focusDraft : undefined}
            onClose={() => {
              setComparison(null)
              setFocusMessage('')
            }}
            showHeader={false}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        title="保存一个手动版本"
        description="版本会保留当前标题、分类和正文。自动保存不会生成版本。"
      >
        <form className="studio-version-save-dialog" onSubmit={saveVersion}>
          <label>
            <span>版本说明</span>
            <input
              autoFocus
              value={versionLabel}
              onChange={(event) => setVersionLabel(event.target.value)}
              placeholder="例如：补充第二节案例"
            />
          </label>
          <div>
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => setVersionDialogOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              className="studio-primary-button"
              disabled={versionPending}
            >
              <Save size={18} />
              {versionPending ? '正在保存…' : '保存版本'}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="版本历史"
        description="当前草稿单独显示；这里只保留手动版本和每次发布生成的版本。"
        className="studio-history-dialog"
      >
        <VersionHistory
          articleId={article.id}
          versions={versions}
          draft={{ title, wordCount, savedAt }}
          actorId={actorId}
          actorRole={role}
          onCompare={compareVersions}
        />
      </Dialog>

      <AlertDialog.Root
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay fixed inset-0 z-[90] bg-[#0d120f]/55 backdrop-blur-[2px]" />
          <AlertDialog.Content className="dialog-content fixed left-1/2 top-1/2 z-[91] w-[min(92vw,430px)] -translate-x-1/2 -translate-y-1/2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-2xl">
            <AlertDialog.Title className="font-display text-xl text-[var(--ink)]">
              撤回公开访问？
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs leading-6 text-[var(--muted)]">
              线上页面将不再可访问，但草稿、历史版本和原发布记录都会保留。之后可以重新发布。
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button type="button" className="studio-secondary-button">
                  取消
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className="studio-primary-button"
                  onClick={() => void withdraw()}
                >
                  确认撤回
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root open={trashOpen} onOpenChange={setTrashOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay fixed inset-0 z-[90] bg-[#0d120f]/55 backdrop-blur-[2px]" />
          <AlertDialog.Content className="dialog-content fixed left-1/2 top-1/2 z-[91] w-[min(92vw,430px)] -translate-x-1/2 -translate-y-1/2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-2xl">
            <AlertDialog.Title className="font-display text-xl text-[var(--ink)]">
              把这个章节移到回收站？
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs leading-6 text-[var(--muted)]">
              公开访问会立即关闭，内容、草稿和历史版本会保留 30 天。恢复后需要重新发布。
            </AlertDialog.Description>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button type="button" className="studio-secondary-button">
                  取消
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className="studio-primary-button"
                  onClick={() => void moveToTrash()}
                >
                  移到回收站
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  )
}

type BlockKind =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'

const blockOptions: Array<{
  kind: BlockKind
  label: string
  icon: LucideIcon
}> = [
  { kind: 'paragraph', label: '正文', icon: Pilcrow },
  { kind: 'h1', label: '一级标题', icon: Heading1 },
  { kind: 'h2', label: '二级标题', icon: Heading2 },
  { kind: 'h3', label: '三级标题', icon: Heading3 },
  { kind: 'h4', label: '四级标题', icon: Heading4 },
  { kind: 'h5', label: '五级标题', icon: Heading5 },
  { kind: 'bulletList', label: '无序列表', icon: List },
  { kind: 'orderedList', label: '有序列表', icon: ListOrdered },
  { kind: 'taskList', label: '待办列表', icon: CheckSquare2 },
  { kind: 'blockquote', label: '引用', icon: Quote },
  { kind: 'codeBlock', label: '代码块', icon: Code2 },
]

const textColors = [
  { label: '默认', value: null },
  { label: '石墨', value: '#3f3f46' },
  { label: '墨绿', value: '#0f766e' },
  { label: '蓝色', value: '#2563eb' },
  { label: '紫色', value: '#7c3aed' },
  { label: '橙色', value: '#c2410c' },
  { label: '红色', value: '#b91c1c' },
] as const

function BlockTypeMenu({ editor }: { editor: Editor | null }) {
  const activeBlock = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) return null
      return {
        paragraph:
          currentEditor.isActive('paragraph') &&
          !currentEditor.isActive('bulletList') &&
          !currentEditor.isActive('orderedList') &&
          !currentEditor.isActive('taskList') &&
          !currentEditor.isActive('blockquote') &&
          !currentEditor.isActive('codeBlock'),
        h1: currentEditor.isActive('heading', { level: 1 }),
        h2: currentEditor.isActive('heading', { level: 2 }),
        h3: currentEditor.isActive('heading', { level: 3 }),
        h4: currentEditor.isActive('heading', { level: 4 }),
        h5: currentEditor.isActive('heading', { level: 5 }),
        bulletList: currentEditor.isActive('bulletList'),
        orderedList: currentEditor.isActive('orderedList'),
        taskList: currentEditor.isActive('taskList'),
        blockquote: currentEditor.isActive('blockquote'),
        codeBlock: currentEditor.isActive('codeBlock'),
      }
    },
  })
  if (!editor || !activeBlock) return null

  const convertBlock = (kind: BlockKind) => {
    const chain = editor.chain().focus().clearNodes()
    switch (kind) {
      case 'paragraph':
        chain.setParagraph().run()
        break
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
        chain
          .setHeading({
            level: Number(kind.slice(1)) as 1 | 2 | 3 | 4 | 5,
          })
          .run()
        break
      case 'bulletList':
        chain.setParagraph().toggleBulletList().run()
        break
      case 'orderedList':
        chain.setParagraph().toggleOrderedList().run()
        break
      case 'taskList':
        chain.setParagraph().toggleTaskList().run()
        break
      case 'blockquote':
        chain.setParagraph().toggleBlockquote().run()
        break
      case 'codeBlock':
        chain.setCodeBlock().run()
        break
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="block-type-trigger"
          aria-label="转换内容块"
          title="点击转换格式，拖动调整位置"
        >
          <GripVertical size={20} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="block-type-menu"
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={12}
        >
          <DropdownMenu.Label className="block-type-menu-label">
            转换内容块
          </DropdownMenu.Label>
          {blockOptions.map((option) => {
            const Icon = option.icon
            const active = activeBlock[option.kind]
            return (
              <DropdownMenu.Item
                key={option.kind}
                className={cn(
                  'block-type-menu-item',
                  active && 'is-active',
                )}
                onSelect={() => convertBlock(option.kind)}
              >
                <Icon size={19} />
                <span>{option.label}</span>
                {active ? <Check size={18} className="ml-auto" /> : null}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function TextColorMenu({
  editor,
  currentColor,
}: {
  editor: Editor | null
  currentColor: string | null
}) {
  if (!editor) return null
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn('toolbar-button', currentColor && 'is-active')}
          aria-label="文字颜色"
          title="文字颜色"
        >
          <Palette size={19} />
          <span
            className="text-color-indicator"
            style={{ backgroundColor: currentColor ?? 'var(--ink-soft)' }}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="text-color-menu"
          side="bottom"
          align="start"
          sideOffset={8}
        >
          <DropdownMenu.Label className="block-type-menu-label">
            文字颜色
          </DropdownMenu.Label>
          <div className="text-color-grid">
            {textColors.map((color) => (
              <DropdownMenu.Item
                key={color.label}
                className={cn(
                  'text-color-option',
                  (currentColor ?? null) === color.value && 'is-active',
                )}
                onSelect={() => {
                  if (color.value) {
                    editor.chain().focus().setColor(color.value).run()
                  } else {
                    editor.chain().focus().unsetColor().run()
                  }
                }}
                title={color.label}
              >
                <span
                  style={{
                    backgroundColor: color.value ?? 'var(--ink-soft)',
                  }}
                />
                {(currentColor ?? null) === color.value ? (
                  <Check size={16} />
                ) : null}
              </DropdownMenu.Item>
            ))}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function StudioToolbar({
  editor,
  onLink,
  onImage,
  onSource,
  imageBusy,
}: {
  editor: Editor | null
  onLink: () => void
  onImage: () => void
  onSource: () => void
  imageBusy: boolean
}) {
  const selectionState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) return null
      return {
        h1: currentEditor.isActive('heading', { level: 1 }),
        h2: currentEditor.isActive('heading', { level: 2 }),
        h3: currentEditor.isActive('heading', { level: 3 }),
        h4: currentEditor.isActive('heading', { level: 4 }),
        h5: currentEditor.isActive('heading', { level: 5 }),
        bold: currentEditor.isActive('bold'),
        italic: currentEditor.isActive('italic'),
        underline: currentEditor.isActive('underline'),
        strike: currentEditor.isActive('strike'),
        highlight: currentEditor.isActive('highlight'),
        color:
          (currentEditor.getAttributes('textStyle').color as
            | string
            | undefined) ?? null,
        bulletList: currentEditor.isActive('bulletList'),
        orderedList: currentEditor.isActive('orderedList'),
        taskList: currentEditor.isActive('taskList'),
        blockquote: currentEditor.isActive('blockquote'),
        codeBlock: currentEditor.isActive('codeBlock'),
        link: currentEditor.isActive('link'),
        canUndo: currentEditor.can().undo(),
        canRedo: currentEditor.can().redo(),
      }
    },
  })
  if (!editor || !selectionState) return null

  return (
    <div className="editor-toolbar studio-editor-toolbar">
      <div className="toolbar-group">
        <ToolbarButton
          label="一级标题"
          active={selectionState.h1}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="二级标题"
          active={selectionState.h2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="三级标题"
          active={selectionState.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="四级标题"
          active={selectionState.h4}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="五级标题"
          active={selectionState.h5}
          onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
        >
          <Heading5 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="加粗"
          active={selectionState.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="斜体"
          active={selectionState.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="下划线"
          active={selectionState.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="删除线"
          active={selectionState.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="高亮"
          active={selectionState.highlight}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter size={19} />
        </ToolbarButton>
        <TextColorMenu editor={editor} currentColor={selectionState.color} />
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <ToolbarButton
          label="项目列表"
          active={selectionState.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="编号列表"
          active={selectionState.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="待办事项"
          active={selectionState.taskList}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <CheckSquare2 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="引用"
          active={selectionState.blockquote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="代码块"
          active={selectionState.codeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="插入表格"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <Table2 size={19} />
        </ToolbarButton>
        <ToolbarButton label="Markdown 源码" onClick={onSource}>
          <CodeXml size={19} />
        </ToolbarButton>
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <ToolbarButton
          label="链接"
          active={selectionState.link}
          onClick={onLink}
        >
          <Link2 size={19} />
        </ToolbarButton>
        <ToolbarButton label="插入图片" onClick={onImage} disabled={imageBusy}>
          {imageBusy ? (
            <LoaderCircle className="animate-spin" size={19} />
          ) : (
            <ImagePlus size={19} />
          )}
        </ToolbarButton>
      </div>
      <div
        className="ml-auto flex items-center gap-0.5"
        data-visual-dynamic
      >
        <ToolbarButton
          label="撤销"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!selectionState.canUndo}
        >
          <Undo2 size={19} />
        </ToolbarButton>
        <ToolbarButton
          label="重做"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!selectionState.canRedo}
        >
          <Redo2 size={19} />
        </ToolbarButton>
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  active,
  children,
  ...props
}: {
  label: string
  active?: boolean
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Hint label={label}>
      <button
        type="button"
        aria-label={label}
        className={cn('toolbar-button', active && 'is-active')}
        {...props}
      >
        {children}
      </button>
    </Hint>
  )
}
