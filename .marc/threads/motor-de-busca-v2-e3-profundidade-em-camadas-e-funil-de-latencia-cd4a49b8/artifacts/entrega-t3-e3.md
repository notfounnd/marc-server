# Entrega T3 reduzida da E3: camadas no MCP e na CLI, e DEPTH0 contra o M0 congelado (claude-dev)

Escopo do handoff-t3.md. Sem UI, datasets, capturas, `.marc/memory/**`, `pnpm-lock.yaml`, Git ou docs. Nenhum rebuild produtivo. `INDEXED_LAYERS` continua `[0]`.

## 1. Produção: depth 1 e 2 sem funil

Verificado no caminho que já existia (`src/core/memory/operations.ts`, `runReadyMemoryRecall`): a busca usa `layersForDepth` sobre as camadas presentes, `searchChannelsByLayer` e `rankHybridMemoryHits`. Não chama `runFunnel`, `selectFinalists` nem orçamento B. O pool reranqueado é o consolidado do M0 nessa depth, com identidade e no máximo três passagens por grupo (`semantic-ranking.ts`, `consolidateThreads`), a mesma definição das variantes DEPTHd do harness. Não houve mudança no core: a cobertura de reranqueamento já era completa.

Verificado por teste:
- depth 1 lê `[0, 1]` e depth 2 lê `[0, 1, 2]` (`layersSearched`);
- `rerankPairs` é igual ao total de documentos que o reranker recebeu nas chamadas (`test/core-memory-depth-production.test.ts`);
- referências por tipo: resumo `marc://$<thread>`, chat `marc://$<thread>/#<mensagem>`, artefato `marc://$<thread>/#<mensagem>/!<arquivo>`, regras e documento o `sourcePath`; `nextActions` por tipo (já existente);
- com o índice só na camada 0, depth 1 e 2 dão resultados e `rerankPairs` iguais a depth 0;
- depth 0 lê só a camada 0 e é repetível.

## 2. Contrato em MCP, CLI e HTTP

- MCP (`src/mcp/memory-tools.ts`): `depth` é de 0 a 2, e o 3 é rejeitado com a mensagem das camadas (antes, o zod devolvia um erro genérico). Teste em `test/memory-depth-transports.test.ts`.
- CLI (`src/cli.ts`, sem mudança): `--depth 0|1|2`; o 3 sai com código 1 e a mensagem das camadas. Teste de processo no mesmo arquivo.
- HTTP (`src/daemon/memory-routes.ts`, sem mudança): o 3 é rejeitado com a mensagem das camadas (teste existente em `daemon-memory-search.test.ts`).
- `layersSearched` e `rerankPairs` estão no resultado dos três transportes.

## 3. Probe pela `dist/cli.js` no workspace real (só camada 0, sem rebuild)

Índice: geração `20261022025654947_cbb6ce74`, 61 registros, camadas `[0]`, status `ready`.

| Chamada | Resultado |
|---|---|
| `memory recall --query "memory search depth" --limit 10 --depth 0` | 5 resultados, `layersSearched` `[0]`, `rerankPairs` 104 |
| mesma chamada com `--depth 2` | 5 resultados idênticos, `layersSearched` `[0]`, `rerankPairs` 104 |
| `--depth 3` | código 1, "Depth 3 is not available" |

## 4. Aceite de DEPTH0 contra o M0 congelado (E0: δ 0,05, bootstrap por família, inconclusivo reprova)

Comando novo: `memory:eval compare-common --baseline <captura E2>:M0 --candidate <captura E3>:DEPTH0 --corpus <corpus>` (`scripts/memory-eval/compare-common.ts`, `cli.ts`). Compara só os casos comuns pelo caseId, com a mesma consulta original e efetiva, nos dois lados, e usa os julgamentos atuais do dataset para os dois lados. Os digests de corpus batem nos dois corpora (`bae33c91cf67` e `44da053463b1`). As impressões digitais de consulta diferem porque o conjunto de casos cresceu, então o `compare` padrão recusa o par; o comando novo não.

Capturas: base E2 `marc/1b68a7e3f4e6` (M0) e `ledgerline-en/5ae0f660527c` (M0, citada em decisao-e2.md, linha 26); candidatas E3 `marc/87cd2e4d96f7` e `ledgerline-en/0d31bd4afd3f` (DEPTH0).

