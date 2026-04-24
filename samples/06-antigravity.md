---
marp: true
---

<!-- layout: title-only -->

# Antigravity
## O Futuro da Programação Agêntica

---

<!-- layout: default -->

# O que é o Antigravity?

Antigravity é um poderoso assistente de inteligência artificial focado em **codificação agêntica avançada**, desenvolvido pela equipe do Google DeepMind.

- **Autonomia:** Capaz de resolver tarefas complexas sozinho.
- **Integração:** Trabalha diretamente no seu ambiente (workspace).
- **Parceria:** Atua em *pair programming* com o usuário, tomando decisões e executando ações.

---

<!-- layout: two-column -->

# Capacidades Principais

Aqui estão as principais vantagens de usar o Antigravity no dia a dia do desenvolvimento.

<!-- col -->

### Análise e Compreensão
- Leitura rápida de codebases inteiras.
- Geração de resumos e relatórios de auditoria.
- Pesquisa semântica e web embutida.

### Execução e Automação
- Executa comandos no terminal nativo.
- Instala dependências.
- Testa a aplicação automaticamente através de um subagente de navegação (Browser Subagent).

---

<!-- layout: blank -->

> "O Antigravity não é apenas um chat; é um engenheiro virtual que trabalha lado a lado com você no seu projeto."
> 
> *- Google DeepMind Team*

---

<!-- layout: default -->

# Arquitetura Orientada a Ferramentas

O Antigravity decide de forma inteligente qual ferramenta usar para cada situação:

1. **Manipulação de Arquivos:** `view_file`, `write_to_file`, `replace_file_content`.
2. **Navegação Web:** `browser_subagent` e `search_web`.
3. **Comandos de Sistema:** `run_command` e `command_status`.
4. **Geração Multimídia:** `generate_image`.

Isso dá ao agente controle quase total sobre o ciclo de desenvolvimento.

---

<!-- layout: two-column -->

# Planning Mode (Modo de Planejamento)

Para tarefas complexas, o Antigravity adota uma postura cautelosa e estruturada.

<!-- col -->

### 1. Pesquisa e Análise
Antes de alterar código, o agente analisa a arquitetura atual, dependências e impactos das mudanças. Ele verifica "Knowledge Items" (KIs) passados.

### 2. Aprovação do Usuário
O agente redige um plano detalhado (`implementation_plan.md`) e aguarda o **feedback explícito** do usuário antes de executar comandos mutáveis.

---

<!-- layout: caption -->

```python
# O Antigravity consegue ler, entender e refatorar este código em segundos
def optimize_search(query, dataset):
    results = [item for item in dataset if query.lower() in item.name.lower()]
    return sorted(results, key=lambda x: x.relevance, reverse=True)
```

# Compreensão Profunda de Código e Sintaxe

---

<!-- layout: default -->

# Interagindo via Browser Subagent

Um dos recursos mais impressionantes é o **Browser Subagent**. O Antigravity pode:
- Iniciar servidores locais (ex: `npm run dev`).
- Abrir navegadores invisíveis para o usuário.
- Clicar, digitar e validar se as telas da web foram renderizadas corretamente.
- Tirar screenshots visuais de confirmação.

Tudo isso garante um fluxo de ponta a ponta (TDD e E2E) gerido pela IA.

---

<!-- layout: two-column -->

# Antigravity vs. Assistentes Comuns

<!-- col -->

**Assistentes Comuns**
- Apenas respondem texto.
- Não alteram os arquivos diretamente sem copiar e colar.
- Perdem o contexto de projetos grandes.
- Passivos.

**Antigravity**
- Executa ferramentas diretamente na máquina do usuário.
- Edita, cria e exclui múltiplos arquivos.
- Mantém contexto persistente.
- Proativo (*Planning Mode*).

---

<!-- layout: title-only -->

# Dúvidas?
## Obrigado por conhecer o Antigravity!
