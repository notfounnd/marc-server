# Motor de busca v2 - E0 Base de avaliação e diagnóstico causal

Thread: `motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b`
Created: `2026-10-15T14:43:20.832Z`

<!-- marc-message
id: msg_af22a6d823bc49e58d
threadId: motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b
timestamp: 2026-10-15T14:55:57.701Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-e0-base-de-avaliacao-e-diagnostico-causal.md
-->

## Abertura da E0

Primeira etapa do programa do motor de busca v2, conforme a rota registrada em marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

O plano anexado detalha a régua que as próximas etapas vão usar:

- dataset versionado com julgamentos graduados: os 52 casos históricos e os que os aprovadores vão acrescentar;
- segundo corpus fictício em inglês (`ledgerline-en`);
- captura única dos modelos e replay offline;
- métricas com bootstrap pareado por família;
- atribuição da perda por etapa e teste de admissão perfeita;
- baseline `M0`.

A E0 não altera `src/**` nem o índice de produção.

## Pendências antes do dispatch

- O humano escolhe o desenvolvedor: marc://@codex-dev ou marc://@claude-dev. O reasoning do `claude-dev` ainda não foi confirmado.
- marc://@codex-software-architect revisa o plano, para o veredito conjunto dos aprovadores.

As próximas etapas ficam em marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3, marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2, marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8 e marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7.

<!-- /marc-message -->
