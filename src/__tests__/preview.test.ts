import { describe, it, expect } from 'vitest'
import { renderMarkdown, preprocessLayoutDirectives, mountSlideInFrame, createSlideFrame, scaleFrame } from '../preview'

// jsdom provê DOMParser, document, etc.

// ─── preprocessLayoutDirectives ───────────────────────────────────────────────

describe('preprocessLayoutDirectives', () => {
  it('não modifica markdown sem diretiva de layout', () => {
    const md = '# Hello\n\nWorld'
    const result = preprocessLayoutDirectives(md)
    expect(result).toContain('# Hello')
    expect(result).toContain('World')
    expect(result).not.toContain('class:')
  })

  it('converte <!-- layout: blank --> em <!-- class: layout-blank -->', () => {
    const md = '<!-- layout: blank -->\n\nConteúdo'
    const result = preprocessLayoutDirectives(md)
    expect(result).toContain('<!-- class: layout-blank -->')
    expect(result).not.toContain('<!-- layout: blank -->')
  })

  it('converte <!-- layout: title-only --> em <!-- class: layout-title-only -->', () => {
    const md = '<!-- layout: title-only -->\n\n# Título'
    const result = preprocessLayoutDirectives(md)
    expect(result).toContain('<!-- class: layout-title-only -->')
  })

  it('converte <!-- layout: caption --> em <!-- class: layout-caption -->', () => {
    const md = '<!-- layout: caption -->\n\nConteúdo\n\n# Legenda'
    const result = preprocessLayoutDirectives(md)
    expect(result).toContain('<!-- class: layout-caption -->')
  })

  it('converte <!-- layout: two-column --> em <!-- class: layout-two-column -->', () => {
    const md = '<!-- layout: two-column -->\n# T\n\nEsq\n\n<!-- col -->\n\nDir'
    const result = preprocessLayoutDirectives(md)
    expect(result).toContain('<!-- class: layout-two-column -->')
  })

  it('two-column: injeta estrutura col-layout com as duas colunas', () => {
    const md = '<!-- layout: two-column -->\n# Título\n\nColuna esquerda\n\n<!-- col -->\n\nColuna direita'
    const result = preprocessLayoutDirectives(md)
    expect(result).toContain('col-layout')
    expect(result).toContain('Coluna esquerda')
    expect(result).toContain('Coluna direita')
    expect(result).not.toContain('<!-- col -->')
  })

  it('two-column: aplica proporcoes customizadas na estrutura gerada', () => {
    const md = '<!-- layout: two-column 40/60 -->\n# Título\n\nColuna esquerda\n\n<!-- col -->\n\nColuna direita'
    const result = preprocessLayoutDirectives(md)
    expect(result).toContain('--column-left: 40')
    expect(result).toContain('--column-right: 60')
  })

  it('two-column: remove o marcador <!-- col --> do output', () => {
    const md = '<!-- layout: two-column -->\n# T\n\nEsq\n\n<!-- col -->\n\nDir'
    const result = preprocessLayoutDirectives(md)
    expect(result).not.toContain('<!-- col -->')
  })

  it('preserva outros slides sem layout inalterados', () => {
    const md = '# Normal\n\n---\n\n<!-- layout: blank -->\nBlank'
    const result = preprocessLayoutDirectives(md)
    // O primeiro slide não deve ter class:
    const parts = result.split('---')
    expect(parts[0]).not.toContain('class:')
    expect(parts[1]).toContain('layout-blank')
  })
})

// ─── renderMarkdown ────────────────────────────────────────────────────────────

