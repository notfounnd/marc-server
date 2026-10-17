# Adendo à E2: juiz de admissão e interpretação por escolha tipada

## Resumo

Este adendo propõe duas hipóteses novas para a E2, H7 e H8, sem mudar a arquitetura aprovada na revisão 2 do plano:

- **H7, juiz de admissão:** um segundo estágio de score. Um modelo local pequeno, treinado para responder sim ou não, dá a probabilidade de a thread responder à consulta, mas só para as threads que já passaram pelo piso do H1.
- **H8, interpretação por escolha tipada:** uma alternativa D para a H3. Um modelo escolhe entre os candidatos de correção que o código já monta, ou "nenhum", em vez de gerar texto.

**Por quê:** a E0 mostrou onde está a perda do M0 no marc. Ela vem da admissão (32 threads de grau 3) e da ordenação (14), e nenhuma do recall de candidatos. A admissão perfeita levaria o Top1-alvo de 0,67 para 0,94. Além disso, no marc a interpretação sugere correção sem necessidade em 15 de 26 consultas. As duas hipóteses atacam exatamente esses pontos.

**Origem:** o humano autorizou o estudo de modelos e aceitou refazer partes da busca se o resultado justificar. A referência foi o padrão "System One" do Jev, da TypeSafe: perguntas tipadas com probabilidade calibrada. O Jev em si é uma API hospedada e não serve para a memória local do marc. O adendo usa modelos abertos que rodam localmente.

**Prioridade do humano:** primeiro a qualidade, depois a latência. A latência é medida e registrada, mas não reprova H7 nem H8.

**Precisa de:** confirmação de marc://@codex-software-architect sobre a revisão 1 deste adendo e aprovação do humano. Depois disso, o adendo entra no plano como revisão 3.

## Modelos candidatos

Todos têm licença Apache-2.0, versão ONNX e entram no harness zero-shot.

| Papel | Modelo | Base | Saída |
| --- | --- | --- | --- |
| Juiz (H7) | onnx-community/Qwen3-Reranker-0.6B-ONNX, q8 | Qwen3-0.6B, treinado para relevância | P(yes) pelos logits de "yes" e "no" no último token |
| Juiz (H7) | onnx-community/kev-0.6b-ONNX, q4 | Qwen3-0.6B-Base com cabeça de decisão | probabilidade de uma pergunta de sim ou não |
| Escolha (H8) | onnx-community/laya-multilingual-ONNX, fp16 | mmBERT-base, multilíngue | distribuição calibrada sobre as opções |
| Escolha (H8) | onnx-community/kev-0.6b-ONNX, q4 | Qwen3-0.6B-Base | distribuição sobre as opções |
| Escolha (H8) | LFM2.5-350M atual | o interpretador de hoje | log-probabilidade de cada opção, sem gerar texto |

**Descartados:**
- Von, porque só funciona em inglês e o card avisa que dá confiança indevida em outros idiomas.
- OpenJev, com 4 B ou 35 B de parâmetros, porque é grande demais para rodar na CPU.

**Regras para os modelos:**
- **Sem ajuste fino.** Os julgamentos da E0 são dados de avaliação, e nenhum modelo é treinado com eles. Só os pesos da logística de segundo estágio são ajustados, com a mesma validação aninhada do H1.
- **Runtime:** cada modelo precisa rodar com o runtime atual do projeto (transformers-js 4.3.1, na CPU), sem dependência nova e sem mudar o pnpm-lock.yaml. Um modelo que não rode assim sai do estudo, e o relatório registra o motivo.
- **Arquivos:** os modelos ficam em .marc/cache/memory-models/experiments/, como os experimentos de antes. Nenhum modelo vira modelo de produção antes da decisão.

## H7: juiz de admissão

### Documento julgado

Para cada par de caso e thread, o juiz vê a consulta efetiva do caso e um documento formado por duas partes, nesta ordem:
- o texto do registro identity da thread;
- uma linha em branco;
- o texto da passagem com maior score de reranker **entre as passagens que a produção seleciona para o reranking**: no máximo 3 por thread, pela regra de `semantic-ranking.ts`. Não vale o máximo da matriz completa. O empate é decidido pelo menor recordId.

