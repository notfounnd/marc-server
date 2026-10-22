# Entrega 1 da E2: fase A (harness)

Autor: claude-dev. Código: scripts/memory-eval/** e src/core/memory/scoring/** (judge-document.ts), com testes em test/**. Nenhuma alteração de produção fora de src/core/memory/scoring. Nenhum modelo de produção foi trocado.

## 1. O que a fase A entrega (A1 a A4)

- **A1 e A1b (features e ajuste):** features absolutas em src/core/memory/scoring/features.ts, usando as funções de produção (consolidateThreads, denseRanksByKind, semanticHitsForChannels). Ajuste logístico aninhado por família, com projeção e pesos não negativos. Comando: `fit`, que grava fit.json e fit-predictions.json.
- **A2 e A2b (captura e calibração):** captura com canais da correção (variants[1]), 60 consultas sintéticas (Inverse Cloze, semente pelo sha256 da geração), vetores de identidade, referências entre threads e modelo barato de quatro features. Comandos: `capture`, `calibrate` (N1, N2, h6Fallback), `h3` (A, B, C).
- **A3 (juiz e escolha):** juiz H7 com Qwen3-Reranker-0.6B (q8) e Kev-0.6B (q4), com revisões fixadas por SHA. Escolha H8 com Kev e LFM2.5-350M (produção, só leitura). Laya ficou fora do estudo. Comandos: `judge --model qwen|kev`, `choice --model kev|lfm`, `h3` com D_KEV e D_LFM, `replay` com H7_JUDGE_*.
- **A3c (diagnóstico do Kev):** montagem conferida pelo exemplo do card, com os ids do config.json. Causa da AUC baixa isolada na pergunta declarada.
- **A4 (latência e memória):** `latency --capture <id> --judge qwen|kev --model marc/<id>` e `latency --capture <id> --choice kev|lfm`. Um aquecimento e três amostras por caso. Memória do processo do harness (base, carregado, pico, delta), memória dos workers (memoryUsage) e os.freemem/os.totalmem. Gravam latency-judge-<modelo>.json e latency-choice-<modelo>.json. Total rotulado "estimated".
- **H3 (informativo):** contador de casos sem expectedInterpretation em que a alternativa aplica ou sugere correção, por estilo. Não entra no critério.

## 2. Decisões de implementação

- **Sem espelho de features:** o harness chama as funções de produção. O espelho da A1 foi removido na A1b.
- **Passadas por modelo:** juiz e escolha têm arquivos próprios (judge-<modelo>.json, choice-<modelo>.json), com checkpoint por caso e --resume.
- **Laya:** fora do estudo. A montagem da entrada (tokenização das opções, teto de 48 tokens, orçamento da cabeça, split_words) é definida só pelo build_sequence do open-jev, dependência fora do escopo. Não é verificável pelo card e pelo config.json.
- **Kev, delimitadores:** vêm do config.json (state 151659, question 151660, option_start 151648, option_end 151649, decide 151661). O exemplo do card deriva os ids codificando o texto sanitizado; no controle, todos os delimitadores viram o id 27 ("<").
- **LFM:** a escolha é a softmax dos logits dos tokens "0" (manter) e "1" (corrigir) num único forward, com o prompt de produção.
- **H7:** p2 = sigmoid(v0 + v1·logit(p) + v2·juiz), com v1 e v2 não negativos. A pré-admissão vem do semanticOnly do H1 (D6). Recuo: cadeia sobre o M0.
- **Memória:** dispose de tensores em todos os modelos. num_logits_to_keep só onde o grafo declara a entrada: o LFM sim; Qwen e Kev não (verificado nos arquivos ONNX).
- **Pergunta do juiz Kev:** mantida como aprovada.

## 3. Checks (último ciclo)

- `pnpm validate`: exit 0 (format, lint de src e test, typecheck). Nenhum arquivo alterado nesta execução.
- `pnpm build`: exit 0 (aviso de tamanho de chunk, já existente).
- `pnpm test` completo: 700 testes, 0 falhas.
- Lint de scripts/memory-eval fora do validate: o erro de `_batchSize` em scripts/memory-eval/cached-providers.ts:70 é anterior e não está no escopo do validate.

## 4. Números do smoke (medições, não decisão)

Captura faad42c0a104 (ledgerline-en, 40 casos). Os números de latência são de uma passada isolada por modelo, com memória controlada.

**Juízes (AUC no ledgerline, 58 positivos e 474 negativos; 668 threads sem rótulo ficam fora):**
- Qwen: AUC 0,9411; mediana dos positivos 0,919; mediana dos negativos 0,0021.
- Kev: AUC 0,5197; mediana dos positivos 0,836; mediana dos negativos 0,826.

**Escolha (36 casos com correção distinta):**
- Kev: 30 aplica, 4 sugere, 2 não muda. Trocar a ordem das opções muda 1 decisão em 36.
- LFM: 27 aplica, 2 sugere, 7 não muda.
- Ambos aplicam muitas correções degradadas. Isso vai para os aprovadores.

**H3 (só os 4 casos com gabarito):** A 2/4 (correção) e 4/4 (sugestão indevida); B 2/4 e 2/4; C 2/4 e 2/4; D_KEV 2/4 e 0/4; D_LFM 1/4 e 1/4. Em LT01 e LT02 o gabarito difere da correção gerada só no plural.

**H6 (ledgerline, verificação dos cortes):**
- Com os cortes do marc: alta 15 pares, precisão 1,000 (alvo 0,90); média 28, 1,000 (alvo 0,60); baixa 40, 0,875 (alvo 0,30). Veredito: fail.
- No recuo, com cortes escolhidos no próprio ledgerline (sem validação externa intocada): alta 38, 0,895; média 87, 0,540; baixa 177, 0,294. Dentro de ±0,10.

**Latência e memória (A4):**

| Passada | Casos | Unidades | Mediana por caso | Pico do harness | Pico dos workers | Total amostrado | Livre mínimo |
|---|---|---|---|---|---|---|---|
| choice LFM | 36 | 36 forwards | 618 ms (483 a 770) | 589 MB | embedding 653 MB, reranking 925 MB | 2168 MB | 439 MB |
| judge Kev | 40 | 37 threads | 1435 ms (1028 a 4308) por caso com threads; 1257 ms por thread | 794 MB | embedding 653 MB, reranking 890 MB | 2338 MB | 875 MB |
| judge Qwen | 40 | 37 threads | 749 ms (594 a 2271) por caso com threads; 715 ms por thread | 2294 MB | embedding 657 MB, reranking 924 MB | 3874 MB | 4779 MB |

- O RSS é do processo inteiro. O delta (pico menos base) é o custo incremental do modelo: LFM 486 MB, Kev 670 MB, Qwen 2172 MB.
- O Qwen rodou com 8,2 GB livres no início.

## 5. Decisões de M0 e estimativa

- **Latência M0 do smoke: nula.** A captura faad42c0a104 é anterior ao código final da A3 (judge-document.ts entrou em src/core/memory/scoring). O sourceHash mudou, o captureId calculado é diferente e não há latency.json para ela. Por isso o total estimado fica null. Não recapturei.
- Na fase B, a captura com o código final terá o M0 medido, e o total estimado será calculado com ele.

## 6. Riscos e pendências

- **Kev sem sinal de relevância** com a pergunta declarada. O diagnóstico mostra que a montagem está certa; a pergunta não separa relevância (par trivial falha). Fica para a decisão.
- **Escolha permissiva:** Kev e LFM aplicam correções degradadas. O critério de H8 não distingue boas de ruins neste corpus.
- **Memória da máquina:** a captura do marc e as passadas do Qwen exigem muita memória livre. Recomenda-se fechar aplicações antes delas.
- **Gabarito de LT01 e LT02:** a diferença de plural vem do gerador de candidatos, herdada por todas as alternativas. Não mexido.
