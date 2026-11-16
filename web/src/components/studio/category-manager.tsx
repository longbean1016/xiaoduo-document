'use client'

import { FolderPlus, GripVertical, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface CategoryItem {
  id: string
  title: string
  slug: string
  position: number
}

function sortCategories(categories: CategoryItem[]) {
  return [...categories].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  )
}

function moveCategoryToPosition(
  categories: CategoryItem[],
  sourceId: string,
  targetId: string,
) {
  const sourceIndex = categories.findIndex((item) => item.id === sourceId)
  const targetIndex = categories.findIndex((item) => item.id === targetId)
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex === targetIndex
  ) {
    return categories
  }

  const reordered = [...categories]
  const [moved] = reordered.splice(sourceIndex, 1)
  reordered.splice(targetIndex, 0, moved)
  return reordered
}

export function CategoryManager({
  initialCategories,
  chapterCounts,
}: {
  initialCategories: CategoryItem[]
  chapterCounts: Record<string, number>
}) {
  const router = useRouter()
  const [orderedCategories, setOrderedCategories] = useState<CategoryItem[]>(
    () => sortCategories(initialCategories),
  )
  const [savedOrder, setSavedOrder] = useState<string[]>(() =>
    sortCategories(initialCategories).map((category) => category.id),
  )
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(
    null,
  )

  const orderDirty =
    orderedCategories.length !== savedOrder.length ||
    orderedCategories.some(
      (category, index) => category.id !== savedOrder[index],
    )

  async function request(
    url: string,
    init: RequestInit,
    successMessage = '',
  ) {
    setPending(true)
    setMessage('')
    setNotice('')
    try {
      const response = await fetch(url, init)
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      if (!response.ok) {
        const errors: Record<string, string> = {
          SLUG_TAKEN: '分类网址标识已存在。',
          CATEGORY_NOT_EMPTY: '分类中仍有章节，不能删除。',
          CANNOT_MOVE: '该分类已经位于边界。',
          INVALID_CATEGORY: '请填写有效的中文名称和英文网址标识。',
          INVALID_CATEGORY_ORDER:
            '分类顺序已发生变化，请刷新页面后重新排序。',
        }
        setMessage(errors[payload.error ?? ''] ?? '操作失败，请重试。')
        return false
      }

      if (successMessage) setNotice(successMessage)
      router.refresh()
      return true
    } catch {
      setMessage('网络连接失败，请稍后重试。')
      return false
    } finally {
      setPending(false)
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await request('/api/studio/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: newTitle, slug: newSlug }),
    })
    if (created) {
      setNewTitle('')
      setNewSlug('')
    }
  }

  async function save(
    category: CategoryItem,
    values: { title: string; slug: string },
  ) {
    await request(`/api/studio/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    })
  }

  async function saveOrder() {
    if (!orderDirty || pending) return
    const ids = orderedCategories.map((category) => category.id)
    const saved = await request(
      '/api/studio/categories/reorder',
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ids }),
      },
      '分类顺序已保存。',
    )
    if (saved) setSavedOrder(ids)
  }

  async function remove(category: CategoryItem) {
    await request(`/api/studio/categories/${category.id}`, {
      method: 'DELETE',
    })
    setDeleteTarget(null)
  }

  function beginDrag(
    event: DragEvent<HTMLButtonElement>,
    categoryId: string,
  ) {
    if (pending) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', categoryId)
    setDraggedId(categoryId)
    setDragOverId(categoryId)
  }

  function dragEnter(categoryId: string) {
    if (!draggedId || draggedId === categoryId) return
    setDragOverId(categoryId)
  }

  function dropCategory(categoryId: string) {
    if (draggedId && draggedId !== categoryId) {
      setOrderedCategories((current) =>
        moveCategoryToPosition(current, draggedId, categoryId),
      )
    }
    finishDrag()
  }

  function finishDrag() {
    setDraggedId(null)
    setDragOverId(null)
  }

  function keyboardMove(categoryId: string, direction: -1 | 1) {
    if (pending) return
    const sourceIndex = orderedCategories.findIndex(
      (category) => category.id === categoryId,
    )
    const target = orderedCategories[sourceIndex + direction]
    if (!target) return
    setOrderedCategories((current) =>
      moveCategoryToPosition(current, categoryId, target.id),
    )
  }

  return (
    <div className="studio-page max-w-[900px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Library structure</p>
          <h1>分类</h1>
          <p>分类只负责组织章节。名称用于界面展示，英文标识进入公开网址。</p>
        </div>
      </header>

      <form className="category-create-form" onSubmit={create}>
        <FolderPlus size={20} />
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="分类名称"
          aria-label="分类名称"
          required
        />
        <input
          value={newSlug}
          onChange={(event) => setNewSlug(event.target.value)}
          placeholder="english-slug"
          aria-label="分类英文网址标识"
          pattern="[a-z0-9-]+"
          required
        />
        <button
          type="submit"
          className="studio-primary-button"
          disabled={pending}
        >
          新建分类
        </button>
      </form>

      {orderedCategories.length > 1 ? (
        <div className="category-order-toolbar">
          <div className="category-order-toolbar-copy">
            <GripVertical size={17} />
            <span>
              {orderDirty
                ? '排序尚未保存，点击“保存排序”后生效。'
                : '拖动分类左侧把手调整顺序。'}
            </span>
          </div>
          <button
            type="button"
            className="studio-primary-button"
            disabled={pending || !orderDirty}
            onClick={() => void saveOrder()}
          >
            <Save size={17} />
            {pending && orderDirty ? '保存中...' : '保存排序'}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="category-form-error" role="alert">
          {message}
        </p>
      ) : null}
      {notice ? (
        <p className="category-form-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="category-editor-list">
        {orderedCategories.map((category, index) => (
          <CategoryEditor
            key={category.id}
            category={category}
            index={index}
            chapterCount={chapterCounts[category.id] ?? 0}
            disabled={pending}
            isDragging={draggedId === category.id}
            isDragOver={dragOverId === category.id && draggedId !== category.id}
            onDragStart={(event) => beginDrag(event, category.id)}
            onDragEnter={() => dragEnter(category.id)}
            onDragEnd={finishDrag}
            onDrop={() => dropCategory(category.id)}
            onKeyboardMove={(direction) =>
              keyboardMove(category.id, direction)
            }
            onSave={(values) => void save(category, values)}
            onDelete={() => setDeleteTarget(category)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="删除这个分类？"
        description={
          deleteTarget
            ? `分类“${deleteTarget.title}”将被永久删除，这个操作无法撤销。`
            : ''
        }
        confirmLabel="删除分类"
        pending={pending}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget)
        }}
      />
    </div>
  )
}

function CategoryEditor({
  category,
  index,
  chapterCount,
  disabled,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onKeyboardMove,
  onSave,
  onDelete,
}: {
  category: CategoryItem
  index: number
  chapterCount: number
  disabled: boolean
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnter: () => void
  onDragEnd: () => void
  onDrop: () => void
  onKeyboardMove: (direction: -1 | 1) => void
  onSave: (values: { title: string; slug: string }) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(category.title)
  const [slug, setSlug] = useState(category.slug)

  function handleDragKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    onKeyboardMove(event.key === 'ArrowUp' ? -1 : 1)
  }

  return (
    <section
      className={[
        'category-editor',
        isDragging ? 'is-dragging' : '',
        isDragOver ? 'is-drag-over' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        if (disabled) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        onDragEnter()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop()
      }}
    >
      <header>
        <button
          type="button"
          className="category-drag-handle"
          draggable={!disabled}
          disabled={disabled}
          aria-label={`拖拽排序 ${category.title}`}
          title="拖拽排序，也可使用上下方向键"
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onKeyDown={handleDragKeyDown}
        >
          <GripVertical size={18} />
        </button>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2>{category.title}</h2>
          <p>{chapterCount} 篇章节</p>
        </div>
        <div className="ml-auto text-[12px] text-[var(--muted-faint)]">
          {isDragging ? '拖动中' : isDragOver ? '放到这里' : ''}
        </div>
      </header>
      <div className="category-editor-fields sm:grid-cols-2">
        <label>
          <span>名称</span>
          <input
            value={title}
            aria-label={`分类名称 ${category.title}`}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>英文网址标识</span>
          <input
            value={slug}
            aria-label={`分类网址标识 ${category.title}`}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--rust)] disabled:opacity-40"
          aria-label={`删除 ${category.title}`}
          disabled={disabled || chapterCount > 0}
          title={
            chapterCount > 0 ? '分类中仍有章节，不能删除' : '删除空分类'
          }
          onClick={onDelete}
        >
          <Trash2 size={16} />
          删除分类
        </button>
        <button
          type="button"
          className="studio-primary-button"
          aria-label="保存分类"
          disabled={disabled}
          onClick={() => onSave({ title, slug })}
        >
          <Save size={18} />
          保存修改
        </button>
      </div>
    </section>
  )
}
