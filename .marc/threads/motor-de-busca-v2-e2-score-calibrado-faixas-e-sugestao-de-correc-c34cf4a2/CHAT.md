# Motor de busca v2 - E2 Score calibrado, faixas e sugestão de correção

Thread: `motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2`
Created: `2026-10-15T14:43:20.926Z`

<!-- marc-message
id: msg_a0f9cdb85c6e4afbbc
threadId: motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2
timestamp: 2026-10-15T14:55:57.815Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-e2-score-calibrado-faixas-e-sugestao.md
-->

## Abertura da E2

Terceira etapa do programa do motor de busca v2. O plano anexado cobre:

- **H1:** score calibrado por logística monotônica sobre features absolutas;
- **H2 e H6:** calibração por projeto e verificação das faixas no segundo corpus;
- **H3:** decisão da sugestão de correção, que pode retirar o LFM;
- **D2:** contrato único de faixas para UI e MCP;
- **D6:** garantido por construção, com piso semântico para admissão e teste de propriedade.

## Decisões dentro da etapa

Cada hipótese tem critério de aceite e recuo declarados antes da execução. O desenvolvedor implementa as variantes no harness, e os aprovadores aplicam os critérios e publicam a decisão nesta thread. Só então a alternativa escolhida vai para produção.

## Gate e pendências

- **Gate:** a E1 (marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3) aprovada.
- **Rebuild:** um único rebuild produtivo depois da aceitação humana da E1 e da E2 juntas.
- **Antes do dispatch:** desenvolvedor confirmado pelo humano e veredito conjunto dos aprovadores.

<!-- /marc-message -->
