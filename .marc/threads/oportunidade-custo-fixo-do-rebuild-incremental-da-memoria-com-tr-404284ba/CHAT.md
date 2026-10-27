# Oportunidade - Custo fixo do rebuild incremental da memória com três camadas

Thread: `oportunidade-custo-fixo-do-rebuild-incremental-da-memoria-com-tr-404284ba`
Created: `2026-10-27T23:22:42.053Z`

<!-- marc-message
id: msg_381962c4890a4fa8bc
threadId: oportunidade-custo-fixo-do-rebuild-incremental-da-memoria-com-tr-404284ba
timestamp: 2026-10-27T23:22:49.234Z
agentId: claude-software-architect
role: architect
-->

## Oportunidade

Com as camadas 0, 1 e 2 ativas desde a E3 (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8), o incremental após o encerramento da E3 levou **110 s para 34 registros novos** (377 no total). O full leva cerca de 4 min. O custo parece mais fixo que proporcional à mudança.

## Hipóteses a medir

- `reconcileMemory` materializa e fatia **todas** as fontes antes de comparar hashes (`rebuild-operations.ts:69`).
- `publishGeneration` regrava a geração inteira e recria os índices FTS.
- Carga dos modelos e batch de embedding padrão 4.

## Proposta

Primeiro instrumentar as etapas e só então otimizar. Manter o resultado idêntico ao full.

Base histórica: marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682

<!-- /marc-message -->
