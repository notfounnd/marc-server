# Revisão final integrada da E3

Revisão do principal (claude-software-architect) sobre o estado integrado depois da última alteração autorizada, a Entrega 2 da T5 (marc://msg_65ce722086a143ce9a).

## Escopo e fontes revisados

- **Plano** (revisão 8), `decisao-e3.md` (revisado em 2026-10-25) e o parecer do Codex `coaprovacao-decisao-e3-codex.md`.
- **Entregas do desenvolvedor:**
  - T0;
  - T1 (Entregas 1, 1b, 1c e 1d);
  - T-worksheet;
  - T2 (msg_9c2f4550754e4ae9a8);
  - T4 (msg_62522eaca7174abd99);
  - T3 reduzida (msg_8b34ae9d5d12405ca5);
  - T5 (msg_65ce722086a143ce9a).
- **Julgamento:** consenso dos dois avaliadores (msg_0a78b65afde64621b3) e o merge nos datasets.
- **Código e documentos:** os de produção alterados na E3 (`src/core/memory/**`, transportes, UI), o harness (`scripts/memory-eval/**`), os testes, o ADR 0012, a nota do ADR 0011 e os docs.

## Validação independente do principal

Medida no estado integrado final:
- `pnpm validate`: código 0;
- `pnpm build`: código 0;
- `pnpm test`: 1.020 de 1.020, sem falhas.

Também conferi:
- **Testes focados:** 45 da T4 e 10 da T3, todos passando. Os testes novos da T3 não têm `if`, ternário nem `switch`.
- **Busca no repositório:** `src`, `docs` e `public` sem `Deep retry`, `recallMemorySearchDepths` e sem depth 3 como opção. A única menção a `searchRetryDepth` é a nota de descarte da chave antiga.
- **Memória de produção:** o manifest de `.marc/memory` está intacto (sha256 b96e41ce…b56a, o mesmo da E2).
- **Medição de latência:** o JSON da T5 foi lido diretamente (30 casos, 90 amostras por caminho e pares iguais ao replay).

## Critérios de aceite da etapa

| Critério | Implementação e evidência | Avaliação |
| --- | --- | --- |
| 1. Decisões de H4, H5, faixas e rebuild registradas com evidência | `decisao-e3.md`, coaprovado pelo Codex com os ajustes aplicados; D10 do humano registrada (seguir a regra pré-registrada); máquina de referência confirmada pelo humano | Atendido |
| 2. Implementação corresponde à decisão | UI com busca única em depth 0 (T4). Depth 1 e 2 no MCP, na CLI e no HTTP com o pool consolidado do M0 e sem funil (T3, verificado em `operations.ts`). `INDEXED_LAYERS` = [0] até o rebuild autorizado. Funil e expansão adaptativa só no harness | Atendido |
| 3. Sem `Deep retry`, `searchRetryDepth` ou depth 3 | Busca no repositório limpa, com a exceção documentada | Atendido |
| 4. UI validada com Playwright CLI e backlog revisado | T4 em 1280×720, 1440×900 e 390×844, com recall interceptado. Backlog f742659a atualizado (marc://msg_4cfad711a1fe4726a5) | Atendido, com o limite registrado abaixo |
| 5. validate, build e test com as regras de estilo | Medidos pelo principal no estado final, todos verdes | Atendido |
| 6. Rebuild produtivo com três camadas depois da aceitação | Pendente da aceitação e da autorização do humano | Pendente, por desenho |

## Resultados que sustentam a decisão

- **DEPTH0 contra o M0 congelado** (revisão 6): não inferior em Top1-alvo, recall implicit e abstenção, com 114 casos comuns no marc e 40 no ledgerline-en. O Top1 implicit do marc é diagnóstico (−0,032, inconclusivo) e não é critério pré-registrado.
- **Latência na máquina de referência:** UI com mediana de 11,81 s, contra 18,22 s do M0 na ordem `input`. A razão é 0,648, dentro do limite de 1,2×. O MCP com depth 2 tem mediana de 18,13 s e p95 de 22,33 s (só reportado). Nenhum caminho atinge a referência de 5 s, que fica com o estudo de modelos.
- **Rebuild com as três camadas:** 177 s, com pico de 2,7 GB, dentro do limite de 15 min.
- **H4 e H5 reprovadas no marc, com o recuo pré-registrado aplicado:**
  - recall dos finalistas −0,063;
  - sobrevivência da evidência de 0,73 a 0,77;
  - exposição incidental pior;
  - 2 de 8 armadilhas paradas antes da evidência.
- **ledgerline-en:** passa em todos os critérios.

## Achados e limites

- **Formatação fora do escopo:** `pnpm validate` roda formatação em modo de escrita. Sem Git autorizado, não há diff para provar que nenhum arquivo fora do escopo foi reformatado. Os checks finais estão verdes e nenhum relato de tarefa apontou mudança inesperada.
- **Referência de latência:** o M0 de antes da E3 é reproduzido pela ordem `input` do reranker, e não pelo código anterior em si. É a aproximação prevista no plano.
- **UI sem modelos:** a validação de UI usou recall interceptado. A busca real em produção continua sendo o M0 em depth 0, e a T3 a cobre por testes e pelo probe da CLI.
- **Concordância do julgamento:** o kappa do marc ficou em 0,47, abaixo de 0,6. A causa foi a primeira passada do avaliador a, feita sobre trechos truncados. As 740 divergências foram resolvidas por consenso em duas rodadas, coaprovadas.
- **Mudanças fora do caminho de UI:** os datasets receberam os graus por camada pelo merge, e `src/core/memory/funnel-run.ts` ganhou campos aditivos de diagnóstico. Nada disso muda o comportamento de produção.
- **Faixa alta:** o corte fica perto de 1 em todos os folds. A faixa continua heurística, conforme D10 e o ADR 0011.

## Veredito

**Aprovado tecnicamente** para o estado integrado da E3, sujeito ao parecer final do Codex.

A aprovação técnica não é aceitação humana. O rebuild produtivo com `INDEXED_LAYERS = [0, 1, 2]` só pode ocorrer depois da aceitação e da autorização explícitas do humano. A thread continua aberta.
