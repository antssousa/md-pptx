import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, PhrasingContent, List, RootContent } from 'mdast'

import {
  calcFontSize,
  extractText,
  phrasingToRuns,
  splitBySlides,
  flattenList,
  countAllListItems,
  extractLayout,
  extractLayoutConfig,
  filterDirectives,
  splitAtCol,
} from '../converter'

// ─── Mock PptxGenJS (hoisted pelo Vitest) ─────────────────────────────────────
const mockAddSlide = vi.fn()
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockAddShape = vi.fn()

vi.mock('pptxgenjs', () => ({
  default: class MockPptx {
    layout  = ''
    author  = ''
    subject = ''
    ShapeType = { line: 'line' }
    addSlide() {
      const slide = {
        background: {} as Record<string, unknown>,
        addText:  vi.fn(),
        addImage: vi.fn(),
        addTable: vi.fn(),
        addShape: mockAddShape,
      }
      mockAddSlide(slide)
      return slide
    }
    writeFile = mockWriteFile
  },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAst(md: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as Root
}

function makeHtmlNode(value: string): RootContent {
  return { type: 'html', value } as RootContent
}

// ─── calcFontSize ─────────────────────────────────────────────────────────────

describe('calcFontSize', () => {
  it('retorna baseSize quando o conteúdo cabe na altura', () => {
    expect(calcFontSize(1, 24, 4)).toBe(24)
  })

  it('reduz o tamanho quando o conteúdo extrapola a altura', () => {
    const result = calcFontSize(40, 24, 1)
    expect(result).toBeLessThan(24)
    expect(result).toBeGreaterThanOrEqual(12)
  })

  it('nunca vai abaixo do minSize padrão (12)', () => {
    expect(calcFontSize(1000, 36, 0.5)).toBe(12)
  })

  it('respeita minSize customizado', () => {
    expect(calcFontSize(1000, 36, 0.5, 8)).toBe(8)
  })

  it('retorna baseSize quando lineCount é 0', () => {
    expect(calcFontSize(0, 18, 4)).toBe(18)
  })

  it('reduz fonte quando 11 linhas a 18pt não cabem em 3.5 polegadas', () => {
    // 11 linhas × 18pt × 1.4 leading = 277.2pt > 3.5in × 72pt/in = 252pt → deve reduzir
    const result = calcFontSize(11, 18, 3.5)
    expect(result).toBeLessThan(18)
  })

  it('mantém 18pt para 10 linhas em 3.5 polegadas (limite exato)', () => {
    // 10 linhas × 18pt × 1.4 = 252pt = 3.5in × 72pt/in → cabe
    expect(calcFontSize(10, 18, 3.5)).toBe(18)
  })
})

// ─── extractText ──────────────────────────────────────────────────────────────

describe('extractText', () => {
  it('extrai texto plano', () => {
    const nodes: PhrasingContent[] = [{ type: 'text', value: 'Hello world' }]
    expect(extractText(nodes)).toBe('Hello world')
  })

  it('extrai texto de strong aninhado', () => {
    const nodes: PhrasingContent[] = [
      { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
    ]
    expect(extractText(nodes)).toBe('bold')
  })

  it('extrai texto de emphasis aninhado', () => {
    const nodes: PhrasingContent[] = [
      { type: 'emphasis', children: [{ type: 'text', value: 'italic' }] },
    ]
    expect(extractText(nodes)).toBe('italic')
  })

  it('extrai valor de inlineCode', () => {
    const nodes: PhrasingContent[] = [{ type: 'inlineCode', value: 'const x = 1' }]
    expect(extractText(nodes)).toBe('const x = 1')
  })

  it('concatena múltiplos nós', () => {
    const nodes: PhrasingContent[] = [
      { type: 'text', value: 'Hello ' },
      { type: 'strong', children: [{ type: 'text', value: 'world' }] },
    ]
    expect(extractText(nodes)).toBe('Hello world')
  })

  it('retorna string vazia para tipos desconhecidos', () => {
    // @ts-expect-error — tipo intencional para teste de robustez
    const nodes: PhrasingContent[] = [{ type: 'unknown' }]
    expect(extractText(nodes)).toBe('')
  })
})

// ─── phrasingToRuns ───────────────────────────────────────────────────────────

describe('phrasingToRuns', () => {
  it('cria run de texto plano sem opções', () => {
    const nodes: PhrasingContent[] = [{ type: 'text', value: 'plain' }]
    const runs = phrasingToRuns(nodes)
    expect(runs).toHaveLength(1)
    expect(runs[0].text).toBe('plain')
    expect(runs[0].options).toBeUndefined()
  })

  it('aplica bold em filhos de strong', () => {
    const nodes: PhrasingContent[] = [
      { type: 'strong', children: [{ type: 'text', value: 'bold text' }] },
    ]
    expect(phrasingToRuns(nodes)[0].options?.bold).toBe(true)
  })

  it('aplica italic em filhos de emphasis', () => {
    const nodes: PhrasingContent[] = [
      { type: 'emphasis', children: [{ type: 'text', value: 'italic text' }] },
    ]
    expect(phrasingToRuns(nodes)[0].options?.italic).toBe(true)
  })

  it('aplica fonte monoespaçada em inlineCode', () => {
    const nodes: PhrasingContent[] = [{ type: 'inlineCode', value: 'code' }]
    const runs = phrasingToRuns(nodes)
    expect(runs[0].options?.fontFace).toBe('Courier New')
    expect(runs[0].options?.color).toBe('89b4fa')
  })

  it('combina bold e texto plano corretamente', () => {
    const nodes: PhrasingContent[] = [
      { type: 'text', value: 'prefix ' },
      { type: 'strong', children: [{ type: 'text', value: 'bold' }] },
      { type: 'text', value: ' suffix' },
    ]
    const runs = phrasingToRuns(nodes)
    expect(runs).toHaveLength(3)
    expect(runs[1].options?.bold).toBe(true)
  })

  it('retorna array vazio para lista vazia', () => {
    expect(phrasingToRuns([])).toEqual([])
  })
})

// ─── splitBySlides ────────────────────────────────────────────────────────────

describe('splitBySlides', () => {
  it('retorna um único grupo quando não há separador', () => {
    const ast = parseAst('# Hello\n\nParagraph.')
    expect(splitBySlides(ast)).toHaveLength(1)
  })

  it('divide em dois grupos com um separador ---', () => {
    const ast = parseAst('# Slide 1\n\n---\n\n# Slide 2')
    expect(splitBySlides(ast)).toHaveLength(2)
  })

  it('divide em três grupos com dois separadores', () => {
    const ast = parseAst('# A\n\n---\n\n# B\n\n---\n\n# C')
    expect(splitBySlides(ast)).toHaveLength(3)
  })

  it('nunca retorna grupos vazios', () => {
    const ast = parseAst('---\n\n# Slide 1')
    splitBySlides(ast).forEach(g => expect(g.length).toBeGreaterThan(0))
  })

  it('cada grupo contém os tipos de nó corretos', () => {
    const ast = parseAst('# Title\n\nText.\n\n---\n\n- item')
    const groups = splitBySlides(ast)
    expect(groups[0].some(n => n.type === 'heading')).toBe(true)
    expect(groups[1].some(n => n.type === 'list')).toBe(true)
  })
})

// ─── flattenList ──────────────────────────────────────────────────────────────

describe('flattenList', () => {
  it('achata lista não-ordenada simples', () => {
    const ast = parseAst('- item one\n- item two\n- item three')
    const listNode = ast.children[0] as List
    const texts = flattenList(listNode).map(r => r.text).join(' ')
    expect(texts).toContain('item one')
    expect(texts).toContain('item two')
    expect(texts).toContain('item three')
  })

  it('usa bullet numerado para lista ordenada', () => {
    const ast = parseAst('1. first\n2. second')
    const runs = flattenList(ast.children[0] as List)
    expect(runs[0].options?.bullet).toMatchObject({ type: 'number' })
  })

  it('aplica indentLevel correto em sub-lista aninhada', () => {
    const ast = parseAst('- parent\n  - child')
    const runs = flattenList(ast.children[0] as List)
    const childRun = runs.find(r => r.text === 'child')
    expect(childRun?.options?.indentLevel).toBeGreaterThan(0)
  })

  it('aplica bold em itens com texto negrito', () => {
    const ast = parseAst('- **bold item**')
    const runs = flattenList(ast.children[0] as List)
    expect(runs.some(r => r.options?.bold === true)).toBe(true)
  })

  it('retorna array vazio para lista sem itens', () => {
    const emptyList: List = { type: 'list', ordered: false, spread: false, children: [] }
    expect(flattenList(emptyList)).toEqual([])
  })
})

// ─── countAllListItems ────────────────────────────────────────────────────────

describe('countAllListItems', () => {
  it('conta itens de lista simples corretamente', () => {
    const ast = parseAst('- a\n- b\n- c')
    const list = ast.children[0] as List
    expect(countAllListItems(list)).toBe(3)
  })

  it('conta itens aninhados recursivamente', () => {
    const ast = parseAst('- parent\n  - child1\n  - child2')
    const list = ast.children[0] as List
    // 1 parent + 2 children = 3
    expect(countAllListItems(list)).toBe(3)
  })

  it('retorna 0 para lista vazia', () => {
    const emptyList: List = { type: 'list', ordered: false, spread: false, children: [] }
    expect(countAllListItems(emptyList)).toBe(0)
  })
})

// ─── extractLayout ────────────────────────────────────────────────────────────

describe('extractLayout', () => {
  it('retorna "default" quando não há diretiva de layout', () => {
    const nodes: RootContent[] = [{ type: 'paragraph', children: [{ type: 'text', value: 'txt' }] }]
    expect(extractLayout(nodes)).toBe('default')
  })

  it('detecta layout "blank"', () => {
    expect(extractLayout([makeHtmlNode('<!-- layout: blank -->')])).toBe('blank')
  })

  it('detecta layout "two-column"', () => {
    expect(extractLayout([makeHtmlNode('<!-- layout: two-column -->')])).toBe('two-column')
  })

  it('detecta layout "title-only"', () => {
    expect(extractLayout([makeHtmlNode('<!-- layout: title-only -->')])).toBe('title-only')
  })

  it('detecta layout "caption"', () => {
    expect(extractLayout([makeHtmlNode('<!-- layout: caption -->')])).toBe('caption')
  })

  it('ignora diretivas de layout inválidas e retorna "default"', () => {
    expect(extractLayout([makeHtmlNode('<!-- layout: nao-existe -->')])).toBe('default')
  })

  it('detecta layout mesmo com espaços extras no comentário', () => {
    expect(extractLayout([makeHtmlNode('<!--  layout:  blank  -->')])).toBe('blank')
  })

  it('ignora nós que não são html', () => {
    const nodes: RootContent[] = [
      { type: 'paragraph', children: [{ type: 'text', value: 'layout: blank' }] },
    ]
    expect(extractLayout(nodes)).toBe('default')
  })
})

describe('extractLayoutConfig', () => {
  it('retorna proporcao padrao para two-column sem configuracao explicita', () => {
    const config = extractLayoutConfig([makeHtmlNode('<!-- layout: two-column -->')])
    expect(config.layout).toBe('two-column')
    expect(config.twoColumnRatio).toEqual({ left: 1, right: 1 })
  })

  it('retorna proporcao customizada para two-column', () => {
    const config = extractLayoutConfig([makeHtmlNode('<!-- layout: two-column 40/60 -->')])
    expect(config.layout).toBe('two-column')
    expect(config.twoColumnRatio).toEqual({ left: 40, right: 60 })
  })

  it('ignora proporcao invalida e usa fallback 50/50', () => {
    const config = extractLayoutConfig([makeHtmlNode('<!-- layout: two-column 40/0 -->')])
    expect(config.layout).toBe('two-column')
    expect(config.twoColumnRatio).toEqual({ left: 1, right: 1 })
  })
})

// ─── filterDirectives ─────────────────────────────────────────────────────────

describe('filterDirectives', () => {
  it('remove nó com diretiva <!-- layout: ... -->', () => {
    const nodes: RootContent[] = [
      makeHtmlNode('<!-- layout: blank -->'),
      { type: 'paragraph', children: [{ type: 'text', value: 'content' }] },
    ]
    const filtered = filterDirectives(nodes)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].type).toBe('paragraph')
  })

  it('remove nó com diretiva <!-- col -->', () => {
    const nodes: RootContent[] = [
      { type: 'paragraph', children: [{ type: 'text', value: 'left' }] },
      makeHtmlNode('<!-- col -->'),
      { type: 'paragraph', children: [{ type: 'text', value: 'right' }] },
    ]
    const filtered = filterDirectives(nodes)
    expect(filtered).toHaveLength(2)
    expect(filtered.some(n => n.type === 'html')).toBe(false)
  })

  it('preserva nós html que não são diretivas', () => {
    const nodes: RootContent[] = [
      makeHtmlNode('<br/>'),
      { type: 'paragraph', children: [{ type: 'text', value: 'text' }] },
    ]
    const filtered = filterDirectives(nodes)
    expect(filtered).toHaveLength(2)
  })

  it('retorna lista vazia para entrada vazia', () => {
    expect(filterDirectives([])).toEqual([])
  })
})

// ─── splitAtCol ───────────────────────────────────────────────────────────────

describe('splitAtCol', () => {
  it('divide nodes no marcador <!-- col -->', () => {
    const nodes: RootContent[] = [
      { type: 'paragraph', children: [{ type: 'text', value: 'left' }] },
      makeHtmlNode('<!-- col -->'),
      { type: 'paragraph', children: [{ type: 'text', value: 'right' }] },
    ]
    const [col1, col2] = splitAtCol(nodes)
    expect(col1).toHaveLength(1)
    expect(col2).toHaveLength(1)
    expect((col1[0] as { children: Array<{ value: string }> }).children[0].value).toBe('left')
    expect((col2[0] as { children: Array<{ value: string }> }).children[0].value).toBe('right')
  })

  it('retorna [todos, []] quando não há marcador <!-- col -->', () => {
    const nodes: RootContent[] = [
      { type: 'paragraph', children: [{ type: 'text', value: 'only' }] },
    ]
    const [col1, col2] = splitAtCol(nodes)
    expect(col1).toHaveLength(1)
    expect(col2).toHaveLength(0)
  })

  it('divide na primeira ocorrência de <!-- col -->', () => {
    const nodes: RootContent[] = [
      { type: 'paragraph', children: [{ type: 'text', value: 'a' }] },
      makeHtmlNode('<!-- col -->'),
      { type: 'paragraph', children: [{ type: 'text', value: 'b' }] },
      makeHtmlNode('<!-- col -->'),
      { type: 'paragraph', children: [{ type: 'text', value: 'c' }] },
    ]
    const [col1, col2] = splitAtCol(nodes)
    expect(col1).toHaveLength(1)
    expect(col2).toHaveLength(3) // inclui segundo <!-- col --> e 'c'
  })

  it('retorna coluna esquerda vazia quando <!-- col --> é o primeiro nó', () => {
    const nodes: RootContent[] = [
      makeHtmlNode('<!-- col -->'),
      { type: 'paragraph', children: [{ type: 'text', value: 'right' }] },
    ]
    const [col1, col2] = splitAtCol(nodes)
    expect(col1).toHaveLength(0)
    expect(col2).toHaveLength(1)
  })

  it('retorna coluna direita vazia quando <!-- col --> é o último nó', () => {
    const nodes: RootContent[] = [
      { type: 'paragraph', children: [{ type: 'text', value: 'left' }] },
      makeHtmlNode('<!-- col -->'),
    ]
    const [col1, col2] = splitAtCol(nodes)
    expect(col1).toHaveLength(1)
    expect(col2).toHaveLength(0)
  })
})

// ─── convertToPptx (integração) ───────────────────────────────────────────────

describe('convertToPptx', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockAddSlide.mockClear()
    mockWriteFile.mockClear()
    mockAddShape.mockClear()
  })

  it('layout default: gera PPTX sem overflow para slide simples', async () => {
    const { convertToPptx } = await import('../converter')
    const result = await convertToPptx('# Hello\n\nThis is a test slide.')
    expect(result.overflowed).toEqual([])
    expect(mockWriteFile).toHaveBeenCalledTimes(1)
  })

  it('layout default: detecta overflow quando conteúdo excede altura', async () => {
    const { convertToPptx } = await import('../converter')
    const overflow = Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}`).join('\n\n')
    const result = await convertToPptx(overflow)
    expect(result.overflowed).toContain(1)
  })

  it('layout default: cria um slide por seção separada por ---', async () => {
    const { convertToPptx } = await import('../converter')
    await convertToPptx('# Slide 1\n\n---\n\n# Slide 2\n\n---\n\n# Slide 3')
    expect(mockAddSlide).toHaveBeenCalledTimes(3)
  })

  it('layout default: fallback para slide vazio quando markdown é vazio', async () => {
    const { convertToPptx } = await import('../converter')
    const result = await convertToPptx('')
    expect(mockAddSlide).toHaveBeenCalledTimes(1)
    expect(result).toHaveProperty('overflowed')
  })

  it('layout default: remove front-matter Marp antes de processar', async () => {
    const { convertToPptx } = await import('../converter')
    const md = `---\nmarp: true\n---\n\n# Slide`
    await convertToPptx(md)
    expect(mockAddSlide).toHaveBeenCalledTimes(1)
  })

  it('layout blank: reconhece diretiva e cria slide', async () => {
    const { convertToPptx } = await import('../converter')
    await convertToPptx('<!-- layout: blank -->\n\nConteúdo sem título')
    expect(mockAddSlide).toHaveBeenCalledTimes(1)
  })

  it('layout title-only: reconhece diretiva e cria slide', async () => {
    const { convertToPptx } = await import('../converter')
    await convertToPptx('<!-- layout: title-only -->\n\n# Título Centralizado')
    expect(mockAddSlide).toHaveBeenCalledTimes(1)
  })

  it('layout caption: reconhece diretiva e cria slide', async () => {
    const { convertToPptx } = await import('../converter')
    await convertToPptx('<!-- layout: caption -->\n\nConteúdo principal\n\n# Legenda do slide')
    expect(mockAddSlide).toHaveBeenCalledTimes(1)
  })

  it('layout two-column: reconhece diretiva e cria slide com divisor', async () => {
    const { convertToPptx } = await import('../converter')
    await convertToPptx(
      '<!-- layout: two-column -->\n# Título\n\nColuna esquerda\n\n<!-- col -->\n\nColuna direita'
    )
    expect(mockAddSlide).toHaveBeenCalledTimes(1)
    // Deve ter chamado addShape para a linha divisória
    expect(mockAddShape).toHaveBeenCalled()
  })

  it('layout two-column: aplica largura customizada nas colunas do slide', async () => {
    const { convertToPptx } = await import('../converter')
    await convertToPptx(
      '<!-- layout: two-column 40/60 -->\n# Título\n\nColuna esquerda\n\n<!-- col -->\n\nColuna direita'
    )

    const slide = mockAddSlide.mock.calls[0][0]
    const bodyCalls = slide.addText.mock.calls.filter(([content]: [unknown, unknown]) => {
      const serialized = JSON.stringify(content)
      return serialized.includes('Coluna esquerda') || serialized.includes('Coluna direita')
    })
    expect(bodyCalls).toHaveLength(2)
    expect(bodyCalls[0][1].w).toBeCloseTo(3.5, 3)
    expect(bodyCalls[1][1].w).toBeCloseTo(5.25, 3)
  })

  it('bloco mermaid: exporta SVG com proporcao derivada do viewBox', async () => {
    const mermaidModule = await import('../mermaid')
    vi.spyOn(mermaidModule, 'renderMermaidSvg').mockResolvedValue(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="400" height="200" /></svg>'
    )

    const { convertToPptx } = await import('../converter')
    await convertToPptx('```mermaid\nflowchart TD\nA-->B\n```')

    const slide = mockAddSlide.mock.calls[0][0]
    expect(slide.addImage).toHaveBeenCalledTimes(1)

    const mermaidImageCall = slide.addImage.mock.calls[0][0]
    expect(mermaidImageCall.data).toContain('image/svg+xml;base64,')
    expect(mermaidImageCall.w / mermaidImageCall.h).toBeCloseTo(2, 3)
  })

  it('layouts diferentes em slides diferentes', async () => {
    const { convertToPptx } = await import('../converter')
    const md = [
      '# Padrão',
      '---',
      '<!-- layout: blank -->\nSem título',
      '---',
      '<!-- layout: two-column -->\n# Cols\n\nEsq\n\n<!-- col -->\n\nDir',
      '---',
      '<!-- layout: title-only -->\n# Só título',
      '---',
      '<!-- layout: caption -->\nImagem\n\n# Legenda',
    ].join('\n\n')

    const result = await convertToPptx(md)
    expect(mockAddSlide).toHaveBeenCalledTimes(5)
    expect(result).toHaveProperty('overflowed')
  })
})
