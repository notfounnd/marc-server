# Entrega 2 - E4: latência do memory_deep, descrição, skill, documentação e ADR 0013

Status: pronta para revisão do principal. Não publicada no thread.

## Escopo

- T3: medição de latência do `memory_deep` com M0 reproduzido, caminho com escopo, caminho sem escopo e recuo B' calculado.
- Descrição da ferramenta MCP, orientação da skill `marc-ops`, documentação e ADR 0013.
- Correção de `merge-judgments`, que grava julgamentos só de passagens (já revisada).

## Mudanças

- `scripts/memory-eval/deep-latency.ts`, `deep-latency-math.ts`, `deep-latency-paths.ts` e `deep-latency-report.ts` (novos): protocolo, gates, B' e relatório em `.marc/cache/memory-eval/marc-deep/`.
- `scripts/memory-eval/t0-funnel-prestudy.ts`: exporta `providersOf`, `instrumentedProviders`, `probedCall` e `openReferenceContext`, e ganha a guarda `isEntrypoint` (linhas 1182 a 1188). O comportamento do t0 é preservado.
- `scripts/memory-eval/cli.ts`: comando `deep-latency` (linhas 1627 e 1700).
- `scripts/memory-eval/judgments.ts`, linhas 512 a 514: `commitMerge` grava também quando há julgamentos de passagem.
- `src/mcp/memory-tools.ts`, linha 91: descrição do `memory_deep`. Diz que no máximo 232 trechos chegam ao reranker, que o tempo de reranking cresce com os trechos reranqueados e que o p95 das chamadas com escopo foi de cerca de 35 s na medição do E4.
- `src/core/marc-ops-skill.ts`, linhas 50 a 52: orientação sobre o `memory_deep`.
- `docs/memory.md` (seção `memory_deep`, lista de corpora e tabela de ferramentas), `docs/mcp-tools.md` (linha 9 com 26 ferramentas, linha da tabela e subseção `memory_deep`), com o mesmo texto de latência da descrição, `docs/adrs/0013-memory-deep-scoped-passages.md` (novo, na estrutura da ADR 0012) e `docs/adrs/README.md` (linha 21).
- `test/memory-eval-deep-latency-math.test.ts` (10 testes) e `test/memory-eval-deep-merge.test.ts` (3 testes). Nenhum teste fixa o texto da descrição.

## Medição (uma execução, máquina de referência)

Comando: `pnpm memory:eval deep-latency --corpus marc-deep --capture 58686cbe9fc0`.

Protocolo: por caso, um aquecimento de cada caminho aplicável e, depois, três rodadas com a ordem dos caminhos rotacionada. Os 4 casos sem escopo rodam M0 e o caminho sem escopo. Os 10 casos com escopo rodam M0, o caminho com escopo e o caminho sem escopo, porque o gate sem escopo cobre as 14 consultas.

| Caminho | Mediana | p95 | Limite (1,2 × mediana do M0) | Veredito |
|---|---|---|---|---|
| M0 (14 consultas) | 30 484 ms | 35 739 ms | referência | referência |
| Com escopo (10 consultas) | 11 486 ms | 34 990 ms | 33 765 ms (M0 das 10: 28 137 ms) | aprovado |
| Sem escopo (14 consultas) | 26 515 ms | 37 725 ms | 36 580 ms (M0: 30 484 ms) | aprovado |

- A referência informativa de 5 s no p95 é excedida pelos dois caminhos. Não decide gate.
- Sobrecarga do caminho com escopo: 2 290 ms. Taxa do reranker: 6,74 pares por segundo, contra cerca de 11,7 na estimativa da E3 (232 pares em cerca de 19,8 s). Os valores absolutos desta execução são conservadores. O gate relativo, medido na mesma execução, não é afetado.
- B' = 212 foi calculado com as fórmulas do plano e não foi executado, porque o gate com escopo passou.
- Os pares de cada caminho batem com o replay da captura. O protocolo está completo.

## Qualidade (leitura sobre a captura 58686cbe9fc0 e o dataset atual)

- DEEP (B = 232): Success@5 13/14, MRR@5 0,738, P@5 0,571, zero incompletos, conformidade de escopo de 100%.
- DEEP_ALL: as mesmas três métricas. Os dois não são idênticos: no D14 o top 5 muda, e o resultado do caso não muda.
- D03: classe `ordering`. Duas posições, com a mesma definição em cada uma, calculadas a partir dos escores gravados na captura:
  - (b) posição na saída do DEEP: 10ª entre as 18 passagens de grupos admitidos, após `firstPerPassage` e na ordem do core (score, rank denso, recordId). É o número a citar.
  - (a) posição entre todas as entradas pontuadas do pool: 15ª entre 132, incluindo as 7 identidades.
  - O SUMMARY não está no pool. Em ambos os casos o trecho está fora do top 5, e a classe não muda.

## Adoção

B = 232 é adotado somente se a qualidade (critério 2 do plano: Success@5 em 12 ou mais de 14, sem incompletos) e os dois gates de latência (critério 4) passarem juntos (critério 5). Passaram na mesma execução. O B' não é usado, e a reavaliação única do plano não é consumida.

## Verificação

- `pnpm validate`: saída 0. Nenhum arquivo de `src`, `test`, `scripts`, `docs` ou `.agents` mudou durante a execução. Os sha256 de `.marc/memory/manifest.json`, `marc.json`, `ledgerline-en.json`, `marc.corpus.json`, `ledgerline-en.corpus.json`, `marc-deep.json` e `marc-deep.corpus.json` não mudaram.
- `pnpm build`: saída 0. O aviso de tamanho de chunk do bundle da UI já existia.
- `pnpm test`: 1170 testes, 1170 aprovados, 0 falhas.
- SKILL.md será regenerado pelo principal após reconexão do mcp-marc.

## Riscos e pendências

- As latências absolutas ficam acima da estimativa do plano (19,8 s para 232 pares), pela taxa mais baixa do reranker nesta execução. A medição deve ser repetida antes de qualquer release.
- Os pares esperados vêm do replay da captura usada nesta execução. Não consultei uma baseline fixada separada para `marc-deep`.
