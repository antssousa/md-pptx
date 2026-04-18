import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'

const INITIAL_MD = `---
marp: true
---

# Minha Apresentação

Subtítulo ou autor

---

## Slide 2

- Item A
- Item B
- Item C

---

## Slide com Tabela

| Coluna 1 | Coluna 2 | Coluna 3 |
|----------|----------|----------|
| A        | B        | C        |
| D        | E        | F        |

---

## Código

\`\`\`typescript
function hello(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

---

## Fim

Obrigado!
`

export function createEditor(
  mountEl: HTMLElement,
  onChange: (value: string) => void
): EditorView {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString())
    }
  })

  const state = EditorState.create({
    doc: INITIAL_MD,
    extensions: [
      history(),
      lineNumbers(),
      highlightActiveLine(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown({ base: markdownLanguage }),
      oneDark,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      EditorView.theme({
        '&': { height: '100%', backgroundColor: '#060e20' },
        '.cm-content': { caretColor: '#c3c0ff', padding: '12px 0' },
        '.cm-gutters': { backgroundColor: '#060e20', borderRight: '1px solid #1e2840', color: '#464554' },
        '.cm-activeLineGutter': { backgroundColor: '#131b2e' },
        '.cm-activeLine': { backgroundColor: '#131b2e88' },
        '.cm-cursor': { borderLeftColor: '#c3c0ff' },
        '.cm-selectionBackground, ::selection': { backgroundColor: '#2d344988' },
      }),
      EditorView.lineWrapping,
    ],
  })

  const view = new EditorView({ state, parent: mountEl })
  return view
}

export function getEditorValue(view: EditorView): string {
  return view.state.doc.toString()
}

/** Wraps the current selection (or cursor) with a prefix and suffix. */
export function insertAround(view: EditorView, before: string, after: string): void {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  view.dispatch({
    changes: { from, to, insert: before + selected + after },
    selection: { anchor: from + before.length, head: from + before.length + selected.length },
  })
}

/** Inserts a prefix at the start of the current line. */
export function insertAtLineStart(view: EditorView, prefix: string): void {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  view.dispatch({
    changes: { from: line.from, insert: prefix },
    selection: { anchor: line.from + prefix.length },
  })
}
