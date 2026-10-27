# Revisão independente do harness da E3 — Entrega 1

## Veredito e voto

**Harness pendente: corrigir B1 a B8 antes da captura pontuada.**

**Voto favorável à proposta de DEPTH0:** substituir a identidade pela não inferioridade contra o M0 da captura 1b68a7e3f4e6, nos casos comuns, para Top1-alvo, recall implicit e abstenção correta, δ=0,05. A decisão é prospectiva, antes de resultados confirmatórios da E3; inconclusivo continua reprovando.

Isso é uma extensão explícita do recuo, porque os dados mostram divergência vetorial além do BM25. Não é simplesmente a execução automática da condição anterior “se só o BM25 divergir”. Não coaprovo a afirmação causal forte de que a composição do lote já foi isolada: a própria entrega reconhece que não houve esse experimento.

A aprovação desse critério não aprova o harness nem antecipa aprovação da E3.

## Fontes e método

- Thread: msg_e8545514c0a347f1ad, entrega-1-e3.md, msg_d39050ee3df9432985 e esclarecimento da T0 em msg_ebf6563839fd4aa295.
- Plano revisão 5 e código atual no disco, por context-mode.
- Leitura do relatório existente .marc/cache/memory-eval-e3/t1c/bm25-invariance.json e dos módulos que o produziram. Não os executei novamente.
- Reproduções com funções reais e fixtures em memória, sem modelos, captura, rebuild ou escrita de arquivos.
- No teste de função privada do complemento e de células pendentes, a exposição adicional do símbolo foi feita apenas no JavaScript transpilado em memória. Nenhum arquivo foi editado.

## B1 — A captura interpreta usando o vocabulário das três camadas

**Local:** scripts/memory-eval/capture-plan.ts:55-63, especialmente :57; src/core/memory/query-candidates.ts:72-89.

planCase passa context.rows inteiro para buildMemoryQueryCandidates. Essa função não filtra camada. A interpretação capturada, portanto, depende de artifacts e chat, contrariando a restrição à camada 0.

**Reprodução:** com “workspace” na camada 0 e “toggle” só na camada 1, a consulta “toogle” tem candidatos:
- camada 0: somente “toogle”;
- linhas completas: “toogle” e “toggle”.

Não precisei invocar um interpretador: a entrada oferecida ao modelo já mudou.

**Risco:** as variantes e DEPTH0 são avaliados com uma consulta efetiva que não corresponde à interpretação aprovada de produção.

**Aceite:** filtrar camada 0 antes da geração de candidatos, preferencialmente pela mesma função usada pelo core. Testar termos presentes apenas nas camadas 1/2 e conferir a igualdade da entrada e da consulta interpretada de DEPTH0 com a referência apropriada.

## B2 — O fechamento da matriz considera apenas os finalistas da depth 2

**Local:** scripts/memory-eval/capture-scope.ts:67-99, especialmente :68-80.

O código reúne os recordIds dos canais de todas as depths, mas calcula os grupos e os cortes de K_max somente em channelsByDepth[2]. Isso não equivale à união dos top K_max de cada depth. A ordem de fusão e o rank de passagem mudam quando novas camadas entram.

**Reprodução com K_max=30:** o grupo A é o único candidato da depth 0. Na depth 2, 31 grupos novos passam à sua frente. A tem uma passagem recuperada e outra fora dos canais:
- a passagem recuperada entra pelo conjunto de canais;
- a outra passagem de A fica fora do escopo, embora A seja finalista da depth 0.

O teste unitário atual de matrixScope prova cobertura para uma ordenação de grupos, não a integração entre diferentes depths.

**Aceite:** calcular a seleção abrangente por depth e unir seus grupos antes de adicionar todas as passagens permitidas. Incluir esse cenário, sem usar grau conhecido ou evidence para mascarar a lacuna.

## B3 — O universo de passagens do funil não é o universo dos finalistas

**Locais:**
- src/core/memory/funnel-groups.ts:23-64;
- src/core/memory/funnel-run.ts:174-186 e :220-244;
- scripts/memory-eval/replay.ts:448-463.

groupsOf monta rows exclusivamente a partir de registros presentes nos canais. O replay fornece vetores e scores, mas não entrega ao seletor os metadados de todas as passagens do grupo. Assim, tanto a seleção por P quanto ALL_PASSAGES ficam limitadas às passagens já recuperadas.

**Reprodução:** disponibilizei no input os vetores e os scores de A-visible e A-hidden, mas apenas A-visible estava no canal. ALL_PASSAGES_D0 pediu só A-visible. A passagem adicional capturada não é usada.

Isso invalida a interpretação de ALL_PASSAGES como referência para medir a perda causada pelo corte P e pode esconder a própria evidência que o estudo precisa avaliar.

**Subcaso do ALL_CANDIDATES:** consolidatedPassages recebe apenas group.passages. Quando o grupo só tem identity, retorna vazio e descarta o fallback do M0 (semantic-ranking.ts, rerankingEvidence).
- Com um grupo identity-only e score 0,9, o M0 real admitiu o grupo.
- ALL_CANDIDATES_D0 não pediu nenhum documento e admitiu zero.

