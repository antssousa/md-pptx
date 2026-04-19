import { describe, it, expect } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { insertAround, insertAtLineStart, insertLine, setEditorContent } from '../editor'

function makeView(doc: string): EditorView {
  const state = EditorState.create({ doc })
  return new EditorView({ state })
}

describe('insertAround', () => {
  it('envolve a seleção com o prefixo e sufixo', () => {
    const view = makeView('hello world')
    // seleciona "hello"
    view.dispatch({ selection: { anchor: 0, head: 5 } })
    insertAround(view, '**', '**')
    expect(view.state.doc.toString()).toBe('**hello** world')
  })

  it('insere prefix+suffix no cursor quando não há seleção', () => {
    const view = makeView('hello')
    view.dispatch({ selection: { anchor: 5 } })
    insertAround(view, '[', '](url)')
    expect(view.state.doc.toString()).toBe('hello[](url)')
  })
})

describe('insertAtLineStart', () => {
  it('insere prefixo no início da linha do cursor', () => {
    const view = makeView('line one\nline two')
    view.dispatch({ selection: { anchor: 12 } }) // dentro de "line two"
    insertAtLineStart(view, '## ')
    expect(view.state.doc.toString()).toBe('line one\n## line two')
  })
})

describe('insertLine', () => {
  it('insere uma linha inteira antes do conteúdo na posição do cursor', () => {
    const view = makeView('# Slide\n\nContent')
    view.dispatch({ selection: { anchor: 0 } })
    insertLine(view, '<!-- layout: blank -->')
    expect(view.state.doc.toString()).toContain('<!-- layout: blank -->\n')
  })

  it('não apaga conteúdo existente', () => {
    const view = makeView('# Meu Slide')
    view.dispatch({ selection: { anchor: 0 } })
    insertLine(view, '<!-- layout: two-column -->')
    const content = view.state.doc.toString()
    expect(content).toContain('<!-- layout: two-column -->')
    expect(content).toContain('# Meu Slide')
  })

  it('insere <!-- col --> como separador de coluna', () => {
    const view = makeView('Left content\nRight content')
    view.dispatch({ selection: { anchor: 4 } })
    insertLine(view, '<!-- col -->')
    expect(view.state.doc.toString()).toContain('<!-- col -->')
  })
})

describe('setEditorContent', () => {
  it('substitui todo o conteúdo do editor', () => {
    const view = makeView('conteúdo antigo')
    setEditorContent(view, 'novo conteúdo')
    expect(view.state.doc.toString()).toBe('novo conteúdo')
  })

  it('posiciona o cursor no início após substituição', () => {
    const view = makeView('old')
    setEditorContent(view, 'new content here')
    expect(view.state.selection.main.from).toBe(0)
  })
})
