export interface TemplateState {
  buffer: ArrayBuffer | null
  name: string | null
}

const state: TemplateState = { buffer: null, name: null }

export function getTemplateState(): TemplateState {
  return state
}

export function setupTemplateLoader(
  input: HTMLInputElement,
  badgeEl: HTMLElement,
  onLoad: (name: string) => void
): void {
  input.addEventListener('change', () => {
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      state.buffer = e.target?.result as ArrayBuffer
      state.name   = file.name
      badgeEl.textContent = file.name
      badgeEl.hidden      = false
      onLoad(file.name)
    }
    reader.readAsArrayBuffer(file)
  })
}