Um único construtor, `buildJudgeDocument`, monta o documento e é usado pelo harness e pela produção. Ele aplica a seleção elegível, o desempate, o layout e o truncamento em 512 tokens do tokenizer do modelo. Cada par é julgado sozinho, e um teste prova que o documento de uma thread não muda quando os outros candidatos do caso são permutados.

### Prompts fixos

Os prompts ficam declarados aqui e não são ajustados com os dados de avaliação.

- **Qwen3-Reranker:** o template oficial do card, com a instrução "Given a question about a software project's past work, judge whether this thread record answers it".
- **Kev:** uma pergunta de sim ou não, "Does this thread record answer the query?". O estado é a consulta e o documento, no formato de uso documentado no card.

### Captura

A captura da E2 ganha um canal judge, com chave (modelo, consulta efetiva, thread, hash do documento). A consulta efetiva entra na chave para que um score do juiz nunca seja reaproveitado para outra interpretação da H8. Ele traz o score de todas as threads que aparecem em qualquer canal do caso. Esse conjunto não depende dos folds, e por isso o replay pode aplicar qualquer ajuste sem rodar o modelo de novo.

Com 56 threads fixadas, o marc tem no máximo 114 × 56 = 6.384 pares por modelo, e o ledgerline-en, com 30 threads fixadas, tem no máximo 40 × 30 = 1.200.

### Modelo de segundo estágio

Para cada juiz J, uma variante H7_JUDGE_J faz o seguinte:

1. **Pré-admissão:** usa o H1 como está no plano. Uma thread passa quando `semanticOnly ≥ corte baixo`.
2. **Score final:** para as threads pré-admitidas, `p2 = σ(v0 + v1·logit(p) + v2·judge)`, com `v1 ≥ 0` e `v2 ≥ 0`. Aqui p é o score do H1, e judge é a probabilidade do juiz.
3. **Ajuste:** o mesmo `fitProcedure` aninhado do H1 escolhe v, λ e os cortes. Os cortes das faixas saem das predições internas, com as mesmas metas de precisão, 0,90, 0,60 e 0,30. A pré-admissão e o segundo estágio são ajustados dentro do mesmo fold de treino.
4. **Admissão:** a thread é admitida quando `p2 ≥ corte baixo do segundo estágio`. A faixa vem de p2. A ordem é p2 decrescente, depois p decrescente, depois threadId.

**Isolamento dos folds:** a cadeia inteira (H1, pré-admissão, v, λ e cortes do segundo estágio) é reajustada dentro de cada partição, tanto nas internas quanto nas externas. Nenhum H1 ajustado com todos os folds é reaproveitado. Um teste marca um fold externo e prova que nenhum par dele chega a qualquer etapa da cadeia que o avalia.

**Ramo de recuo do H1:** se o H1 recuar para H1_FALLBACK, o H7 é avaliado como H7_JUDGE_J_FALLBACK, com duas mudanças:
- a pré-admissão passa a ser o conjunto admitido pelo M0;
- p passa a ser a eligibility do M0, limitada ao intervalo [1e-6, 1 − 1e-6] antes do logit.

O segundo estágio só filtra e reordena threads já pré-admitidas, então nunca admite uma thread que a base não admitiria. Os critérios são os mesmos, com H1_FALLBACK como base.

**D6:** o juiz só olha conteúdo semântico, e o segundo estágio só age dentro da pré-admissão. No ramo do H1, ela exige o piso semântico; no ramo de recuo, ela é a admissão do M0. Nos dois casos, o acerto literal sozinho continua sem admitir nenhuma thread. O teste de propriedade do plano cobre o segundo estágio nos dois ramos.

### Critério de decisão (H7)

Os critérios usam as predições externas do marc e a regra de decisão da E0, em que inconclusivo reprova.

| Item | Critério |
| --- | --- |
| Base de comparação | H1_CALIBRATED, ou H1_FALLBACK se o H1 tiver recuado (ramo de recuo acima) |
| Não inferioridade | Top1-alvo, recall de admissão e abstenção correta nos negativos não inferiores à base |
| Ganho exigido | Pelo menos um destes: precisão de admissão com o termo "melhora", ou exposição incidental com o intervalo inteiro abaixo de 0. A exposição incidental é melhor quanto menor, e o relatório da E0 marca esse sentido como "piora" porque o termo não inverte o sinal |
| Segundo corpus | No ledgerline-en, sem reajuste, a precisão de cada faixa fica a no máximo 0,10 da meta, como na H6 |
| Escolha | Se os dois juízes passarem, fica o de maior ganho em precisão de admissão. Se empatarem, o de menor memória ocupada |
| Recuo | Se nenhum juiz passar, a E2 segue sem juiz |

