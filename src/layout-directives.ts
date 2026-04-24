export type LayoutType =
  | 'default'
  | 'two-column'
  | 'blank'
  | 'title-only'
  | 'caption'
  | 'title-slide'
  | 'section-header'
  | 'comparison'
  | 'main-point'
  | 'content-caption'

export interface TwoColumnRatio {
  left: number
  right: number
}

export interface LayoutDirectiveConfig {
  layout: LayoutType
  twoColumnRatio?: TwoColumnRatio
}

export const DEFAULT_TWO_COLUMN_RATIO: TwoColumnRatio = { left: 1, right: 1 }

const LAYOUT_DIRECTIVE_RE = /<!--\s*layout:\s*(\S+)(?:\s+(\d+)\s*\/\s*(\d+))?\s*-->/

function parseTwoColumnRatio(leftRaw?: string, rightRaw?: string): TwoColumnRatio {
  const left = Number(leftRaw)
  const right = Number(rightRaw)

  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
    return { ...DEFAULT_TWO_COLUMN_RATIO }
  }

  return { left, right }
}

export function parseLayoutDirective(value: string): LayoutDirectiveConfig | null {
  const match = value.match(LAYOUT_DIRECTIVE_RE)
  if (!match) return null

  const layout = match[1] as LayoutType
  if (![
    'default', 'two-column', 'blank', 'title-only', 'caption', 'title-slide',
    'section-header', 'comparison', 'main-point', 'content-caption',
  ].includes(layout)) {
    return null
  }

  if (layout !== 'two-column') {
    return { layout }
  }

  return {
    layout,
    twoColumnRatio: parseTwoColumnRatio(match[2], match[3]),
  }
}

export function getTwoColumnRatioStyle(ratio?: TwoColumnRatio): string {
  const normalized = ratio ?? DEFAULT_TWO_COLUMN_RATIO
  return `--column-left: ${normalized.left}; --column-right: ${normalized.right}`
}
