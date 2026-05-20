# Resumo Executivo

## Resultado

- A thread foi concluida com a correcao do guidance que levava agentes a repetir `workspace_bootstrap` como ritual em acoes comuns.
- A skill gerenciada `marc-ops` agora separa quando o workflow deve orientar a decisao de quando o bootstrap deve ser estabelecido.
- O bootstrap permanece forte no inicio da sessao/workspace e apos perda, incerteza, tool error, compaction, reconnect, rebuild ou daemon/MCP restart.
- A leitura de `RULES.md` continua preservada como contrato obrigatorio vindo do bootstrap inicial.
- A skill nao menciona `bootstrapConfirmed: true`; a flag permanece apenas na interface tecnica MCP.

## O que foi tratado

- `src/core/marc-ops-skill.ts` e `.agents/skills/marc-ops/SKILL.md` foram ajustados para remover gatilhos problemáticos do tipo `Always before...`.
- `src/core/recommendations.ts`, `.marc/INSTRUCTIONS.md` e `.marc/RULES.md` foram atualizados com a orientacao de reutilizar o contrato conhecido e evitar investigacao ampla quando uma fonte mARC especifica foi fornecida.
- `src/mcp/responses.ts`, `src/mcp/helper.ts` e `docs/mcp-tools.md` foram alinhados com o novo guidance operacional.
- `test/core-recommendations-bootstrap.test.ts` foi adicionado para impedir regressao da skill.
- `test/mcp.test.ts` foi atualizado para validar o novo helper/reminder.

## Validacao

- `pnpm run validate` passou.
- `pnpm test` passou: 74/74.
- `pnpm build` passou.
- Context-mode confirmou os textos novos em fonte, arquivos gerenciados e `dist`.
- `workspace_audit` de preflight passou sem findings.

## Continuidade

- Nao ha pendencias funcionais registradas nesta thread.
- Warnings residuais de auditoria sobre Description ausente em perfis de agentes foram considerados fora do escopo desta correcao.
- Plano detalhado: `artifacts/plano-correcao-bootstrap-redundante.md`