**marc: 114 casos comuns; 23 fora, todos presentes só na E3.** Nenhum fora por consulta diferente ou caso incompleto.

| Métrica | Escopo | Base (M0) | Candidato (DEPTH0) | Diferença | IC 95% | Veredito |
|---|---|---|---|---|---|---|
| Top1-alvo | total | 0,6600 | 0,6600 | 0,0000 | [−0,0280; 0,0297] | não inferior |
| Recall dos casos implicit | implicit | 0,3939 | 0,3939 | 0,0000 | [0,0000; 0,0000] | não inferior |
| Abstenção correta | total | 1,0000 | 1,0000 | 0,0000 | [0,0000; 0,0000] | não inferior |
| Abstenção correta | negative | 1,0000 | 1,0000 | 0,0000 | [0,0000; 0,0000] | não inferior |
| Diagnóstico: Top1-alvo | implicit | 0,4839 | 0,4516 | −0,0323 | [−0,0909; 0,0000] | inconclusivo |

**ledgerline-en: 40 casos comuns; 39 fora, todos presentes só na E3.**

| Métrica | Escopo | Base (M0) | Candidato (DEPTH0) | Diferença | IC 95% | Veredito |
|---|---|---|---|---|---|---|
| Top1-alvo | total | 0,8824 | 0,8824 | 0,0000 | [0,0000; 0,0000] | não inferior |
| Recall dos casos implicit | implicit | 0,5556 | 0,5556 | 0,0000 | [0,0000; 0,0000] | não inferior |
| Abstenção correta | total | 1,0000 | 1,0000 | 0,0000 | [0,0000; 0,0000] | não inferior |
| Abstenção correta | negative | 1,0000 | 1,0000 | 0,0000 | [0,0000; 0,0000] | não inferior |

**Casos divergentes e canal.** Em marc, o canal léxico diverge em 114 de 114 casos, e o vetorial em 80. A lista admitida muda em 5 casos, e nos cinco o conjunto de grupos admitidos é o mesmo, só a ordem muda: 5D e 10I (canal léxico), 9I, C2 e A31 (léxico e vetorial). Em ledgerline-en, o léxico diverge em 40 de 40 casos, o vetorial em nenhum, e a lista admitida não muda.

Relatório completo: `.marc\cache\memory-eval\marc\87cd2e4d96f7\compare-common-1b68a7e3f4e6-M0.{json,md}` e `.marc\cache\memory-eval\ledgerline-en\0d31bd4afd3f\compare-common-5ae0f660527c-M0.{json,md}`.

**Ponto para decidir.** Pelo texto pré-registrado, Top1-alvo vale no escopo total, e o aceite passa nos dois corpora. A linha Top1-alvo no escopo implicit do marc é inconclusiva (−0,0323, IC [−0,0909; 0,0000]). Registro como diagnóstico, sem mudar o critério. Se o humano quiser esse escopo como requisito, o aceite falha no marc.

## 5. Testes e checks

- Novos: `test/core-memory-depth-production.test.ts` (4), `test/memory-depth-transports.test.ts` (2), `test/memory-eval-compare-common.test.ts` (4). Todos sem `if`, `else`, `switch`, ternário nem skip.
- `pnpm validate`: código 0. `pnpm build`: código 0. `pnpm test`: 1020 passam, 0 falham. Typecheck de `scripts/`: código 0.
- Processos: os probes rodaram em foreground e não deixaram listener. A porta 4187 segue com o daemon do ecossistema, sem mudança.

## 6. Riscos e limites

- Só 114 casos no marc e 40 no ledgerline-en. Com resultados idênticos, o IC colapsa em zero; a comparação prova não inferioridade, não igualdade histórica (R1 da coaprovação).
- A divergência léxica está em todos os casos, como já medido na T1c-c (114 de 114). O sinal vetorial aparece em 80 casos do marc, sem efeito na lista admitida além da ordem.
- `pnpm validate` roda formatação em modo de escrita, e sem Git não verifiquei por diff se algum arquivo fora do escopo mudou.