## H8: interpretação por escolha tipada (alternativa D da H3)

### Opções e decisão

- **Opções:** as correções distintas geradas por `buildMemoryQueryCandidates`, sem a consulta original, mais uma única opção de não agir: "manter a consulta como está". O gerador inclui a consulta original no conjunto (query-candidates.ts:38-41), e por isso ela é retirada da lista de correções, para não duplicar a opção de não agir nem diluir as probabilidades. Sem nenhuma correção distinta, não há decisão e nada muda.
- **Decisão, com limites fixos declarados antes da medição. Os limites são inclusivos:**
  - aplica a correção quando a probabilidade da melhor correção é ≥ 0,90;
  - sugere quando ela é ≥ 0,60 e < 0,90;
  - não age quando a opção de não agir é a mais provável, quando nenhuma correção chega a 0,60 ou quando há empate exato entre as duas opções mais prováveis.
  - Os limites não são ajustados com os dados, porque o critério da H3 conta todos os casos dos dois corpora e não há conjunto separado para escolher limites. Eles evitam escolher o resultado depois de medir, mas não provam a calibração.
- **Testes:** ausência de correções; empate no topo; probabilidade exatamente em 0,60 e em 0,90; consulta original fora da lista de correções.

### Variantes

- **H3_D_LAYA:** uma pergunta de choice, com as temperaturas calibradas do config.json do modelo.
- **H3_D_KEV:** uma pergunta de choice, no formato do card.
- **H3_D_LFM:** o LFM atual. O score de cada opção é a log-probabilidade média dos tokens dela, dado o prompt atual do interpretador. As opções passam por um softmax com temperatura 1.

### Critério de decisão (H8)

- **Critério, que vale para B, C e D contra a alternativa A, em todos os casos dos dois corpora:**
  - correctionCorrect ≥ o de A e suggestionCorrect ≥ o de A;
  - correctionUndue ≤ o de A e suggestionUndue ≤ o de A;
  - a soma correctionUndue + suggestionUndue < a de A.
  - Motivo: A teve 0 correções indevidas na E0, e exigir uma redução estrita de cada contador seria impossível. Assim, nenhum tipo de erro pode aumentar, pelo menos um tem de diminuir, e os acertos não podem cair.
- **Regra de escolha, que substitui a ordem fixa C → B → A.** Entre as alternativas que passarem, nesta ordem:
  1. a menor soma de erros indevidos (correctionUndue + suggestionUndue);
  2. a maior soma de acertos (correctionCorrect + suggestionCorrect);
  3. o menor número de modelos distintos na cadeia de produção resultante: embedding, reranker, juiz da H7 se aceito, e interpretador. O reuso conta uma vez só; por exemplo, o Kev como juiz e como interpretador conta como um modelo;
  4. a ordem fixa B, C, H3_D_LFM, H3_D_KEV, H3_D_LAYA.
  - Se nenhuma passar, fica a A.
  - Como a escolha depende do juiz aceito, a H8 é decidida depois da H7.

Motivo da troca: com a prioridade em qualidade, a ordem fixa poderia escolher C mesmo quando uma alternativa D erra menos.

## Latência e memória

- **Antes da decisão, como estimativa:** o comando latency ganha uma passada opcional, `--judge <modelo>`. Ela mede, por caso, o tempo do juiz e da escolha tipada de cada variante D, com 1 aquecimento e 3 amostras. O relatório soma esse tempo ao do M0 e mostra o total com o rótulo "estimado".
- **Depois da decisão, como medição:** a cadeia escolhida (H1 ou recuo, juiz se aceito, interpretador escolhido) é medida de ponta a ponta, no caminho de produção, com o rótulo "medido".
- **Memória:** cada passada grava o RSS do processo em três momentos: a base, com os modelos do M0 carregados e antes do modelo novo; o pico, durante a passada; e o delta entre os dois. O relatório deixa claro que o RSS é do processo inteiro, não só do modelo, e que o delta é o custo incremental. Também grava `os.freemem`.
- **Condição:** a da revisão 8 da E0, carga típica de desktop.
- **Decisão:** a latência e a memória não reprovam H7 nem H8 e não têm gate automático. Antes de qualquer adoção em produção, o humano vê os números medidos e aprova, ou não, o custo, inclusive para máquinas de 8 GB.