describe('renderMarkdown', () => {
  it('retorna pelo menos um slide para markdown simples', () => {
    const result = renderMarkdown('# Hello\n\nWorld')
    expect(result.count).toBeGreaterThanOrEqual(1)
    expect(result.slides).toHaveLength(result.count)
  })

  it('retorna CSS como string contendo o CSS de layout', () => {
    const result = renderMarkdown('# Test')
    expect(typeof result.css).toBe('string')
    expect(result.css).toContain('layout-blank')
    expect(result.css).toContain('layout-two-column')
    expect(result.css).toContain('layout-title-only')
    expect(result.css).toContain('layout-caption')
  })

  it('não lança exceção para string vazia', () => {
    expect(() => renderMarkdown('')).not.toThrow()
  })

  it('divide múltiplos slides por separador ---', () => {
    const md = '# Slide 1\n\n---\n\n# Slide 2\n\n---\n\n# Slide 3'
    const result = renderMarkdown(md)
    expect(result.count).toBeGreaterThanOrEqual(3)
  })

  it('todos os slides são strings', () => {
    const result = renderMarkdown('# Hello')
    result.slides.forEach(slide => expect(typeof slide).toBe('string'))
  })

  it('layout blank: slide contém class layout-blank', () => {
    const result = renderMarkdown('<!-- layout: blank -->\n\nConteúdo')
    const combined = result.slides.join('')
    expect(combined).toContain('layout-blank')
  })

  it('layout title-only: slide contém class layout-title-only', () => {
    const result = renderMarkdown('<!-- layout: title-only -->\n\n# Só Título')
    const combined = result.slides.join('')
    expect(combined).toContain('layout-title-only')
  })

  it('layout caption: slide contém class layout-caption', () => {
    const result = renderMarkdown('<!-- layout: caption -->\n\nConteúdo\n\n# Legenda')
    const combined = result.slides.join('')
    expect(combined).toContain('layout-caption')
  })

  it('layout two-column: slide contém class layout-two-column e estrutura de colunas', () => {
    const md = '<!-- layout: two-column -->\n# Título\n\nEsquerda\n\n<!-- col -->\n\nDireita'
    const result = renderMarkdown(md)
    const combined = result.slides.join('')
    expect(combined).toContain('layout-two-column')
    expect(combined).toContain('col-layout')
  })

  it('layout two-column: preserva proporcoes customizadas no HTML renderizado', () => {
    const md = '<!-- layout: two-column 30/70 -->\n# Título\n\nEsquerda\n\n<!-- col -->\n\nDireita'
    const result = renderMarkdown(md)
    const combined = result.slides.join('')
    expect(combined).toContain('--column-left: 30')
    expect(combined).toContain('--column-right: 70')
  })

  // ─── Segurança ────────────────────────────────────────────────────────────

  it('não contém tag <script> executável no HTML de saída', () => {
    const result = renderMarkdown('# Test\n\n<script>alert("xss")</script>')
    const combined = result.slides.join('')
    expect(combined).not.toContain('<script')
    expect(combined).not.toContain('</script>')
  })

  it('não injeta atributo onerror em elementos do DOM', () => {
    const result = renderMarkdown('# Test\n\n<img src="x" onerror="alert(1)">')
    const parser = new DOMParser()
    result.slides.forEach(slide => {
      const doc = parser.parseFromString(slide, 'text/html')
      expect(doc.querySelectorAll('[onerror]').length).toBe(0)
    })
  })

  it('não injeta atributo onclick em elementos do DOM', () => {
    const result = renderMarkdown('# Test\n\n<button onclick="alert(1)">click</button>')
    const parser = new DOMParser()
    result.slides.forEach(slide => {
      const doc = parser.parseFromString(slide, 'text/html')
      expect(doc.querySelectorAll('[onclick]').length).toBe(0)
    })
  })

  it('não contém href com javascript: em links', () => {
    const result = renderMarkdown('# Test\n\n[click](javascript:alert(1))')
    const combined = result.slides.join('')
    expect(combined).not.toMatch(/href\s*=\s*["']?\s*javascript:/i)
  })
})

// ─── createSlideFrame ─────────────────────────────────────────────────────────

describe('createSlideFrame', () => {
  it('cria um iframe e o adiciona ao wrapper', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)
    const iframe = createSlideFrame(wrapper)
    expect(wrapper.contains(iframe)).toBe(true)
    expect(iframe.tagName).toBe('IFRAME')
    wrapper.remove()
  })

  it('aplica atributo sandbox ao iframe criado', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)
    const iframe = createSlideFrame(wrapper)
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin')
    wrapper.remove()
  })

  it('aplica classe slide-frame ao iframe', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)
    const iframe = createSlideFrame(wrapper)
    expect(iframe.classList.contains('slide-frame')).toBe(true)
    wrapper.remove()
  })

  it('aplica atributo title acessível ao iframe', () => {
    const wrapper = document.createElement('div')
    document.body.appendChild(wrapper)
    const iframe = createSlideFrame(wrapper)
    expect(iframe.getAttribute('title')).toBeTruthy()
    wrapper.remove()
  })
})

// ─── scaleFrame ───────────────────────────────────────────────────────────────

describe('scaleFrame', () => {
  it('aplica transform scale ao iframe', () => {
    const mount = document.createElement('div')
    Object.defineProperty(mount, 'clientWidth',  { value: 1024, configurable: true })
    Object.defineProperty(mount, 'clientHeight', { value: 600,  configurable: true })
    const wrapper = document.createElement('div')
    mount.appendChild(wrapper)
    document.body.appendChild(mount)
    const iframe = document.createElement('iframe')
    wrapper.appendChild(iframe)
    scaleFrame(iframe, wrapper)
    expect(iframe.style.transform).toMatch(/scale\(/)
    mount.remove()
  })

  it('scale não excede 1 quando wrapper é menor que 960×540', () => {
    const mount = document.createElement('div')
    Object.defineProperty(mount, 'clientWidth',  { value: 500, configurable: true })
    Object.defineProperty(mount, 'clientHeight', { value: 300, configurable: true })
    const wrapper = document.createElement('div')
    mount.appendChild(wrapper)
    document.body.appendChild(mount)
    const iframe = document.createElement('iframe')
    wrapper.appendChild(iframe)
    scaleFrame(iframe, wrapper)
    const scale = parseFloat(iframe.style.transform.replace('scale(', '').replace(')', ''))
    expect(scale).toBeLessThan(1)
    mount.remove()
  })

  it('permite ampliar acima de 1x quando a viewport do preview e maior que o slide base', () => {
    const mount = document.createElement('div')
    Object.defineProperty(mount, 'clientWidth',  { value: 1600, configurable: true })
    Object.defineProperty(mount, 'clientHeight', { value: 900, configurable: true })
    const wrapper = document.createElement('div')
    mount.appendChild(wrapper)
    document.body.appendChild(mount)
    const iframe = document.createElement('iframe')
    wrapper.appendChild(iframe)
    scaleFrame(iframe, wrapper)
    const scale = parseFloat(iframe.style.transform.replace('scale(', '').replace(')', ''))
    expect(scale).toBeGreaterThan(1)
    mount.remove()
  })
})

// ─── mountSlideInFrame ────────────────────────────────────────────────────────

describe('mountSlideInFrame', () => {
  it('não lança exceção quando iframe não tem contentDocument', () => {
    const iframe = document.createElement('iframe')
    expect(() => mountSlideInFrame(iframe, '<section>test</section>', '')).not.toThrow()
  })
})
