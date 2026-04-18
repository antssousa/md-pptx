import { describe, it, expect, vi, afterEach } from 'vitest'
import { getTemplateState, setupTemplateLoader } from '../template'

describe('getTemplateState', () => {
  it('retorna objeto com propriedades buffer e name', () => {
    const state = getTemplateState()
    expect(state).toHaveProperty('buffer')
    expect(state).toHaveProperty('name')
  })

  it('retorna a mesma referência de objeto (singleton)', () => {
    expect(getTemplateState()).toBe(getTemplateState())
  })
})

describe('setupTemplateLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('não faz nada quando nenhum arquivo é selecionado', () => {
    const input  = document.createElement('input')
    const badge  = document.createElement('span')
    const onLoad = vi.fn()

    setupTemplateLoader(input, badge, onLoad)
    input.dispatchEvent(new Event('change'))

    expect(onLoad).not.toHaveBeenCalled()
  })

  it('chama onLoad com o nome do arquivo após FileReader concluir', async () => {
    const input  = document.createElement('input')
    input.type   = 'file'
    const badge  = document.createElement('span')
    badge.hidden = true
    const onLoad = vi.fn()

    setupTemplateLoader(input, badge, onLoad)

    const fakeBuffer = new ArrayBuffer(8)
    const fakeFile   = new File([fakeBuffer], 'template.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })

    // FileReader mock como classe real (necessário para `new FileReader()`)
    const OriginalFileReader = globalThis.FileReader
    class MockFileReader {
      onload:  ((e: Partial<ProgressEvent<FileReader>>) => void) | null = null
      onerror: (() => void) | null = null
      readAsArrayBuffer(_blob: Blob) {
        // Simula callback assíncrono
        setTimeout(() => {
          this.onload?.({
            target: { result: fakeBuffer } as unknown as FileReader,
          })
        }, 0)
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader

    // Simula input.files
    Object.defineProperty(input, 'files', {
      value: {
        0: fakeFile,
        length: 1,
        item: (i: number) => (i === 0 ? fakeFile : null),
        [Symbol.iterator]: function* () { yield fakeFile },
      },
      configurable: true,
    })

    input.dispatchEvent(new Event('change'))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(onLoad).toHaveBeenCalledWith('template.pptx')

    globalThis.FileReader = OriginalFileReader
  })

  it('atualiza o badge com o nome do arquivo', async () => {
    const input  = document.createElement('input')
    input.type   = 'file'
    const badge  = document.createElement('span')
    badge.hidden = true
    const onLoad = vi.fn()

    setupTemplateLoader(input, badge, onLoad)

    const fakeBuffer = new ArrayBuffer(4)
    const fakeFile   = new File([fakeBuffer], 'meu-template.pptx')

    const OriginalFileReader = globalThis.FileReader
    class MockFileReader {
      onload:  ((e: Partial<ProgressEvent<FileReader>>) => void) | null = null
      onerror: (() => void) | null = null
      readAsArrayBuffer(_blob: Blob) {
        setTimeout(() => this.onload?.({ target: { result: fakeBuffer } as unknown as FileReader }), 0)
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader

    Object.defineProperty(input, 'files', {
      value: { 0: fakeFile, length: 1, item: (i: number) => (i === 0 ? fakeFile : null) },
      configurable: true,
    })

    input.dispatchEvent(new Event('change'))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(badge.textContent).toBe('meu-template.pptx')
    expect(badge.hidden).toBe(false)

    globalThis.FileReader = OriginalFileReader
  })

  it('armazena o buffer no state após carregamento', async () => {
    const input  = document.createElement('input')
    input.type   = 'file'
    const badge  = document.createElement('span')
    const onLoad = vi.fn()

    setupTemplateLoader(input, badge, onLoad)

    const fakeBuffer = new ArrayBuffer(16)
    const fakeFile   = new File([fakeBuffer], 'deck.pptx')

    const OriginalFileReader = globalThis.FileReader
    class MockFileReader {
      onload:  ((e: Partial<ProgressEvent<FileReader>>) => void) | null = null
      onerror: (() => void) | null = null
      readAsArrayBuffer(_blob: Blob) {
        setTimeout(() => this.onload?.({ target: { result: fakeBuffer } as unknown as FileReader }), 0)
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader

    Object.defineProperty(input, 'files', {
      value: { 0: fakeFile, length: 1, item: (i: number) => (i === 0 ? fakeFile : null) },
      configurable: true,
    })

    input.dispatchEvent(new Event('change'))
    await new Promise(resolve => setTimeout(resolve, 20))

    const state = getTemplateState()
    expect(state.buffer).toBe(fakeBuffer)
    expect(state.name).toBe('deck.pptx')

    globalThis.FileReader = OriginalFileReader
  })
})
