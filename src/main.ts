import './style.css'
import { createEditor, insertAround, insertAtLineStart, setEditorContent, INITIAL_MD } from './editor'
import { renderMarkdown, mountSlideInFrame, createSlideFrame, scaleFrame } from './preview'
import { convertToPptx } from './converter'
import { setupTemplateLoader, getTemplateState } from './template'

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
const newBtn         = document.getElementById('new-btn') as HTMLButtonElement
const importInput    = document.getElementById('import-input') as HTMLInputElement

// ─── State ───────────────────────────────────────────────────────────────────
let currentSlides: string[] = []
let currentCss    = ''
let currentSlide  = 0
let iframe: HTMLIFrameElement | null = null

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
  const result = renderMarkdown(md)
  currentSlides = result.slides
  currentCss    = result.css
  if (currentSlide >= result.count) currentSlide = result.count - 1
  showSlide(currentSlide)
}, 300)

// ─── Editor init ─────────────────────────────────────────────────────────────
const savedDraft = loadDraft()
const editor = createEditor(editorMount, handleMdChange, savedDraft ?? undefined)

if (savedDraft) {
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

// ─── Sidebar toggle ───────────────────────────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed')
})

// Initial render
handleMdChange(editor.state.doc.toString())

// ─── Navigation ──────────────────────────────────────────────────────────────
prevBtn.addEventListener('click', () => showSlide(currentSlide - 1))
nextBtn.addEventListener('click', () => showSlide(currentSlide + 1))

document.addEventListener('keydown', (e) => {
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

// ─── Download PPTX ───────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', async () => {
  downloadBtn.disabled = true
  downloadBtn.textContent = 'Gerando…'

  try {
    const md = editor.state.doc.toString()
    const { buffer } = getTemplateState()
    const result = await convertToPptx(md, buffer ? { templateBuffer: buffer } : {})
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
