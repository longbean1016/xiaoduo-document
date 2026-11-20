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
import type { Editor } from '@tiptap/core'
import {
  ArrowLeft,
  Bold,
  Check,
  CheckSquare2,
  ChevronRight,
  Code2,
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
  RotateCcw,
  Save,
  Send,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Unlink2,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { createEditorExtensions } from '../../components/editor/extensions'
import {
  handleEditorBoundaryKeyDown,
  handleEditorCopy,
} from '../../components/editor/EditorBoundaryActions'
import {
  MarkdownDiffNavigator,
  MarkdownDiffPane,
} from '../../components/studio/MarkdownDiffNavigator'
import { StudioSelect } from '../../components/studio/StudioSelect'
import { Dialog } from '../../components/ui/Dialog'
import { Hint } from '../../components/ui/Tooltip'
import { compressImageFile } from '../../lib/images'
import { markdownHeadings } from '../../lib/markdownHeadings'
import { looksLikeMermaidSource } from '../../lib/markdownMermaid'
import {
  buildMarkdownDiff,
  type MarkdownDiffChange,
} from '../../lib/markdownDiff'
import { normalizeCurrentMarkdownBlock } from '../../lib/markdownNormalize'
import {
  extractPlainText,
  formatClock,
  formatDateTime,
} from '../../lib/text'
import { cn, countWords } from '../../lib/utils'
import { usePageTitle } from '../../lib/usePageTitle'
import {
  chapterPublicPath,
  hasUnpublishedChanges,
  useSiteStore,
} from '../../store/siteStore'
import type { ChapterSnapshot } from '../../types'

type SaveState = 'saved' | 'dirty' | 'saving' | 'conflict'
type MobilePane = 'draft' | 'published'

export function StudioNotePage() {
  const { noteId } = useParams()
  const author = useSiteStore((state) => state.author)
  const note = useSiteStore((state) =>
    state.notes.find((item) => item.id === noteId),
  )
  const categories = useSiteStore((state) => state.categories)
  const studioRole = useSiteStore((state) => state.studioRole)
  const currentCollaboratorId = useSiteStore(
    (state) => state.currentCollaboratorId,
  )
  const collaborators = useSiteStore((state) => state.collaborators)
  const updateNoteDraft = useSiteStore((state) => state.updateNoteDraft)
  const saveManualVersion = useSiteStore((state) => state.saveManualVersion)
  const deleteVersion = useSiteStore((state) => state.deleteVersion)
  const restoreVersion = useSiteStore((state) => state.restoreVersion)
  const publishNote = useSiteStore((state) => state.publishNote)
  const unpublishNote = useSiteStore((state) => state.unpublishNote)
  const trashNote = useSiteStore((state) => state.trashNote)
  const restoreTrashedNote = useSiteStore((state) => state.restoreTrashedNote)
  const navigate = useNavigate()
  usePageTitle(note ? `${note.title} · 写作台` : '写作台 · 知笺')
  const isOwner = studioRole === 'owner'
  const currentCollaborator = collaborators.find(
    (item) => item.id === currentCollaboratorId,
  )
  const canEditNote =
    isOwner || Boolean(currentCollaborator?.noteIds.includes(noteId ?? ''))

  const [title, setTitle] = useState(note?.title ?? '')
  const [categoryId, setCategoryId] = useState(note?.categoryId ?? '')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [savedAt, setSavedAt] = useState(note?.updatedAt ?? new Date().toISOString())
  const [compareOpen, setCompareOpen] = useState(false)
  const [activeEditorHeadingId, setActiveEditorHeadingId] = useState<
    string | null
  >(null)
  const [syncScroll, setSyncScroll] = useState(true)
  const [mobilePane, setMobilePane] = useState<MobilePane>('draft')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versionDialogOpen, setVersionDialogOpen] = useState(false)
  const [versionLabel, setVersionLabel] = useState('')
  const [restoreTarget, setRestoreTarget] = useState<ChapterSnapshot | null>(null)
  const [selectedVersion, setSelectedVersion] =
    useState<ChapterSnapshot | null>(null)
  const [trashDialogOpen, setTrashDialogOpen] = useState(false)
  const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkValue, setLinkValue] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [, setDraftTick] = useState(0)
  const [activeDiffChangeId, setActiveDiffChangeId] = useState<string | null>(
    null,
  )
  const titleRef = useRef(note?.title ?? '')
  const categoryRef = useRef(note?.categoryId ?? '')
  const revisionRef = useRef(note?.revision ?? 1)
  const dirtyRef = useRef(false)
  const applyingVersionRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const saveNowRef = useRef<() => boolean>(() => false)
  const editorRef = useRef<Editor | null>(null)
  const insertImageFileRef = useRef<(file: File) => Promise<void>>(
    async () => {},
  )
  const imageInputRef = useRef<HTMLInputElement>(null)
  const markdownInputRef = useRef<HTMLInputElement>(null)
  const draftPaneRef = useRef<HTMLElement | null>(null)
  const publishedPaneRef = useRef<HTMLElement | null>(null)
  const editorWorkspaceRef = useRef<HTMLDivElement | null>(null)
  const tocSelectionLockRef = useRef(false)
  const tocSelectionTimerRef = useRef<number | null>(null)
  const normalizeTimerRef = useRef<number | null>(null)

  const markDirty = useCallback(() => {
    dirtyRef.current = true
    setSaveState('dirty')
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveNowRef.current()
    }, 800)
  }, [])

  const editor = useEditor(
    {
      extensions: createEditorExtensions({ editable: true }),
      content: canEditNote ? note?.markdown ?? '' : '',
      contentType: 'markdown',
      editorProps: {
        attributes: {
          class: 'zhijian-prose markdown-body studio-prose',
          spellcheck: 'false',
        },
        handleKeyDown: handleEditorBoundaryKeyDown,
        handleDOMEvents: {
          copy: handleEditorCopy,
        },
        handlePaste: (_view, event) => {
          const clipboard = event.clipboardData
          if (!clipboard) return false
          const text = clipboard.getData('text/plain')
          const html = clipboard.getData('text/html')
          if (!text) return false
          if (looksLikeMermaidSource(text)) {
            const currentEditor = editorRef.current
            if (!currentEditor) return false
            currentEditor
              .chain()
              .focus()
              .insertContent({
                type: 'codeBlock',
                attrs: { language: 'mermaid' },
                content: [{ type: 'text', text: text.trim() }],
              })
              .run()
            return true
          }
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
      onUpdate: () => {
        if (applyingVersionRef.current) return
        setDraftTick((current) => current + 1)
        markDirty()
        if (normalizeTimerRef.current) {
          window.clearTimeout(normalizeTimerRef.current)
        }
        normalizeTimerRef.current = window.setTimeout(() => {
          normalizeCurrentMarkdownBlock(editor)
        }, 80)
      },
    },
    [canEditNote, noteId],
  )
  const editorHeadings = markdownHeadings(
    editor?.getMarkdown() ?? note?.markdown ?? '',
  )
  const minEditorHeadingLevel = Math.min(
    ...editorHeadings.map((heading) => heading.level),
  )

  const saveNow = useCallback(() => {
    const currentNote = useSiteStore
      .getState()
      .notes.find((item) => item.id === noteId)
    const currentEditor = editorRef.current
    if (!currentNote || !currentEditor) return false
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null

    setSaveState('saving')
    const result = updateNoteDraft(noteId ?? '', {
      title: titleRef.current,
      categoryId: categoryRef.current,
      markdown: currentEditor.getMarkdown(),
      plainText: currentEditor.getText(),
      expectedRevision: revisionRef.current,
    })

    if (result === 'saved') {
      const savedNote = useSiteStore
        .getState()
        .notes.find((item) => item.id === noteId)
      revisionRef.current = savedNote?.revision ?? revisionRef.current + 1
      setSavedAt(savedNote?.updatedAt ?? new Date().toISOString())
      dirtyRef.current = false
      setSaveState('saved')
      return true
    }

    if (result === 'conflict') {
      dirtyRef.current = true
      setSaveState('conflict')
      toast.error('这个章节已在另一处更新，请刷新后再继续编辑')
    } else {
      dirtyRef.current = true
      setSaveState('dirty')
      toast.error('章节不存在，无法保存')
    }
    return false
  }, [noteId, updateNoteDraft])

  useEffect(() => {
    editorRef.current = editor
    if (!editor) {
      return () => {
        editorRef.current = null
      }
    }
    const editorDom = editor.view.dom
    const onPaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData
      if (!clipboard) return
      const imageItem = Array.from(clipboard.items).find(
        (item) =>
          item.kind === 'file' && item.type.startsWith('image/'),
      )
      const imageFile =
        imageItem?.getAsFile() ??
        Array.from(clipboard.files).find((file) =>
          file.type.startsWith('image/'),
        )
      if (!imageFile) return
      event.preventDefault()
      event.stopPropagation()
      void insertImageFileRef.current(imageFile)
    }
    editorDom.addEventListener('paste', onPaste, true)
    return () => {
      editorDom.removeEventListener('paste', onPaste, true)
      editorRef.current = null
    }
  }, [editor])

  useEffect(() => {
    saveNowRef.current = saveNow
  }, [saveNow])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (saveNow()) toast.success('草稿已保存')
      }
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [saveNow])

  useEffect(() => {
    const openImagePicker = () => imageInputRef.current?.click()
    window.addEventListener('zhijian:pick-image', openImagePicker)
    return () =>
      window.removeEventListener('zhijian:pick-image', openImagePicker)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      if (tocSelectionTimerRef.current) {
        window.clearTimeout(tocSelectionTimerRef.current)
      }
      if (normalizeTimerRef.current) {
        window.clearTimeout(normalizeTimerRef.current)
      }
    }
  }, [noteId])

  useEffect(() => {
    const draftPane = draftPaneRef.current
    const publishedPane = publishedPaneRef.current
    if (!compareOpen || !syncScroll || !draftPane || !publishedPane) return

    let syncing = false
    let frame = 0
    const syncPane = (source: HTMLElement, target: HTMLElement) => {
      if (syncing) return
      syncing = true
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const sourceRange = source.scrollHeight - source.clientHeight
        const targetRange = target.scrollHeight - target.clientHeight
        if (sourceRange > 0 && targetRange > 0) {
          target.scrollTop =
            (source.scrollTop / sourceRange) * targetRange
        }
        syncing = false
      })
    }
    const syncFromDraft = () => syncPane(draftPane, publishedPane)
    const syncFromPublished = () => syncPane(publishedPane, draftPane)
    draftPane.addEventListener('scroll', syncFromDraft, { passive: true })
    publishedPane.addEventListener('scroll', syncFromPublished, {
      passive: true,
    })
    return () => {
      window.cancelAnimationFrame(frame)
      draftPane.removeEventListener('scroll', syncFromDraft)
      publishedPane.removeEventListener('scroll', syncFromPublished)
    }
  }, [compareOpen, syncScroll])

  useEffect(() => {
    if (compareOpen) return
    const workspace = editorWorkspaceRef.current
    if (!workspace) return

    let frame = 0
    const updateActiveHeading = () => {
      if (tocSelectionLockRef.current) return
      const currentEditor = editorRef.current
      if (!currentEditor) return
      let editorElement: HTMLElement
      try {
        editorElement = currentEditor.view.dom
      } catch {
        return
      }
      const headings = markdownHeadings(currentEditor.getMarkdown())
      const headingElements = Array.from(
        editorElement.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5'),
      )
      if (!headings.length || !headingElements.length) return
      const top =
        workspace.getBoundingClientRect().top +
        Math.min(360, workspace.clientHeight * 0.42)
      let current = headings[0]?.id ?? null
      headingElements.forEach((element, index) => {
        if (element.getBoundingClientRect().top <= top) {
          current = headings[index]?.id ?? current
        }
      })
      if (
        workspace.scrollTop + workspace.clientHeight >=
        workspace.scrollHeight - 4
      ) {
        current = headings.at(-1)?.id ?? current
      }
      setActiveEditorHeadingId(current)
    }
    const onScroll = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateActiveHeading)
    }
    frame = window.requestAnimationFrame(updateActiveHeading)
    workspace.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      workspace.removeEventListener('scroll', onScroll)
    }
  }, [compareOpen, note?.markdown])

  const currentCategory = categories.find((item) => item.id === categoryId)
  const publishedCategory = categories.find(
    (item) => item.id === note?.published?.categoryId,
  )
  const chapterIndex = currentCategory?.noteOrder.indexOf(note?.id ?? '') ?? -1
  const publishedPath = note ? chapterPublicPath(note, categories) : null
  const wordCount = editor
    ? countWords(editor.getText())
    : countWords(note?.plainText ?? '')
  const pendingChanges = note
    ? hasUnpublishedChanges(note) ||
      saveState === 'dirty' ||
      saveState === 'saving'
    : false
  const compareAvailable = Boolean(note?.published)
  const draftPath =
    currentCategory && note
      ? `/library/${currentCategory.slug}/${note.slug}`
      : ''
  const draftMarkdown = editor?.getMarkdown() ?? note?.markdown ?? ''
  const comparisonDiff = note?.published
    ? buildMarkdownDiff(note.published.markdown, draftMarkdown)
    : null
  const activeDiffChange =
    comparisonDiff?.changes.find(
      (change) => change.id === activeDiffChangeId,
    ) ?? null

  const handleDiffJump = (change: MarkdownDiffChange) => {
    setActiveDiffChangeId(change.id)
    if (change.newIndex === null) {
      setMobilePane('published')
      return
    }
    setMobilePane('draft')
    const currentEditor = editorRef.current
    if (!currentEditor) return
    const block = currentEditor.view.dom.children[change.newIndex] as
      | HTMLElement
      | undefined
    block?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    let targetPosition = 1
    for (let index = 0; index < change.newIndex; index += 1) {
      targetPosition += currentEditor.state.doc.child(index).nodeSize
    }
    const targetNode = currentEditor.state.doc.child(change.newIndex)
    currentEditor
      .chain()
      .focus()
      .setTextSelection({
        from: targetPosition,
        to: Math.max(
          targetPosition,
          targetPosition + targetNode.nodeSize - 2,
        ),
      })
      .run()
  }

  const handlePublish = () => {
    if (!titleRef.current.trim()) {
      toast.error('发布前请填写章节标题')
      return
    }
    if (!saveNow()) return
    if (!publishNote(noteId ?? '')) {
      toast.error('发布失败，请检查章节分类')
      return
    }
    dirtyRef.current = false
    setSaveState('saved')
    toast.success(
      note?.publicationState === 'published'
        ? '线上版本已更新'
        : note?.published
          ? '章节已重新发布'
          : '章节已发布',
    )
  }

  const handleSaveVersion = () => {
    if (!saveNow()) return
    const versionId = saveManualVersion(noteId ?? '', versionLabel)
    if (!versionId) {
      toast.error('版本保存失败')
      return
    }
    setVersionDialogOpen(false)
    setVersionLabel('')
    setHistoryOpen(true)
    toast.success('已保存当前版本')
  }

  const handleRestoreVersion = () => {
    if (!restoreTarget || !note) return
    if (!isOwner && restoreTarget.categoryId !== note.categoryId) {
      toast.error('协作者不能把文章移动到其他分类')
      return
    }
    const result = restoreVersion(noteId ?? '', restoreTarget.id)
    if (result !== 'saved') {
      toast.error('版本恢复失败')
      return
    }
    const restored = useSiteStore
      .getState()
      .notes.find((item) => item.id === noteId)
    if (!restored) return

    applyingVersionRef.current = true
    titleRef.current = restored.title
    categoryRef.current = restored.categoryId
    revisionRef.current = restored.revision
    setTitle(restored.title)
    setCategoryId(restored.categoryId)
    setSavedAt(restored.updatedAt)
    setSaveState('saved')
    dirtyRef.current = false
    editorRef.current?.commands.setContent(restored.markdown, {
      contentType: 'markdown',
      emitUpdate: false,
    })
    applyingVersionRef.current = false
    setRestoreTarget(null)
    setMobilePane('draft')
    toast.success('版本已恢复到当前草稿')
  }

  const insertImageFile = useCallback(
    async (file: File) => {
      const currentEditor = editorRef.current
      if (!currentEditor) return
      setImageBusy(true)
      try {
        const image = await compressImageFile(file)
        currentEditor
          .chain()
          .focus()
          .insertContent({
            type: 'image',
            attrs: {
              src: image.dataUrl,
              alt: file.name,
              title: file.name,
              publicUrl: image.publicUrl,
            },
          })
          .run()
        toast.success('图片已插入')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '图片插入失败')
      } finally {
        setImageBusy(false)
      }
    },
    [],
  )

  const insertImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await insertImageFile(file)
  }

  useEffect(() => {
    insertImageFileRef.current = insertImageFile
  }, [insertImageFile])

  const handleMarkdownImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Markdown 文件不能超过 2MB')
      return
    }
    try {
      const markdown = await file.text()
      const parsed = editor?.storage.markdown.manager.parse(markdown)
      const result = updateNoteDraft(noteId ?? '', {
        title: titleRef.current,
        categoryId: categoryRef.current,
        markdown,
        plainText: extractPlainText(parsed),
        expectedRevision: revisionRef.current,
      })
      if (result !== 'saved') throw new Error('导入失败')
      editor?.commands.setContent(markdown, { emitUpdate: false })
      revisionRef.current += 1
      dirtyRef.current = false
      setSaveState('saved')
      setDraftTick((current) => current + 1)
      toast.success('Markdown 已导入当前文章')
    } catch {
      toast.error('Markdown 导入失败')
    }
  }

  const openLinkDialog = () => {
    if (!editor) return
    setLinkValue(editor.getAttributes('link').href ?? '')
    setLinkOpen(true)
  }

  const scrollToEditorHeading = (headingId: string, index: number) => {
    const heading = editorRef.current?.view.dom.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5',
    )[index]
    const workspace = editorWorkspaceRef.current
    if (!heading || !workspace) return
    tocSelectionLockRef.current = true
    if (tocSelectionTimerRef.current) {
      window.clearTimeout(tocSelectionTimerRef.current)
    }
    tocSelectionTimerRef.current = window.setTimeout(() => {
      tocSelectionLockRef.current = false
    }, 700)
    setActiveEditorHeadingId(headingId)
    const targetTop =
      workspace.scrollTop +
      heading.getBoundingClientRect().top -
      workspace.getBoundingClientRect().top -
      34
    workspace.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }

  if (!note) {
    return (
      <div className="studio-page flex min-h-[70vh] flex-col items-center justify-center text-center">
        <p className="font-display text-2xl text-[var(--ink)]">没有找到这个章节</p>
        <button
          type="button"
          className="studio-secondary-button mt-5"
          onClick={() => navigate('/studio')}
        >
          返回写作台
        </button>
      </div>
    )
  }

  if (!canEditNote) {
    return (
      <div className="studio-page flex min-h-[70vh] flex-col items-center justify-center text-center">
        <p className="font-display text-2xl text-[var(--ink)]">
          没有这篇文章的编辑权限
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          请联系站主申请授权，或返回写作台查看已授权文章。
        </p>
        <button
          type="button"
          className="studio-secondary-button mt-5"
          onClick={() => navigate('/studio')}
        >
          返回写作台
        </button>
      </div>
    )
  }

  if (note.trashedAt) {
    return (
      <div className="studio-page flex min-h-[70vh] flex-col items-center justify-center text-center">
        <Trash2 size={26} className="text-[var(--muted)]" />
        <p className="mt-4 font-display text-2xl text-[var(--ink)]">
          这个章节在回收站中
        </p>
        <p className="mt-2 max-w-sm text-xs leading-6 text-[var(--muted)]">
          恢复后会保留全部内容、草稿和历史版本，但仍保持未发布状态。
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="studio-secondary-button"
            onClick={() => navigate('/studio/trash')}
          >
            查看回收站
          </button>
          {isOwner && (
            <button
              type="button"
              className="studio-primary-button"
              onClick={() => {
                restoreTrashedNote(note.id)
                toast.success('章节已恢复为未发布草稿')
              }}
            >
              <RotateCcw size={18} />
              恢复章节
            </button>
          )}
        </div>
      </div>
    )
  }

  const isPublished = note.publicationState === 'published'
  const hasPublishedVersion = Boolean(note.published)
  const publishedHeading =
    note.publicationState === 'published' ? '线上版本' : '上次发布版本'
  const selectedVersionIndex = selectedVersion
    ? note.versions.findIndex((version) => version.id === selectedVersion.id)
    : -1
  const previousVersion =
    selectedVersionIndex >= 0
      ? (note.versions[selectedVersionIndex + 1] ?? null)
      : null

  return (
    <div className="studio-editor-page">
      <header className="studio-editor-topbar">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="studio-icon-button"
            onClick={() => {
              saveNow()
              navigate('/studio')
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
            <SaveIndicator state={saveState} savedAt={savedAt} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {compareAvailable && (
            <>
              <div className="studio-view-switch studio-desktop-compare-switch">
                <button
                  type="button"
                  className={!compareOpen ? 'is-active' : ''}
                  onClick={() => setCompareOpen(false)}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className={compareOpen ? 'is-active' : ''}
                  onClick={() => setCompareOpen(true)}
                >
                  <Columns2 size={17} />
                  对照
                </button>
              </div>
              <button
                type="button"
                className="studio-icon-button studio-mobile-compare-button"
                onClick={() => {
                  setCompareOpen((current) => !current)
                  setMobilePane('draft')
                }}
                aria-label={compareOpen ? '退出对照模式' : '打开对照模式'}
                title={compareOpen ? '退出对照模式' : '对照线上版本'}
              >
                <Columns2 size={20} />
              </button>
            </>
          )}

          <div className="hidden items-center gap-1 sm:flex">
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

          {isPublished && publishedPath && (
            <a
              href={publishedPath}
              target="_blank"
              rel="noreferrer"
              className="studio-secondary-button studio-topbar-public-link"
            >
              <Eye size={18} />
              查看
            </a>
          )}

          {isPublished ? (
            <>
              <button
                type="button"
                className="studio-primary-button"
                onClick={handlePublish}
                disabled={!pendingChanges}
              >
                <Send size={18} />
                {pendingChanges ? '更新线上' : '已是最新'}
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="studio-icon-button studio-topbar-unpublish"
                  onClick={() => setUnpublishDialogOpen(true)}
                  aria-label="撤回公开访问"
                  title="撤回公开访问"
                >
                  <Eye size={20} />
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="studio-primary-button"
              onClick={handlePublish}
            >
              <Send size={18} />
              {hasPublishedVersion ? '重新发布' : '发布'}
            </button>
          )}
          {!isOwner && (
            <span className="collaborator-editor-badge">协作编辑</span>
          )}
        </div>
      </header>

      <div className="studio-editor-body">
        {compareOpen && hasPublishedVersion && (
          <div className="studio-compare-mobile-tabs md:hidden">
            <div className="segmented-control">
              <button
                type="button"
                className={mobilePane === 'draft' ? 'is-active' : ''}
                onClick={() => setMobilePane('draft')}
              >
                当前草稿
              </button>
              <button
                type="button"
                className={mobilePane === 'published' ? 'is-active' : ''}
                onClick={() => setMobilePane('published')}
              >
                {publishedHeading}
              </button>
            </div>
          </div>
        )}

        {compareOpen && comparisonDiff && (
          <MarkdownDiffNavigator
            changes={comparisonDiff.changes}
            activeChangeId={activeDiffChange?.id ?? null}
            onSelect={handleDiffJump}
          />
        )}

        <div
          ref={editorWorkspaceRef}
          className={cn(
            'studio-editor-workspace',
            !compareOpen && 'is-editing',
            compareOpen && hasPublishedVersion && 'is-comparing',
          )}
        >
          <section
            ref={draftPaneRef}
            className={cn(
              'studio-draft-pane',
              compareOpen &&
                mobilePane === 'published' &&
                'is-mobile-hidden md:block',
            )}
            aria-label="当前草稿"
          >
            {compareOpen && hasPublishedVersion && (
              <div className="studio-pane-label">
                <span>当前草稿</span>
                <div className="flex items-center gap-2">
                  <small>自动保存，不会自动公开</small>
                  <button
                    type="button"
                    className={cn(
                      'studio-scroll-sync-button',
                      syncScroll && 'is-active',
                    )}
                    onClick={() => setSyncScroll((current) => !current)}
                    title={syncScroll ? '关闭联动滚动' : '开启联动滚动'}
                    aria-label={syncScroll ? '关闭联动滚动' : '开启联动滚动'}
                  >
                    {syncScroll ? <Link2 size={15} /> : <Unlink2 size={15} />}
                  </button>
                </div>
              </div>
            )}
            <div
              className={cn(
                'studio-writing-sheet',
                compareOpen && 'is-compare',
              )}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  saveNow()
                }
              }}
            >
              <input
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value)
                  titleRef.current = event.target.value
                  markDirty()
                }}
                onBlur={saveNow}
                className="studio-title-input"
                placeholder="无标题章节"
                aria-label="章节标题"
              />

              <div className="studio-document-meta">
                <label className="studio-category-select">
                  <span className="sr-only">所属分类</span>
                  {isOwner ? (
                    <StudioSelect
                      value={categoryId}
                      onChange={(value) => {
                        setCategoryId(value)
                        categoryRef.current = value
                        markDirty()
                      }}
                      options={categories
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((category) => ({
                          value: category.id,
                          label: category.title,
                        }))}
                      ariaLabel="所属分类"
                      className="!h-[26px] !min-w-[112px] !text-[12px]"
                    />
                  ) : (
                    <span className="studio-readonly-category">
                      {currentCategory?.title ?? '未分类'}
                    </span>
                  )}
                </label>
                <span>{wordCount} 字</span>
                <span className="hidden sm:inline">
                  {isPublished
                    ? pendingChanges
                      ? '有未发布的修改'
                      : '与线上版本一致'
                    : hasPublishedVersion
                      ? '当前未公开'
                      : '尚未发布'}
                </span>
              </div>

              <StudioToolbar
                editor={editor}
                onLink={openLinkDialog}
                onImage={() => imageInputRef.current?.click()}
                imageBusy={imageBusy}
              />

              <EditorContent editor={editor} />
              <DragHandle editor={editor} className="drag-handle" nested={false}>
                <BlockTypeMenu editor={editor} />
              </DragHandle>

              <div className="studio-document-footer">
                <span>
                  {!isOwner
                    ? '已授权文章'
                    : chapterIndex >= 0
                    ? `分类内第 ${chapterIndex + 1} 章`
                    : '章节将追加到分类末尾'}
                </span>
                <span className="truncate normal-case tracking-normal">
                  {draftPath}
                </span>
              </div>
            </div>
          </section>

          {!compareOpen && (
            <aside className="chapter-toc studio-editor-toc">
              <p className="section-kicker">On this page</p>
              {editorHeadings.length ? (
                <nav aria-label="当前草稿目录">
                  {editorHeadings.map((heading, index) => (
                    <button
                      key={heading.id}
                      type="button"
                      className={cn(
                        heading.level === minEditorHeadingLevel &&
                          'is-top-level',
                        activeEditorHeadingId === heading.id && 'is-current',
                      )}
                      data-level={heading.level}
                      style={{
                        paddingLeft: `${(heading.level - minEditorHeadingLevel) * 16}px`,
                      }}
                      aria-current={
                        activeEditorHeadingId === heading.id
                          ? 'location'
                          : undefined
                      }
                      onClick={() =>
                        scrollToEditorHeading(heading.id, index)
                      }
                    >
                      {heading.text}
                    </button>
                  ))}
                </nav>
              ) : (
                <p className="studio-editor-toc-empty">还没有小标题</p>
              )}
            </aside>
          )}

          {compareOpen && note.published && (
            <aside
              ref={publishedPaneRef}
              className={cn(
                'studio-published-pane',
                mobilePane === 'draft' && 'is-mobile-hidden md:block',
              )}
              aria-label={publishedHeading}
            >
              <div className="studio-pane-label">
                <span>{publishedHeading}</span>
                <small>
                  更新于 {formatDateTime(note.published.publishedAt)}
                </small>
              </div>
              <div className="studio-published-sheet">
                <header>
                  <p className="section-kicker">
                    {publishedCategory?.title ?? '未分类'}
                  </p>
                  <h2>{note.published.title}</h2>
                  <div className="studio-published-meta">
                    <span>{countWords(note.published.plainText)} 字</span>
                    <span>
                      更新于 {formatDateTime(note.published.publishedAt)}
                    </span>
                  </div>
                </header>
                <MarkdownDiffPane
                  blocks={comparisonDiff?.oldBlocks ?? []}
                  changeIds={comparisonDiff?.oldChangeIds ?? []}
                  side="old"
                  activeChangeId={activeDiffChange?.id ?? null}
                  className="studio-comparison-content"
                />
              </div>
            </aside>
          )}
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
        <button type="button" onClick={() => setTrashDialogOpen(true)}>
          <Trash2 size={20} />
          <span>回收</span>
        </button>
        <button
          type="button"
          onClick={() => markdownInputRef.current?.click()}
        >
          <FileUp size={20} />
          <span>导入</span>
        </button>
        {isPublished && publishedPath && (
          <a href={publishedPath} target="_blank" rel="noreferrer">
            <Eye size={20} />
            <span>查看</span>
          </a>
        )}
        {isOwner && isPublished && (
          <button type="button" onClick={() => setUnpublishDialogOpen(true)}>
            <EyeOff size={20} />
            <span>撤回</span>
          </button>
        )}
      </div>

      {editor && (
        <BubbleMenu
          editor={editor}
          className="bubble-menu"
          shouldShow={({ editor: currentEditor, state }) =>
            !state.selection.empty || currentEditor.isActive('image')
          }
        >
          {editor.isActive('image') ? (
            <button
              type="button"
              onClick={async () => {
                const attrs = editor.getAttributes('image')
                await navigator.clipboard.writeText(
                  String(attrs.publicUrl || attrs.src || ''),
                )
                toast.success('图片链接已复制')
              }}
            >
              <Link2 size={18} />
              复制链接
            </button>
          ) : (
            <>
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
            </>
          )}
        </BubbleMenu>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={insertImage}
      />
      <input
        ref={markdownInputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        className="hidden"
        onChange={handleMarkdownImport}
      />

      <Dialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="添加链接"
        description="链接会作为行内 Markdown 保存。"
      >
        <form
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
          className="p-5"
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
        open={versionDialogOpen}
        onOpenChange={setVersionDialogOpen}
        title="保存一个手动版本"
        description="版本会保留当前标题、分类和正文。自动保存不会生成版本。"
      >
        <form
          className="p-5"
          onSubmit={(event) => {
            event.preventDefault()
            handleSaveVersion()
          }}
        >
          <label className="text-xs font-medium text-[var(--ink-soft)]">
            版本说明
            <input
              autoFocus
              value={versionLabel}
              onChange={(event) => setVersionLabel(event.target.value)}
              placeholder="例如：补充第二节案例"
              className="mt-2 h-10 w-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm outline-none"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              className="studio-secondary-button"
              onClick={() => setVersionDialogOpen(false)}
            >
              取消
            </button>
            <button type="submit" className="studio-primary-button">
              <Save size={18} />
              保存版本
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
        <div className="max-h-[64vh] overflow-y-auto p-3">
          <section className="studio-current-draft-card">
            <span className="studio-history-kind">当前草稿</span>
            <strong>{title || '无标题章节'}</strong>
            <p data-visual-dynamic>
              最后保存于 {formatClock(savedAt)} · {wordCount} 字
            </p>
          </section>

          <ol className="studio-version-list" aria-label="共享版本日志">
            {note.versions.map((version) => (
              <li
                key={version.id}
                className={cn(
                  'studio-version-row',
                  version.kind === 'published' ? 'is-published' : 'is-manual',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'studio-history-kind',
                        version.kind === 'published' && 'is-published',
                      )}
                    >
                      {version.kind === 'published' ? '发布版本' : '手动版本'}
                    </span>
                    <span className="studio-version-author">
                      <strong>{versionAuthorName(version, author.name)}</strong>
                      <small
                        className={
                          versionAuthorRole(version) === '站主'
                            ? 'is-owner'
                            : 'is-collaborator'
                        }
                      >
                        {versionAuthorRole(version)}
                      </small>
                    </span>
                    <time>{formatVersionDate(version.createdAt)}</time>
                  </div>
                  <strong className="mt-1.5 block truncate">
                    {version.label || version.title}
                  </strong>
                  <p className="mt-1 text-[11px] text-[var(--muted-faint)]">
                    {countWords(version.plainText)} 字 · {version.title}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="studio-icon-button"
                    onClick={() => {
                      setHistoryOpen(false)
                      setSelectedVersion(version)
                    }}
                    title="查看与上一版本的变化"
                    aria-label="查看与上一版本的变化"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    type="button"
                    className="studio-icon-button"
                    onClick={() => setRestoreTarget(version)}
                    title="恢复到当前草稿"
                    aria-label="恢复到当前草稿"
                  >
                    <RotateCcw size={18} />
                  </button>
                  {version.kind === 'manual' &&
                    (isOwner ||
                      version.author?.id === currentCollaboratorId) && (
                    <button
                      type="button"
                      className="studio-icon-button hover:!text-[var(--rust)]"
                      onClick={() => {
                        if (deleteVersion(note.id, version.id)) {
                          toast.success('手动版本已删除')
                        }
                      }}
                      title="删除手动版本"
                      aria-label="删除手动版本"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </li>
            ))}
            {!note.versions.length && (
              <p className="py-10 text-center text-xs text-[var(--muted)]">
                还没有历史版本。可以手动保存一个版本，或在发布时自动生成。
              </p>
            )}
          </ol>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(selectedVersion)}
        onOpenChange={(open) => {
          if (!open) setSelectedVersion(null)
        }}
        title="版本变化"
        description={
          selectedVersion
            ? `${versionAuthorName(selectedVersion, author.name)} · ${versionAuthorRole(selectedVersion)} · ${formatVersionDate(selectedVersion.createdAt)} · ${selectedVersion.label || selectedVersion.title}`
            : undefined
        }
        className="version-diff-dialog"
      >
        {selectedVersion && (
          <VersionDiffPreview
            key={selectedVersion.id}
            previous={previousVersion}
            selected={selectedVersion}
            ownerName={author.name}
          />
        )}
      </Dialog>

      <AlertDialog.Root
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null)
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay fixed inset-0 z-[90] bg-[#0d120f]/55 backdrop-blur-[2px]" />
          <AlertDialog.Content className="dialog-content fixed left-1/2 top-1/2 z-[91] w-[min(92vw,430px)] -translate-x-1/2 -translate-y-1/2 rounded-[7px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-2xl">
            <AlertDialog.Title className="font-display text-xl text-[var(--ink)]">
              恢复这个版本？
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs leading-6 text-[var(--muted)]">
              当前草稿会被这个版本覆盖，并回到可继续编辑的草稿状态。恢复不会直接改变线上页面。
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
                  onClick={handleRestoreVersion}
                >
                  恢复为草稿
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root
        open={trashDialogOpen}
        onOpenChange={setTrashDialogOpen}
      >
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
                  className="inline-flex h-8 items-center rounded-[4px] bg-[var(--rust)] px-3 text-[13px] font-medium text-white"
                  onClick={() => {
                    saveNow()
                    trashNote(note.id)
                    toast.success('章节已移到回收站')
                    navigate('/studio')
                  }}
                >
                  移到回收站
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <AlertDialog.Root
        open={unpublishDialogOpen}
        onOpenChange={setUnpublishDialogOpen}
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
                  onClick={() => {
                    saveNow()
                    unpublishNote(note.id)
                    setCompareOpen(false)
                    toast.success('章节已撤回，公开访问已关闭')
                  }}
                >
                  确认撤回
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <button
        type="button"
        className="studio-editor-danger-link"
        onClick={() => setTrashDialogOpen(true)}
      >
        <Trash2 size={16} />
        移到回收站
      </button>
    </div>
  )
}

function SaveIndicator({
  state,
  savedAt,
}: {
  state: SaveState
  savedAt: string
}) {
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--muted-faint)]">
      <span
        className={cn(
          'size-1.5 rounded-full',
          state === 'saved' && 'bg-[var(--accent)]',
          state === 'dirty' && 'bg-[var(--gold)]',
          state === 'saving' && 'animate-pulse bg-[var(--gold)]',
          state === 'conflict' && 'bg-[var(--rust)]',
        )}
      />
      {state === 'saved' && `草稿已保存 ${formatClock(savedAt)}`}
      {state === 'dirty' && '等待自动保存'}
      {state === 'saving' && '正在保存草稿'}
      {state === 'conflict' && '草稿版本冲突'}
    </p>
  )
}

