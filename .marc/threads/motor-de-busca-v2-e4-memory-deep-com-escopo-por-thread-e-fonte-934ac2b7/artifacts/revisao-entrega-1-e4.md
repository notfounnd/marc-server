# Revisão da Entrega 1 da E4 (T1 e T2)

## Escopo e fontes

Esta é a revisão do principal sobre a Entrega 1, publicada por claude-dev (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_9c73a89ee3d947d89c). Ela cobre o código da T1 e o harness da T2, lidos diretamente, e as checagens que rodei.

As correções pedidas na revisão já estão integradas. Esta revisão vale para o estado depois delas.

## T1: `memory_deep` no core, MCP e CLI

**Arquivos lidos:**
- `deep.ts`, `deep-pool.ts`, `deep-scope.ts`, `deep-rerank.ts`, `deep-thread.ts`, `deep-output.ts` e `deep-input.ts`;
- `recall-hits.ts`, `lancedb-store-support.ts`, `memory-tools.ts` e `cli.ts`;
- os testes de paridade, de pool, de escopo, de erros, de saída, de filtro do store e da CLI.

**Critérios:**

| Critério | Evidência | Resultado |
|---|---|---|
| `memory_recall` inalterado | `semantic-ranking.ts`, `hybrid-ranking.ts` e `operations.ts` intocados. Replay M0,DEPTH2 das capturas E3 (marc `87cd2e4d96f7`, ledgerline-en `0d31bd4afd3f`) com sha256 idêntico antes e depois. Os testes de recall passam sem edição | Passa |
| P1 e paridade de ponta a ponta | `rankDepthPoolPassages(...).ranked` profundamente igual a `rankHybridMemoryCandidates`, com os mesmos documentos, lote e uma chamada, nos regimes de empate e dispersão. O deep sem escopo e o recall em depth 2, no mesmo índice, enviam os mesmos documentos e têm o mesmo `rerankPairs` e as mesmas faixas | Passa |
| Modo com escopo | Thread fechada e indexada; `sourceTypes` antes da seleção; B = 232; cosseno só acima do teto; desempate score, cosseno e `recordId`; sem `groupBand` | Passa |
| Modo sem escopo | Só grupos admitidos, inclusive contra um grupo reprovado com trecho de score maior; identity pontuada e nunca devolvida; `sourceTypes` muda só a saída (mesmos documentos, pares e `abstained`) | Passa |
| Erros e transportes | Códigos do core mapeados para `toolError` no MCP; zod com limite de 1 a 20; a CLI recusa `--thread`, `--source-types`, `--limit` e `--query-mode` sem valor | Passa |
| Produção | Manifest com sha256 `ae070d9a…` inalterado. CLI no índice de produção: `cd4a49b8` com 502 trechos, 232 pares e `scopeTruncated`; thread pequena com 35 trechos e 35 pares; sem escopo, 115 pares e 3 grupos com faixa | Passa |

**Trechos copiados de `operations.ts`:** os campos lexicais, a prontidão, o acesso ao store e o ramo de índice vazio. A cópia foi decidida para manter a exclusão coaprovada. O teste de paridade de ponta a ponta acusa qualquer divergência futura entre as duas cópias.

## T2: harness `marc-deep`

**Arquivos lidos:** `deep-variants.ts`, `deep-classes.ts`, `deep-protocol.ts`, `deep-metrics.ts`, `deep-run.ts` (relatório do caso e motivos de incompleto) e `deep-worksheet.ts`.

**Critérios:**

| Critério | Evidência | Resultado |
|---|---|---|
| Datasets e capturas anteriores intactos | `marc.json`, `ledgerline-en.json` e os corpus com o mesmo hash. `queryFingerprint` sem `scope` igual ao guardado | Passa |
| Corpus `marc-deep` | 62 threads fechadas em 2026-10-28; a E4 fica de fora; `kMax` 0 só no fingerprint dele | Passa |
| B1, worksheet | União dos 5 primeiros de `DEEP`, `DEEP_ALL` e `DEEP_COSINE`, mais `DEEP_BUDGET` quando dado; em ordem de `passageId`; sem score, posição nem variante | Passa |
| Grau ausente | Deixa a variante `incomplete` (`missing-grade`) e nunca vale zero | Passa |
| B2, protocolo | `protocolIncomplete` sem 14 casos (4 + 10) ou sem um caso acima de 232 trechos; gate só com protocolo completo, 12/14, zero incompletos e escopo conforme | Passa |
| Classes | Precedência segmentation → admission/pool → cap → ordering, com `alsoTruncated`. admission/pool é mecânica, por `passageId`, e não lê graus | Passa, após correção |

