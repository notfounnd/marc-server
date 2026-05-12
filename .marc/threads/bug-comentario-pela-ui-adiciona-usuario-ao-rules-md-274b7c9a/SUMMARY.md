# Sumario executivo

## Resultado

A thread foi concluida. O problema de preservacao do `RULES.md` foi analisado, corrigido e validado com MCP client/server reiniciado.

## Contexto

Durante a investigacao, uma chamada real de `workspace_bootstrap` removeu conteudo customizado abaixo de `## Custom Rules`, incluindo `### Flow Rules`. A analise separou dois pontos:

- havia forte evidencia de MCP stale em memoria, pois os processos MCP ativos eram mais antigos que o daemon/rebuild;
- havia tambem um bug real no codigo atual: o recorte de `## Custom Rules` nao preservava corretamente tudo abaixo da fronteira quando apareciam headings `#` ou `##`.

## Tratativa

- O fluxo de normalizacao de `RULES.md` foi ajustado para tratar `## Custom Rules` como fronteira posicional.
- Todo conteudo abaixo dos comentarios de `Custom Rules` passou a ser preservado, independentemente do nivel de heading.
- Subsecao customizada legada com `###` ou mais profunda ainda pode ser migrada para baixo da fronteira quando encontrada antes de `## Custom Rules`.
- Inventario legado de agentes em `RULES.md` deixou de ser mantido; descoberta de agentes permanece via `.marc/agents/*.md`, `agent_list` e `agent_read_profile`.
- Testes cobrem preservacao de conteudo customizado, atualizacao idempotente de recommendations e postagem pela UI sem alterar `RULES.md`.

## Validacao

- `pnpm test test/core.test.ts test/daemon.test.ts` passou.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- Probe direto em `dist/core/workspace.js` confirmou idempotencia.
- Bateria MCP fresh via `StdioClientTransport` cobriu 6 cenarios.
- Validacao controlada no workspace real confirmou preservacao de `Custom Rules` apos baguncar e restaurar `RULES.md`.
- Apos reiniciar tudo, `workspace_bootstrap` atualizou `RULES.md` uma vez e `workspace_update_recommendations` estabilizou em `updated: []` e `alreadyCurrent: ["INSTRUCTIONS.md", "RULES.md"]`.
- `workspace_read_rules` confirmou `### Flow Rules` preservado abaixo de `## Custom Rules`.
- Checagem de processos confirmou daemon iniciado em `11/05/2026 21:57:21` e MCP em `11/05/2026 21:57:47`, ambos posteriores ao restart.

## Documentacao

A decisao arquitetural esta documentada em `docs/adrs/0007-rules-managed-baseline-and-custom-rules.md`, com referencias em `docs/adrs/README.md`, `docs/architecture.md` e `docs/mcp-tools.md`. Nenhuma documentacao adicional foi necessaria no encerramento.

## Referencias

- Plano detalhado: `artifacts/plano-correcao-rules-custom-boundary.md`
- Evidencias iniciais: `artifacts/evidencias-reproducao-rules-bootstrap.md`
- Relatorio de validacao MCP fresh: `artifacts/relatorio-validacao-mcp-fresh-rules.md`
