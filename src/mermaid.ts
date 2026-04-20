import mermaid from 'mermaid'

// ─── Mermaid theme map ────────────────────────────────────────────────────────

const MERMAID_THEME_MAP: Record<string, string> = {
  'dark-catppuccin': 'dark',
  'corporate-clean': 'default',
  'minimal-light':   'default',
}

// ─── Lazy init ────────────────────────────────────────────────────────────────

let _initialized = false
let _idCounter   = 0

function ensureInit(): void {
  if (_initialized) return
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
  _initialized = true
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Renders a Mermaid diagram string to an SVG string.
 * Returns null if the diagram is invalid or rendering fails.
 */
export async function renderMermaidSvg(
  code: string,
  themeId = 'dark-catppuccin',
): Promise<string | null> {
  ensureInit()
  const mermaidTheme = MERMAID_THEME_MAP[themeId] ?? 'default'
  // Inject theme via front-matter directive (works per-diagram without re-initialize)
  const codeWithTheme = `%%{init: {'theme': '${mermaidTheme}'}}%%\n${code}`
  const id = `mmd-${++_idCounter}`
  try {
    const { svg } = await mermaid.render(id, codeWithTheme)
    return svg
  } catch {
    return null
  }
}

/**
 * Encodes an SVG string to a base64 data URL safe for use in img src and
 * for embedding in PPTX.
 */
export function svgToDataUrl(svg: string): string {
  // encodeURIComponent + unescape handles non-ASCII chars before btoa
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}
