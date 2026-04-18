import PptxGenJS from 'pptxgenjs'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, RootContent, PhrasingContent, TableRow, List, ListItem } from 'mdast'

// ─── Slide dimensions (inches, 16:9) ─────────────────────────────────────────
const SLIDE_W = 10
const SLIDE_H = 5.625
const MARGIN  = 0.5

// ─── Layout system ────────────────────────────────────────────────────────────

/**
 * Tipos de layout disponíveis.
 * Selecione com `<!-- layout: TYPE -->` em qualquer ponto do slide.
 *
 * | Tipo        | Aparência                                               |
 * |-------------|--------------------------------------------------------|
 * | default     | Título no topo, área de conteúdo abaixo                |
 * | two-column  | Título no topo + 2 colunas divididas por `<!-- col -->` |
 * | blank       | Sem título — conteúdo ocupa todo o slide               |
 * | title-only  | Só o título, centralizado verticalmente                |
 * | caption     | Conteúdo/imagem no topo, título como legenda no rodapé |
 */
export type LayoutType = 'default' | 'two-column' | 'blank' | 'title-only' | 'caption'

interface Area { x: number; y: number; w: number; h: number }

// Shared geometry values
const FOOTER_RES = 0.4
const TITLE_Y    = 0.2
const TITLE_H    = 0.9
const BODY_TOP   = TITLE_Y + TITLE_H + 0.15
const BODY_BOT   = SLIDE_H - FOOTER_RES
const BODY_H     = BODY_BOT - BODY_TOP
const COL_GAP    = 0.25
const COL_W      = (SLIDE_W - MARGIN * 2 - COL_GAP) / 2

const LAYOUTS: Record<LayoutType, {
  title?:   Area
  content?: Area
  col1?:    Area
  col2?:    Area
  caption?: Area
}> = {
  /** Título no topo, área única de conteúdo abaixo */
  default: {
    title:   { x: MARGIN, y: TITLE_Y,  w: SLIDE_W - MARGIN * 2, h: TITLE_H },
    content: { x: MARGIN, y: BODY_TOP, w: SLIDE_W - MARGIN * 2, h: BODY_H },
  },
  /** Título no topo, duas colunas de conteúdo */
  'two-column': {
    title: { x: MARGIN,                    y: TITLE_Y,  w: SLIDE_W - MARGIN * 2, h: TITLE_H },
    col1:  { x: MARGIN,                    y: BODY_TOP, w: COL_W,                h: BODY_H },
    col2:  { x: MARGIN + COL_W + COL_GAP, y: BODY_TOP, w: COL_W,                h: BODY_H },
  },
  /** Conteúdo preenche o slide, sem título dedicado */
  blank: {
    content: { x: MARGIN, y: MARGIN, w: SLIDE_W - MARGIN * 2, h: SLIDE_H - MARGIN - FOOTER_RES },
  },
  /** Apenas o título, centralizado verticalmente */
  'title-only': {
    title: { x: MARGIN, y: (SLIDE_H - 1.2) / 2 - 0.2, w: SLIDE_W - MARGIN * 2, h: 1.2 },
  },
  /** Conteúdo/imagem no topo, título como legenda no rodapé */
  caption: {
    content: { x: MARGIN, y: MARGIN, w: SLIDE_W - MARGIN * 2, h: 3.5 },
    caption: { x: MARGIN, y: 3.8,   w: SLIDE_W - MARGIN * 2, h: 1.1 },
  },
}

// ─── Layout directive helpers ─────────────────────────────────────────────────

/** Lê o tipo de layout a partir de `<!-- layout: TYPE -->` nos nós do slide */
export function extractLayout(nodes: RootContent[]): LayoutType {
  for (const node of nodes) {
    if (node.type === 'html') {
      const m = node.value.match(/<!--\s*layout:\s*(\S+)\s*-->/)
      if (m && m[1] in LAYOUTS) return m[1] as LayoutType
    }
  }
  return 'default'
}

