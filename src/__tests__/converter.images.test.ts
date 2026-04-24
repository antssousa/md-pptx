import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockAddSlide = vi.fn()
const mockWriteFile = vi.fn().mockResolvedValue(undefined)

vi.mock('pptxgenjs', () => ({
  default: class MockPptx {
    layout = ''
    author = ''
    subject = ''
    ShapeType = { line: 'line', rect: 'rect' }

    addSlide() {
      const slide = {
        background: {} as Record<string, unknown>,
        addText: vi.fn(),
        addImage: vi.fn(),
        addTable: vi.fn(),
        addShape: vi.fn(),
      }
      mockAddSlide(slide)
      return slide
    }

    writeFile = mockWriteFile
  },
}))

describe('convertToPptx image sources', () => {
  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2Z6x8AAAAASUVORK5CYII='

  beforeEach(() => {
    mockAddSlide.mockClear()
    mockWriteFile.mockClear()
  })

  it('exports data-url images through addImage', async () => {
    const { convertToPptx } = await import('../converter')

    await convertToPptx(`![local](${tinyPngDataUrl})`)

    const slide = mockAddSlide.mock.calls[0]?.[0]
    expect(slide).toBeDefined()
    expect(slide.addImage).toHaveBeenCalled()
    expect(mockWriteFile).toHaveBeenCalledTimes(1)
  }, 15000)
})
