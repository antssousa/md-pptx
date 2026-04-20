import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import type { Root, RootContent, PhrasingContent, TableRow, List, ListItem } from 'mdast'
import type PptxGenJS from 'pptxgenjs'
import type { Highlighter, BundledLanguage, BundledTheme } from 'shiki'
import {
  DEFAULT_TWO_COLUMN_RATIO,
  parseLayoutDirective,
  type LayoutType,
  type TwoColumnRatio,
} from './layout-directives'
import { DEFAULT_THEME, type Theme, type ThemeColors } from './themes'
import { extractSvgAspectRatio, renderMermaidSvg, svgToDataUrl } from './mermaid'

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
export type { LayoutType } from './layout-directives'

export interface LayoutConfig {
  layout: LayoutType
  twoColumnRatio?: TwoColumnRatio
}

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
  return extractLayoutConfig(nodes).layout
}

export function extractLayoutConfig(nodes: RootContent[]): LayoutConfig {
  for (const node of nodes) {
    if (node.type === 'html') {
      const directive = parseLayoutDirective(node.value)
      if (directive) {
        if (directive.layout === 'two-column') {
          return {
            layout: directive.layout,
            twoColumnRatio: directive.twoColumnRatio ?? { ...DEFAULT_TWO_COLUMN_RATIO },
          }
        }
        return { layout: directive.layout }
      }
    }
  }
  return { layout: 'default' }
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

export function phrasingToRuns(nodes: PhrasingContent[], colors?: ThemeColors): PptxGenJS.TextProps[] {
  const inlineCodeColor = colors?.inlineCodeColor ?? '89b4fa'
  const runs: PptxGenJS.TextProps[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      runs.push({ text: node.value })
    } else if (node.type === 'strong') {
      const inner = phrasingToRuns(node.children, colors)
      inner.forEach(r => { r.options = { ...(r.options ?? {}), bold: true } })
      runs.push(...inner)
    } else if (node.type === 'emphasis') {
      const inner = phrasingToRuns(node.children, colors)
      inner.forEach(r => { r.options = { ...(r.options ?? {}), italic: true } })
      runs.push(...inner)
    } else if (node.type === 'inlineCode') {
      runs.push({ text: node.value, options: { fontFace: 'Courier New', color: inlineCodeColor } })
    } else if ('children' in node) {
      runs.push(...phrasingToRuns(node.children as PhrasingContent[], colors))
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
  // Use points (72pt = 1in) so units match: size is in pt, leading factor 1.4
  const heightPt = heightInches * 72
  let size = baseSize
  while (size > minSize) {
    if (lineCount * size * 1.4 <= heightPt) break
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

function parseImageSource(url: string): { kind: 'data'; data: string; mimeType: string } | { kind: 'remote'; url: string } | null {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (!match) return null
    return { kind: 'data', mimeType: match[1], data: match[2] }
  }

  if (/^https?:\/\//i.test(url)) {
    return { kind: 'remote', url }
  }

  return null
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

// ─── Shiki syntax highlighting ────────────────────────────────────────────────

const SHIKI_THEME_MAP: Record<string, BundledTheme> = {
  'dark-catppuccin': 'catppuccin-mocha',
  'corporate-clean': 'github-light',
  'minimal-light':   'github-light',
}

const HIGHLIGHT_LANGS: BundledLanguage[] = [
  'javascript', 'typescript', 'tsx', 'jsx',
  'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust',
  'bash', 'sh', 'json', 'yaml', 'html', 'css', 'sql',
  'markdown', 'xml', 'php', 'ruby', 'swift', 'kotlin', 'scala',
]

let _highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!_highlighterPromise) {
    _highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['catppuccin-mocha', 'github-light'] as BundledTheme[],
        langs: HIGHLIGHT_LANGS,
      })
    )
  }
  return _highlighterPromise
}

