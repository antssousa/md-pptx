# Handoff - Syntax Gallery (md-pptx)

**Data:** 2026-04-19  
**Status:** produto funcional e validado; hardening tecnico concluido ate a Sprint 8, restando apenas verificacao final de release.

---

## O que e o projeto

Aplicacao web **100% client-side** para converter Markdown em apresentacoes PowerPoint, com preview em tempo real via Marp, export PPTX no browser, export PDF, modo apresentacao e persistencia local de multiplos projetos.

URL de desenvolvimento: `http://localhost:5173`

---

## Estado atual validado

- `npm test`: **109/109** testes passando
- `npm run build`: PASS
- Preview HTML, export PPTX e fluxo visual principal estao sincronizados com a base visual de `stitch/Syntax Gallery.html`

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Editor | CodeMirror 6 (`src/editor.ts`) |
| Preview | Marp Core (`src/preview.ts`) |
| PPTX | PptxGenJS (`src/converter.ts`) |
| Parser MD | unified + remark-parse + remark-gfm |
| Diagramas | Mermaid (`src/mermaid.ts`) |
| Temas | `src/themes.ts` |
| Projetos | `src/storage.ts` |
| Build | Vite + TypeScript + vite-plugin-pwa |
| Testes | Vitest + jsdom |

---

## Modulos principais

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/main.ts` | Orquestracao da UI, eventos DOM, auto-save, URL hash, tabs, preview, PDF, modo apresentacao, projetos |
| `src/editor.ts` | Inicializacao do CodeMirror e helpers de insercao |
| `src/preview.ts` | `renderMarkdown`, preprocessamento de layouts, preprocessamento Mermaid e montagem do iframe |
| `src/converter.ts` | `convertToPptx`, sistema de layouts, export de rich text, imagens, Mermaid e estimativa de densidade |
| `src/layout-directives.ts` | Parser compartilhado de `<!-- layout: ... -->`, incluindo proporcao de `two-column` |
| `src/mermaid.ts` | Render Mermaid -> SVG, extracao de proporcao do SVG |
| `src/themes.ts` | Temas built-in e tokens de cor |
| `src/storage.ts` | CRUD de projetos no localStorage |
| `src/template.ts` | Carregamento de template `.pptx` |

---

## Funcionalidades implementadas

- Editor Markdown em tempo real
- Preview 16:9 via Marp
- Export PPTX no browser
- Export PDF via `window.print()`
- Modo apresentacao fullscreen
- Multiplos projetos persistidos no localStorage
- Compartilhamento via URL hash
- 5 layouts de slide: `default`, `two-column`, `blank`, `title-only`, `caption`
- `two-column` com proporcoes customizaveis, ex.: `<!-- layout: two-column 40/60 -->`
- Syntax highlighting em blocos de codigo no PPTX
- Mermaid no preview e no PPTX
- Indicador de densidade por slide
- Templates `.pptx`
- PWA offline-first

---

## Layouts

Diretiva suportada:

```markdown
<!-- layout: default -->
<!-- layout: two-column -->
<!-- layout: two-column 40/60 -->
<!-- layout: blank -->
<!-- layout: title-only -->
<!-- layout: caption -->
```

Para `two-column`, o marcador de quebra continua sendo:

```markdown
<!-- col -->
```

### Implementacao

- `src/layout-directives.ts` faz o parse compartilhado da diretiva
- `src/preview.ts` aplica a proporcao no HTML via CSS variables
- `src/converter.ts` aplica a mesma proporcao na geometria do PPTX

---

## Mermaid

### Preview

- `preprocessMermaid()` em `src/preview.ts` renderiza blocos Mermaid para SVG e injeta `data:image/svg+xml;base64,...` no markdown antes do Marp

### PPTX

- `src/converter.ts` chama `renderMermaidSvg()`
- o diagrama e embutido como **SVG** no slide, sem rasterizacao para JPEG
- a proporcao e derivada do `viewBox` ou de `width/height` por `extractSvgAspectRatio()`

Isso melhorou a fidelidade em relacao ao caminho anterior de rasterizacao.

---

## Imagens no PPTX

### Suportado

- imagens remotas `http/https`
- imagens `data:image/...;base64,...`

### Nao suportado diretamente

- caminhos locais do filesystem como `C:\...` ou caminhos relativos crus no markdown

Observacao: o exportador hoje trata corretamente imagens em `data:` e aplica fallback seguro quando a etapa de resize nao conclui.

---

## Performance

O hardening de performance aplicado nesta sessao foi:

- `pptxgenjs` carregado sob demanda em `convertToPptx()`
- `shiki` carregado sob demanda ao tokenizar codigo para export
- `mermaid` carregado sob demanda em `src/mermaid.ts`

Efeito observado no build:

- chunks dedicados para `pptx` e `mermaid`
- bundle de entrada reduzido em relacao ao estado anterior

### Ainda conhecido

- o chunk de Marp continua muito grande
- alguns chunks de linguagens/diagramas ainda excedem o warning de 500 kB

Isso ficou explicitamente reservado para iteracoes futuras, caso performance de first load vire prioridade de produto.

---

## Testes

Arquivos atuais em `src/__tests__/`:

- `converter.test.ts`
- `converter.images.test.ts`
- `editor.test.ts`
- `preview.test.ts`
- `template.test.ts`

Cobertura validada no momento do handoff:

- layouts
- preview
- export PPTX
- imagens `data:`
- Mermaid no export
- editor
- template loader

---

## Comandos

```bash
npm run dev
npm run build
npm run preview
npm test
npm run test:coverage
```

---

## Limites conhecidos

1. Preview HTML e PPTX ainda nao sao pixel-perfect; existem diferencas inevitaveis entre CSS/HTML e PptxGenJS.
2. O app ainda depende de renderizacao no thread principal para alguns caminhos pesados de preview.
3. O bundle de Marp e de alguns pacotes de diagramas continua grande mesmo apos o deferimento inicial.

---

## Ultimas trilhas de trabalho desta sessao

1. Migracao visual da interface para a referencia `stitch/Syntax Gallery.html`
2. Tabs centrais `Editor`, `Templates`, `History`
3. Fluxo documentado de regressao visual com `samples/`
4. Suporte explicito a imagens `data:` no export PPTX
5. `two-column` com proporcoes configuraveis em preview e export
6. Mermaid exportado como SVG no PPTX
7. Lazy loading de dependencias pesadas (`pptxgenjs`, `shiki`, `mermaid`)
8. Alinhamento de `README.md` e deste `HANDOFF.md`

---

## Proximo passo recomendado

Executar a verificacao final de readiness:

- rodar `npm test`
- rodar `npm run build`
- validar manualmente pelo menos 2 arquivos de `samples/`, incluindo um com imagem e um com Mermaid
- registrar riscos residuais de release
