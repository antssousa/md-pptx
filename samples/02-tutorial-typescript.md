---
marp: true
---

# TypeScript na Prática

## Do JavaScript ao código tipado em produção

---

# Por que TypeScript?

- **Erros em tempo de compilação** — encontre bugs antes de rodar
- **Autocomplete inteligente** — IDE sabe o que existe
- **Refatoração segura** — renomear não quebra nada
- **Documentação viva** — tipos explicam o contrato

> "TypeScript não é sobre adicionar tipos. É sobre tornar o impossível legível." — Dan Abramov

---

## Tipos Básicos

```typescript
// Primitivos
const nome: string = 'Maria'
const idade: number = 28
const ativo: boolean = true

// Arrays
const tags: string[] = ['ts', 'node', 'react']
const scores: Array<number> = [98, 87, 92]

// Tuple — posição importa
const ponto: [number, number] = [10, 20]
```

---

## Interfaces vs Types

```typescript
// Interface — extensível, merge automático
interface Usuario {
  id: number
  nome: string
  email?: string   // opcional
}

// Type — mais flexível para unions e intersections
type Status = 'ativo' | 'inativo' | 'pendente'
type UsuarioCompleto = Usuario & { status: Status }

// Na prática: interfaces para objetos, types para unions
```

---

<!-- layout: two-column -->

## Generics

Funções que funcionam com qualquer tipo sem perder a informação.

<!-- col -->

### Sem Generic

```typescript
function primeiro(arr: any[]): any {
  return arr[0]
  // retorno é `any` 😢
}

const x = primeiro([1, 2, 3])
// x é `any`, sem autocomplete
```

### Com Generic

```typescript
function primeiro<T>(arr: T[]): T {
  return arr[0]
  // retorno preserva o tipo 🎉
}

const x = primeiro([1, 2, 3])
// x é `number`, autocomplete OK
```

---

## Utility Types mais usados

```typescript
interface Produto {
  id: number
  nome: string
  preco: number
  estoque: number
}

// Partial — todos os campos opcionais
type AtualizarProduto = Partial<Produto>

// Pick — seleciona campos
type CardProduto = Pick<Produto, 'nome' | 'preco'>

// Omit — remove campos
type NovoProduto = Omit<Produto, 'id'>

// Record — mapa tipado
type Catalogo = Record<string, Produto>
```

---

## Narrowing — afunilamento de tipos

```typescript
type Resultado = { ok: true; valor: number } | { ok: false; erro: string }

function processar(res: Resultado): string {
  if (res.ok) {
    // TypeScript sabe que res.valor existe aqui
    return `Valor: ${res.valor.toFixed(2)}`
  }
  // Aqui TypeScript sabe que res.erro existe
  return `Erro: ${res.erro}`
}
```

---

## tsconfig.json essencial

| Opção | Valor | O que faz |
|-------|-------|-----------|
| `strict` | `true` | Ativa todas as checagens |
| `target` | `ES2022` | Versão JS de saída |
| `moduleResolution` | `bundler` | Para Vite/esbuild |
| `noUncheckedIndexedAccess` | `true` | Array[i] pode ser undefined |
| `exactOptionalPropertyTypes` | `true` | `?` ≠ `| undefined` |

---

<!-- layout: title-only -->

# Próximos passos

### Decorators · Type guards avançados · Template literal types

github.com/microsoft/TypeScript · typescriptlang.org/play