/** Remove comentários HTML de diretiva (layout, col) dos nós */
export function filterDirectives(nodes: RootContent[]): RootContent[] {
  return nodes.filter(n => {
    if (n.type !== 'html') return true
    if (/<!--\s*layout:/.test(n.value))  return false
    if (/<!--\s*col\s*-->/.test(n.value)) return false
    return true
  })
}

/**
 * Divide os nós no marcador `<!-- col -->`.
 * Retorna `[coluna1, coluna2]`; se não houver marcador, retorna `[todos, []]`.
 */
export function splitAtCol(nodes: RootContent[]): [RootContent[], RootContent[]] {
  const idx = nodes.findIndex(
    n => n.type === 'html' && /<!--\s*col\s*-->/.test(n.value)
  )
  if (idx === -1) return [nodes, []]
  return [nodes.slice(0, idx), nodes.slice(idx + 1)]
}

// ─── Phrasing / text helpers ──────────────────────────────────────────────────

export function extractText(nodes: PhrasingContent[]): string {
  return nodes.map((n) => {
    if (n.type === 'text') return n.value
    if ('children' in n) return extractText(n.children as PhrasingContent[])
    if (n.type === 'inlineCode') return n.value
    return ''
  }).join('')
}

export function phrasingToRuns(nodes: PhrasingContent[]): PptxGenJS.TextProps[] {
  const runs: PptxGenJS.TextProps[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      runs.push({ text: node.value })
    } else if (node.type === 'strong') {
      const inner = phrasingToRuns(node.children)
      inner.forEach(r => { r.options = { ...(r.options ?? {}), bold: true } })
      runs.push(...inner)
    } else if (node.type === 'emphasis') {
      const inner = phrasingToRuns(node.children)
      inner.forEach(r => { r.options = { ...(r.options ?? {}), italic: true } })
      runs.push(...inner)
    } else if (node.type === 'inlineCode') {
      runs.push({ text: node.value, options: { fontFace: 'Courier New', color: '89b4fa' } })
    } else if ('children' in node) {
      runs.push(...phrasingToRuns(node.children as PhrasingContent[]))
    }
  }
  return runs
}

/**
 * Auto-Shrink: reduz fontSize de 2pt em 2pt até o texto caber na altura disponível.
 */
export function calcFontSize(
  lineCount: number,
  baseSize: number,
  heightInches: number,
  minSize = 12
): number {
  const heightPx = heightInches * 96
  let size = baseSize
  while (size > minSize) {
    if (lineCount * size * 1.4 <= heightPx) break
    size -= 2
  }
  return size
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function urlToBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const mimeType = blob.type || 'image/png'
    return await new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve({ data: (reader.result as string).split(',')[1], mimeType })
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function resizeImage(dataUrl: string, maxW = 1280, maxH = 720): Promise<{ data: string; w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let w = img.naturalWidth
      let h = img.naturalHeight
      const ratio = Math.min(maxW / w, maxH / h, 1)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve({ data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], w, h })
    }
    img.src = dataUrl
  })
}

// ─── List helpers ─────────────────────────────────────────────────────────────

function listItemToRuns(item: ListItem, ordered: boolean, depth: number): PptxGenJS.TextProps[] {
  const runs: PptxGenJS.TextProps[] = []
  const bulletOpts: PptxGenJS.TextPropsOptions = {
    bullet: ordered ? { type: 'number', style: 'arabicPeriod' } : true,
    indentLevel: depth,
    paraSpaceAfter: 2,
  }

  for (const child of item.children) {
    if (child.type === 'paragraph') {
      const phraseRuns = phrasingToRuns(child.children as PhrasingContent[])
      if (phraseRuns.length === 0) continue
      phraseRuns[0].options = { ...(phraseRuns[0].options ?? {}), ...bulletOpts }
      runs.push(...phraseRuns)
    } else if (child.type === 'list') {
      runs.push(...flattenList(child as List, depth + 1))
    }
  }
  return runs
}

export function flattenList(list: List, depth = 0): PptxGenJS.TextProps[] {
  const runs: PptxGenJS.TextProps[] = []
  list.children.forEach((item) => {
    runs.push(...listItemToRuns(item as ListItem, list.ordered ?? false, depth))
  })
  return runs
}

