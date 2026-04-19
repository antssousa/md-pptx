import './style.css'
import { createEditor, insertAround, insertAtLineStart, insertLine, setEditorContent, INITIAL_MD } from './editor'
import { renderMarkdown, mountSlideInFrame, createSlideFrame, scaleFrame } from './preview'
import { convertToPptx } from './converter'
import { setupTemplateLoader, getTemplateState } from './template'
import { THEMES, getTheme, DEFAULT_THEME, type Theme } from './themes'

// ─── URL hash sharing ────────────────────────────────────────────────────────
const HASH_PREFIX = 'md='

function encodeToHash(md: string): string {
  return HASH_PREFIX + btoa(encodeURIComponent(md))
}

function decodeFromHash(): string | null {
  try {
    const hash = window.location.hash.slice(1) // remove '#'
    if (!hash.startsWith(HASH_PREFIX)) return null
    return decodeURIComponent(atob(hash.slice(HASH_PREFIX.length)))
  } catch {
    return null
  }
}

// ─── Auto-save ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'md-pptx-draft'

function loadDraft(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

function saveDraft(md: string): void {
  try { localStorage.setItem(STORAGE_KEY, md) } catch { /* quota exceeded */ }
}

function clearDraft(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// ─── DOM refs ────────────────────────────────────────────────────────────────
const editorMount    = document.getElementById('editor-mount')!
const previewMount   = document.getElementById('preview-mount')!
const downloadBtn    = document.getElementById('download-btn') as HTMLButtonElement
const pdfBtn         = document.getElementById('pdf-btn') as HTMLButtonElement
const templateInput  = document.getElementById('template-input') as HTMLInputElement
const templateBadge  = document.getElementById('template-name') as HTMLElement
const slideCountEl   = document.getElementById('slide-count')!
const slideIndicator = document.getElementById('slide-indicator')!
const prevBtn        = document.getElementById('prev-slide') as HTMLButtonElement
const nextBtn        = document.getElementById('next-slide') as HTMLButtonElement
const resizer        = document.getElementById('resizer')!
const editorPane     = document.getElementById('editor-pane')!
const toastEl        = document.getElementById('toast')!
const sidebarToggle  = document.getElementById('sidebar-toggle') as HTMLButtonElement
const sidebar        = document.getElementById('sidebar')!
const saveStatusEl   = document.getElementById('save-status')!
const newBtn              = document.getElementById('new-btn') as HTMLButtonElement
const importInput         = document.getElementById('import-input') as HTMLInputElement
const presentationOverlay = document.getElementById('presentation-overlay')!
const presentationSlideArea = document.getElementById('presentation-slide-area')!
const presentationCounter = document.getElementById('presentation-counter')!
const presentationPrevBtn = document.getElementById('presentation-prev') as HTMLButtonElement
const presentationNextBtn = document.getElementById('presentation-next') as HTMLButtonElement
const btnPlay             = document.getElementById('btn-play') as HTMLButtonElement

// ─── State ───────────────────────────────────────────────────────────────────
let currentSlides: string[] = []
let currentCss    = ''
let currentSlide  = 0
let iframe: HTMLIFrameElement | null = null

// ─── Theme state ─────────────────────────────────────────────────────────────
const THEME_STORAGE_KEY = 'md-pptx-theme'

function loadSavedTheme(): Theme {
  try {
    const id = localStorage.getItem(THEME_STORAGE_KEY)
    return id ? getTheme(id) : DEFAULT_THEME
  } catch { return DEFAULT_THEME }
}

let currentTheme: Theme = loadSavedTheme()

// ─── Toast ───────────────────────────────────────────────────────────────────
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, type: 'success' | 'error' | '' = '') {
  toastEl.textContent    = msg
  toastEl.className      = `toast${type ? ' ' + type : ''}`
  toastEl.hidden         = false
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastEl.hidden = true }, 3500)
}

// ─── Save status indicator ───────────────────────────────────────────────────
let saveTimer: ReturnType<typeof setTimeout> | null = null

function showSaveStatus(state: 'saving' | 'saved') {
  if (state === 'saving') {
    saveStatusEl.textContent = 'Salvando…'
    saveStatusEl.className   = 'save-status saving'
  } else {
    const now = new Date()
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    saveStatusEl.textContent = `✓ Salvo às ${time}`
    saveStatusEl.className   = 'save-status saved'
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveStatusEl.className = 'save-status idle'
    }, 3000)
  }
}

