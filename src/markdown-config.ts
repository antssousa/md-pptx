export interface ProjectConfig {
  font?: string
  ratio?: '16:9' | '4:3'
}

export interface MarkdownProject {
  config: ProjectConfig
  slidesMd: string
}

export const SLIDE_BEGIN_MARKER = '<!-- slide begin -->'
export const SLIDE_END_MARKER = '<!-- slide end -->'

export function parseMarkdownProject(markdown: string): MarkdownProject {
  const config: ProjectConfig = {}
  
  // 1. Extrair bloco de configuração YAML no início do arquivo
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const lines = fmMatch[1].split('\n')
    for (const line of lines) {
      const parts = line.split(':')
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase()
        const val = parts.slice(1).join(':').trim()
        
        if (key === 'font') {
          config.font = val
        } else if (key === 'ratio') {
          if (val === '16:9' || val === '4:3') {
            config.ratio = val as '16:9' | '4:3'
          }
        }
      }
    }
  }

  // 2. Extrair blocos de conteúdo baseados em marcadores explícitos
  let slidesMd = markdown
  const beginIdx = markdown.indexOf(SLIDE_BEGIN_MARKER)
  const endIdx = markdown.indexOf(SLIDE_END_MARKER)

  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    slidesMd = markdown.slice(beginIdx + SLIDE_BEGIN_MARKER.length, endIdx).trim()
  } else if (beginIdx !== -1) {
    slidesMd = markdown.slice(beginIdx + SLIDE_BEGIN_MARKER.length).trim()
  } else if (endIdx !== -1) {
    slidesMd = markdown.slice(0, endIdx).trim()
  } else {
    // Fallback: Se não encontrar marcadores, remove o frontmatter e considera todo o conteúdo
    slidesMd = markdown.replace(/^---[\s\S]*?---\n?/, '').trim()
  }

  return { config, slidesMd }
}