function versionAuthorName(version: ChapterSnapshot, ownerName: string) {
  return version.author?.name ?? ownerName
}

function versionAuthorRole(version: ChapterSnapshot) {
  return version.author?.role === 'collaborator' ? '协作者' : '站主'
}

function VersionDiffPreview({
  selected,
  previous,
  ownerName,
}: {
  selected: ChapterSnapshot
  previous: ChapterSnapshot | null
  ownerName: string
}) {
  const diff = buildMarkdownDiff(
    previous?.markdown ?? '',
    selected.markdown,
  )
  const [activeChangeId, setActiveChangeId] = useState<string | null>(
    diff.changes[0]?.id ?? null,
  )
  const activeChange =
    diff.changes.find((change) => change.id === activeChangeId) ?? null

  return (
    <div className="version-diff-preview">
      <MarkdownDiffNavigator
        changes={diff.changes}
        activeChangeId={activeChange?.id ?? null}
        onSelect={(change) => setActiveChangeId(change.id)}
      />
      <div className="version-diff-columns">
        <section>
          <header className="is-old">
            <span>上一版本</span>
            <small>
              {previous
                ? `${versionAuthorName(previous, ownerName)} · ${versionAuthorRole(previous)} · ${formatVersionDate(previous.createdAt)}`
                : '无'}
            </small>
          </header>
          <div className="version-diff-content">
            <MarkdownDiffPane
              blocks={diff.oldBlocks}
              changeIds={diff.oldChangeIds}
              side="old"
              activeChangeId={activeChange?.id ?? null}
            />
          </div>
        </section>
        <section>
          <header className="is-new">
            <span>此版本</span>
            <small>
              {versionAuthorName(selected, ownerName)} ·{' '}
              {versionAuthorRole(selected)} ·{' '}
              {formatVersionDate(selected.createdAt)}
            </small>
          </header>
          <div className="version-diff-content">
            <MarkdownDiffPane
              blocks={diff.newBlocks}
              changeIds={diff.newChangeIds}
              side="new"
              activeChangeId={activeChange?.id ?? null}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function formatVersionDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
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
  hint?: string
  icon: LucideIcon
}> = [
  { kind: 'paragraph', label: '正文', hint: '普通段落', icon: Pilcrow },
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
      const paragraph =
        currentEditor.isActive('paragraph') &&
        !currentEditor.isActive('bulletList') &&
        !currentEditor.isActive('orderedList') &&
        !currentEditor.isActive('taskList') &&
        !currentEditor.isActive('blockquote') &&
        !currentEditor.isActive('codeBlock')
      return {
        paragraph,
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
                {active && <Check size={18} className="ml-auto" />}
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
          className={cn(
            'toolbar-button',
            currentColor && 'is-active',
          )}
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
                {(currentColor ?? null) === color.value && (
                  <Check size={16} />
                )}
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
  imageBusy,
}: {
  editor: Editor | null
  onLink: () => void
  onImage: () => void
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
      </div>
      <div className="toolbar-separator" />
      <div className="toolbar-group">
        <ToolbarButton label="链接" active={selectionState.link} onClick={onLink}>
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