**Correções pedidas e integradas:**
1. **segmentation:** passou a exigir que todas as citações sejam `evidence_unindexable`. Antes bastava uma.
2. **admission/pool:** passou a exigir que nenhuma citação indexada esteja no pool consolidado. Antes bastava uma fora.
3. **Citação `missing`:** deixa o caso `incomplete` (`missing-evidence`), sem classe. Antes, o caso caía em ordering e seria mandado ao estudo de modelos por engano.

Os dois primeiros só diferiam em casos com mais de uma citação. Há testes específicos para os três.

## Bloqueios do parecer do Codex e correções

O parecer do Codex (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_c9ed589b9b3e4d7995) apontou dois bloqueios na T2. Conferi os dois no código, e os dois procediam.

| Bloqueio | Correção integrada | Evidência |
|---|---|---|
| **B1, dedupe da saída:** o harness cortava o Top5 do ranking bruto. A produção aplica `firstPerPassage` antes do limite | `firstPerPassage` do core ganhou assinatura genérica (`deep-output.ts:51-53`, sem mudar o corpo). O harness a chama em todas as variantes: `scopedRunOf`, `cosineRun` e `unscopedVariantsOf`. No modo sem escopo, a ordem é filtro de `sourceTypes` e depois dedupe. `pairs` conta os documentos pontuados antes do dedupe (`ranked` do core tem no máximo B) | `memory-eval-deep-dedupe.test.ts`: cinco records do mesmo `passageId` antes do trecho útil, com e sem escopo. O Top5 é igual ao do core, Success@5 é verdadeiro, `pairs` = 6 e a worksheet não repete trecho |
| **B2, gate do recuo:** o gate e as classes liam sempre `DEEP`, mesmo com B' | O relatório ganhou `adoptedVariant` (`DEEP`, ou `DEEP_BUDGET` com B'). Gate, conformidade de escopo, saturação e classes leem a variante adotada; `DEEP` fica como baseline. O caso continua incompleto se qualquer variante estiver incompleta ou se faltar uma citação. Domínio 1 ≤ B' ≤ 231 na CLI e em `deepReportOf`. `runDeepReport` = `runDeepCases` + `deepReportOf` (função pura em `deep-case-report.ts`) | `memory-eval-deep-adoption.test.ts`: a reprodução do Codex dá `DEEP` 14/14, adotada 4/14 e `gate.passed=false`. B' = 231 com 14/14 passa. Sem B', a adotada é `DEEP`. B' = 0, 232 e 1,5 são recusados. O teste de ponta a ponta prova que `runDeepReport` é igual a `deepReportOf(runDeepCases(...))` |

`deep-run.ts` foi dividido em `deep-case-report.ts` para ficar abaixo de 300 linhas. O código segue sem `else` e sem `if` aninhado.

## Checagens

- **Do desenvolvedor, na rodada final:**
  - `pnpm validate` exit 0, sem efeito fora do escopo pela checagem de mtime;
  - `pnpm build` exit 0;
  - `pnpm test` 1.157/1.157;
  - `memory:eval validate` sem issues nos três corpus;
  - replay M0,DEPTH2 das capturas E3 com o sha256 inalterado (`ec3eb25e…` e `bf872d5f…`);
  - manifest e datasets antigos com os hashes inalterados.
- **Da revisão:** `pnpm test` rodado por mim no estado final, depois das correções B1 e B2. O resultado está na mensagem desta revisão.

## Limites

- Nenhuma captura real do marc-deep foi feita. A checagem de produção nas 62 threads e o tempo real do `deep-run` ficam para a captura.
- A captura antiga não muda, mas o `sourceHash` de uma captura nova já reflete o código da T1, como esperado.
- A frase sobre o tempo do modo com escopo na descrição do MCP ("about 22 seconds") será recalibrada na T3 pela medição de latência.

## Veredito

**T1 e T2 aprovadas tecnicamente** no estado com B1 e B2 corrigidos, sujeitas à nova rodada do parecer do Codex.

O passo seguinte do plano é dos aprovadores: escrever os 14 casos. São 4 sem escopo e 10 com escopo, com a estratificação por tamanho e pelo menos um caso acima de 232 trechos depois de `sourceTypes`.
