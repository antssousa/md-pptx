import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'

export const INITIAL_MD = `---
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
  onChange: (value: string) => void,
  initialDoc?: string
): EditorView {
  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString())
    }
  })

  const state = EditorState.create({
    doc: initialDoc ?? INITIAL_MD,
    extensions: [
      history(),
      lineNumbers(),
      highlightActiveLine(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      markdown({ base: markdownLanguage }),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      EditorView.theme({
        '&': {
          height: '100%',
          backgroundColor: 'var(--editor-bg)',
          color: 'var(--editor-text)',
          fontFamily: "'JetBrains Mono', monospace",
        },
        '.cm-content': {
          caretColor: 'var(--accent)',
          padding: '16px 0',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12.5px',
          lineHeight: '1.7',
        },
        '.cm-gutters': {
          backgroundColor: 'var(--editor-gutter-bg)',
          borderRight: '1px solid var(--editor-gutter-border)',
          color: 'var(--editor-gutter-text)',
          fontFamily: "'JetBrains Mono', monospace",
        },
        '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)' },
        '.cm-activeLine': { backgroundColor: 'var(--editor-active-line-soft)' },
        '.cm-cursor': { borderLeftColor: 'var(--accent)' },
        '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--editor-selection)' },
        '.cm-lineNumbers .cm-gutterElement': { paddingRight: '12px' },
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

/** Replaces the entire editor content. */
export function setEditorContent(view: EditorView, content: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: content },
    selection: { anchor: 0 },
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

/** Inserts a full line at the cursor position (end of current line). */
export function insertLine(view: EditorView, text: string): void {
  const { from } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  view.dispatch({
    changes: { from: line.from, insert: text + '\n' },
    selection: { anchor: line.from + text.length + 1 },
  })
}