// ─── Content area renderer ────────────────────────────────────────────────────

/**
 * Renderiza uma lista de nós Markdown dentro de uma área do slide.
 * Retorna `true` se o conteúdo ultrapassou a altura da área (overflow).
 */
async function renderContentNodes(
  slide: PptxGenJS.Slide,
  nodes: RootContent[],
  area: Area,
): Promise<boolean> {
  let cursorY = area.y
  const maxY  = area.y + area.h

  for (const node of nodes) {
    if (node.type === 'yaml' || node.type === 'html') continue

    // ── Heading (inside content area = section heading) ──
    if (node.type === 'heading') {
      const text = extractText(node.children as PhrasingContent[])
      slide.addText(text, {
        x: area.x, y: cursorY, w: area.w, h: 0.45,
        fontSize: node.depth <= 2 ? 22 : 18,
        bold: true, color: '313244', fontFace: 'Calibri',
      })
      cursorY += 0.5
      continue
    }

    // ── Image-only paragraph ──
    if (
      node.type === 'paragraph' &&
      node.children.length === 1 &&
      node.children[0].type === 'image'
    ) {
      const imgNode = node.children[0] as { url: string }
      let dataB64: string | null = null
      let mimeType = 'image/jpeg'

      if (imgNode.url.startsWith('data:')) {
        const [header, data] = imgNode.url.split(',')
        dataB64  = data
        mimeType = header.replace('data:', '').replace(';base64', '') || 'image/jpeg'
      } else {
        const fetched = await urlToBase64(imgNode.url)
        if (fetched) { dataB64 = fetched.data; mimeType = fetched.mimeType }
      }

      if (dataB64) {
        const fullUrl = `data:${mimeType};base64,${dataB64}`
        const resized = await resizeImage(fullUrl)
        const aspect  = resized.w / resized.h
        const imgW    = Math.min(area.w, 5)
        const imgH    = imgW / aspect
        slide.addImage({
          data: `image/jpeg;base64,${resized.data}`,
          x: area.x, y: cursorY, w: imgW, h: imgH,
        })
        cursorY += imgH + 0.15
      }
      continue
    }

    // ── Regular paragraph ──
    if (node.type === 'paragraph') {
      const runs   = phrasingToRuns(node.children as PhrasingContent[])
      const text   = runs.map(r => r.text).join('')
      const lines  = Math.max(1, Math.ceil(text.length / 80))
      const fs     = calcFontSize(lines, 18, maxY - cursorY)
      const blockH = Math.min(lines * (fs / 72) * 1.5, maxY - cursorY)
      slide.addText(runs, {
        x: area.x, y: cursorY, w: area.w, h: blockH,
        fontSize: fs, color: '313244', fontFace: 'Calibri', wrap: true,
      })
      cursorY += blockH + 0.1
      continue
    }

    // ── List ──
    if (node.type === 'list') {
      const runs   = flattenList(node as List)
      const nItems = node.children.length
      const fs     = calcFontSize(nItems, 18, maxY - cursorY)
      const blockH = Math.min(nItems * (fs / 72) * 1.6, maxY - cursorY)
      slide.addText(runs, {
        x: area.x, y: cursorY, w: area.w, h: blockH,
        fontSize: fs, color: '313244', fontFace: 'Calibri',
      })
      cursorY += blockH + 0.1
      continue
    }

    // ── Code block ──
    if (node.type === 'code') {
      const lines  = node.value.split('\n')
      const fs     = 12
      const blockH = Math.min(lines.length * (fs / 72) * 1.5, maxY - cursorY)
      slide.addText(node.value, {
        x: area.x, y: cursorY, w: area.w, h: blockH,
        fontSize: fs, fontFace: 'Courier New',
        color: 'cdd6f4', fill: { color: '27273a' }, wrap: true,
      })
      cursorY += blockH + 0.15
      continue
    }

    // ── Table ──
    if (node.type === 'table') {
      const rows  = node.children as TableRow[]
      const nCols = rows[0]?.children.length ?? 1
      const colW  = area.w / nCols
      const tableData = rows.map((row, rowIdx) =>
        row.children.map(cell => ({
          text: extractText(cell.children as PhrasingContent[]),
          options: {
            bold:     rowIdx === 0,
            fill:     rowIdx === 0 ? { color: '89b4fa' } : { color: 'FFFFFF' },
            color:    rowIdx === 0 ? '11111b' : '313244',
            fontSize: 14,
            align:    'center' as const,
            border:   { pt: 1, color: 'e0e0e0' } as PptxGenJS.BorderProps,
          },
        }))
      )
      const tableH = Math.min(rows.length * 0.35 + 0.1, maxY - cursorY)
      slide.addTable(tableData, {
        x: area.x, y: cursorY, w: area.w, h: tableH,
        colW: Array(nCols).fill(colW), rowH: 0.35,
      })
      cursorY += tableH + 0.15
      continue
    }

    // ── Blockquote ──
    if (node.type === 'blockquote') {
      const texts: string[] = []
      for (const child of node.children as RootContent[]) {
        if (child.type === 'paragraph') {
          texts.push(extractText(child.children as PhrasingContent[]))
        }
      }
      const text   = texts.join('\n')
      const lines  = Math.max(1, Math.ceil(text.length / 72))
      const fs     = calcFontSize(lines, 16, maxY - cursorY)
      const blockH = Math.min(lines * (fs / 72) * 1.5, maxY - cursorY)
      slide.addText(text, {
        x: area.x + 0.3, y: cursorY, w: area.w - 0.3, h: blockH,
        fontSize: fs, italic: true, color: '585b70', fontFace: 'Calibri', wrap: true,
      })
      cursorY += blockH + 0.1
      continue
    }
  }

  return cursorY > maxY
}