async function tokenizeCode(
  code: string,
  lang: string | null | undefined,
  themeId: string,
): Promise<PptxGenJS.TextProps[]> {
  const normalLang = (lang ?? '').trim().toLowerCase()

  // No language → plain text, skip Shiki
  if (!normalLang || normalLang === 'text' || normalLang === 'plaintext') {
    return [{ text: code, options: { fontFace: 'Courier New' } }]
  }

  const shikiTheme = SHIKI_THEME_MAP[themeId] ?? 'catppuccin-mocha'

  try {
    const highlighter = await getHighlighter()
    const result = highlighter.codeToTokens(code, { lang: normalLang as BundledLanguage, theme: shikiTheme })
    const runs: PptxGenJS.TextProps[] = []

    for (let i = 0; i < result.tokens.length; i++) {
      const lineTokens = result.tokens[i]
      for (const token of lineTokens) {
        if (!token.content) continue
        const color  = token.color ? token.color.replace('#', '') : undefined
        const italic = Boolean(token.fontStyle && (token.fontStyle & 1))
        const bold   = Boolean(token.fontStyle && (token.fontStyle & 2))
        runs.push({
          text: token.content,
          options: {
            fontFace: 'Courier New',
            ...(color  ? { color }  : {}),
            ...(italic ? { italic } : {}),
            ...(bold   ? { bold }   : {}),
          },
        })
      }
      if (i < result.tokens.length - 1) {
        runs.push({ text: '\n', options: { fontFace: 'Courier New' } })
      }
    }

    return runs.length > 0 ? runs : [{ text: code, options: { fontFace: 'Courier New' } }]
  } catch {
    // Unknown language or error — plain text fallback
    return [{ text: code, options: { fontFace: 'Courier New' } }]
  }
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

/** Conta todos os itens da lista incluindo sub-itens aninhados */
export function countAllListItems(list: List): number {
  let count = 0
  for (const item of list.children as ListItem[]) {
    count++
    for (const child of item.children) {
      if (child.type === 'list') count += countAllListItems(child as List)
    }
  }
  return count
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
  colors: ThemeColors,
  themeId: string,
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
        bold: true, color: colors.bodyColor, fontFace: 'Calibri',
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
      const parsedSource = parseImageSource(imgNode.url)
      let dataB64: string | null = null
      let mimeType = 'image/jpeg'

      if (parsedSource?.kind === 'data') {
        dataB64 = parsedSource.data
        mimeType = parsedSource.mimeType
      } else if (parsedSource?.kind === 'remote') {
        const fetched = await urlToBase64(parsedSource.url)
        if (fetched) {
          dataB64 = fetched.data
          mimeType = fetched.mimeType
        }
      }

      if (dataB64) {
        const fullUrl = `data:${mimeType};base64,${dataB64}`
        let imgData = `image/jpeg;base64,${dataB64}`
        let aspect = 16 / 9

        try {
          const resized = await Promise.race([
            resizeImage(fullUrl),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200)),
          ])

          if (resized) {
            imgData = `image/jpeg;base64,${resized.data}`
            aspect = resized.w / resized.h
          } else {
            imgData = `${mimeType};base64,${dataB64}`
          }
        } catch {
          imgData = `${mimeType};base64,${dataB64}`
        }

        const imgW = Math.min(area.w, 5)
        const imgH = imgW / aspect
        slide.addImage({
          data: imgData,
          x: area.x, y: cursorY, w: imgW, h: imgH,
        })
        cursorY += imgH + 0.15
      }
      continue
    }

    // ── Regular paragraph ──
    if (node.type === 'paragraph') {
      const runs   = phrasingToRuns(node.children as PhrasingContent[], colors)
      const text   = runs.map(r => r.text).join('')
      // ~10 chars per inch for Calibri 18pt; adapts to area width (e.g. columns)
      const charsPerLine = Math.max(20, Math.round(area.w * 10))
      const lines  = Math.max(1, Math.ceil(text.length / charsPerLine))
      const fs     = calcFontSize(lines, 18, maxY - cursorY)
      const blockH = Math.min(lines * (fs / 72) * 1.5, maxY - cursorY)
      slide.addText(runs, {
        x: area.x, y: cursorY, w: area.w, h: blockH,
        fontSize: fs, color: colors.bodyColor, fontFace: 'Calibri', wrap: true,
      })
      cursorY += blockH + 0.1
      continue
    }

    // ── List ──
    if (node.type === 'list') {
      const runs   = flattenList(node as List)
      const nItems = countAllListItems(node as List)
      const fs     = calcFontSize(nItems, 18, maxY - cursorY)
      const blockH = Math.min(nItems * (fs / 72) * 1.6, maxY - cursorY)
      slide.addText(runs, {
        x: area.x, y: cursorY, w: area.w, h: blockH,
        fontSize: fs, color: colors.bodyColor, fontFace: 'Calibri',
      })
      cursorY += blockH + 0.1
      continue
    }

    // ── Mermaid diagram ──
    if (node.type === 'code' && node.lang === 'mermaid') {
      const svg = await renderMermaidSvg(node.value, themeId)
      if (svg) {
        const aspect = extractSvgAspectRatio(svg) ?? 16 / 9
        const imgW = Math.min(area.w, (maxY - cursorY) * aspect)
        const imgH = imgW / aspect
        const xOffset = (area.w - imgW) / 2
        slide.addImage({
          data: svgToDataUrl(svg).replace(/^data:/, ''),
          x: area.x + xOffset, y: cursorY, w: imgW, h: imgH,
        })
        cursorY += imgH + 0.15
      }
      continue
    }

    // ── Code block ──
    if (node.type === 'code') {
      const lines  = node.value.split('\n')
      const fs     = 12
      const blockH = Math.min(lines.length * (fs / 72) * 1.5, maxY - cursorY)
      const runs   = await tokenizeCode(node.value, node.lang, themeId)
      slide.addText(runs, {
        x: area.x, y: cursorY, w: area.w, h: blockH,
        fontSize: fs, fontFace: 'Courier New',
        color: colors.codeText, fill: { color: colors.codeBackground }, wrap: true,
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
            fill:     rowIdx === 0
              ? { color: colors.tableHeaderFill }
              : { color: colors.background },
            color:    rowIdx === 0 ? colors.tableHeaderText : colors.bodyColor,
            fontSize: 14,
            align:    'center' as const,
            border:   { pt: 1, color: colors.dividerColor } as PptxGenJS.BorderProps,
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
        fontSize: fs, italic: true, color: colors.mutedColor, fontFace: 'Calibri', wrap: true,
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
  colors: ThemeColors,
  opts: Partial<PptxGenJS.TextPropsOptions> = {}
) {
  slide.addText(extractText(nodes), {
    x: area.x, y: area.y, w: area.w, h: area.h,
    fontSize: depth === 1 ? 36 : 28,
    bold: true, color: colors.titleColor, fontFace: 'Calibri',
    ...opts,
  })
}

// ─── Slide builder ────────────────────────────────────────────────────────────

async function buildSlide(
  pptx: PptxGenJS,
  allNodes: RootContent[],
  slideIndex: number,
  layoutConfig: LayoutConfig,
  colors: ThemeColors,
  themeId: string,
): Promise<boolean> {
  const layout = layoutConfig.layout
  const slide = pptx.addSlide()
  slide.background = { color: colors.background }

  const geo   = LAYOUTS[layout]
  const nodes = filterDirectives(allNodes)

  // ── 3-part footer (shared across all layouts) ──────────────────────────
  const FOOTER_Y   = SLIDE_H - 0.35
  const FOOTER_H   = 0.3
  const FOOTER_COL = (SLIDE_W - MARGIN * 2) / 3

  slide.addText('', {
    x: MARGIN, y: FOOTER_Y, w: FOOTER_COL, h: FOOTER_H,
    fontSize: 9, color: colors.mutedColor, align: 'left',
  })
  slide.addText('', {
    x: MARGIN + FOOTER_COL, y: FOOTER_Y, w: FOOTER_COL, h: FOOTER_H,
    fontSize: 9, color: colors.mutedColor, align: 'center',
  })
  slide.addText(`${slideIndex + 1}`, {
    x: MARGIN + FOOTER_COL * 2, y: FOOTER_Y, w: FOOTER_COL, h: FOOTER_H,
    fontSize: 9, color: colors.mutedColor, align: 'right',
  })

  let didOverflow = false

  switch (layout) {

    // ── blank: no title area, content fills the slide ──────────────────────
    case 'blank': {
      // Thick accent border (matches template blank layout)
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.1, y: 0.1, w: SLIDE_W - 0.2, h: SLIDE_H - 0.2,
        fill: { type: 'none' },
        line: { color: colors.accentColor, width: 5 },
      })
      if (geo.content) {
        didOverflow = await renderContentNodes(slide, nodes, geo.content, colors, themeId)
      }
      break
    }

    // ── title-only: single title, centered vertically ──────────────────────
    case 'title-only': {
      const heading = nodes.find(n => n.type === 'heading')
      if (geo.title && heading?.type === 'heading') {
        addTitleText(slide, heading.children as PhrasingContent[], geo.title, heading.depth, colors, {
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
        didOverflow = await renderContentNodes(slide, bodyNodes, geo.content, colors, themeId)
      }
      if (geo.caption && heading?.type === 'heading') {
        // Thin accent line above caption
        slide.addShape(pptx.ShapeType.line, {
          x: MARGIN, y: geo.caption.y - 0.1,
          w: SLIDE_W - MARGIN * 2, h: 0,
          line: { color: colors.accentColor, width: 1.5 },
        })
        slide.addText(extractText(heading.children as PhrasingContent[]), {
          x: geo.caption.x, y: geo.caption.y, w: geo.caption.w, h: geo.caption.h,
          fontSize: 24, bold: true, color: colors.titleColor, fontFace: 'Calibri',
        })
      }
      break
    }

    // ── two-column: title at top, content split by <!-- col --> ─────────────
    case 'two-column': {
      const headingIdx = allNodes.findIndex(
        n => n.type === 'heading' && (n as { depth: number }).depth <= 2
      )
      const heading   = headingIdx >= 0 ? allNodes[headingIdx] : null
      const bodyNodes = allNodes.filter((_, i) => i !== headingIdx)
      const [col1Raw, col2Raw] = splitAtCol(bodyNodes)
      const col1 = filterDirectives(col1Raw)
      const col2 = filterDirectives(col2Raw)
      const ratio = layoutConfig.twoColumnRatio ?? DEFAULT_TWO_COLUMN_RATIO
      const ratioTotal = ratio.left + ratio.right
      const availableWidth = SLIDE_W - MARGIN * 2 - COL_GAP
      const col1Width = availableWidth * (ratio.left / ratioTotal)
      const col2Width = availableWidth * (ratio.right / ratioTotal)
      const col1Area = { x: MARGIN, y: BODY_TOP, w: col1Width, h: BODY_H }
      const col2Area = { x: MARGIN + col1Width + COL_GAP, y: BODY_TOP, w: col2Width, h: BODY_H }
      const dividerX = MARGIN + col1Width + COL_GAP / 2

      if (geo.title && heading?.type === 'heading') {
        addTitleText(slide, heading.children as PhrasingContent[], geo.title, heading.depth, colors)
        if (heading.depth === 1) {
          slide.addShape(pptx.ShapeType.line, {
            x: MARGIN, y: geo.title.y + geo.title.h + 0.04,
            w: SLIDE_W - MARGIN * 2, h: 0,
            line: { color: colors.accentColor, width: 1.5 },
          })
        }
      }

      // Vertical divider
      slide.addShape(pptx.ShapeType.line, {
        x: dividerX, y: BODY_TOP,
        w: 0, h: BODY_H,
        line: { color: colors.dividerColor, width: 1 },
      })

      if (col1Area) {
        const o1 = await renderContentNodes(slide, col1, col1Area, colors, themeId)
        if (o1) didOverflow = true
      }
      if (col2Area) {
        const o2 = await renderContentNodes(slide, col2, col2Area, colors, themeId)
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
        addTitleText(slide, heading.children as PhrasingContent[], geo.title, heading.depth, colors)
        if (heading.depth === 1) {
          slide.addShape(pptx.ShapeType.line, {
            x: MARGIN, y: geo.title.y + geo.title.h + 0.04,
            w: SLIDE_W - MARGIN * 2, h: 0,
            line: { color: colors.accentColor, width: 1.5 },
          })
        }
      }
      if (geo.content) {
        didOverflow = await renderContentNodes(slide, bodyNodes, geo.content, colors, themeId)
      }
      break
    }
  }

  return didOverflow
}

// ─── Slide density estimation ─────────────────────────────────────────────────

/**
 * Counts effective "lines" of body content in a slide's AST nodes.
 * Skips the first h1/h2 for layouts that have a dedicated title area.
 */
function countContentLines(nodes: RootContent[], layout: LayoutType): number {
  let lines = 0
  let seenTitle = false
  for (const node of filterDirectives(nodes)) {
    if (node.type === 'yaml' || node.type === 'html') continue
    // The first h1/h2 goes to the title area — don't count it as body content
    if (node.type === 'heading' && !seenTitle && layout !== 'blank') {
      seenTitle = true
      continue
    }
    if (node.type === 'heading')   { lines += 1; continue }
    if (node.type === 'paragraph') {
      const text = extractText(node.children as PhrasingContent[])
      lines += Math.max(1, Math.ceil(text.length / 80))
      continue
    }
    if (node.type === 'list')       { lines += (node as List).children.length; continue }
    if (node.type === 'code')       { lines += (node as { value: string }).value.split('\n').length; continue }
    if (node.type === 'table')      { lines += node.children.length; continue }
    if (node.type === 'blockquote') { lines += 2; continue }
  }
  return lines
}

/** Lines that comfortably fill the content area for a layout at 18pt / 1.5× leading */
function maxLinesForLayout(layout: LayoutType): number {
  const geo = LAYOUTS[layout]
  const h   = geo.content?.h ?? geo.col1?.h ?? BODY_H
  return Math.max(1, Math.floor(h / ((18 / 72) * 1.5)))
}

/**
 * Returns a 0–100 density value for each slide in the markdown.
 * 0 = empty, 100 = fully packed (may overflow).
 */
export function estimateSlideDensities(markdown: string): number[] {
  const cleaned   = markdown.replace(/^---[\s\S]*?---\n?/, '')
  const processor = unified().use(remarkParse).use(remarkGfm)
  const ast       = processor.parse(cleaned) as Root
  const groups    = splitBySlides(ast)
  return groups.map(nodes => {
    const layout   = extractLayout(nodes)
    const lines    = countContentLines(nodes, layout)
    const maxLines = maxLinesForLayout(layout)
    return Math.min(100, Math.round((lines / maxLines) * 100))
  })
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
  theme?: Theme
}

export interface ConvertResult {
  /** Números dos slides (1-indexed) cujo conteúdo ultrapassou a altura disponível */
  overflowed: number[]
}

export async function convertToPptx(
  markdown: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const { default: PptxGenJS } = await import('pptxgenjs')
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

  const theme  = options.theme ?? DEFAULT_THEME
  const colors = theme.colors
  const overflowed: number[] = []
  for (let i = 0; i < slideGroups.length; i++) {
    const layoutConfig = extractLayoutConfig(slideGroups[i])
    const didOverflow = await buildSlide(pptx, slideGroups[i], i, layoutConfig, colors, theme.id)
    if (didOverflow) overflowed.push(i + 1)
  }

  await pptx.writeFile({ fileName: 'apresentacao.pptx' })
  return { overflowed }
}
