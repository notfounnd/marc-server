# Plano 02 - Skill local mARC Ops

## Objetivo

Adicionar um mecanismo para o mARC instalar uma skill local no workspace do projeto. A skill deve trabalhar em conjunto com `RULES.md`: ela nao substitui rules, ela transforma o contrato da workspace em comportamento ativo do agente.

## Relacao com RULES.md

Fluxo esperado:

1. O agente chama `workspace_bootstrap`.
2. O bootstrap entrega `INSTRUCTIONS.md`, `RULES.md`, workspace info e agentes registrados.
3. A skill local orienta o agente a ler e aplicar `RULES.md` antes de agir.
4. A skill transforma `Custom Rules` em checklist operacional para a acao atual.
5. O agente deixa evidencia quando uma regra critica exige evidencia.

`RULES.md` permanece como source of truth do contrato comportamental. A skill e uma camada de execucao e lembranca.

## Premissa de instalacao local

O mARC funciona localmente por projeto e o MCP deve ser configurado localmente para o repositorio de trabalho. A skill segue a mesma premissa: ela deve ser instalada no repo do projeto, em um caminho generico para agentes, sem depender de layouts especificos como `.claude`, `.copilot` ou `.codex`.

## Nome da skill

Nome escolhido: `marc-ops`.

Racional:

- `ops` vem de contrato operacional, nao de daemon ou infraestrutura;
- comunica uso pratico do mARC no dia a dia do agente;
- cobre bootstrap, rules, artifacts, references, preflight e audit;
- segue uma ideia ampla e familiar de operacao, como devops, secops e techops;
- e curto e generico para o ecossistema de agentes.

## Padrao de SKILL.md

A skill deve respeitar o formato esperado por agentes que leem skills:

- arquivo obrigatorio `SKILL.md`;
- frontmatter YAML no topo;
- campo `name` com `marc-ops`;
- campo `description` explicando quando a skill deve ser usada;
- corpo em Markdown com instrucoes enxutas e acionaveis.

A `description` e parte critica do contrato, porque agentes podem usa-la para decidir quando ativar a skill.

## Inspiracao operacional

A skill sera parecida com Napkin no ponto que importa: aplicar regras no momento certo, nao apenas documenta-las. Nao havera compatibilidade, deteccao, comparacao, migracao ou integracao com Napkin.

## Conteudo da skill

A skill deve orientar o agente a:

- chamar `workspace_bootstrap` no inicio da sessao ou apos perda de contexto;
- ler e aplicar `RULES.md` como contrato da workspace;
- identificar `Custom Rules` relevantes para a tarefa atual;
- transformar regras operacionais em checklist antes de proposta, plano, desenvolvimento, conclusao ou fechamento de thread;
- usar `thread_read_since` quando houver cursor;
- anexar artifacts antes de referencia-los em mensagens;
- usar referencias `marc://` para agentes, threads, mensagens e artifacts;
- declarar fontes antes de planos, propostas, design, API ou tool nova quando a regra exigir;
- preferir mensagens curtas e artifacts para conteudo longo.

## Instalacao

A instalacao deve ser idempotente e segura.

Proposta de estrutura gerenciada:

```text
.agents/skills/marc-ops/SKILL.md
```

Razoes:

- fica local ao repositorio do projeto;
- acompanha a premissa de MCP configurado por workspace;
- usa um caminho generico para agentes;
- nao depende de layout externo de uma ferramenta especifica;
- evita sobrescrever arquivos de ferramentas especificas.

A skill deve conter um cabecalho indicando que e gerenciada pelo mARC. Conteudo customizado do usuario nao deve ser gravado dentro desse arquivo gerenciado.

## Atualizacao

A atualizacao da skill pode ocorrer junto de `workspace_update_recommendations` e `workspace_bootstrap`, seguindo o mesmo principio dos arquivos gerenciados:

- atualizar quando o conteudo gerenciado estiver desatualizado;
- nao tocar em areas customizadas fora do caminho gerenciado;
- retornar se a skill foi criada, atualizada ou ja estava atual.

## Contrato esperado da skill

A skill deve ser enxuta no carregamento, mas suficientemente operacional para mudar o comportamento do agente nos pontos criticos:

```md
---
name: marc-ops
description: Use when working in a mARC-enabled repository or thread to apply workspace_bootstrap, RULES.md, Custom Rules, artifact linking, marc:// references, preflight evidence, and workspace_audit before proposing, planning, developing, concluding, or closing mARC work.
---

# mARC Ops

Operate inside a mARC-enabled workspace with the local workspace contract in force.

## Activation Triggers

- Start, resume, reconnect, or daemon/tool restart.
- Read, create, update, comment, summarize, or close a mARC thread.
- Reference artifacts, threads, messages, agents, or workspace assets.
- Prepare proposal, plan, design, API/tool change, development update, completion note, or closure summary.
- Validate quality, audit, preflight, review, cleanup, or consistency.

## Required Workflow

1. Call `workspace_bootstrap` before gated mARC tools.
2. Read `RULES.md` from the bootstrap response as the workspace contract.
3. Read the target thread before proposing or changing anything.
4. Convert relevant `Custom Rules` into a task checklist.
5. Leave evidence when a critical rule asks for it.
6. Attach artifacts before referencing them in `message_post`.
7. Use canonical `marc://` references.
8. Use `workspace_audit` at meaningful checkpoints, not continuously.

## Preflight Checklist

- Sources read.
- Scope mapped to the thread problem.
- Critical rules have action and evidence.
- Artifacts are attached before reference.
- mARC assets use `marc://` links.
- Validation or audit scope is selected with token cost in mind.
```

O conteudo final pode ter secoes adicionais para disciplina de mensagem, artifacts e auditoria, desde que continue simples de carregar e acionavel.

## Criterios de aceite

- A skill e instalada em `.agents/skills/marc-ops/SKILL.md`.
- A skill possui frontmatter YAML com `name` e `description`.
- A instalacao e idempotente.
- `workspace_bootstrap` ou `workspace_update_recommendations` reporta a atualizacao quando aplicavel.
- Testes cobrem criacao, atualizacao e ausencia de sobrescrita fora do caminho gerenciado.
- Documentacao explica que a skill funciona em conjunto com `RULES.md`.
