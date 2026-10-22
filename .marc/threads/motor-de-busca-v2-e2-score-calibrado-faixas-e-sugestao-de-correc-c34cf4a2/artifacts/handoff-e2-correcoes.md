# Correções de handoff da E2

Este artifact registra a conferência das referências do plano (revisão 3) e do adendo H7/H8 contra o código atual, depois da E1 (commit 39ed10b), e contra a API do Hugging Face. O gate exige essa conferência ("referências de linha conferidas pelos aprovadores no handoff"), e o adendo também ("o principal confere o formato de uso de cada card e as versões exatas dos arquivos ONNX").

Nenhuma correção muda o desenho aprovado. São ajustes de implementação que o desenvolvedor segue.

## Features e captura

1. **O canal FTS "content" se chama `summary`.**
   - `MemoryLexicalField = "title" | "summary" | "titlePrefix"` (`types.ts:182`).
   - `lexicalSummary` cobre o texto de todos os registros. `title` e `titlePrefix` só são preenchidos para o registro identity (`lancedb-store-support.ts:85-102`).
   - `titlePrefix` só entra em consultas de um token (`operations.ts:259-268`).
   - Mapeamento das features: `lexicalTitleMatch` é o canal `title` ou `titlePrefix`; `lexicalContentMatch` é o canal `summary`.
2. **Os scores do reranker já estão na captura.**
   - `captureChannels` (`capture-channels.ts:55-89`) pontua a matriz completa, com os registros identity, usando `semanticRerankingDocument`.
   - `identityRerankerScore`, `bestRerankerScore` e `secondRerankerScore` saem do replay, sem canal novo.
   - A seleção de até 3 passagens por thread é feita por `consolidateThreads` (`semantic-ranking.ts:122-142`), que ordena por denseRank e depois por recordId.
   - As features e o `buildJudgeDocument` reutilizam essa função, exportada, em vez de copiá-la.
3. **Canais do candidato de correção.**
   - Hoje a captura só registra canais para a consulta, a efetiva e a sugerida (`capture.ts:285-291`).
   - Se o LFM escolhe o índice 0, `candidates.variants[1]` fica sem canais.
   - A captura da E2 registra canais, vetores e matriz de `variants[1]` sempre que ele existir.
4. **As consultas sintéticas da H2 entram na captura.** As 60 consultas Inverse Cloze, com semente derivada da geração, são capturadas com canais e matriz nos dois corpora. O marc serve à H2, e o ledgerline-en à H6, com a calibração escolhida.
5. **Fingerprint.**
   - O captureId (`capture-fingerprint.ts:34-63`) não cobre o código do harness, os canais capturados nem os modelos do juiz e da escolha.
   - Ele passa a incluir uma versão `captureChannels` e as identidades desses modelos, só quando estão presentes, como já é feito com `indexedLayers`.
   - Assim, os captureIds da E0 e da E1 continuam os mesmos.

## Harness

6. **As variantes precisam de mais entrada.**
   - Hoje `VariantInput` (`variants.ts:10-17`) recebe só uma consulta e os canais dela.
   - As variantes H2, H3 e H7 precisam do caso capturado (candidatos, canais judge e choice, consultas sintéticas) e dos parâmetros ajustados no fold.
   - Toda variante nova também entra no segundo registro, `VARIANT_PLANS` (`metrics.ts:71-86`).
   - O teste de isolamento do replay (`memory-eval-replay-isolation.test.ts:44-49`) passa a cobrir também `fit.ts` e os arquivos de variante novos.
7. **Folds.** O `fit` reutiliza `assignFolds` (`folds.ts:11-21`, semente 20261015) para os 5 folds externos. A validação interna usa os 4 folds de treino recebidos, como define o plano.
8. **Métricas de interpretação por alternativa.** Hoje elas só saem de `capture.cases` (`report.ts:345-364`). A H3 precisa delas por alternativa, reutilizando `interpretationContribution` (`metrics.ts:220-252`).

## Modelos

9. **Logits.**
   - O runtime só lê logits no cross-encoder (`inference-worker.ts:250-275`).
   - O LFM só usa `pipeline("text-generation")`, e não existe código de log-probabilidade.
   - Na T1b, o juiz e a escolha rodam no processo do harness (`scripts/memory-eval/`), com `AutoModelForCausalLM` ou `PreTrainedModel` do transformers.js 4.3.1.
   - Nada muda em `src/core/memory/inference-*` antes da T2b ou da T4.
