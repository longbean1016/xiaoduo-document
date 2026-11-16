'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import {
  CheckSquare2,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table2,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SlashItem {
  title: string
  hint: string
  icon: LucideIcon
  keywords: string[]
  run: (editor: Editor, range: Range) => void
}

const items: SlashItem[] = [
  {
    title: '正文',
    hint: '普通段落',
    icon: Pilcrow,
    keywords: ['paragraph', 'text', 'wenben'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: '一级标题',
    hint: '页面主标题',
    icon: Heading1,
    keywords: ['h1', 'heading', 'biaoti'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    title: '二级标题',
    hint: '章节标题',
    icon: Heading2,
    keywords: ['h2', 'heading', 'biaoti'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    title: '三级标题',
    hint: '小节标题',
    icon: Heading3,
    keywords: ['h3', 'heading', 'biaoti'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    title: '四级标题',
    hint: '更深一层的小节',
    icon: Heading4,
    keywords: ['h4', 'heading', 'biaoti'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run(),
  },
  {
    title: '五级标题',
    hint: '最深层级的标题',
    icon: Heading5,
    keywords: ['h5', 'heading', 'biaoti'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 5 }).run(),
  },
  {
    title: '项目列表',
    hint: '无序要点',
    icon: List,
    keywords: ['bullet', 'list', 'liebiao'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: '编号列表',
    hint: '按顺序排列',
    icon: ListOrdered,
    keywords: ['ordered', 'number', 'bianhao'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: '待办事项',
    hint: '可勾选的任务',
    icon: CheckSquare2,
    keywords: ['todo', 'task', 'daiban'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: '引用',
    hint: '突出的一段话',
    icon: Quote,
    keywords: ['quote', 'blockquote', 'yinyong'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: '代码块',
    hint: '等宽代码内容',
    icon: Code2,
    keywords: ['code', 'daima'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Mermaid 图表',
    hint: '流程图、时序图等',
    icon: Workflow,
    keywords: ['mermaid', 'diagram', 'flowchart', 'liuchengtu'],
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: 'mermaid' })
        .run(),
  },
  {
    title: '表格',
    hint: '3 × 3 表格',
    icon: Table2,
    keywords: ['table', 'biaoge'],
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
  {
    title: '分割线',
    hint: '分隔内容',
    icon: Minus,
    keywords: ['divider', 'rule', 'fenge'],
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: '图片',
    hint: '从本地选择',
    icon: ImageIcon,
    keywords: ['image', 'photo', 'tupian'],
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).run()
      window.dispatchEvent(new Event('zhijian:pick-image'))
    },
  },
]

function filteredItems(query: string) {
  const normalized = query.toLowerCase().trim()
  if (!normalized) return items
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(normalized) ||
      item.keywords.some((keyword) => keyword.includes(normalized)),
  )
}

interface SlashMenuProps {
  editor: Editor
  range: Range
  items: SlashItem[]
  query: string
  command: (item: SlashItem) => void
}

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(
  function SlashMenu({ items: availableItems, command }, ref) {
    const [selected, setSelected] = useState(0)

    useEffect(() => {
      setSelected(0)
    }, [availableItems])

    const selectItem = (index: number) => {
      const item = availableItems[index]
      if (item) command(item)
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: (event) => {
        if (event.key === 'ArrowUp') {
          setSelected(
            (current) =>
              (current + availableItems.length - 1) % availableItems.length,
          )
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelected((current) => (current + 1) % availableItems.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selected)
          return true
        }
        return false
      },
    }))

    if (!availableItems.length) {
      return (
        <div className="slash-menu px-3 py-2.5 text-xs text-[var(--muted)]">
          没有匹配的块
        </div>
      )
    }

    return (
      <div className="slash-menu" role="listbox" aria-label="插入内容块">
        <p className="px-2.5 pb-1.5 pt-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--muted-faint)]">
          Insert block
        </p>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {availableItems.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.title}
                type="button"
                role="option"
                aria-selected={index === selected}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[5px] px-2.5 py-2 text-left',
                  index === selected
                    ? 'bg-[var(--accent-soft)] text-[var(--ink)]'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--hover)]',
                )}
                onMouseDown={(event) => {
                  event.preventDefault()
                  command(item)
                }}
                onMouseEnter={() => setSelected(index)}
              >
                <span className="flex size-7 items-center justify-center rounded-[4px] border border-[var(--line)] bg-[var(--panel-strong)] text-[var(--accent)]">
                  <Icon size={19} strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-[13px] text-[var(--muted)]">
                    {item.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--line)] px-3 py-2 text-[12px] text-[var(--muted-faint)]">
          <span>↑↓ 选择</span>
          <span>Enter 插入</span>
        </div>
      </div>
    )
  },
)

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filteredItems(query),
        command: ({ editor, range, props }) => {
          props.run(editor, range)
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle> | null = null
          let popup: HTMLDivElement | null = null

          const positionPopup = (
            clientRect?: (() => DOMRect | null) | null,
          ) => {
            if (!popup || !clientRect) return
            const rect = clientRect()
            if (!rect) return
            const menuWidth = 270
            const left = Math.min(
              window.innerWidth - menuWidth - 12,
              Math.max(12, rect.left),
            )
            const estimatedHeight = 310
            const top =
              rect.bottom + estimatedHeight > window.innerHeight
                ? Math.max(12, rect.top - estimatedHeight)
                : rect.bottom + 8
            popup.style.left = `${left}px`
            popup.style.top = `${top}px`
          }

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                props: {
                  ...props,
                  command: (item: SlashItem) => {
                    props.command(item)
                  },
                },
                editor: props.editor,
              })
              popup = document.createElement('div')
              popup.className = 'fixed z-[90]'
              popup.appendChild(component.element)
              document.body.appendChild(popup)
              positionPopup(props.clientRect)
            },
            onUpdate: (props) => {
              component?.updateProps({
                ...props,
                command: (item: SlashItem) => {
                  props.command(item)
                },
              })
              positionPopup(props.clientRect)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.remove()
                component?.destroy()
                popup = null
                component = null
                return true
              }
              return component?.ref?.onKeyDown(props.event) ?? false
            },
            onExit: () => {
              popup?.remove()
              component?.destroy()
              popup = null
              component = null
            },
          }
        },
      }),
    ]
  },
})
