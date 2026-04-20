# Handoff — Syntax Gallery (md-pptx)

**Data:** 2026-04-19  
**Status:** Projeto com roadmap 100% completo. Sessão mais recente aplicou correção de CSS nos layouts do preview.

---

## O que é o projeto

Ferramenta web **100% client-side** que converte Markdown em apresentações PowerPoint profissionais, com live preview via Marp.

URL de desenvolvimento: `http://localhost:5173` (Vite)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Editor | CodeMirror 6 (`src/editor.ts`) |
| Preview | Marp Core (`src/preview.ts`) — iframes com `sandbox="allow-same-origin"` |
| PPTX | PptxGenJS (`src/converter.ts`) |
| Parser MD | unified + remark-parse + remark-gfm |
| Diagramas | Mermaid.js (`src/mermaid.ts`) — SVG → data URL → imagem |
| Temas | `src/themes.ts` — 3 temas built-in |
| Projetos | `src/storage.ts` — múltiplos projetos no localStorage |
| Build | Vite + TypeScript + vite-plugin-pwa (PWA offline-first) |
| Testes | Vitest + jsdom — **101 testes, todos passando** |

---

## Comandos

```bash
npm run dev          # dev server (localhost:5173)
npm run build        # tsc + vite build → dist/
npm run preview      # serve dist/ localmente
npm run test         # vitest run (headless)
npm run test:watch   # vitest interativo
```

---

## Arquitetura — Módulos principais

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/main.ts` | Orquestração: estado global, eventos DOM, auto-save, URL hash, temas, projetos, PDF, modo apresentação |
| `src/editor.ts` | CodeMirror 6: cria editor, helpers de inserção (`insertAround`, `insertAtLineStart`, `insertLine`) |
| `src/preview.ts` | `renderMarkdown(md, theme)` → Marp → array de HTML por slide; helpers de iframe; `preprocessLayoutDirectives`; `preprocessMermaid` |
| `src/converter.ts` | `convertToPptx(md, options)` → PptxGenJS; sistema de layouts; auto-shrink de fonte; `estimateSlideDensities` |
| `src/themes.ts` | Definição dos 3 temas; `ThemeColors`, `Theme`, `getTheme()` |
| `src/storage.ts` | CRUD de projetos no localStorage; `listProjects`, `createProject`, `loadProjectContent`, `deleteProject` |
| `src/template.ts` | Carrega template `.pptx` externo (Slide Master) |
| `src/mermaid.ts` | `renderMermaidSvg(code, themeId)` → SVG string; `svgToDataUrl` |

---

## Sistema de Layouts

Slides aceitam a diretiva `<!-- layout: TYPE -->`:

| Layout | Comportamento |
|--------|--------------|
| `default` | Título no topo, área de conteúdo abaixo (padrão Marp) |
| `two-column` | Título + 2 colunas (divididas por `<!-- col -->`) |
| `blank` | Conteúdo preenche o slide, sem título destacado |
| `title-only` | Apenas título, centralizado verticalmente |
| `caption` | Conteúdo no topo, título como legenda no rodapé com borda colorida |

**Fluxo:** `preprocessLayoutDirectives()` em `preview.ts` transforma `<!-- layout: TYPE -->` em `<!-- class: layout-TYPE -->` antes de passar para o Marp. Para `two-column`, também injeta `<div class="col-layout">` / `<div class="col">` ao redor do conteúdo.

**CSS dos layouts:** gerado dinamicamente por `buildLayoutCss(colors: ThemeColors)` em `preview.ts`, usando as cores do tema ativo para evitar cores hardcoded.

**Ordem de injeção de CSS no iframe:**
```
result.css (Marp) + buildLayoutCss(colors) + theme.colors.previewCss
```
`previewCss` vem por último e usa `!important` extensivamente → todos os overrides de layout em `buildLayoutCss` precisam de `!important` para não serem sobrescritos.

---

## Sistema de Temas

Três temas built-in em `src/themes.ts`:
- **Dark Catppuccin** (`catppuccin`) — escuro, roxo/azul
- **Corporate Clean** (`corporate`) — claro, azul corporativo
- **Minimal Light** (`minimal`) — claro, minimalista

Cada tema define `ThemeColors` com:
- `background`, `foreground`, `accentColor`, `dividerColor` (hex sem `#`)
- `previewCss` — CSS injetado no iframe do preview
- `codeBackground`, `codeText` — cores para blocos de código

O tema ativo é persistido em `localStorage` com a chave `md-pptx-theme`.  
Os temas afetam simultaneamente o preview HTML e o PPTX gerado.

---

## Sistema de Projetos

`src/storage.ts` implementa CRUD de projetos no localStorage:

- **Chave de índice:** `md-pptx-projects` — array de metadados `ProjectMeta[]`
- **Chave de conteúdo:** `md-pptx-proj-{id}` — markdown do projeto
- **Projeto atual:** `md-pptx-current-id`
- Máximo de 10 projetos listados na sidebar
- Auto-save com debounce de 300ms
- Nome do projeto extraído do primeiro `# Heading` do markdown

---

## Funcionalidades Implementadas (todas 12)

