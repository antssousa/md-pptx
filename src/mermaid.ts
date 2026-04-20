
// ─── Mermaid theme map ────────────────────────────────────────────────────────

const MERMAID_THEME_MAP: Record<string, string> = {
  'dark-catppuccin': 'dark',
  'corporate-clean': 'default',
  'minimal-light':   'default',
}

// ─── Lazy init ────────────────────────────────────────────────────────────────

let _initialized = false
let _idCounter   = 0
type MermaidRuntime = typeof import('mermaid')['default']
let _mermaidPromise: Promise<MermaidRuntime> | null = null

async function getMermaidModule(): Promise<MermaidRuntime> {
  if (!_mermaidPromise) {
    _mermaidPromise = import('mermaid').then((mod) => mod.default)
  }
  return _mermaidPromise
}

async function ensureInit(): Promise<MermaidRuntime> {
  const mermaid = await getMermaidModule()
  if (_initialized) return mermaid
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
  _initialized = true
  return mermaid
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
  const mermaid = await ensureInit()
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

export function extractSvgAspectRatio(svg: string): number | null {
  const viewBoxMatch = svg.match(/viewBox\s*=\s*"[^"]*?\s+[^"]*?\s+([0-9.]+)\s+([0-9.]+)"/i)
  if (viewBoxMatch) {
    const width = Number(viewBoxMatch[1])
    const height = Number(viewBoxMatch[2])
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return width / height
    }
  }

  const widthMatch = svg.match(/width\s*=\s*"([0-9.]+)(?:px)?"/i)
  const heightMatch = svg.match(/height\s*=\s*"([0-9.]+)(?:px)?"/i)
  if (widthMatch && heightMatch) {
    const width = Number(widthMatch[1])
    const height = Number(heightMatch[1])
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return width / height
    }
  }

  return null
}