// ─── Preview renderer ─────────────────────────────────────────────────────────
function updateSlideNav() {
  const total = currentSlides.length
  slideCountEl.textContent   = `${total} slide${total !== 1 ? 's' : ''}`
  slideIndicator.textContent = `${currentSlide + 1} / ${total}`
  prevBtn.disabled = currentSlide === 0
  nextBtn.disabled = currentSlide === total - 1
}

function showSlide(index: number) {
  if (!currentSlides.length) return
  currentSlide = Math.max(0, Math.min(index, currentSlides.length - 1))

  let wrapper = previewMount.querySelector<HTMLElement>('.slide-wrapper')
  if (!wrapper) {
    previewMount.innerHTML = ''
    wrapper = document.createElement('div')
    wrapper.className = 'slide-wrapper'
    previewMount.appendChild(wrapper)
    iframe = createSlideFrame(wrapper)
  }

  mountSlideInFrame(iframe!, currentSlides[currentSlide], currentCss)
  scaleFrame(iframe!, wrapper!)
  updateSlideNav()
}

// ─── Debounce helper ──────────────────────────────────────────────────────────
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

// ─── Markdown change handler ──────────────────────────────────────────────────
const handleMdChange = debounce((md: string) => {
  // Auto-save
  showSaveStatus('saving')
  saveDraft(md)
  showSaveStatus('saved')

  // Preview
  const result = renderMarkdown(md, currentTheme)
  currentSlides = result.slides
  currentCss    = result.css
  if (currentSlide >= result.count) currentSlide = result.count - 1
  showSlide(currentSlide)
}, 300)

// ─── Editor init ─────────────────────────────────────────────────────────────
const sharedContent = decodeFromHash()
const savedDraft    = sharedContent ?? loadDraft()
const editor = createEditor(editorMount, handleMdChange, savedDraft ?? undefined)

if (sharedContent) {
  // Persiste o conteúdo compartilhado como rascunho e limpa o hash da URL
  saveDraft(sharedContent)
  history.replaceState(null, '', window.location.pathname + window.location.search)
  showToast('Apresentação carregada via link compartilhado.', 'success')
} else if (savedDraft) {
  showToast('Rascunho restaurado automaticamente.', 'success')
}

// ─── Formatting toolbar ───────────────────────────────────────────────────────
document.getElementById('tool-bold')?.addEventListener('click', () => {
  insertAround(editor, '**', '**')
  editor.focus()
})
document.getElementById('tool-italic')?.addEventListener('click', () => {
  insertAround(editor, '_', '_')
  editor.focus()
})
document.getElementById('tool-heading')?.addEventListener('click', () => {
  insertAtLineStart(editor, '## ')
  editor.focus()
})
document.getElementById('tool-list')?.addEventListener('click', () => {
  insertAtLineStart(editor, '- ')
  editor.focus()
})
document.getElementById('tool-image')?.addEventListener('click', () => {
  insertAround(editor, '![', '](url)')
  editor.focus()
})

// ─── Novo documento ──────────────────────────────────────────────────────────
newBtn.addEventListener('click', () => {
  if (!confirm('Descartar o rascunho atual e começar um novo documento?')) return
  clearDraft()
  setEditorContent(editor, INITIAL_MD)
  saveStatusEl.className   = 'save-status idle'
  saveStatusEl.textContent = ''
  showToast('Novo documento criado.', 'success')
  editor.focus()
})

// ─── Importar .md ────────────────────────────────────────────────────────────
importInput.addEventListener('change', () => {
  const file = importInput.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (!content) return
    setEditorContent(editor, content)
    saveDraft(content)
    showSaveStatus('saved')
    showToast(`Arquivo "${file.name}" importado.`, 'success')
    editor.focus()
  }
  reader.readAsText(file)
  importInput.value = '' // reset para permitir reimportar o mesmo arquivo
})

// ─── Compartilhar via URL ────────────────────────────────────────────────────
document.getElementById('share-btn')?.addEventListener('click', () => {
  const md      = editor.state.doc.toString()
  const hash    = encodeToHash(md)
  const url     = `${window.location.origin}${window.location.pathname}${window.location.search}#${hash}`

  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copiado para a área de transferência!', 'success')
  }).catch(() => {
    // fallback: mostra a URL num prompt para o usuário copiar manualmente
    prompt('Copie o link abaixo:', url)
  })
})

