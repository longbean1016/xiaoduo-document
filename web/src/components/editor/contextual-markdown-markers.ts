import { Extension } from '@tiptap/core'
import { lift } from '@tiptap/pm/commands'
import type { Mark } from '@tiptap/pm/model'
import type { EditorState } from '@tiptap/pm/state'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

type MarkRange = {
  close: string
  from: number
  key: string
  mark: Mark
  markName: string
  open: string
  to: number
}

const markersPluginKey = new PluginKey<DecorationSet>(
  'contextualMarkdownMarkers',
)

function markSyntax(markName: string, href?: unknown) {
  switch (markName) {
    case 'bold':
      return { open: '**', close: '**' }
    case 'italic':
      return { open: '*', close: '*' }
    case 'strike':
      return { open: '~~', close: '~~' }
    case 'code':
      return { open: '`', close: '`' }
    case 'link':
      return typeof href === 'string'
        ? { open: '[', close: `](${href})` }
        : null
    default:
      return null
  }
}

function markerWidget(
  text: string,
  side: -1 | 1,
  markName: string,
) {
  return () => {
    const marker = document.createElement('span')
    marker.className = 'markdown-context-marker'
    marker.dataset.markdownMarker = markName
    marker.dataset.side = side < 0 ? 'open' : 'close'
    marker.setAttribute('aria-hidden', 'true')
    marker.contentEditable = 'false'
    marker.textContent = text
    return marker
  }
}

function collectMarkRanges(state: EditorState) {
  const { $from } = state.selection
  const blockStart = $from.start()
  const blockEnd = $from.end()
  const ranges: MarkRange[] = []

  state.doc.nodesBetween(blockStart, blockEnd, (node, position) => {
    if (!node.isText) return
    node.marks.forEach((mark) => {
      const syntax = markSyntax(mark.type.name, mark.attrs.href)
      if (!syntax) return
      const key = `${mark.type.name}:${JSON.stringify(mark.attrs)}`
      const previous = ranges.at(-1)
      if (
        previous?.key === key &&
        previous.to === position
      ) {
        previous.to = position + node.nodeSize
        return
      }
      ranges.push({
        ...syntax,
        from: position,
        key,
        mark,
        markName: mark.type.name,
        to: position + node.nodeSize,
      })
    })
  })
  return ranges
}

function buildDecorations(state: EditorState) {
  if (!state.selection.empty) return DecorationSet.empty

  const { $from } = state.selection
  const blockStart = $from.start()
  const ranges = collectMarkRanges(state)
  const blockDecorations: Decoration[] = []
  const blockPrefix =
    $from.parent.type.name === 'heading'
      ? `${'#'.repeat(Number($from.parent.attrs.level) || 1)} `
      : $from.depth > 1 &&
          $from.node($from.depth - 1).type.name === 'blockquote'
        ? '> '
        : ''
  if (blockPrefix) {
    blockDecorations.push(
      Decoration.widget(
        blockStart,
        markerWidget(blockPrefix, -1, 'block'),
        {
          key: `block-${$from.pos}-${blockPrefix}`,
          side: -1,
        },
      ),
    )
  }

  const cursor = state.selection.from
  const decorations = ranges.flatMap((range) => {
    if (cursor < range.from || cursor > range.to) return []
    return [
      Decoration.widget(
        range.from,
        markerWidget(range.open, -1, range.markName),
        {
          key: `open-${range.key}-${range.from}`,
          side: -1,
        },
      ),
      Decoration.widget(
        range.to,
        markerWidget(range.close, 1, range.markName),
        {
          key: `close-${range.key}-${range.to}`,
          side: 1,
        },
      ),
    ]
  })

  return DecorationSet.create(state.doc, [
    ...blockDecorations,
    ...decorations,
  ])
}

function handleMarkerKeyDown(
  state: EditorState,
  dispatch: (transaction: ReturnType<EditorState['tr']['setMeta']>) => void,
  key: string,
) {
  if (!state.selection.empty) return false
  const { $from } = state.selection

  if (key === 'Backspace' && $from.parentOffset === 0) {
    if ($from.parent.type.name === 'heading') {
      dispatch(
        state.tr.setBlockType(
          $from.before($from.depth),
          $from.after($from.depth),
          state.schema.nodes.paragraph,
        ),
      )
      return true
    }
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name !== 'blockquote') continue
      return lift(state, dispatch)
    }
  }

  const ranges = collectMarkRanges(state)
  const boundary =
    key === 'Backspace'
      ? ranges.find((range) => range.from === state.selection.from)
      : key === 'Delete'
        ? ranges.find((range) => range.to === state.selection.from)
        : null
  if (!boundary) return false
  dispatch(state.tr.removeMark(boundary.from, boundary.to, boundary.mark))
  return true
}

export const ContextualMarkdownMarkers = Extension.create({
  name: 'contextualMarkdownMarkers',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: markersPluginKey,
        state: {
          init: (_config, state) => buildDecorations(state),
          apply: (transaction, previous, _oldState, newState) =>
            transaction.docChanged || transaction.selectionSet
              ? buildDecorations(newState)
              : previous,
        },
        props: {
          decorations(state) {
            return markersPluginKey.getState(state)
          },
          handleKeyDown(view, event) {
            if (event.key !== 'Backspace' && event.key !== 'Delete') {
              return false
            }
            const handled = handleMarkerKeyDown(
              view.state,
              view.dispatch,
              event.key,
            )
            if (handled) event.preventDefault()
            return handled
          },
        },
      }),
    ]
  },
})
