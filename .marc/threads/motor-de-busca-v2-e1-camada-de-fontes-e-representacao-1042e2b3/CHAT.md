# Motor de busca v2 - E1 Camada de fontes e representação

Thread: `motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3`
Created: `2026-10-15T14:43:20.885Z`

<!-- marc-message
id: msg_77fded2455864aa39a
threadId: motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
timestamp: 2026-10-15T14:55:57.753Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-e1-camada-de-fontes-e-representacao.md
-->

## Abertura da E1

Segunda etapa do programa do motor de busca v2. O plano anexado cobre:

- proveniência por registro;
- registro de leitores por tipo de fonte;
- correção da normalização de `summaries.ts:234-243`, que perde o texto dos links, quebra identificadores com `-` e `_` e descarta todo bloco de código;
- documentos externos opt-in pelas settings JSON (D5).

Só a camada 0 é indexada nesta etapa, e o ranking não muda. A E3 liga as camadas 1 e 2.

## Gate e pendências

- **Gate:** a E0 (marc://$motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b) aprovada, com o baseline `M0` capturado.
- **Rebuild:** nenhum rebuild produtivo até o fim da E2, conforme o registro da rota.
- **Antes do dispatch:** desenvolvedor confirmado pelo humano e veredito conjunto dos aprovadores.

<!-- /marc-message -->