// ─── Layout dropdown ──────────────────────────────────────────────────────────
const layoutDropdown = document.getElementById('layout-dropdown')!
const layoutBtn      = document.getElementById('layout-btn') as HTMLButtonElement
const layoutMenu     = document.getElementById('layout-menu') as HTMLElement

function openLayoutMenu() {
  layoutMenu.hidden = false
  layoutDropdown.classList.add('open')
}

function closeLayoutMenu() {
  layoutMenu.hidden = true
  layoutDropdown.classList.remove('open')
}

layoutBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  if (layoutMenu.hidden) openLayoutMenu()
  else closeLayoutMenu()
})

document.addEventListener('click', () => closeLayoutMenu())
layoutMenu.addEventListener('click', (e) => e.stopPropagation())

layoutMenu.querySelectorAll<HTMLButtonElement>('.layout-menu-item[data-layout]').forEach((item) => {
  item.addEventListener('click', () => {
    const layout = item.dataset.layout!
    if (layout === 'default') {
      // Remove qualquer diretiva de layout existente; não insere nada
      insertLine(editor, '<!-- layout: default -->')
    } else {
      insertLine(editor, `<!-- layout: ${layout} -->`)
    }
    closeLayoutMenu()
    editor.focus()
  })
})

document.getElementById('tool-col')?.addEventListener('click', () => {
  insertLine(editor, '<!-- col -->')
  closeLayoutMenu()
  editor.focus()
})

// ─── Sidebar toggle ───────────────────────────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed')
})

// ─── Theme picker ────────────────────────────────────────────────────────────
const themeBadgeEl = document.getElementById('theme-badge')

function applyThemeSelection(theme: Theme) {
  currentTheme = theme
  try { localStorage.setItem(THEME_STORAGE_KEY, theme.id) } catch { /* quota */ }

  // Update active button
  document.querySelectorAll<HTMLButtonElement>('.theme-btn[data-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme.id)
  })

  // Update preview badge
  if (themeBadgeEl) themeBadgeEl.textContent = theme.name

  // Re-render preview
  handleMdChange(editor.state.doc.toString())
}

// Sync initial active state with saved theme
document.querySelectorAll<HTMLButtonElement>('.theme-btn[data-theme]').forEach(btn => {
  btn.classList.toggle('active', btn.dataset.theme === currentTheme.id)
  btn.addEventListener('click', () => {
    const theme = THEMES.find(t => t.id === btn.dataset.theme)
    if (theme) applyThemeSelection(theme)
  })
})

if (themeBadgeEl) themeBadgeEl.textContent = currentTheme.name

// Initial render
handleMdChange(editor.state.doc.toString())

// ─── Navigation ──────────────────────────────────────────────────────────────
prevBtn.addEventListener('click', () => showSlide(currentSlide - 1))
nextBtn.addEventListener('click', () => showSlide(currentSlide + 1))

document.addEventListener('keydown', (e) => {
  if (!presentationOverlay.hidden) return // presentation mode handles its own keys
  if (e.target instanceof HTMLElement && e.target.closest('.cm-editor')) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') showSlide(currentSlide + 1)
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   showSlide(currentSlide - 1)
})

// ─── Resize iframe on window resize ──────────────────────────────────────────
const resizeObserver = new ResizeObserver(() => {
  const wrapper = previewMount.querySelector<HTMLElement>('.slide-wrapper')
  if (iframe && wrapper) scaleFrame(iframe, wrapper)
})
resizeObserver.observe(previewMount)

// ─── Resizer drag ────────────────────────────────────────────────────────────
let dragging = false
resizer.addEventListener('mousedown', (e) => {
  dragging = true
  resizer.classList.add('dragging')
  e.preventDefault()
})
document.addEventListener('mousemove', (e) => {
  if (!dragging) return
  const containerRect = editorPane.parentElement!.getBoundingClientRect()
  const newW = e.clientX - containerRect.left
  const pct  = (newW / containerRect.width) * 100
  if (pct > 15 && pct < 85) {
    editorPane.style.width = `${pct}%`
  }
})
document.addEventListener('mouseup', () => {
  if (!dragging) return
  dragging = false
  resizer.classList.remove('dragging')
  const wrapper = previewMount.querySelector<HTMLElement>('.slide-wrapper')
  if (iframe && wrapper) scaleFrame(iframe, wrapper)
})

// ─── Template loader ─────────────────────────────────────────────────────────
setupTemplateLoader(templateInput, templateBadge, (name) => {
  showToast(`Template carregado: ${name}`, 'success')
})