10. **Pasta dos modelos experimentais.** O purge da manutenção trata pastas sem contrato como recuperáveis (`maintenance.ts:145-179`) e por isso apaga `.marc/cache/memory-models/experiments/`. Os modelos do estudo ficam em `.marc/cache/memory-eval/models/`, que o Git ignora e o purge não varre.
11. **Arquivos ONNX conferidos no Hugging Face, com a revisão fixada pelo sha:**

    | Modelo | Arquivo | Tamanho | Revisão | Uso pelo card |
    |---|---|---|---|---|
    | onnx-community/Qwen3-Reranker-0.6B-ONNX | `onnx/model_quantized.onnx` (q8) | 1,22 GB | 9995c50e23 | `AutoModelForCausalLM`. P(yes) vem dos logits de "yes" e "no" no último token, com o template do card e a instrução do adendo |
    | onnx-community/kev-0.6b-ONNX | `onnx/model_q4.onnx` + `_data` | 375 MB | 5a827091b3 | `PreTrainedModel`. Softmax dos logits nos marcadores de fim de cada opção. Sim/não usa as opções ["no", "yes"] |
    | onnx-community/laya-multilingual-ONNX | `onnx/model_fp16.onnx` + `_data` | 644 MB | 46b77bbf56 | Entradas próprias (`marker_pos`, `marker_mask`, `qtype`). O card só mostra o uso pelo pacote `open-jev` |

    O `open-jev` seria uma dependência nova, e o adendo proíbe isso. O Laya só fica no estudo se rodar pela API do transformers.js, com as entradas montadas pela especificação do card e pela seção `laya` do `config.json`. Se não rodar, sai do estudo com o motivo registrado, como já prevê o risco do adendo.
12. **RSS.**
    - Os modelos do M0 rodam em processos filhos (`inference-manager.ts:234`), então o RSS do harness não os inclui.
    - A passada `--judge` grava o RSS do processo do harness, que inclui o juiz, e o RSS dos workers pela ação `memoryUsage`.
    - Esse padrão está em `scripts/memory-model-benchmark-support.ts:116-134` e é levado para `scripts/memory-eval/` antes que a T6 remova o arquivo original.
13. **A interpretação tem no máximo 2 variantes.** O índice 0 é sempre a consulta original (`query-candidates.ts:38-41`, confirmado), e o modelo só decide entre 0 e 1. Por isso a escolha da H8 é binária: aplicar a correção distinta ou manter a consulta.

## Produção e contrato

14. **O rebuild produtivo já aconteceu.**
    - O humano reviu a decisão de fazer um único rebuild e regerou a memória ao fim da E1.
    - O manifest commitado (39ed10b) tem o sha256 `1540264d0d52643474c62104d58050de46324c92280adbe77214dd0724f2045d`. Essa é a referência de "produção intacta" na E2.
    - O hash `33104f73…` citado no SUMMARY da E1 é anterior ao rebuild incremental que indexou esse mesmo SUMMARY.
    - O critério 8 da etapa passa a ser: depois da aceitação da E2, o humano autoriza um rebuild, que também gera o arquivo de calibração da T3.
15. **Arquivo de calibração em `.marc/memory/`.** `LanceDbMemoryVectorStore.exists` (`lancedb-store.ts:49-51`) considera que o store existe se houver qualquer entrada além de `manifest.json`. A T3 trata disso, com teste. Como `.marc/memory/` é versionado, o arquivo de calibração vai para os commits junto com as gerações.
16. **O limiar 0,5 aparece em três lugares:** `semantic-eligibility.ts:1`, `hybrid-ranking.ts:22-49` e `rankSemanticMemoryHits` (`semantic-ranking.ts:64-73`). Ele também é lido em `scripts/memory-eval/variants.ts:42-50` e em `scripts/memory-quality-v4.ts`. Se a H1 for aceita, a lista de remoção da T2 sai daqui. O título de `memory-eval-attribution.test.ts:205` cita `semantic-ranking.ts:20` pelo número da linha.
17. **UI.**
    - `src/ui/types.ts:93-110` duplica `MemoryRecallHit` e `MemoryRecallResult`, e as duas cópias ganham `band` e `abstained`.
    - `recallMemorySearchDepths` (`memory-search.ts:113-151`) para na primeira profundidade que tiver resultado. Com abstenção, a resposta vazia segue para a próxima profundidade. Esse é o comportamento desejado, coberto por teste.
    - O painel não mostra o score.

## Lições da E1 aplicadas

- **Equivalência de registros:** depois de uma captura já julgada, uma correção que só toca código fora do caminho medido é validada pela igualdade dos registros e das features, sem recapturar.
- **Sensibilidade do δ:** o achado O4 da E1 não afeta os critérios da H1, que não incluem MRR. Um caso de top1 que cai de 1 para 0 dá um limite inferior de cerca de −0,034, dentro do δ de 0,05.
- **Segundo aprovador:** o Codex revisa o harness depois da entrega 1, antes da captura, e não só no fim.

## Execução

- **Desenvolvedor:** `claude-dev`, com Haiku 5.5 e reasoning xhigh, confirmado pelo humano em 19/10. Modo sequencial, com um desenvolvedor.
- **Fase A (harness):** subtarefas A1 a A4.
  - A1: features, `fit` aninhado e H1.
  - A2: extensão da captura, H2 e H3 de A a C.
  - A3: juiz, escolha, H7 e H3_D.
  - A4: `latency --judge` com RSS.
- **Entrega 1:** do desenvolvedor, seguida da revisão de harness do Codex.
- **Fase B:**
  1. captura nos dois corpora;
  2. julgamento incremental pelos dois avaliadores;
  3. `fit` e `report`;
  4. decisão dos aprovadores publicada na thread;
  5. aprovação do custo pelo humano, se a H7 ou uma alternativa D for adotada.
- **Fase C (produção, condicionada à decisão):** T2b, T2, T3, T4, T5 e T6.
- **Entrega 2:** do desenvolvedor.
- **Fechamento:** revisão final integrada, coaprovação e aceitação do humano.
