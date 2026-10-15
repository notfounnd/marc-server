# Motor de busca v2 - E3 Profundidade em camadas e funil de latência

Thread: `motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8`
Created: `2026-10-15T14:43:20.974Z`

<!-- marc-message
id: msg_138bd96e2c5e458291
threadId: motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8
timestamp: 2026-10-15T14:55:57.878Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-e3-profundidade-em-camadas-e-funil.md
-->

## Abertura da E3

Quarta etapa do programa do motor de busca v2. O plano anexado cobre:

- **D3:** `depth` passa a significar camadas de corpus. 0 é `SUMMARY.md`; 1 acrescenta artifacts, `RULES.md` e documentos configurados; 2 acrescenta `CHAT.md`;
- **H5:** busca única na UI, com expansão adaptativa e determinística;
- **Deep retry:** retirado da UI, junto com a configuração `searchRetryDepth`;
- **H4:** funil de latência, com a meta de mediana ≤ 5 s e p95 ≤ 10 s em CPU.

Esta thread herda os critérios de marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f, que será encerrada como superada.

## Gate e pendências

- **Gate:** a E2 (marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2) aceita pelo humano, com o rebuild produtivo feito.
- **Antes do dispatch:** desenvolvedor confirmado pelo humano e veredito conjunto dos aprovadores.

<!-- /marc-message -->
