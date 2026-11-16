import {
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { FolderPlus, GripVertical, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePageTitle } from '../../lib/usePageTitle'
import { useSiteStore } from '../../store/siteStore'
import type { Category } from '../../types'

export function CategoryManagementPage() {
  usePageTitle('分类管理 · 知笺')
  const categories = useSiteStore((state) => state.categories)
  const notes = useSiteStore((state) => state.notes)
  const createCategory = useSiteStore((state) => state.createCategory)
  const updateCategory = useSiteStore((state) => state.updateCategory)
  const deleteCategory = useSiteStore((state) => state.deleteCategory)
  const reorderCategories = useSiteStore((state) => state.reorderCategories)
  const [newTitle, setNewTitle] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [draftOrder, setDraftOrder] = useState(() =>
    orderedCategoryIds(categories),
  )
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(
    null,
  )

  useEffect(() => {
    setDraftOrder((current) => {
      const categoryIds = new Set(categories.map((category) => category.id))
      const retained = current.filter((id) => categoryIds.has(id))
      const retainedIds = new Set(retained)
      return [
        ...retained,
        ...orderedCategoryIds(categories).filter((id) => !retainedIds.has(id)),
      ]
    })
  }, [categories])

  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const ordered = draftOrder.flatMap((id) => {
    const category = categoryById.get(id)
    return category ? [category] : []
  })
  const persistedOrder = orderedCategoryIds(categories)
  const orderDirty =
    ordered.length !== persistedOrder.length ||
    ordered.some(
      (category, index) => category.id !== persistedOrder[index],
    )

  const create = (event: FormEvent) => {
    event.preventDefault()
    const id = createCategory(newTitle, newSlug)
    if (!id) {
      toast.error('请填写分类名称和唯一的英文网址标识')
      return
    }
    setNewTitle('')
    setNewSlug('')
    toast.success('分类已创建')
  }

  const moveDraftCategory = (categoryId: string, targetId: string) => {
    if (categoryId === targetId) return
    setDraftOrder((current) => {
      const fromIndex = current.indexOf(categoryId)
      const targetIndex = current.indexOf(targetId)
      if (fromIndex < 0 || targetIndex < 0) return current
      const next = current.slice()
      const [moved] = next.splice(fromIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const moveDraftCategoryBy = (categoryId: string, direction: -1 | 1) => {
    setDraftOrder((current) => {
      const index = current.indexOf(categoryId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      const next = current.slice()
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  const saveOrdering = () => {
    if (!orderDirty) return
    if (!reorderCategories(draftOrder)) {
      toast.error('分类排序保存失败')
      return
    }
    toast.success('分类排序已保存')
  }

  return (
    <div className="studio-page max-w-[900px]">
      <header className="studio-page-header">
        <div>
          <p className="section-kicker">Library structure</p>
          <h1>分类</h1>
          <p>分类只负责组织章节。名称用于界面展示，英文标识进入公开网址。</p>
        </div>
        <button
          type="button"
          className="studio-primary-button category-order-save"
          onClick={saveOrdering}
          disabled={!orderDirty}
        >
          <Save size={18} />
          保存排序
        </button>
      </header>

      <form onSubmit={create} className="category-create-form">
        <FolderPlus size={20} />
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder="分类名称"
          aria-label="分类名称"
        />
        <input
          value={newSlug}
          onChange={(event) => setNewSlug(event.target.value)}
          placeholder="english-slug"
          aria-label="分类英文网址标识"
          className="max-w-[210px]"
        />
        <button type="submit" className="studio-primary-button">
          新建分类
        </button>
      </form>

      <div className="category-editor-list">
        {ordered.map((category, index) => (
          <CategoryEditor
            key={category.id}
            category={category}
            index={index}
            chapterCount={
              notes.filter(
                (note) =>
                  note.categoryId === category.id ||
                  note.published?.categoryId === category.id,
              ).length
            }
            isDragging={draggedCategoryId === category.id}
            isDragOver={dragOverCategoryId === category.id}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', category.id)
              setDraggedCategoryId(category.id)
            }}
            onDragOver={() => {
              setDragOverCategoryId(category.id)
            }}
            onDragLeave={() => {
              setDragOverCategoryId((current) =>
                current === category.id ? null : current,
              )
            }}
            onDrop={(event) => {
              event.preventDefault()
              const sourceId =
                event.dataTransfer.getData('text/plain') || draggedCategoryId
              if (sourceId) moveDraftCategory(sourceId, category.id)
              setDraggedCategoryId(null)
              setDragOverCategoryId(null)
            }}
            onDragEnd={() => {
              setDraggedCategoryId(null)
              setDragOverCategoryId(null)
            }}
            onKeyboardMove={(direction) =>
              moveDraftCategoryBy(category.id, direction)
            }
            onSave={(patch) => {
              if (!updateCategory(category.id, patch)) {
                toast.error('分类网址标识重复或无效')
                return
              }
              toast.success('分类已保存')
            }}
            onDelete={() => {
              if (!deleteCategory(category.id)) {
                toast.error('分类中还有章节，不能删除')
                return
              }
              toast.success('分类已删除')
            }}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryEditor({
  category,
  index,
  chapterCount,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onKeyboardMove,
  onSave,
  onDelete,
}: {
  category: Category
  index: number
  chapterCount: number
  isDragging: boolean
  isDragOver: boolean
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onKeyboardMove: (direction: -1 | 1) => void
  onSave: (patch: { title: string; slug: string }) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(category.title)
  const [slug, setSlug] = useState(category.slug)

  return (
    <section
      className={[
        'category-editor',
        isDragging ? 'is-dragging' : '',
        isDragOver && !isDragging ? 'is-drag-over' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`分类：${category.title}`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!isDragging) onDragOver()
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <header>
        <button
          type="button"
          draggable
          className="category-drag-handle"
          aria-label={`拖拽分类：${category.title}`}
          title="拖拽调整分类顺序"
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            onKeyboardMove(event.key === 'ArrowUp' ? -1 : 1)
          }}
        >
          <GripVertical size={18} />
        </button>
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div>
          <h2>{category.title}</h2>
          <p>{chapterCount} 篇章节</p>
        </div>
      </header>
      <div className="category-editor-fields sm:grid-cols-2">
        <label>
          <span>名称</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          <span>英文网址标识</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--rust)] disabled:opacity-40"
          onClick={onDelete}
          disabled={chapterCount > 0}
        >
          <Trash2 size={16} />
          删除分类
        </button>
        <button
          type="button"
          className="studio-primary-button"
          onClick={() => onSave({ title, slug })}
        >
          <Save size={18} />
          保存
        </button>
      </div>
    </section>
  )
}

function orderedCategoryIds(categories: Category[]) {
  return categories
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((category) => category.id)
}
