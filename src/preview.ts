import Marp from '@marp-team/marp-core'
import DOMPurify from 'dompurify'
import { getTwoColumnRatioStyle, parseLayoutDirective } from './layout-directives'
import { DEFAULT_THEME, type Theme, type ThemeColors } from './themes'
import { renderMermaidSvg, svgToDataUrl } from './mermaid'

// html: true permite que o pré-processador injete divs para two-column.
// DOMPurify sanitiza o output, então não há risco de XSS.
const marp = new Marp({ html: true, math: false })

export interface RenderResult {
  slides: string[]
  css: string
  count: number
}

// ─── CSS injetado para cada layout ────────────────────────────────────────────

/**
 * Gera o CSS dos layouts usando as cores do tema ativo, evitando cores hardcoded
 * que ficariam erradas em temas diferentes (ex: divisor #e0e0e0 no Catppuccin dark).
 */
function buildLayoutCss(colors: ThemeColors): string {
  return `
/* ═══════════════════════════════════════════════════════════
   Base — matches layout.html: padding 40px, flex column,
   footer at bottom 20px with 3 dashed-border cells.
   ═══════════════════════════════════════════════════════════ */
section {
  padding: 40px 40px 65px !important;
  display: flex !important;
  flex-direction: column !important;
  position: relative !important;
}

/* ── footer: 3 dashed cells (date | center | page) ── */
.slide-footer-bar {
  position: absolute !important;
  bottom: 18px !important;
  left: 40px !important;
  right: 40px !important;
  display: flex !important;
  gap: 20px !important;
  z-index: 10 !important;
}
.slide-footer-bar > span {
  flex: 1 !important;
  height: 22px !important;
  border: 1px dashed #${colors.dividerColor} !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 10px !important;
  color: #${colors.mutedColor} !important;
  background: transparent !important;
}

/* ── default (title-content) — title top, body below ── */
section h1, section h2 {
  min-height: 48px !important;
  margin-bottom: 16px !important;
}

/* ═══════════════════════════════════════════════════════════
   title-slide — centered title + subtitle (2/3 width)
   ═══════════════════════════════════════════════════════════ */
section.layout-title-slide {
  justify-content: center !important;
  align-items: center !important;
  text-align: center !important;
}
section.layout-title-slide h1 {
  font-size: 2.2rem !important;
  font-weight: 500 !important;
  border-bottom: none !important;
  margin: 0 0 0.4em !important;
  width: 100% !important;
}
section.layout-title-slide p {
  font-size: 1.2rem !important;
  color: #${colors.mutedColor} !important;
  margin: 0 !important;
  width: 66% !important;
}

/* ═══════════════════════════════════════════════════════════
   blank — no title, content fills the slide
   ═══════════════════════════════════════════════════════════ */
section.layout-blank h1,
section.layout-blank h2 {
  font-size: 1.4em !important;
  margin-top: 0 !important;
  border-bottom: none !important;
  background: none !important;
}

/* ═══════════════════════════════════════════════════════════
   title-only — title at top, rest empty
   ═══════════════════════════════════════════════════════════ */
section.layout-title-only h1,
section.layout-title-only h2 {
  font-size: 2.2rem !important;
  font-weight: 500 !important;
  min-height: 80px !important;
  display: flex !important;
  align-items: center !important;
  border-bottom: none !important;
  margin: 0 !important;
}

/* ═══════════════════════════════════════════════════════════
   two-column — title + 2 equal columns
   ═══════════════════════════════════════════════════════════ */
section.layout-two-column .col-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  --column-left: 1;
  --column-right: 1;
}
section.layout-two-column .col {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  padding: 16px;
  border: 2px dashed #${colors.dividerColor};
}
section.layout-two-column .col:first-child {
  flex: var(--column-left) 1 0;
}
section.layout-two-column .col:last-child {
  flex: var(--column-right) 1 0;
}

/* ═══════════════════════════════════════════════════════════
   caption — content top, heading as caption at bottom
   ═══════════════════════════════════════════════════════════ */
section.layout-caption {
  padding-bottom: 65px !important;
}
section.layout-caption > *:not(h1):not(h2):not(header):not(footer):not(.slide-footer-bar) {
  flex: 1;
}
section.layout-caption h1,
section.layout-caption h2 {
  order: 99;
  font-size: 1.3em !important;
  margin-top: auto !important;
  padding-top: 0.4em !important;
  border-bottom: none !important;
  border-top: 2px solid #${colors.accentColor} !important;
}

/* ═══════════════════════════════════════════════════════════
   section-header — vertically centered, title 3/4 width,
   text 1/2 width below
   ═══════════════════════════════════════════════════════════ */
section.layout-section-header {
  justify-content: center !important;
  gap: 16px !important;
}
section.layout-section-header h1,
section.layout-section-header h2 {
  font-size: 2.2rem !important;
  font-weight: 500 !important;
  width: 75% !important;
  border-bottom: none !important;
  margin: 0 !important;
}
section.layout-section-header p {
  width: 50% !important;
  font-size: 0.95rem !important;
  color: #${colors.mutedColor} !important;
  margin: 0 !important;
}

/* ═══════════════════════════════════════════════════════════
   comparison — title + 2 columns each with sub-header
   ═══════════════════════════════════════════════════════════ */
section.layout-comparison .col-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  flex: 1;
}
section.layout-comparison .col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}
section.layout-comparison .col h3,
section.layout-comparison .col h4 {
  font-size: 1.1rem !important;
  font-weight: 500 !important;
  min-height: 32px !important;
  display: flex !important;
  align-items: center !important;
  border: 2px dashed #${colors.dividerColor} !important;
  padding: 4px 10px !important;
  margin-bottom: 8px !important;
  color: #${colors.bodyColor} !important;
}
section.layout-comparison .col > *:not(h3):not(h4) {
  flex: 1;
}

/* ═══════════════════════════════════════════════════════════
   main-point — large centered text in bordered box, 50% height
   ═══════════════════════════════════════════════════════════ */
section.layout-main-point {
  justify-content: center !important;
  align-items: center !important;
}
section.layout-main-point h1,
section.layout-main-point h2,
section.layout-main-point p {
  border: 4px dashed #${colors.dividerColor} !important;
  padding: 1em 1.5em !important;
  font-size: 2.2rem !important;
  font-weight: bold !important;
  text-align: center !important;
  width: 100% !important;
  min-height: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin: 0 !important;
}

/* ═══════════════════════════════════════════════════════════
   content-caption — left 1/3 (title+caption) + right 2/3
   ═══════════════════════════════════════════════════════════ */
section.layout-content-caption .col-layout {
  display: flex;
  gap: 24px;
  flex: 1;
}
section.layout-content-caption .col:first-child {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
section.layout-content-caption .col:last-child {
  flex: 2 1 0;
  min-width: 0;
  overflow: hidden;
  padding: 16px;
  border: 2px dashed #${colors.dividerColor};
}
section.layout-content-caption .col:first-child h1,
section.layout-content-caption .col:first-child h2 {
  font-size: 1.5rem !important;
  font-weight: 500 !important;
  border-bottom: none !important;
  margin: 0 !important;
}
section.layout-content-caption .col:first-child p {
  font-size: 0.85rem !important;
  color: #${colors.mutedColor} !important;
  flex: 1;
  padding: 12px;
  border: 2px dashed #${colors.dividerColor};
}
`
}

