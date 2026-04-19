import Marp from '@marp-team/marp-core'
import DOMPurify from 'dompurify'
import { DEFAULT_THEME, type Theme } from './themes'

// html: true permite que o pré-processador injete divs para two-column.
// DOMPurify sanitiza o output, então não há risco de XSS.
const marp = new Marp({ html: true, math: false })

export interface RenderResult {
  slides: string[]
  css: string
  count: number
}

// ─── CSS injetado para cada layout ────────────────────────────────────────────

const LAYOUT_CSS = `
/* ── default: padrão Marp ─────────────────────────────── */

/* ── blank: conteúdo preenche o slide, sem título destacado ── */
section.layout-blank h1,
section.layout-blank h2 {
  font-size: 1.4em;
  margin-top: 0;
  border-bottom: none;
  background: none;
  color: #313244;
}

/* ── title-only: título centralizado verticalmente ── */
section.layout-title-only {
  display: flex !important;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
section.layout-title-only h1 {
  font-size: 2.8em;
  margin: 0;
}

/* ── two-column: duas colunas com divisor central ── */
section.layout-two-column .col-layout {
  display: flex;
  gap: 1.5em;
  margin-top: 0.5em;
  height: calc(100% - 3em);
}
section.layout-two-column .col {
  flex: 1;
  overflow: hidden;
  border-right: 1px solid #e0e0e0;
  padding-right: 1em;
}
section.layout-two-column .col:last-child {
  border-right: none;
  padding-right: 0;
}

/* ── caption: conteúdo no topo, título como legenda no rodapé ── */
section.layout-caption {
  display: flex !important;
  flex-direction: column;
  padding-bottom: 0.5em;
}
section.layout-caption > *:not(h1):not(h2) {
  flex: 1;
}
section.layout-caption h1,
section.layout-caption h2 {
  order: 99;
  font-size: 1.3em;
  margin-top: auto;
  padding-top: 0.4em;
  border-top: 2px solid #89b4fa;
  color: #1e1e2e;
}
`

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
    const layoutMatch = part.match(/<!--\s*layout:\s*(\S+)\s*-->/)
    if (!layoutMatch) return part

    const layout = layoutMatch[1]

    // Substitui a diretiva original pela diretiva de classe Marp
    let result = part.replace(/[ \t]*<!--\s*layout:\s*\S+\s*-->[ \t]*\n?/, '')
    result = `<!-- class: layout-${layout} -->\n${result}`

    if (layout === 'two-column' && result.includes('<!-- col -->')) {
      // Localiza o marcador <!-- col --> e o heading (h1/h2) no conteúdo
      const colMarker = '<!-- col -->'
      const colIdx    = result.indexOf(colMarker)
      const beforeCol = result.slice(0, colIdx).trimEnd()
      const afterCol  = result.slice(colIdx + colMarker.length).trimStart()

      // Separa a diretiva Marp + heading do conteúdo da coluna esquerda
      const headingMatch = beforeCol.match(/^([\s\S]*?\n(?:#{1,6}[^\n]+)\n)([\s\S]*)$/)

      if (headingMatch) {
        const preamble  = headingMatch[1]  // class-directive + heading line
        const leftBody  = headingMatch[2].trim()
        result = [
          preamble,
          '<div class="col-layout"><div class="col">',
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
        result = [
          beforeCol,
          '<div class="col-layout"><div class="col">',
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

  const slides = sections.map(section => {
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
    })
  })

  return {
    slides: slides.length ? slides : [''],
    css: result.css + LAYOUT_CSS + theme.colors.previewCss,
    count: slides.length,
  }
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
  const ww    = wrapper.clientWidth  - 32
  const wh    = wrapper.clientHeight - 32
  const scale = Math.min(ww / 960, wh / 540, 1)
  iframe.style.transform = `scale(${scale})`
}