## Tarefas e escopo

| Tarefa | Entrega | Testes |
| --- | --- | --- |
| T1b, junto com a T1 | `buildJudgeDocument` compartilhado; canais judge e choice na captura; variantes H7_JUDGE_QWEN e H7_JUDGE_KEV, com os ramos _FALLBACK, e H3_D_LAYA, H3_D_KEV e H3_D_LFM; segundo estágio dentro do fitProcedure; passada --judge do latency, com RSS de base, pico e delta | Segundo estágio com pesos não negativos e dados conhecidos; propriedade de D6 nos dois ramos; isolamento da cadeia H1 → v → cortes em cada partição interna e externa; documento do juiz invariante à permutação dos outros candidatos; cache do juiz com a consulta efetiva na chave; opções sem a consulta original; decisão nos limites (ausência de correção, empate, 0,60 e 0,90 exatos); replay sem carregar modelos |
| — | **Decisão dos aprovadores, publicada na thread** | — |
| T2b, só se a H7 for aceita | Juiz em produção: src/core/memory/scoring/judge.ts, papel judge no model-config, download pelo memory_prepare e status | Contrato do juiz com um provedor falso; inventário de modelos com o papel judge |
| T4, se uma D for escolhida | A alternativa D em src/core/memory/suggestion/, no lugar da alternativa A | Os testes de interpretação reescritos para a escolha tipada |

**Escopo de escrita acrescentado:**
- src/core/memory/scoring/judge.ts e src/core/memory/local-judge.ts, ambos novos e só na T2b;
- model-config.ts, inference-manager.ts e maintenance.ts, só na T2b e na T4.

As exclusões do plano continuam valendo, inclusive pnpm-lock.yaml e .marc/memory/**.

## Riscos

- **Formato de entrada dos modelos:** o Laya precisa de entradas próprias (marker_pos, marker_mask e qtype). Se o runtime atual não executar o grafo sem dependência nova, o modelo sai do estudo, e isso fica registrado.
- **Fora do domínio:** o card do Kev informa 0,62 de acerto fora do domínio dele. O marc é fora do domínio para todos os candidatos, e por isso só a medição decide.
- **Duração da captura:** até 6.384 pares por juiz no marc. Com um modelo de 0,6 B na CPU, a captura deve levar horas. Ela usa o checkpoint e o --resume da E0.
- **Pouco dado para a H8:** os casos typo e overcorrection-control são 20 no marc e 4 no ledgerline-en. Uma diferença de um ou dois casos decide o critério, e o relatório mostra os casos um a um.
- **Memória em máquina pequena:** dois modelos novos podem passar da sobra de um PC de 8 GB. A medição de rss existe para que o humano decida com números.

## Pendências antes do dispatch

- Confirmação de marc://@codex-software-architect sobre os ajustes da revisão 1 do adendo, e aprovação do humano.
- O principal confere, no handoff da T1b, o formato de uso de cada card e as versões exatas dos arquivos ONNX.
- O gate de entrada da E2 não muda: a E1 aprovada e a captura da E1 disponível.

## Histórico do adendo

- **Revisão 1 (2026-10-17):** incorpora os seis ajustes do parecer de marc://@codex-software-architect, que aprovou com ajustes.
  1. O ramo de recuo do H1 foi definido para o H7, com isolamento da cadeia inteira em cada partição.
  2. O documento do juiz passou a ter um construtor único, com a seleção de passagens da produção e um teste de invariância à permutação. A chave do cache inclui a consulta efetiva.
  3. O critério da H8 passou a ser: nenhum erro aumenta, a soma dos erros diminui e os acertos não caem.
  4. A regra de escolha foi fixada: soma de erros, depois soma de acertos, depois número real de modelos distintos, contando o reuso, depois uma ordem fixa.
  5. A consulta original saiu da lista de correções, e os testes de limite foram declarados.
  6. A latência e a memória passaram a separar o medido do estimado e a registrar o RSS de base, de pico e o delta.