// ─── Pré-processador de diretivas de layout ───────────────────────────────────

/**
 * Transforma diretivas de layout do formato próprio para diretivas Marp:
 * - `<!-- layout: TYPE -->` → `<!-- class: layout-TYPE -->`
 * - Para `two-column`: quebra o conteúdo em `<div class="col-layout">` + `<div class="col">`
 */
export function preprocessLayoutDirectives(md: string): string {
  // Divide o MD por --- respeitando separadores de slide
  const slideParts = md.split(/(?:^|\n)---(?:\n|$)/)

  const processed = slideParts.map(part => {
    const directive = parseLayoutDirective(part)
    if (!directive) return part

    const layout = directive.layout

    // Substitui a diretiva original pela diretiva de classe Marp
    let result = part.replace(/[ \t]*<!--\s*layout:\s*\S+(?:\s+\d+\s*\/\s*\d+)?\s*-->[ \t]*\n?/, '')
    result = `<!-- class: layout-${layout} -->\n${result}`

    // Layouts that use <!-- col --> for splitting into two columns
    const isColLayout = (layout === 'two-column' || layout === 'comparison' || layout === 'content-caption')
    if (isColLayout && result.includes('<!-- col -->')) {
      // Localiza o marcador <!-- col --> e o heading (h1/h2) no conteúdo
      const colMarker = '<!-- col -->'
      const colIdx    = result.indexOf(colMarker)
      const beforeCol = result.slice(0, colIdx).trimEnd()
      const afterCol  = result.slice(colIdx + colMarker.length).trimStart()

      // Separa a diretiva Marp + heading do conteúdo da coluna esquerda
      const headingMatch = beforeCol.match(/^([\s\S]*?\n(?:#{1,6}[^\n]+)\n)([\s\S]*)$/)

      // content-caption uses fixed 1:2 ratio; others use directive ratio
      const colRatio = layout === 'content-caption'
        ? { left: 1, right: 2 }
        : directive.twoColumnRatio

      if (headingMatch) {
        const preamble  = headingMatch[1]  // class-directive + heading line
        const leftBody  = headingMatch[2].trim()
        const styleAttr = getTwoColumnRatioStyle(colRatio)
        result = [
          preamble,
          `<div class="col-layout" style="${styleAttr}"><div class="col">`,
          '',
          leftBody,
          '',
          `</div><div class="col">`,
          '',
          afterCol,
          '',
          '</div></div>',
        ].join('\n')
      } else {
        // Sem heading: envolve todo o conteúdo nas colunas
        const styleAttr = getTwoColumnRatioStyle(colRatio)
        result = [
          beforeCol,
          `<div class="col-layout" style="${styleAttr}"><div class="col">`,
          '',
          `</div><div class="col">`,
          '',
          afterCol,
          '',
          '</div></div>',
        ].join('\n')
      }
    }

    return result
  })

  return processed.join('\n\n---\n\n')
}

// ─── Mermaid pre-processor ────────────────────────────────────────────────────

const MERMAID_FENCE_RE = /```mermaid\n([\s\S]*?)```/g

/**
 * Finds all ```mermaid blocks in raw markdown, renders them to SVG data URLs,
 * and replaces each block with an image tag `![](data:image/svg+xml;base64,...)`.
 * Blocks that fail to render are left unchanged (shown as code in preview).
 */
export async function preprocessMermaid(md: string, themeId: string): Promise<string> {
  // Collect all mermaid blocks with their positions
  const matches: Array<{ full: string; code: string }> = []
  MERMAID_FENCE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MERMAID_FENCE_RE.exec(md)) !== null) {
    matches.push({ full: m[0], code: m[1].trim() })
  }
  if (matches.length === 0) return md

  // Render all in parallel
  const svgs = await Promise.all(
    matches.map(({ code }) => renderMermaidSvg(code, themeId))
  )

  let result = md
  for (let i = 0; i < matches.length; i++) {
    const svg = svgs[i]
    if (!svg) continue  // keep original code block on failure
    const dataUrl = svgToDataUrl(svg)
    result = result.replace(matches[i].full, `![diagram](${dataUrl})`)
  }
  return result
}

// ─── renderMarkdown ────────────────────────────────────────────────────────────

export function renderMarkdown(md: string, theme: Theme = DEFAULT_THEME): RenderResult {
  let result: { html: string; css: string }

  try {
    const preprocessed = preprocessLayoutDirectives(md)
    result = marp.render(preprocessed)
  } catch {
    return {
      slides: ['<section style="padding:2rem;color:#f38ba8">Erro ao renderizar o Markdown.</section>'],
      css: '',
      count: 1,
    }
  }

  const parser   = new DOMParser()
  const doc      = parser.parseFromString(result.html, 'text/html')
  const sections = Array.from(doc.querySelectorAll('section'))

  const slides = sections.map((section, slideIdx) => {
    // Inject 3-part footer bar (date | center | page number)
    const footerBar = doc.createElement('div')
    footerBar.className = 'slide-footer-bar'
    footerBar.innerHTML =
      `<span class="footer-left"></span>` +
      `<span class="footer-center"></span>` +
      `<span class="footer-right">${slideIdx + 1}</span>`
    section.appendChild(footerBar)

    const raw = section.outerHTML
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img', 'br', 'span', 'div', 'header', 'footer', 'svg',
        'g', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text',
      ],
      ALLOWED_ATTR: [
        'class', 'style', 'id', 'src', 'alt', 'width', 'height',
        'colspan', 'rowspan', 'viewBox', 'fill', 'stroke',
        'stroke-width', 'd', 'cx', 'cy', 'r', 'x', 'y',
        'data-marpit-svg', 'data-marpit-pagination',
        'data-marpit-pagination-total',
      ],
      // Allow data:image/svg+xml (mermaid diagrams) and data:image/* (pasted images)
      ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/(?:svg\+xml|png|jpeg|gif|webp);base64,)/i,
    })
  })

  return {
    slides: slides.length ? slides : [''],
    css: result.css + buildLayoutCss(theme.colors) + theme.colors.previewCss,
    count: slides.length,
  }
}