// ─── Title renderer helper ────────────────────────────────────────────────────

function addTitleText(
  slide: PptxGenJS.Slide,
  nodes: PhrasingContent[],
  area: Area,
  depth: number,
  opts: Partial<PptxGenJS.TextPropsOptions> = {}
) {
  slide.addText(extractText(nodes), {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fontSize: depth === 1 ? 36 : 28,
    bold: true, color: '1e1e2e', fontFace: 'Calibri',
    ...opts,
  })
}

// ─── Slide builder ────────────────────────────────────────────────────────────

async function buildSlide(
  pptx: PptxGenJS,
  allNodes: RootContent[],
  slideIndex: number,
  layout: LayoutType,
): Promise<boolean> {
  const slide = pptx.addSlide()
  slide.background = { color: 'FFFFFF' }

  const geo   = LAYOUTS[layout]
  const nodes = filterDirectives(allNodes)

  // Page number (shared across all layouts)
  slide.addText(`${slideIndex + 1}`, {
    x: SLIDE_W - 0.7, y: SLIDE_H - 0.35, w: 0.5, h: 0.25,
    fontSize: 10, color: 'a6adc8', align: 'right',
  })

  let didOverflow = false

  switch (layout) {

    // ── blank: no title area, content fills the slide ──────────────────────
    case 'blank': {
      if (geo.content) {
        didOverflow = await renderContentNodes(slide, nodes, geo.content)
      }
      break
    }

    // ── title-only: single title, centered vertically ──────────────────────
    case 'title-only': {
      const heading = nodes.find(n => n.type === 'heading')
      if (geo.title && heading?.type === 'heading') {
        addTitleText(slide, heading.children as PhrasingContent[], geo.title, heading.depth, {
          fontSize: 40, align: 'center', valign: 'middle',
        })
      }
      break
    }

    // ── caption: content at top, heading as caption at bottom ──────────────
    case 'caption': {
      const headingIdx = nodes.findIndex(n => n.type === 'heading')
      const heading    = headingIdx >= 0 ? nodes[headingIdx] : null
      const bodyNodes  = nodes.filter((_, i) => i !== headingIdx)

      if (geo.content) {
        didOverflow = await renderContentNodes(slide, bodyNodes, geo.content)
      }
      if (geo.caption && heading?.type === 'heading') {
        // Thin accent line above caption
        slide.addShape(pptx.ShapeType.line, {
          x: MARGIN, y: geo.caption.y - 0.1,
          w: SLIDE_W - MARGIN * 2, h: 0,
          line: { color: '89b4fa', width: 1.5 },
        })
        slide.addText(extractText(heading.children as PhrasingContent[]), {
          x: geo.caption.x, y: geo.caption.y, w: geo.caption.w, h: geo.caption.h,
          fontSize: 24, bold: true, color: '1e1e2e', fontFace: 'Calibri',
        })
      }
      break
    }

    // ── two-column: title at top, content split by <!-- col --> ─────────────
    case 'two-column': {
      const headingIdx = nodes.findIndex(
        n => n.type === 'heading' && (n as { depth: number }).depth <= 2
      )
      const heading   = headingIdx >= 0 ? nodes[headingIdx] : null
      const bodyNodes = nodes.filter((_, i) => i !== headingIdx)
      const [col1, col2] = splitAtCol(bodyNodes)

      if (geo.title && heading?.type === 'heading') {
        addTitleText(slide, heading.children as PhrasingContent[], geo.title, heading.depth)
      }

      // Vertical divider
      slide.addShape(pptx.ShapeType.line, {
        x: MARGIN + COL_W + COL_GAP / 2, y: BODY_TOP,
        w: 0, h: BODY_H,
        line: { color: 'e0e0e0', width: 1 },
      })

      if (geo.col1) {
        const o1 = await renderContentNodes(slide, col1, geo.col1)
        if (o1) didOverflow = true
      }
      if (geo.col2) {
        const o2 = await renderContentNodes(slide, col2, geo.col2)
        if (o2) didOverflow = true
      }
      break
    }

    // ── default: title at top, single content area ──────────────────────────
    default: {
      const headingIdx = nodes.findIndex(
        n => n.type === 'heading' && (n as { depth: number }).depth <= 2
      )
      const heading   = headingIdx >= 0 ? nodes[headingIdx] : null
      const bodyNodes = nodes.filter((_, i) => i !== headingIdx)

      if (geo.title && heading?.type === 'heading') {
        addTitleText(slide, heading.children as PhrasingContent[], geo.title, heading.depth)
      }
      if (geo.content) {
        didOverflow = await renderContentNodes(slide, bodyNodes, geo.content)
      }
      break
    }
  }

  return didOverflow
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Divide o AST em grupos de nós por `---` (thematicBreak) */
export function splitBySlides(ast: Root): RootContent[][] {
  const slides: RootContent[][] = []
  let current: RootContent[] = []

  for (const node of ast.children) {
    if (node.type === 'thematicBreak') {
      slides.push(current)
      current = []
    } else {
      current.push(node)
    }
  }
  slides.push(current)
  return slides.filter(s => s.length > 0)
}

export interface ConvertOptions {
  templateBuffer?: ArrayBuffer
}

export interface ConvertResult {
  /** Números dos slides (1-indexed) cujo conteúdo ultrapassou a altura disponível */
  overflowed: number[]
}

export async function convertToPptx(
  markdown: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const pptx = new PptxGenJS()

  if (options.templateBuffer) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (pptx as any).load(new Uint8Array(options.templateBuffer))
  } else {
    pptx.layout  = 'LAYOUT_WIDE'
    pptx.author  = 'md-pptx'
    pptx.subject = 'Apresentação gerada a partir de Markdown'
  }

  // Strip Marp front-matter before parsing
  const cleaned = markdown.replace(/^---[\s\S]*?---\n?/, '')
  const processor = unified().use(remarkParse).use(remarkGfm)
  const ast = processor.parse(cleaned) as Root
  const slideGroups = splitBySlides(ast)

  if (slideGroups.length === 0) {
    slideGroups.push([{ type: 'paragraph', children: [{ type: 'text', value: '' }] }])
  }

  const overflowed: number[] = []
  for (let i = 0; i < slideGroups.length; i++) {
    const layout     = extractLayout(slideGroups[i])
    const didOverflow = await buildSlide(pptx, slideGroups[i], i, layout)
    if (didOverflow) overflowed.push(i + 1)
  }

  await pptx.writeFile({ fileName: 'apresentacao.pptx' })
  return { overflowed }
}
