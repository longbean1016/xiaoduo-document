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

type MarkerPluginState = {
  // ArrowRight enters a mark at its trailing syntax; a second press exits it.
  continuationKeys: string[]
  decorations: DecorationSet
  suppressedKeys: string[]
}

const markersPluginKey = new PluginKey<MarkerPluginState>(
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
    marker.dataset.markerText = text
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

function buildDecorations(
  state: EditorState,
  suppressedKeys: readonly string[] = [],
) {
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
          side: 1,
        },
      ),
    )
  }

  const cursor = state.selection.from
  const decorations = ranges.flatMap((range) => {
    if (suppressedKeys.includes(range.key)) return []
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
  continuationKeys: readonly string[],
  suppressedKeys: readonly string[],
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
  if (key === 'ArrowRight') {
    const endingMarks = ranges.filter(
      (range) => range.to === state.selection.from,
    )
    if (
      endingMarks.length &&
      $from.parentOffset === $from.parent.content.size
    ) {
      if (
        endingMarks.some(({ key: markKey }) =>
          suppressedKeys.includes(markKey),
        )
      ) {
        return false
      }
      const isContinuingMark = endingMarks.some(({ key: markKey }) =>
        continuationKeys.includes(markKey),
      )
      const storedMarks = state.storedMarks ?? []
      dispatch(
        state.tr
          .setStoredMarks(
            isContinuingMark
              ? storedMarks.filter(
                  (storedMark) =>
                    !endingMarks.some(({ mark }) => storedMark.eq(mark)),
                )
              : [
                  ...storedMarks,
                  ...endingMarks
                    .map(({ mark }) => mark)
                    .filter(
                      (mark) =>
                        !storedMarks.some((storedMark) =>
                          storedMark.eq(mark),
                        ),
                    ),
                ],
          )
          .setMeta(
            markersPluginKey,
            {
              continuationKeys: isContinuingMark
                ? []
                : endingMarks.map(({ key: markKey }) => markKey),
              suppressedKeys: isContinuingMark
                ? endingMarks.map(({ key: markKey }) => markKey)
                : [],
            },
          ),
      )
      return true
    }
    return false
  }
  if (key === 'Enter') {
    const endingMark = ranges.find(
      (range) => range.to === state.selection.from,
    )
    if (
      endingMark &&
      $from.parentOffset === $from.parent.content.size
    ) {
      const transaction = state.tr.split($from.pos)
      transaction.setStoredMarks([])
      dispatch(transaction)
      return true
    }
    return false
  }
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
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin<MarkerPluginState>({
        key: markersPluginKey,
        state: {
          init: (_config, state) => ({
            continuationKeys: [],
            decorations: buildDecorations(state),
            suppressedKeys: [],
          }),
          apply: (transaction, previous, _oldState, newState) => {
            const markerState = transaction.getMeta(markersPluginKey) as
              | {
                  continuationKeys: string[]
                  suppressedKeys: string[]
                }
              | undefined
            const continuationKeys =
              markerState?.continuationKeys ??
              (transaction.selectionSet && !transaction.docChanged
                ? []
                : previous.continuationKeys)
            const suppressedKeys =
              markerState?.suppressedKeys ??
              (transaction.docChanged ||
              (transaction.selectionSet && !transaction.docChanged)
                ? []
                : previous.suppressedKeys)
            return {
              continuationKeys,
              decorations:
                markerState ||
                transaction.docChanged ||
                transaction.selectionSet
                  ? buildDecorations(newState, suppressedKeys)
                  : previous.decorations,
              suppressedKeys,
            }
          },
        },
        props: {
          decorations(state) {
            return markersPluginKey.getState(state)?.decorations
          },
          handleKeyDown(view, event) {
            if (
              event.key !== 'Backspace' &&
              event.key !== 'Delete' &&
              event.key !== 'ArrowRight' &&
              event.key !== 'Enter'
            ) {
              return false
            }
            const handled = handleMarkerKeyDown(
              view.state,
              view.dispatch,
              event.key,
              markersPluginKey.getState(view.state)?.continuationKeys ?? [],
              markersPluginKey.getState(view.state)?.suppressedKeys ?? [],
            )
            if (handled) event.preventDefault()
            return handled
          },
          handleTextInput(view, from, to, text) {
            const continuationKeys =
              markersPluginKey.getState(view.state)?.continuationKeys ?? []
            if (!continuationKeys.length) return false

            const { $from } = view.state.selection
            const continuingMarks = collectMarkRanges(view.state).filter(
              (range) =>
                range.to === from &&
                continuationKeys.includes(range.key),
            )
            if (
              !continuingMarks.length ||
              $from.parentOffset !== $from.parent.content.size
            ) {
              return false
            }

            const marks = continuingMarks.reduce(
              (current, { mark }) => mark.addToSet(current),
              view.state.storedMarks ?? $from.marks(),
            )
            const transaction = view.state.tr.insertText(text, from, to)
            for (const mark of marks) {
              transaction.addMark(from, from + text.length, mark)
            }
            transaction.setStoredMarks(marks)
            view.dispatch(transaction)
            return true
          },
        },
      }),
    ]
  },
})