**Aceite:** separar os canais que definem candidatos e sinais densos dos registros completos, com metadados, que alimentam a seleção de passagens nas camadas permitidas. ALL_PASSAGES deve usar todas essas passagens; ALL_CANDIDATES deve manter exatamente a consolidação do M0, incluindo seu fallback de identity. Testar evidência fora dos canais e grupo identity-only.

## B4 — O complemento não preserva todas as células existentes

**Local:** scripts/memory-eval/capture-complement.ts:84-94 e :125-130.

O filtro de células já existentes é por recordId. Entretanto, rerankScores é indexado por texto. Dois recordIds podem gerar o mesmo documento. Ao adicionar o segundo registro, o spread da linha 129 pode sobrescrever uma chave textual antiga.

**Reprodução da função real scoreAdded, somente em memória:**
- dois IDs, documento canônico idêntico;
- score antigo por ID = 0,1; score antigo por chave textual = 0,1;
- score do novo par = 0,9;
- depois: ID antigo continua 0,1, mas a chave textual antiga passa a 0,9.

A diferença numérica é deliberada na fixture. O contrato append-only deve resistir a ela; a própria T0 documenta que mudar lotes pode alterar scores.

**Outro caminho de perda, conferido no código:** o complemento grava o agregado capture.json (:60), mas não os arquivos cases/*.json. Depois, capture --resume lê os arquivos antigos de caso (capture.ts:199-202) e monta um novo agregado (:220-243), sem preservar complementRounds. Isso permite perder as adições e o histórico numa retomada posterior.

**Aceite:** não sobrescrever chave de score existente, nem por ID nem por texto. Definir tratamento consistente de documentos iguais e garantir que uma retomada preserve integralmente células complementadas e rounds. Testar complemento com texto repetido e a sequência captura → complemento → resume, sem novos modelos.

## B5 — O gate de tempo da captura ignora o production recall

**Local:** scripts/memory-eval/capture.ts:251-256, em contraste com capture-score.ts:43, capture-channels.ts:55-62 e capture-count.ts:117-131.

A contagem separada inclui productionRecallPairs. O gate que efetivamente autoriza a pontuação soma só scopeRecordIds.length. Depois de pontuar a matriz, cada caso ainda executa um production recall com o reranker real.

**Reprodução aritmética com a função real countPlanOf:**
- 507.167 pares de matriz: 11,999976 h, aceito;
- os mesmos pares mais 120 de recall: 12,002816 h, recusado.

Logo, o comando de contagem e o gate de execução não protegem o mesmo custo. A captura atual estimada em 6,47 h está abaixo do teto; o problema é a fronteira do mecanismo de autorização.

**Aceite:** usar no gate a mesma contagem total da inspeção prévia, incluindo o recall realmente executado, antes da primeira pontuação. Testar matriz abaixo de 12 h e total acima.

## B6 — A eligibility passou a depender das P passagens selecionadas

**Local:** src/core/memory/funnel-admission.ts:87-96; semantic-ranking.ts:232-260.

candidateOf usa as passagens escolhidas para preencher candidate.passages. rankThreadCandidates calcula bestDenseScore, passageSupport e evidenceConcentration a partir dessa lista. O plano mantém esses sinais nas três passagens de topo do canal, independentemente de P.

**Reprodução:** mesmo grupo, mesmos canais, mesmo melhor rank e score do reranker:
- P=3: eligibility 0,9720774262, faixa alta;
- P=12: eligibility 0,9671795809, faixa média;
- cortes: alta 0,97, média 0,5.

A diferença veio da concentração densa da lista selecionada. Ela pode alterar a parada sem que o melhor resultado do reranker tenha mudado.

**Aceite:** manter os três sinais declarados sobre o recorte de três passagens do canal; guardar a evidência escolhida e o melhor score do reranker separadamente. Acrescentar regressão em que variar P não altera esses sinais quando os canais e o melhor score são iguais.

A conferência dessa construção deve também preservar o tratamento aprovado dos grupos sem identity; não basta aplicar o rank de passagem apenas à fusão barata.

## B7 — A parada olha só o primeiro resultado, não qualquer faixa alta

**Local:** src/core/memory/funnel-run.ts:153-160; funnel-admission.ts:73-77.

stopAfter lê admitted[0].band. A lista é ordenada pelo hybridScore; o código não garante que a maior faixa esteja sempre na primeira posição. O plano manda continuar somente se nenhum resultado for alto.

**Reprodução do ADAPTIVE real:**
- primeiro resultado A, faixa média;
- segundo resultado B, faixa alta;
- layersSearched = [0,1,2], stopReason = deepest-layer.

A busca deveria parar na camada 0 pela regra aprovada.

**Aceite:** aplicar a condição aprovada à lista admitida e testar faixa alta abaixo de um primeiro resultado médio. Uma política de parar só pelo primeiro resultado exigiria decisão explícita; não deve entrar silenciosamente pela descrição da variante.

## B8 — Julgamento pendente de camada não impede métricas completas

**Locais:** scripts/memory-eval/evaluation.ts:67-78 e :104-125; dataset.ts:149-175; judgments.ts:421-436.

A worksheet distingue corretamente células por grupo e camada. Entretanto, a avaliação recebe apenas o máximo dos graus já existentes. Um grau da camada 0 mascara a ausência de grau numa camada adicional alcançada.

**Reprodução com as funções reais de worksheet e avaliação:**
- G tem grau 1 no summary;
- a captura tem passagem de artifact de G na camada 1;
- DEPTH1 alcança G; a camada 1 não tem julgamento;
- pendingCellsOf pede G/camada 1;
- caseInputsFor/evaluateVariant declaram status complete, sem pending, usando G=1.

Não é seguro apresentar a leitura incompleta como se o grau efetivo estivesse estabelecido: a camada ainda não julgada pode responder à consulta e subir o máximo para 3.

**Aceite:** compartilhar a determinação das células necessárias, usando o conteúdo efetivamente existente e a depth alcançada, entre worksheet e avaliação. Célula necessária não julgada deve tornar a variante incomplete. Não atribuir implicitamente à camada nova o grau do summary. Manter compatibilidade com capturas antigas que efetivamente só têm camada 0.

## Itens conferidos sem bloqueio próprio

- capture-layers.ts declara depths [0,1,2], índice temporário [0,1,2] e ordem length, incluída na identidade da captura.
- Canais são gravados por depth; vetores são persistidos em um arquivo float32 e lidos por recordId. O problema B3 é consumir seu universo completo, não ausência da gravação dos vetores.
- evidenceMatchesOf guarda passageIds das passagens que contêm a citação. evidence_unindexable e missing se propagam como caso incomplete, e evaluation.ts impede comparação aprovável nesses casos.
- Budget, K e modo são obrigatórios, sem valor implícito; cortes são obrigatórios para ADAPTIVE/ADAPTIVE_HM, não para as variantes que não leem faixas. Não há uso automático dos cortes de produção.
- judgedDepth do ADAPTIVE vem do run efetivo, pelo maior layer em layersSearched; não é inferido apenas pelo nome da variante. O problema B7 altera onde o run para, não esse cálculo.
- layerJudgments, máximo por depth, validação de grupos e serialização estão implementados. O bloqueio B8 é o vínculo entre ausência de célula e status da avaliação.
- A decomposição T0/T1/T2 e os controles humanos continuam sendo importantes. A existência de 934 testes aprovados no relato não substitui a conferência das fronteiras acima.

## Evidência de invariância e proposta DEPTH0

Confirmei no relatório existente:

- identity: sem divergência;
- passage: ordem divergente em 77 casos e conjunto em 12; delta máximo aproximadamente 0,004993;
- title: ordem divergente em 84 casos;
- summary: ordem divergente em 104 e conjunto em 89;
- 114/114 casos diferem em algum canal;
- dois índices [0]: 351/351 vetores idênticos;
- [0] contra [0,1,2]: 348/351 idênticos, três diferentes, delta máximo por componente 0,01295398 e cosseno mínimo 0,99757375.

O código de vector-invariance.ts compara construções com camadas diferentes; não varia isoladamente o tamanho/composição do lote mantendo todos os demais fatores. Portanto, “efeito ligado à composição do índice” é sustentado; “lote isolado como causa” continua hipótese. A redação da entrega reconhece essa limitação; a classificação gravada no JSON é mais categórica do que o experimento permite.

Sou favorável ao novo gate de não inferioridade, preservando a baseline congelada, pareamento dos casos comuns, bootstrap por família e a regra de inconclusivo como reprovação. Não declaro as três diferenças vetoriais desprezíveis nem a qualidade preservada antes de medir.

Também concordo em medir latência contra o M0 pré-E3 com ordem input: a ordenação length é uma melhoria da própria E3. Isso não dispensa a medição conjunta exigida na T5.

## Checks independentes e preservação

- Typecheck do projeto, sem emissão: passou.
- Sete arquivos de testes puros focais: **76/76**, sem falhas, skips ou cancelamentos.
- Reproduções adicionais em memória: escopo entre depths, universo de ALL_PASSAGES, identity-only em ALL_CANDIDATES, vocabulário de interpretação, fronteira do gate, sobrescrita de célula textual, sinais dependentes de P, parada com faixa alta não inicial e worksheet pendente contra avaliação complete.
- Não executei a suíte inteira nem repeti os 934 testes do relato.
- Manifest antes/depois dos checks: SHA-256 idêntico a b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a.
- Sem Git, rebuild, captura, pnpm validate, modelos ou alterações em código, testes, docs, datasets e .marc/memory.
- Nenhuma thread encerrada; nenhuma tarefa delegada.

## Próximo passo

Corrigir os oito pontos, acrescentar as regressões e devolver o harness integrado para re-revisão antes da captura pontuada. O voto favorável ao critério DEPTH0 pode ser registrado agora, sem confundi-lo com a aprovação do estado atual do harness.
