import { Extension } from '@tiptap/core'
import { TextSelection, type EditorState } from '@tiptap/pm/state'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

function isFirstTableCellStart(state: EditorState) {
  if (!state.selection.empty) return false
  const { $from } = state.selection
  if ($from.parentOffset !== 0) return false

  let tableDepth = -1
  let cellDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name
    if (name === 'table' && tableDepth < 0) tableDepth = depth
    if (
      (name === 'tableCell' || name === 'tableHeader') &&
      cellDepth < 0
    ) {
      cellDepth = depth
    }
  }
  if (tableDepth < 0 || cellDepth < 0) return false

  const tableStart = $from.before(tableDepth)
  return $from.before(cellDepth) === tableStart + 2
}

export function handleEditorBoundaryKeyDown(
  view: EditorView,
  event: KeyboardEvent,
) {
  if (event.key === 'ArrowRight' && view.state.selection.empty) {
    const { $from } = view.state.selection
    if (
      $from.parent.isTextblock &&
      $from.parentOffset === $from.parent.content.size
    ) {
      const nextPosition = $from.after($from.depth)
      if (view.state.doc.nodeAt(nextPosition)?.type.name === 'table') {
        const paragraph = view.state.schema.nodes.paragraph?.createAndFill()
        if (paragraph) {
          const transaction = view.state.tr.insert(nextPosition, paragraph)
          transaction.setSelection(
            TextSelection.near(
              transaction.doc.resolve(nextPosition + 1),
            ),
          )
          transaction.setStoredMarks([])
          view.dispatch(transaction)
          event.preventDefault()
          return true
        }
      }
    }
  }
  if (event.key !== 'Enter' || !isFirstTableCellStart(view.state)) {
    return false
  }
  const { state } = view
  const { $from } = state.selection
  let tableDepth = -1
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      tableDepth = depth
      break
    }
  }
  const paragraph = state.schema.nodes.paragraph?.createAndFill()
  if (tableDepth < 0 || !paragraph) return false

  const tableStart = $from.before(tableDepth)
  const transaction = state.tr.insert(tableStart, paragraph)
  transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(tableStart + 1)),
  )
  transaction.setStoredMarks([])
  view.dispatch(transaction)
  event.preventDefault()
  return true
}

export function handleEditorCopy(
  view: EditorView,
  event: ClipboardEvent,
) {
  if (view.state.selection.empty || !event.clipboardData) return false
  const { from, to } = view.state.selection
  const text = view.state.doc.textBetween(from, to, '\n', '\n')
  if (!text) return false

  event.clipboardData.clearData()
  event.clipboardData.setData('text/plain', text)
  const selection = window.getSelection()
  if (selection?.rangeCount) {
    const container = document.createElement('div')
    container.append(selection.getRangeAt(0).cloneContents())
    event.clipboardData.setData('text/html', container.innerHTML)
  }
  event.preventDefault()
  return true
}

export const EditorBoundaryActions = Extension.create({
  name: 'editorBoundaryActions',
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: handleEditorBoundaryKeyDown,
          handleDOMEvents: {
            copy: handleEditorCopy,
          },
        },
      }),
    ]
  },
})