| # | Feature | Onde |
|---|---------|------|
| 1 | Auto-save localStorage | `main.ts` + `storage.ts` |
| 2 | Importar `.md` | `main.ts` (file picker) |
| 3 | Botões de layout na toolbar | `main.ts` + `index.html` |
| 4 | Compartilhar via URL (hash base64) | `main.ts` |
| 5 | Temas visuais (3 built-in) | `themes.ts` + seletor na sidebar |
| 6 | Exportar PDF | `main.ts` (`exportPdf()`) via `window.print()` |
| 7 | Modo apresentação fullscreen | `main.ts` + overlay DOM |
| 8 | Múltiplos projetos salvos | `storage.ts` + sidebar |
| 9 | Syntax highlighting PPTX | `converter.ts` (Shiki → TextProps runs) |
| 10 | Diagramas Mermaid | `mermaid.ts` + `preview.ts` |
| 11 | Indicador de densidade por slide | `main.ts` + `converter.ts` (`estimateSlideDensities`) |
| 12 | Atalhos de teclado documentados | Modal `#shortcuts-modal` em `index.html` |

---

## Última sessão de trabalho — Correção de Layouts CSS

### Problema
Os layouts `blank`, `title-only` e `caption` não estavam renderizando corretamente no preview. O CSS de layout era sobrescrito pelo `previewCss` do tema.

### Causa raiz
A função `buildLayoutCss()` em `src/preview.ts` gerava CSS **sem** `!important`, mas o `theme.colors.previewCss` (injetado depois, por último) usa `!important` em todos os seus seletores. Resultado: as sobreposições de layout perdiam para o tema.

Exemplos de conflito:
- `section.layout-blank h1 { border-bottom: none }` → perdeu para `h1 { border-bottom: 2px solid !important }`
- `section.layout-title-only { display: flex }` → perdeu para `section { display: block !important }`
- `section.layout-caption h1 { border-bottom: none }` → não tinha nenhum rule, aparecia com borda dupla

### Fix aplicado (`src/preview.ts`)

1. **Adicionado `!important`** em todos os overrides de `buildLayoutCss` que precisam vencer o `previewCss` do tema:
   - `blank` h1/h2: `font-size`, `margin-top`, `border-bottom`, `background`
   - `title-only` section: `display`, `flex-direction`, `justify-content`, `align-items`, `text-align`
   - `title-only` h1: `font-size`, `margin`, `border-bottom`
   - `caption` section: `display`, `flex-direction`, `padding-bottom`
   - `caption` h1/h2: `font-size`, `margin-top`, `padding-top`, `border-bottom`, `border-top`

2. **Corrigido seletor do `caption`:**
   - Antes: `section.layout-caption > *:not(h1):not(h2)`
   - Depois: `section.layout-caption > *:not(h1):not(h2):not(header):not(footer)`
   - Motivo: Marp injeta `<header>` e `<footer>` nos slides; eles recebiam `flex: 1` e distorciam o layout.

### Estado dos testes após o fix
```
Test Files  4 passed (4)
Tests  101 passed (101)
```

---

## O que ainda falta fazer

**Nenhuma feature do roadmap original está pendente.** Todas as 12 foram entregues.

### Melhorias/bugs conhecidos (não priorizados)

1. **Fidelidade preview ↔ PPTX** — o preview usa Marp (HTML/CSS) e o PPTX é gerado por PptxGenJS com layout manual. Há divergências inevitáveis de fontes e espaçamento entre os dois.

2. **Layout `two-column` no PPTX** — funciona, mas a largura das colunas é fixa (50/50). Não há suporte a proporções customizáveis (ex: `<!-- layout: two-column 40/60 -->`).

3. **Imagens no PPTX** — imagens externas (URL) são embutidas no PPTX via fetch. Imagens locais (drag & drop no editor) ainda não são suportadas no PPTX — aparecem apenas no preview.

4. **Mermaid no PPTX** — diagramas Mermaid são convertidos para SVG e inseridos como imagem no preview. No PPTX, a imagem SVG precisa ser rasterizada (Canvas API) para funcionar corretamente no PowerPoint, mas atualmente é embutida como PNG via conversão simples.

5. **Performance** — Mermaid renderiza no thread principal. Com muitos diagramas, o preview pode travar por alguns segundos ao editar.

6. **Export Google Slides** — marcado como "Won't Have" no PRD original, mas seria possível via Google Slides API.

7. **Temas customizáveis pelo usuário** — atualmente só 3 temas built-in, sem editor de tema.

---

## Convenções do projeto

- Cores no PPTX: hex **sem** `#` (ex: `'1e1e2e'`)
- Medidas no PPTX: **polegadas** (slide 16:9 = 10" × 5.625", margem 0.5")
- Diretivas HTML nos slides (`<!-- layout: ... -->`, `<!-- col -->`) são filtradas antes do render no PPTX
- O preview usa Marp com `html: true` — output sanitizado via DOMPurify
- Todos os slides do PPTX recebem número de página no canto inferior direito
- Testes unitários em `src/__tests__/converter.test.ts` — 101 testes cobrindo converter, preview, layouts e temas

---

## Git — Últimos commits

```
cb61453 feat: modo apresentação fullscreen
6309bc1 feat: exportar PDF + CLAUDE.md no .gitignore
2120895 feat: auto-save localStorage + importar .md + botão Novo
d365852 Merge branch 'master'
7fcb80c feat: initial project — Markdown to PPTX converter (Syntax Gallery)
```

> Nota: a correção de CSS de layouts (sessão 2026-04-19) não foi commitada ainda.
