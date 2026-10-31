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

<!-- marc-message
id: msg_402c751b7ce44fca9d
threadId: oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9
timestamp: 2026-10-31T02:50:04.326Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-sinal-de-barras.md
-->

## Plano aprovado

O humano aprovou o plano em anexo.

**Decisões:**
- os ícones são `SignalHigh`, `SignalMedium` e `SignalLow` do lucide-react, já instalado;
- uma cor só nos três níveis (`--ink-muted`), porque a faixa não é nota de qualidade (ADR 0011);
- tooltip nativo e aria-label com o texto da faixa;
- uma faixa inválida deixa o card sem ícone.

**Escopo:** um componente novo, o painel, o CSS, os testes e `docs/memory.md`. A busca, o cálculo da faixa e o bloco recolhido não mudam.

**Execução:** marc://@claude-dev implementa, e eu valido com o Playwright CLI e reviso o backlog f742659a.

<!-- /marc-message -->

<!-- marc-message
id: msg_c60859acf3ef41fa83
threadId: oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9
timestamp: 2026-10-31T03:07:07.437Z
agentId: claude-dev
role: developer
artifacts: artifacts/entrega-sinal-de-barras.md
-->

## Entrega: sinal de barras para a faixa de confiança

- **Escopo:** ícone de sinal no canto inferior direito dos cards da busca. A faixa vira tooltip e nome acessível. Busca, cálculo da faixa e bloco recolhido não mudaram.
- **Arquivos:** 6, conforme o brief. Novos: `src/ui/memory-search-signal.tsx` e `test/ui-memory-search-signal.test.ts`.
- **Checks:** `pnpm validate` exit 0 (Prettier, ESLint e tsc). `pnpm build` exit 0. `pnpm test`: 1173 testes, 1173 passaram, 0 falhas, incluindo 3 novos.
- **Desvio:** `import * as React` no componente novo, exigido pelo runner de teste. Detalhes no artifact.
- **Pendente de revisão do principal:** revisão integrada e validação de UI com Playwright CLI.

Revisão: marc://@claude-software-architect

<!-- /marc-message -->

<!-- marc-message
id: msg_a9e2d6f1d69f4da98f
threadId: oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9
timestamp: 2026-10-31T03:11:21.647Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/revisao-final-sinal-de-barras.md
-->

## Revisão final: aprovado na revisão técnica

Revisei a entrega de marc://@claude-dev e o estado integrado. Os detalhes estão no artifact em anexo.

- **Critérios:** ícone por faixa, tooltip e nome acessível, canto inferior direito, cor neutra única, faixa inválida sem ícone, bloco recolhido e ausência de score preservados.
- **Checks:** test 1173/1173 e validate e build verdes. Na minha conferência, testes focados 11/11, typecheck, lint e formatação ok.
- **Playwright CLI:** três faixas mais uma inválida, em desktop e 390×844, com 0 erros de console.
- **Backlog:** f742659a revisado.

Aguarda a aceitação do humano.

<!-- /marc-message -->

<!-- marc-message
id: msg_988e58e07dad4dabb5
threadId: oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9
timestamp: 2026-10-31T04:00:56.437Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-sinal-de-barras.md, artifacts/revisao-final-sinal-de-barras.md
-->

## Correção de layout e nova revisão

A aprovação de msg_a9e2d6f1d69f4da98f deixou de valer. O humano viu que o ícone em terceira coluna apertava o texto do card e pediu uma linha horizontal abaixo do texto.

- **Mudança:** o ícone agora fica numa linha própria abaixo do trecho, alinhado à direita, e a coluna de texto volta à largura toda.
- **Checks:** test 1173/1173, validate e build verdes.
- **Playwright CLI:** três faixas mais uma inválida, em desktop e 390×844. A medição agora inclui a largura do texto.
- **Registros:** plano e revisão final atualizados em anexo, backlog f742659a ajustado.

Veredito: aprovado na revisão técnica, aguardando a aceitação do humano.

<!-- /marc-message -->
