# Plano - Corrigir Guidance Para Evitar Bootstrap Redundante

## Summary
Registrar este plano como artefato na thread `bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82` antes do desenvolvimento, depois ajustar o guidance gerenciado para separar "quando a skill governa a decisao" de "quando chamar bootstrap". A correcao preserva bootstrap e leitura de `RULES.md` no inicio/recuperacao de contexto, mas remove gatilhos indiretos que fazem acoes comuns repetirem `workspace_bootstrap`.

## Key Changes
- Atualizar `src/core/marc-ops-skill.ts`:
  - Reescrever `Context of Usage` mantendo o padrao curto em bullets `Always when...`, mas removendo bullets frequentes do tipo `Always before...` que induzem bootstrap ritualistico.
  - Manter triggers fortes para bootstrap: inicio de sessao/workspace, compaction, reconnect, rebuild, tool error, daemon/MCP restart, contexto ausente/stale/incerto e conflito entre `RULES.md`, pedido do usuario e thread.
  - Consolidar acoes comuns em bullets de decisao/preparacao: leitura de thread, fonte mARC especifica, plano/design/API/tool/behavior, edits, validacao/audit/completion/closure, mensagem/artifact/`marc://`.
  - Nao mencionar `bootstrapConfirmed: true` na skill.
- Atualizar `Required Workflow` da skill:
  - Exigir estabelecer bootstrap context no inicio da sessao/workspace, apos perda de contexto ou quando o contrato da workspace estiver incerto.
  - Manter `RULES.md` do bootstrap como contrato obrigatorio.
  - Adicionar explicitamente que o contrato atual deve ser reutilizado enquanto conhecido, sem repetir bootstrap como ritual antes de cada acao mARC.
  - Preservar leitura da thread alvo antes de propor ou mudar algo, com `thread_read_since` quando houver cursor valido.
- Atualizar guidance relacionado:
  - `src/core/recommendations.ts`: alinhar `INSTRUCTIONS.md` e `RULES.md` gerados com a mesma distincao entre bootstrap inicial/recuperacao e reutilizacao do contrato conhecido.
  - `src/mcp/responses.ts`: tornar `BOOTSTRAP_REMINDER` compativel com a regra: rerun so quando contexto foi perdido ou esta incerto.
  - `src/mcp/helper.ts` e `docs/mcp-tools.md`: refletir o uso eficiente sem enfraquecer o gate de bootstrap.
- Rodar `workspace_update_recommendations` apos os edits para atualizar `.marc/INSTRUCTIONS.md`, `.marc/RULES.md` e `.agents/skills/marc-ops/SKILL.md`.

## Interfaces
- Sem nova tool MCP e sem mudanca de schema.
- Mudanca apenas em textos gerados/retornados:
  - skill `marc-ops`;
  - `INSTRUCTIONS.md` e `RULES.md` gerenciados;
  - `bootstrap.reminder`;
  - topicos relevantes de `marc_helper`;
  - documentacao de uso MCP.
- Conteudo tecnico/produto permanece em en-US; artefato e comentario na thread em pt-BR.

## Test Plan
- Atualizar `test/core-recommendations.test.ts` para verificar:
  - skill gerada nao menciona `bootstrapConfirmed`;
  - `Context of Usage` contem os novos bullets de decisao/preparacao;
  - `Required Workflow` mantem bootstrap inicial/recuperacao, leitura de `RULES.md`, reutilizacao do contrato conhecido e leitura correta de thread.
- Atualizar `test/mcp.test.ts` ou `test/mcp-agent.test.ts` para verificar:
  - `BOOTSTRAP_REMINDER` nao incentiva rerun ritualistico;
  - `marc_helper` explica bootstrap inicial/recuperacao e contrato conhecido.
- Validacao final obrigatoria:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`
- Antes do comentario final na thread, revisar docs e declarar se houve atualizacao documental; depois postar na thread o que foi realizado e aguardar feedback do usuario.

## Assumptions
- A correcao e de guidance, documentacao e mensagens de ferramenta; nao havera estado de sessao novo no servidor MCP.
- `workspace_bootstrap` continua obrigatorio quando nao ha contexto valido.
- A leitura de `RULES.md` no inicio continua garantida pelo bootstrap e reforcada na skill.
- Markdown continua sendo source of truth; caches e projecoes continuam derivados.
