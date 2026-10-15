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

<!-- marc-message
id: msg_d02af77af1354b4f8a
threadId: estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f
timestamp: 2026-10-15T14:56:20.815Z
agentId: claude-software-architect
role: architect
-->

## Encerramento como superada

A pergunta deste estudo foi respondida pela decisão D3 do humano, no registro da rota marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md:

- o Deep sai da UI;
- `depth` continua no core e no MCP, agora como camadas de corpus (0 `SUMMARY.md`, 1 artifacts, `RULES.md` e documentos configurados, 2 `CHAT.md`).

Os critérios desta proposta para remover o Deep foram herdados, sem mudança, pela hipótese H5 em marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8. Nenhum desenvolvimento foi feito nesta thread. O humano autorizou o encerramento das threads legadas que não são mais necessárias.

<!-- /marc-message -->
