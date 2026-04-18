# Syntax Gallery — MD → PPTX

> Converta Markdown em apresentações PowerPoint profissionais, diretamente no browser. Sem servidores, sem instalação — tudo client-side.

![preview](stitch/layouts.png)

## Funcionalidades

- **Editor em tempo real** — CodeMirror com syntax highlighting para Markdown
- **Live Preview 16:9** — renderização fiel via Marp, atualizada a cada keystroke
- **Geração PPTX no browser** — PptxGenJS gera o arquivo sem enviar dados a servidores
- **5 layouts de slide** — selecionáveis por diretiva Markdown
- **Suporte a rich text** — negrito, itálico, código inline, listas, tabelas, blockquotes, imagens, blocos de código
- **Auto-Shrink de fonte** — reduz automaticamente o tamanho se o conteúdo não couber
- **Alerta de overflow** — avisa quais slides ultrapassaram a altura antes do download
- **Templates .pptx** — carregue um arquivo como Slide Master
- **PWA** — funciona offline após a primeira visita
- **88 testes automatizados** — cobertura de todas as funções críticas

## Layouts de Slide

Adicione `<!-- layout: TIPO -->` em qualquer ponto do slide para selecionar o layout:

| Tipo | Descrição |
|------|-----------|
| `default` | Título no topo, conteúdo abaixo *(padrão)* |
| `two-column` | Título + duas colunas divididas por `<!-- col -->` |
| `blank` | Conteúdo preenche o slide inteiro, sem título destacado |
| `title-only` | Só o título, centralizado verticalmente |
| `caption` | Conteúdo/imagem no topo, título como legenda no rodapé |

```markdown
# Slide padrão

Conteúdo normal abaixo do título.

---

<!-- layout: two-column -->
# Comparativo

Coluna da esquerda com texto livre.

<!-- col -->

Coluna da direita com listas:
- Item A
- Item B

---

<!-- layout: blank -->

Slide totalmente livre, sem área de título reservada.

---

<!-- layout: title-only -->

# Uma Frase de Impacto

---

<!-- layout: caption -->

![Gráfico de resultados](https://exemplo.com/grafico.png)

# Fonte: Relatório Anual 2024
```

## Sintaxe Markdown Suportada

```markdown
# Título principal (h1)
## Subtítulo (h2)

Parágrafo com **negrito**, _itálico_ e `código inline`.

- Lista não-ordenada
- Com **formatação** dentro

1. Lista ordenada
2. Numerada automaticamente

> Blockquote para citações ou destaques

| Coluna A | Coluna B |
|----------|----------|
| Dado 1   | Dado 2   |

\`\`\`python
def hello():
    print("Hello, World!")
\`\`\`

![Alt text](https://url-da-imagem.png)

---  ← separador de slides
```

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Build | Vite + TypeScript |
| Editor | CodeMirror 6 |
| Preview | Marp Core |
| Parser MD | Unified / Remark + remark-gfm |
| Geração PPTX | PptxGenJS |
| Sanitização | DOMPurify |
| Testes | Vitest + jsdom |
| PWA | vite-plugin-pwa |

## Início Rápido

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento (http://localhost:5173)
npm run dev

# Build de produção
npm run build

# Executar testes
npm test

# Testes com cobertura
npm run test:coverage
```

## Estrutura do Projeto

```
md-pptx/
├── src/
│   ├── main.ts          # Ponto de entrada, orquestração da UI
│   ├── converter.ts     # Parser MD → PPTX (PptxGenJS)
│   ├── preview.ts       # Renderização Marp + CSS de layouts
│   ├── editor.ts        # Setup do CodeMirror
│   ├── template.ts      # Carregamento de templates .pptx
│   ├── style.css        # Estilos globais (dark theme)
│   └── __tests__/       # 88 testes automatizados
│       ├── converter.test.ts
│       ├── preview.test.ts
│       └── template.test.ts
├── index.html
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

## Como Usar

1. Abra a aplicação no browser
2. Escreva ou cole seu Markdown no editor (esquerda)
3. Visualize o preview ao vivo (direita)
4. Opcionalmente, carregue um arquivo `.pptx` como template via botão **Template**
5. Clique em **Export** para baixar o arquivo `.pptx`

## Licença

MIT
