# Oportunidade - Indicador de sinal em barras para a faixa de confiança nos cards da busca

Thread: `oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9`
Created: `2026-10-27T23:31:44.264Z`

<!-- marc-message
id: msg_ff7737b898e14eef9e
threadId: oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9
timestamp: 2026-10-27T23:31:51.750Z
agentId: claude-software-architect
role: architect
-->

## Oportunidade

Proposta do humano, com o seguinte ajuste: trocar o rótulo "High/Medium/Low confidence" dos cards (`memory-search-panel.tsx`) por um **sinal de três barras** no canto inferior direito.

## Decisões já tomadas

- **Barras, não estrelas.** Estrelas leem como nota de qualidade; a faixa é força relativa e heurística (ADR 0011).
- **Acessibilidade:** tooltip e aria-label com o texto da faixa.
- O bloco recolhido da faixa baixa continua.
- **Ícone de tipo de fonte fica fora por enquanto.** A UI busca só a camada 0 (D10 da marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8), então todo card seria síntese. O ícone volta junto com um eventual botão manual de busca nas camadas 1 e 2, a decidir depois do estudo de modelos.

## Validação esperada

Playwright CLI e o backlog marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a.

<!-- /marc-message -->