// ─── PDF print helper ─────────────────────────────────────────────────────────

/**
 * Builds a self-contained HTML document with all slides ready for printing.
 * Each slide gets its own page via `@page { size: 960px 540px; margin: 0 }`.
 */
export function buildPrintDocument(slides: string[], css: string): string {
  const pages = slides.map((slideHtml, i) =>
    `<div class="print-page${i === slides.length - 1 ? ' last' : ''}">${slideHtml}</div>`
  ).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: 960px 540px; margin: 0; }
html, body { width: 960px; background: white; }
${css}
section {
  width: 960px !important;
  height: 540px !important;
  position: relative;
  overflow: hidden;
}
.print-page {
  width: 960px;
  height: 540px;
  page-break-after: always;
  overflow: hidden;
}
.print-page.last { page-break-after: avoid; }
</style>
</head>
<body>${pages}</body>
</html>`
}

// ─── Frame helpers ────────────────────────────────────────────────────────────

export function mountSlideInFrame(
  iframe: HTMLIFrameElement,
  slideHtml: string,
  css: string
): void {
  const doc = iframe.contentDocument
  if (!doc) return

  const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 960px; height: 540px; overflow: hidden; background: white; }
${css}
section {
  width: 960px !important;
  height: 540px !important;
  position: relative;
  overflow: hidden;
}
</style>
</head>
<body>${slideHtml}</body>
</html>`

  doc.open()
  doc.write(content)
  doc.close()
}

export function createSlideFrame(wrapper: HTMLElement): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  iframe.className = 'slide-frame'
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.setAttribute('title', 'Preview do slide')
  wrapper.appendChild(iframe)
  return iframe
}

export function scaleFrame(iframe: HTMLIFrameElement, wrapper: HTMLElement): void {
  const viewport = wrapper.parentElement instanceof HTMLElement ? wrapper.parentElement : wrapper
  const ww = Math.max(viewport.clientWidth - 24, 0)
  const wh = Math.max(viewport.clientHeight - 24, 0)
  const scale = Math.min(ww / 960, wh / 540)
  iframe.style.transform = `scale(${scale})`
}
