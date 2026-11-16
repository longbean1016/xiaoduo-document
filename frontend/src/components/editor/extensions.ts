import type {
  AnyExtension,
  JSONContent,
  MarkdownRendererHelpers,
} from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import { Markdown } from '@tiptap/markdown'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { lowlight } from '../../lib/codeHighlight'
import { CodeBlockView } from './CodeBlockView'
import { SlashCommand } from './SlashMenu'

export const ZhijianImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      publicUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-public-url'),
        renderHTML: (attributes) =>
          attributes.publicUrl
            ? { 'data-public-url': attributes.publicUrl }
            : {},
      },
    }
  },
}).configure({
  inline: false,
  allowBase64: true,
})

const ZhijianTextStyle = TextStyle.extend({
  renderMarkdown(
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
  ) {
    const color =
      typeof node.attrs?.color === 'string' ? node.attrs.color : ''
    const content = helpers.renderChildren(node)
    return color
      ? `<span style="color: ${color}">${content}</span>`
      : content
  },
})

const ZhijianHighlight = Highlight.extend({
  renderMarkdown(
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
  ) {
    const color =
      typeof node.attrs?.color === 'string' ? node.attrs.color : ''
    const content = helpers.renderChildren(node)
    return color
      ? `<mark style="background-color: ${color}">${content}</mark>`
      : `<mark>${content}</mark>`
  },
})

const ZhijianCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
}).configure({
  lowlight,
  defaultLanguage: 'text',
  enableTabIndentation: true,
  tabSize: 2,
})

export function createEditorExtensions(options?: {
  editable?: boolean
}): AnyExtension[] {
  const editable = options?.editable ?? true

  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5] },
      link: false,
      underline: false,
      codeBlock: false,
    }),
    ZhijianCodeBlock,
    ...(editable
      ? [
          Placeholder.configure({
            placeholder: ({ node }) =>
              node.type.name === 'heading' ? '标题' : '从这里开始写…',
          }),
        ]
      : []),
    Link.configure({
      openOnClick: !editable,
      autolink: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    Markdown.configure({
      indentation: { style: 'space', size: 2 },
    }),
    ZhijianImage,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: editable }),
    TableRow,
    TableHeader,
    TableCell,
    ZhijianTextStyle,
    Color,
    Underline,
    ZhijianHighlight.configure({ multicolor: true }),
    ...(editable ? [SlashCommand] : []),
  ]
}

