// ─── Theme definitions ────────────────────────────────────────────────────────

export interface ThemeColors {
  // PPTX slide colors (hex without '#')
  background:      string
  titleColor:      string
  bodyColor:       string
  accentColor:     string
  codeBackground:  string
  codeText:        string
  mutedColor:      string
  dividerColor:    string
  tableHeaderFill: string
  tableHeaderText: string
  inlineCodeColor: string
  // CSS injected at the end of Marp output inside the preview iframe
  previewCss:      string
}

export interface Theme {
  id:     string
  name:   string
  colors: ThemeColors
}

// ─── Dark Catppuccin ──────────────────────────────────────────────────────────

const darkCatppuccinCss = `
section {
  background: #1e1e2e !important;
  color: #cdd6f4 !important;
}
section h1, section h2, section h3, section h4 {
  color: #cdd6f4 !important;
}
section h1 {
  border-bottom: 2px solid #89b4fa !important;
  padding-bottom: 0.15em !important;
}
section code {
  background: #313244 !important;
  color: #89b4fa !important;
  padding: 0.1em 0.35em !important;
  border-radius: 4px !important;
}
section pre {
  background: #27273a !important;
}
section pre code {
  background: transparent !important;
  color: #cdd6f4 !important;
}
section a { color: #89b4fa !important; }
section table thead th {
  background: #89b4fa !important;
  color: #11111b !important;
}
section table tbody tr:nth-child(even) td {
  background: #27273a !important;
}
section blockquote {
  border-left: 3px solid #89b4fa !important;
  color: #9399b2 !important;
  padding-left: 1em !important;
  background: #27273a44 !important;
}
section header, section footer {
  color: #6c7086 !important;
}
`

// ─── Corporate Clean ──────────────────────────────────────────────────────────

const corporateCleanCss = `
section {
  background: #ffffff !important;
  color: #374151 !important;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
}
section h1, section h2, section h3 {
  color: #1a1a2e !important;
  font-family: 'Inter', 'Segoe UI', system-ui, sans-serif !important;
}
section h1 {
  border-bottom: 3px solid #2563eb !important;
  padding-bottom: 0.15em !important;
}
section code {
  background: #eff6ff !important;
  color: #1d4ed8 !important;
  padding: 0.1em 0.35em !important;
  border-radius: 4px !important;
}
section pre {
  background: #f1f5f9 !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 6px !important;
}
section pre code {
  background: transparent !important;
  color: #334155 !important;
}
section a { color: #2563eb !important; }
section table thead th {
  background: #2563eb !important;
  color: #ffffff !important;
}
section table tbody tr:nth-child(even) td {
  background: #f8fafc !important;
}
section blockquote {
  border-left: 3px solid #2563eb !important;
  color: #6b7280 !important;
  padding-left: 1em !important;
  background: #eff6ff44 !important;
}
section header, section footer {
  color: #9ca3af !important;
}
`

// ─── Minimal Light ────────────────────────────────────────────────────────────

const minimalLightCss = `
section {
  background: #fafafa !important;
  color: #374151 !important;
  font-family: 'Georgia', 'Times New Roman', serif !important;
}
section h1, section h2, section h3 {
  color: #111827 !important;
  font-family: 'Georgia', serif !important;
  font-weight: normal !important;
  border-bottom: 1px solid #e5e7eb !important;
  padding-bottom: 0.15em !important;
}
section code {
  background: #f3f4f6 !important;
  color: #374151 !important;
  font-size: 0.85em !important;
  padding: 0.1em 0.35em !important;
  border-radius: 3px !important;
  border: 1px solid #e5e7eb !important;
}
section pre {
  background: #f3f4f6 !important;
  border: 1px solid #e5e7eb !important;
}
section pre code {
  background: transparent !important;
  color: #1f2937 !important;
  border: none !important;
}
section a { color: #374151 !important; text-decoration: underline !important; }
section table thead th {
  background: #e5e7eb !important;
  color: #111827 !important;
}
section table tbody tr:nth-child(even) td {
  background: #f9fafb !important;
}
section blockquote {
  border-left: 2px solid #d1d5db !important;
  color: #6b7280 !important;
  font-style: italic !important;
  padding-left: 1em !important;
}
section header, section footer {
  color: #9ca3af !important;
}
`

// ─── Theme registry ───────────────────────────────────────────────────────────

export const THEMES: Theme[] = [
  {
    id: 'dark-catppuccin',
    name: 'Dark Catppuccin',
    colors: {
      background:      '1e1e2e',
      titleColor:      'cdd6f4',
      bodyColor:       'bac2de',
      accentColor:     '89b4fa',
      codeBackground:  '27273a',
      codeText:        'cdd6f4',
      mutedColor:      '6c7086',
      dividerColor:    '313244',
      tableHeaderFill: '89b4fa',
      tableHeaderText: '11111b',
      inlineCodeColor: '89b4fa',
      previewCss: darkCatppuccinCss,
    },
  },
  {
    id: 'corporate-clean',
    name: 'Corporate Clean',
    colors: {
      background:      'FFFFFF',
      titleColor:      '1a1a2e',
      bodyColor:       '374151',
      accentColor:     '2563eb',
      codeBackground:  'f1f5f9',
      codeText:        '334155',
      mutedColor:      '9ca3af',
      dividerColor:    'e2e8f0',
      tableHeaderFill: '2563eb',
      tableHeaderText: 'FFFFFF',
      inlineCodeColor: '1d4ed8',
      previewCss: corporateCleanCss,
    },
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light',
    colors: {
      background:      'fafafa',
      titleColor:      '111827',
      bodyColor:       '374151',
      accentColor:     '6b7280',
      codeBackground:  'f3f4f6',
      codeText:        '1f2937',
      mutedColor:      '9ca3af',
      dividerColor:    'd1d5db',
      tableHeaderFill: 'e5e7eb',
      tableHeaderText: '111827',
      inlineCodeColor: '374151',
      previewCss: minimalLightCss,
    },
  },
]

export const DEFAULT_THEME = THEMES[0]

export function getTheme(id: string): Theme {
  return THEMES.find(t => t.id === id) ?? DEFAULT_THEME
}
