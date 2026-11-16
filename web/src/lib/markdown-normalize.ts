import type { Editor, JSONContent } from '@tiptap/core'

const INLINE_MARKDOWN =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~|`[^`\n]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/i

export function normalizeCurrentMarkdownBlock(editor: Editor) {
  if (!editor.isEditable || !editor.state.selection.empty) return false

  const { state } = editor
  const { $from } = state.selection
  const block = $from.parent
  if (!['paragraph', 'heading'].includes(block.type.name)) return false

  const source = block.textContent
  if (!INLINE_MARKDOWN.test(source)) return false

  try {
    const parsed = editor.storage.markdown.manager.parse(source) as JSONContent
    const parsedBlock = parsed.content?.find(
      (node) => node.type === 'paragraph',
    )
    if (!parsedBlock?.content) return false

    const hasInlineMark = parsedBlock.content.some((node) =>
      node.marks?.some((mark) =>
        ['bold', 'italic', 'strike', 'code', 'link'].includes(mark.type),
      ),
    )
    if (!hasInlineMark) return false

    const parsedNode = editor.schema.nodeFromJSON(parsedBlock)
    editor.view.dispatch(
      state.tr.replaceWith($from.start(), $from.end(), parsedNode.content),
    )
    return true
  } catch {
    return false
  }
}
