# Casos do marc-deep (E4)

## Resumo

Esta é a proposta dos 14 casos da avaliação da E4, escrita pelo principal como aprovador e submetida à coaprovação do Codex. Os casos estão em `scripts/memory-eval/datasets/marc-deep.json`, com `origin: approvers-e4-2026-10-28`.

Os escopos e as citações foram escritos a partir das fontes Markdown, antes de qualquer captura. Nenhum resultado do `memory_recall` ou do `memory_deep` foi usado para escolhê-los.

**Validação:** `memory:eval validate --corpus marc-deep` dá 14 casos, 62 threads fixadas e 0 issues. A primeira rodada acusou um id de thread escrito por extenso em vez do nome truncado da pasta. Corrigi o id, e a segunda rodada saiu limpa.

## Casos sem escopo (as 4 consultas originais)

| Caso | Consulta | Evidência |
|---|---|---|
| D01 | por que a rotação de token não foi implementada? | `SUMMARY.md` de 674632b3 (ameaça não demonstrada com a API local) e `CHAT.md` (sem valor para rotação automática) |
| D02 | quais regras definem organização das informações na UI? | artifact de experiência da c147b8bb ("perto do seu dono semântico") e `SUMMARY.md` de 604ad99b (Marckers exclusivo da coluna do meio) |
| D03 | qual foi o raciocínio para indexar apenas summaries na memory v1? | `CHAT.md` de 0e4dbaac (objetivo: "apenas evidências executivas relevantes à tarefa atual") e `SUMMARY.md` (motivação central) |
| D04 | quais regras operacionais dizem para preservar Markdown como fonte da verdade? | `RULES.md` ("keep Markdown authoritative…") e `SUMMARY.md` de 3d40719f |

As consultas são as do plano, sem alteração. Cada caso tem duas citações: a regra de classe exige que nenhuma delas seja mantida pelo pool para classificar admission/pool.

## Casos com escopo

Os tamanhos vêm do manifest de produção (trechos por grupo, sem a identity). A coluna "Escopo" conta os trechos depois de `sourceTypes`.

| Caso | Thread (trechos) | `sourceTypes` | Escopo | Consulta | Onde está a resposta | Seção específica |
|---|---|---|---|---|---|---|
| D05 | 3c45fa83 (9) | — | 9 | o que a leitura incremental devolve quando o cursor da mensagem não é encontrado? | `SUMMARY.md`, Entregas | não |
| D06 | d14fb686 (12) | — | 12 | quais tools continuam funcionando sem a confirmação de bootstrap? | `SUMMARY.md`, Resultado | não |
| D07 | 3d40719f (20) | summary, artifact | 14 | que risco ficou aberto entre gravar um artifact e registrar o vínculo no transcript? | `SUMMARY.md`, Risco residual | não |
| D08 | 774d1e99 (36) | — | 36 | o que acontece com um segundo pedido de rebuild enquanto outro processo já reconstrói a memory? | `SUMMARY.md`, Decisoes; o lock aparece em outras seções | sim |
| D09 | 1d4c0daa (62) | artifact | 48 | que falha da primeira implementação da busca por sufixo a revisão encontrou? | artifact de atividade, seção da correção; a resolução aparece em vários artifacts | sim |
| D10 | 2f441fa7 (104) | — | 104 | como o update de summary trata uma repetição com o mesmo conteúdo? | entrega do desenvolvedor; a revisão aparece em plano, atividade e exemplo | sim |
| D11 | 1042e2b3 (129) | chat | 34 | por que as linhas da seção não bastavam para identificar uma passagem? | `CHAT.md`, pendência de integração do parecer; o `passageId` aparece em outras mensagens | sim |
| D12 | 834716ba (194) | — | 194 | que problema de concorrência foi corrigido no purge da memory? | `SUMMARY.md`, Modelos e sanitização; o loop cita o purge de passagem | sim |
| D13 | cd4a49b8 (502) | artifact | 408 | quais casos perderam a evidência com a pré-seleção por cosseno? | revisão da entrega T2, perdas por caso; o 0,727 aparece em vários artifacts | sim |
| D14 | 57488bab (597) | — | 597 | quais fontes ficaram de fora da ablação de sumários e conversa? | plano do estudo 2; o resultado do estudo 2 aparece no `SUMMARY.md` | sim |

## Conferência do protocolo

| Exigência do plano 4.1 | Situação |
|---|---|
| 14 casos: 4 sem escopo e 10 com escopo | 4 + 10 |
| Pelo menos 6 com a resposta numa seção específica | 7 (D08 a D14) |
| Pelo menos 2 threads abaixo da mediana (31) | 3: D05, D06 e D07 |
| Pelo menos 2 threads acima de 120 | 4 por thread inteira: D11, D12, D13 e D14. Por escopo efetivo são 3, porque D11 fica em 34 com o filtro de chat |
| Pelo menos 1 caso acima de B = 232 depois de `sourceTypes` | 2: D13 (408) e D14 (597) |
| `sourceTypes` só com summary, artifact e chat no escopo | D07, D09, D11 e D13 |

**Variedade:** as evidências cobrem `SUMMARY.md`, artifacts e `CHAT.md`. Há filtros de um tipo e de dois tipos. Há também um caso sem escopo cuja resposta está no `RULES.md` (D04).

## Limites

- A consulta D02 é ampla por natureza. Os julgamentos da worksheet decidem quais trechos de UI contam como grau 2 ou mais.
- Cada citação é uma frase ou um item de lista, para caber num só trecho. Uma citação que a segmentação quebre aparece como `evidence_unindexable` na captura, e a classe segmentation se aplica.
- O corpus fica como está: 62 threads fechadas em 2026-10-28, e nenhuma thread foi fechada desde então.

## Ajustes do parecer do Codex

O parecer (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_a6c357c27e3b46ba86) coaprovou 12 casos e pediu duas trocas. As duas foram aplicadas como propostas:

- **D03:** a citação do plano só declarava que a memória usaria só summaries, sem explicar por quê. Ela foi trocada pelo objetivo registrado no `CHAT.md` da mesma thread. Conferi que a citação é literal, aparece uma vez e tem 22 palavras. A consulta e a segunda citação ficam como estavam.
- **D12:** a corrida afeta o manifest e a geração do índice, não os modelos. A consulta passou a ser "que problema de concorrência foi corrigido no purge da memory?". A fonte, a citação e o escopo ficam como estavam.

Depois das trocas, `memory:eval validate --corpus marc-deep` dá 14 casos, 62 threads e 0 issues.

## Próximo passo

Com a coaprovação dos casos, o desenvolvedor faz a captura do marc-deep, de cerca de 20 minutos, e gera a worksheet cega. Depois vêm os avaliadores a e b, o merge com kappa e o relatório deep.
