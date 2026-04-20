---
marp: true
---

# Aurora Design System
## Guia de componentes e tokens — v2.0

---

# O que é um Design System?

Um **design system** é o conjunto de padrões, componentes e diretrizes que garante consistência visual e funcional em todos os produtos.

> "Design systems não são sobre ferramentas. São sobre criar uma linguagem compartilhada entre design e engenharia."

- Componentes reutilizáveis
- Tokens de design (cores, tipografia, espaçamento)
- Documentação e exemplos de uso

---

<!-- layout: two-column -->

# Princípios de Design

Os quatro pilares que guiam todas as decisões do Aurora.

<!-- col -->

## Claridade
Cada elemento tem um propósito claro. Eliminamos o ruído visual para focar no que importa. Hierarquia explícita, nunca implícita.

## Eficiência
O usuário completa suas tarefas com o mínimo de esforço cognitivo. Padrões familiares, affordances óbvias, feedback imediato.

## Acessibilidade
Contraste mínimo WCAG AA em todos os componentes. Navegação completa por teclado. Suporte a leitores de tela.

## Consistência
Mesma ação, mesmo resultado — sempre. Vocabulário visual uniforme em todos os produtos da empresa.

---

# Paleta de Cores

| Token                  | Hex     | Uso                              |
|------------------------|---------|----------------------------------|
| `--color-primary`      | #2563EB | Ações principais, links          |
| `--color-primary-dark` | #1D4ED8 | Hover, estados ativos            |
| `--color-success`      | #16A34A | Confirmação, estados positivos   |
| `--color-warning`      | #D97706 | Alertas, atenção necessária      |
| `--color-danger`       | #DC2626 | Erros, ações destrutivas         |
| `--color-neutral-50`   | #F8FAFC | Background de página             |
| `--color-neutral-900`  | #0F172A | Texto primário                   |

---

<!-- layout: two-column -->

# Tipografia

Fonte principal: **Inter** · Fonte de código: **JetBrains Mono**

<!-- col -->

## Escala de tamanhos

| Token      | px  | Uso             |
|------------|-----|-----------------|
| `--text-xs`  | 12 | Legendas, labels|
| `--text-sm`  | 14 | Corpo secundário|
| `--text-base`| 16 | Corpo principal |
| `--text-lg`  | 18 | Subtítulos      |
| `--text-xl`  | 20 | Títulos seção   |
| `--text-2xl` | 24 | H3              |
| `--text-4xl` | 36 | H1 de página    |

## Pesos utilizados

- `400` Regular — corpo de texto
- `500` Medium — labels e botões
- `600` Semibold — subtítulos
- `700` Bold — títulos e destaques

---

# Sistema de Espaçamento

Escala base de **4px** — todos os valores são múltiplos de 4.

```css
/* Tokens de espaçamento */
--space-1:  4px;   /* gap mínimo entre elementos inline */
--space-2:  8px;   /* padding de componentes compactos */
--space-3:  12px;  /* gap entre elementos relacionados */
--space-4:  16px;  /* padding padrão de componentes */
--space-6:  24px;  /* separação entre seções internas */
--space-8:  32px;  /* margem entre componentes */
--space-12: 48px;  /* espaço entre seções de página */
--space-16: 64px;  /* seções maiores */
```

---

<!-- layout: two-column -->

# Componente: Button

O botão é o componente de ação principal. Três variantes, três tamanhos.

<!-- col -->

## Variantes
- **Primary** — ação principal da tela (1 por tela)
- **Secondary** — ações secundárias, outline
- **Ghost** — ações terciárias, sem borda

## Estados
- `default` — estado normal
- `hover` — cursor sobre o botão
- `focus` — navegação por teclado
- `disabled` — ação indisponível
- `loading` — aguardando resposta

---

# Anatomia de um Componente

```typescript
// Contrato de props — cada componente tem um tipo claro
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost'
  size:    'sm' | 'md' | 'lg'
  label:   string
  onClick: () => void
  disabled?: boolean
  loading?:  boolean
  icon?:     React.ReactNode  // ícone à esquerda do label
}
```

---

<!-- layout: blank -->

# Governança do Design System

**Comitê de revisão** — reunião quinzenal com representantes de Design, Engenharia e Produto

**Processo de contribuição:**
1. Abrir RFC (Request for Comments) no Notion
2. Período de feedback: 7 dias úteis
3. Revisão do comitê
4. Implementação com par design+eng
5. Release em semver (MAJOR.MINOR.PATCH)

**Canal de suporte:** #design-system no Slack

---

<!-- layout: caption -->

> "Aurora não é um projeto de design. É infraestrutura de produto — tão crítico quanto nosso API gateway."

# Aurora Design System v2.0
