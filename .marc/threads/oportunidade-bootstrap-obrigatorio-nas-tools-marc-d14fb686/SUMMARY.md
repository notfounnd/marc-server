# Resumo executivo

Thread: `oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686`
Closed: `2026-05-06T15:51:43.162Z`

## Objetivo

Garantir que agentes novos passem pelo protocolo de bootstrap antes de usar tools mARC que leem ou alteram contexto do workspace.

## Resultado

- Criada a tool livre `workspace_bootstrap` como entrada de sessão mARC.
- `workspace_bootstrap` atualiza recomendações, lê `INSTRUCTIONS.md`, lê `RULES.md` e retorna `bootstrap.nextInput` com `bootstrapConfirmed: true`.
- Todas as tools de domínio passaram a exigir `bootstrapConfirmed?: boolean` no schema e `bootstrapConfirmed: true` na lógica.
- Tools gated sem confirmação retornam `bootstrap_required` antes de executar qualquer ação de domínio.
- Tools gated com confirmação retornam envelope `{ bootstrap, result }`, preservando o resultado original em `result`.
- Tools livres mantidas sem confirmação: `marc_helper`, `workspace_bootstrap` e `workspace_update_recommendations`.
- `marc_helper` foi atualizado para orientar o fluxo de bootstrap.

## Validação

- `pnpm test` passou com 33 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- `dist/mcp/server.js` foi inspecionado e confirmou `workspace_bootstrap` registrado.
- Sessão MCP reiniciada validou o comportamento real:
  - `workspace_bootstrap` funcionou sem flag.
  - `marc_helper` funcionou sem flag.
  - `workspace_update_recommendations` funcionou sem flag.
  - `workspace_info` sem flag bloqueou com `bootstrap_required`.
  - `thread_list` com `bootstrapConfirmed: true` executou com envelope `{ bootstrap, result }`.

## Estado final

Thread encerrada. O bootstrap obrigatório está implementado, validado no build local e validado na conexão MCP real após restart do servidor/sessão.