// ─── Presentation mode ───────────────────────────────────────────────────────
let presentationSlide = 0
let presentationIframe: HTMLIFrameElement | null = null

function scalePresentationFrame(): void {
  if (!presentationIframe) return
  const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540)
  presentationIframe.style.transform = `scale(${scale})`
}

function showPresentationSlide(index: number): void {
  if (!currentSlides.length) return
  presentationSlide = Math.max(0, Math.min(index, currentSlides.length - 1))

  if (!presentationIframe) {
    presentationIframe = document.createElement('iframe')
    presentationIframe.className = 'presentation-frame'
    presentationIframe.setAttribute('sandbox', 'allow-same-origin')
    presentationIframe.setAttribute('title', 'Slide em apresentação')
    presentationSlideArea.appendChild(presentationIframe)
  }

  mountSlideInFrame(presentationIframe, currentSlides[presentationSlide], currentCss)
  scalePresentationFrame()

  presentationCounter.textContent = `${presentationSlide + 1} / ${currentSlides.length}`
  presentationPrevBtn.disabled = presentationSlide === 0
  presentationNextBtn.disabled = presentationSlide === currentSlides.length - 1
}

function enterPresentation(): void {
  if (!currentSlides.length) {
    showToast('Nenhum slide para apresentar.', 'error')
    return
  }
  presentationOverlay.hidden = false
  showPresentationSlide(currentSlide)
  document.documentElement.requestFullscreen?.().catch(() => { /* fullscreen denied — overlay still shows */ })
}

function exitPresentation(): void {
  presentationOverlay.hidden = true
  if (document.fullscreenElement) document.exitFullscreen?.()
}

btnPlay.addEventListener('click', () => enterPresentation())
presentationPrevBtn.addEventListener('click', () => showPresentationSlide(presentationSlide - 1))
presentationNextBtn.addEventListener('click', () => showPresentationSlide(presentationSlide + 1))

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && !presentationOverlay.hidden) {
    presentationOverlay.hidden = true
  }
})

document.addEventListener('keydown', (e) => {
  if (presentationOverlay.hidden) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault()
    showPresentationSlide(presentationSlide + 1)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    showPresentationSlide(presentationSlide - 1)
  } else if (e.key === 'Escape') {
    exitPresentation()
  }
})

window.addEventListener('resize', () => {
  if (!presentationOverlay.hidden) scalePresentationFrame()
})

// ─── Export PDF ──────────────────────────────────────────────────────────────
function exportPdf(): void {
  if (!currentSlides.length) {
    showToast('Nenhum slide para exportar.', 'error')
    return
  }

  const win = window.open('', '_blank')
  if (!win) {
    showToast('Pop-up bloqueado. Permita pop-ups para exportar PDF.', 'error')
    return
  }

  const slidesHtml = currentSlides
    .map(html => `<div class="slide-page">${html}</div>`)
    .join('\n')

  const content = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Exportar PDF — Syntax Gallery</title>
<style>
@page { size: 960px 540px; margin: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: white; }
.slide-page {
  width: 960px;
  height: 540px;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  position: relative;
}
.slide-page:last-child {
  page-break-after: avoid;
  break-after: avoid;
}
section {
  width: 960px !important;
  height: 540px !important;
  position: relative;
  overflow: hidden;
}
${currentCss}
</style>
</head>
<body>
${slidesHtml}
</body>
</html>`

  win.document.open()
  win.document.write(content)
  win.document.close()

  // Aguarda o documento renderizar antes de abrir o diálogo de impressão
  setTimeout(() => {
    win.print()
    win.close()
  }, 400)
}

pdfBtn.addEventListener('click', () => {
  exportPdf()
})

// ─── Download PPTX ───────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', async () => {
  downloadBtn.disabled = true
  downloadBtn.textContent = 'Gerando…'

  try {
    const md = editor.state.doc.toString()
    const { buffer } = getTemplateState()
    const result = await convertToPptx(md, buffer
      ? { templateBuffer: buffer, theme: currentTheme }
      : { theme: currentTheme }
    )
    if (result.overflowed.length > 0) {
      showToast(`PPTX gerado! Atenção: overflow nos slides ${result.overflowed.join(', ')}.`, 'error')
    } else {
      showToast('PPTX gerado com sucesso!', 'success')
    }
  } catch (err) {
    console.error(err)
    showToast('Erro ao gerar PPTX. Veja o console.', 'error')
  } finally {
    downloadBtn.disabled = false
    downloadBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export`
  }
})
