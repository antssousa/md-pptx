---
marp: true
---

<!-- layout: title-only -->

# Retrospectiva Sprint 42

### Time Plataforma · 14 a 25 de Julho 2025

---

# Contexto da Sprint

- **Objetivo:** Lançar módulo de notificações em tempo real
- **Duração:** 2 semanas
- **Participantes:** 6 pessoas (3 eng, 1 design, 1 QA, 1 PM)
- **Velocity planejado:** 48 pontos
- **Velocity entregue:** 41 pontos (85%)

---

<!-- layout: two-column -->

# O que foi bem?

*Keep doing* — práticas que devemos manter

<!-- col -->

## Colaboração
- Pair programming nas integrações WebSocket funcionou muito bem
- Design e eng alinharam mockups no início (não no final)
- QA participou do refinamento e pegou ambiguidades cedo

## Processo
- Daily focada e dentro de 15 min todos os dias
- Bloqueios resolvidos no mesmo dia
- Documentação técnica escrita junto com o código

---

<!-- layout: two-column -->

# O que não foi bem?

*Stop doing* — práticas a abandonar ou corrigir

<!-- col -->

## Técnico
- Ambiente de staging ficou fora por 2 dias
- Dependência do serviço de e-mail causou bloqueio
- Falta de feature flags atrasou rollout seguro

## Processo
- Planning muito longa (3h → meta: 90min)
- Estimativas de histórias com dependências externas foram otimistas
- Review session sem clientes presentes — feedback atrasado

---

# Métricas da Sprint

| Métrica              | Sprint 41 | Sprint 42 | Tendência |
|----------------------|-----------|-----------|-----------|
| Velocity             | 45 pts    | 41 pts    | ↓         |
| Bug escape rate      | 3         | 1         | ↑ melhora |
| Tempo médio de PR    | 28h       | 14h       | ↑ melhora |
| Cobertura de testes  | 71%       | 78%       | ↑ melhora |
| Incidentes produção  | 2         | 0         | ↑ melhora |

---

<!-- layout: blank -->

# Itens de Ação

Responsáveis definidos, prazo até próxima retro.

1. **[Juliana]** Configurar redundância no ambiente de staging — até 28/Jul
2. **[Pedro]** Mapear todas as dependências externas no Notion e criar mocks — até 30/Jul
3. **[Time]** Adotar feature flags (LaunchDarkly) — spike de 2 dias na próxima sprint
4. **[Carolina]** Reduzir planning para 90min com agenda estruturada — testar na Sprint 43
5. **[Rafael]** Convidar 2 clientes para a próxima review session — até 25/Jul

---

<!-- layout: two-column -->

# O que queremos experimentar?

*Ideias para a Sprint 43*

<!-- col -->

## Processo
- Planning poker assíncrono (antes da reunião)
- "Buddy system" para histórias com risco alto
- Rotating facilitator na retrospectiva

## Técnico
- Shift-left testing: QA no refinamento
- Contract testing com serviços externos
- Dashboard de métricas da sprint em tempo real

---

<!-- layout: caption -->

> "A melhor sprint não é a que entrega mais pontos. É a que aprende mais."

# Sprint 42 — Encerrada com aprendizados

---

<!-- layout: title-only -->

# Sprint 43

### Começa Segunda-feira · Objetivo: Estabilização e Performance

*Bom descanso no fim de semana!* 🚀
