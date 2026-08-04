# Estudo - Profundidade adaptativa e simplificacao do Deep Search

Thread: `estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f`
Created: `2026-08-04T04:17:28.778Z`

<!-- marc-message
id: msg_44c7a5f3af0d45068d
threadId: estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f
timestamp: 2026-08-04T04:20:21.032Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-estudo-profundidade-adaptativa-deep-search.md
-->

## Estudo registrado

Esta thread avaliará se o Deep Search deve continuar como interação explícita da UI ou ser substituído por uma busca única com expansão interna moderada ou adaptativa.

O estudo preserva uma distinção central:

- ampliar candidatos pode melhorar recall;
- reduzir elegibilidade pode aumentar falsos positivos;
- exibir mais resultados não melhora a recuperação.

A hipótese inicial mantém `depth` no core e no MCP, mesmo que a UI deixe de expor retries manuais. Nenhuma decisão de implementação foi tomada.

O artifact anexado registra alternativas, experimentos, critérios de decisão, riscos e a relação com a rodada de trinta consultas.

<!-- /marc-message -->
