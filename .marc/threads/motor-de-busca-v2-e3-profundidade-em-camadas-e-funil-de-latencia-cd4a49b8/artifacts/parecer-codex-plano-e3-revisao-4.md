# Parecer independente sobre a revisão 4 do plano da E3

## Veredito

**Achados: coaprovação integral pendente de B1, B2 e B3.**

Concordo com a adaptação à decisão da E2: não presumir modelo barato ou score calibrado, manter faixas heurísticas, usar 1,2 × M0 como gate de latência e deixar 5 s como alvo do estudo de modelos. Não reabro a arquitetura aprovada na revisão 3. Os ajustes abaixo fecham contratos novos da revisão 4 antes do dispatch.

Fontes: msg_4574dc3b3dd74bd082, plano-e3-profundidade-em-camadas-e-funil.md revisão 4, handoff-e3-correcoes.md, pareceres anteriores da E3, código atual no disco e captura existente 1b68a7e3f4e6. Inspeção por context-mode.

## B1 — O orçamento global ainda não define uma execução viável

**Plano: seção 4, linhas 110-125; recuo H4 nas linhas 189-190.**

O texto define B como total de pares novos por consulta, somando passos adaptativos, mas só impõe K × P ≤ B. Essa desigualdade por passo não garante o total da consulta. A execução precisa saber quanto pode gastar na camada 0 e quanto resta para as demais.

Exemplo de fronteira, não medição: B=120, K=20, P=6. Se cada finalista tiver seis passagens distintas, a camada 0 pode consumir os 120 pares. Se não houver faixa alta, a camada seguinte pode precisar de documentos novos; o plano não diz como expandir sem ultrapassar B ou sem tornar a expansão apenas nominal.

Há mais duas indefinições:

- “o identity entra quando existe” não diz se ocupa uma das P posições ou acrescenta mais um par por grupo;
- P = floor(B/K), “com mínimo de 3”, pode violar o próprio orçamento. Com B=50 e K=20, o mínimo produz 60 pares;
- o recuo para até 2P e o aumento de K precisam respeitar o mesmo teto, não criar uma exceção implícita.

O M0 atual não fornece essa política: em semantic-ranking.ts:174-177, ele pontua as passagens, usando identity só quando não há passagem. Portanto, a contabilidade da proposta precisa ser explícita.

**Ajuste pedido:** definir a contagem de pares únicos, o tratamento do identity, a alocação determinística entre passos e o comportamento quando o saldo não permite nova avaliação. Declarar a condição de inviabilidade K × 3 > B e como os dois recuos cabem no teto. A estimativa de latência deve usar essa mesma política, distinguindo custo fixo por passo de custo dos pares inéditos.

**Aceite:** testes declarados para três passos com conjuntos disjuntos, cache parcial, identity presente, K × 3 > B e recuo FTS. O total real de chamadas para documentos inéditos nunca supera B; layersSearched e a condição de parada não apresentam uma camada não efetivamente avaliada como se tivesse sido buscada.

## B2 — K é ajustado pelos mesmos julgamentos que voltam à aprovação

**Plano: seção 4, linha 123; seção de casos, linha 158; avaliação, linhas 185-192; T0, linha 238.**

A T0 escolhe o menor K com perda de recall no máximo 0,02 na captura rotulada da E2. A E3 acrescenta casos ao dataset existente, mantendo os casos antigos. Assim, parte dos julgamentos que escolhem K também participará do IC de aprovação do funil. Declarar antecipadamente a regra do mínimo não separa ajuste de avaliação.

No código atual, o dataset tem família por caso (dataset.ts:11-23), e o precedente da E2 separa parâmetros e cortes por partição de treino (fit.ts:317-340). O bootstrap por família mede incerteza, mas não desfaz a escolha de K olhando os próprios rótulos avaliados.

**Risco:** apresentar como confirmação fora da amostra a retenção que foi usada para escolher o parâmetro. P também herda a escolha por depender de K.

**Ajuste pedido:** separar explicitamente os dados de ajuste de K dos de aprovação. Pode ser seleção dentro dos folds de treino, com K/P de produção reajustados depois em todos os dados autorizados, ou um holdout independente pré-declarado. A curva global da T0 pode continuar exploratória; não deve ser confundida com a medida confirmatória que aprova a configuração escolhida.

**Aceite:** alterar os graus de um fold externo não muda K/P nem os cortes que predizem esse fold. Se for escolhido holdout, os casos usados no ajuste não entram como confirmação independente. A regra de produção, a separação por família e o universo de cada gate ficam documentados antes da captura/decisão.

## B3 — A matriz com escopo precisa fechar variantes, recuos e julgamentos

**Plano: captura, linhas 200-206; julgamentos, linhas 168-185; tarefas, linhas 239-243.**

A matriz depende dos finalistas de cada depth e dos grupos de grau ≥ 2. Entretanto:

- os novos graus só ficam conhecidos no julgamento incremental;
- aumentar K pode produzir finalistas cujas passagens completas não estavam na matriz inicial;
- a captura aparece entre T1 e T2, mas as variantes e a seleção usadas para definir seu escopo só são entregues em T2.

No harness atual, capture.ts:265-279 monta a matriz de todos os registros. Isso evita lacunas para o corpus presente. Ao restringi-la, essa garantia deixa de ser automática. variants.ts:35-57 ainda recebe um único conjunto de canais e não expõe a seleção; o handoff identifica corretamente esse trabalho futuro.

**Ajuste pedido:** colocar o seletor e as variantes necessários à definição do escopo antes da captura, separando implementação do harness de análise posterior dos resultados. Definir o fechamento da matriz para K de recuo, 2P e ALL_PASSAGES. Definir também como incorporar grupos novos julgados relevantes: união pré-declarada suficientemente ampla ou complementação monotônica via resume, sem alterar canais/vetores e sem transformar a falta de score em zero ou em exclusão silenciosa.

**Aceite:** toda variante e recuo autorizado consegue solicitar todos os documentos de que necessita. Uma célula ausente gera incomplete/erro explícito, não um resultado aprovável. Incluir testes com finalista novo após aumento de K e grupo que passa a ter grau ≥ 2 após o julgamento. O relatório distingue seleção, cobertura da matriz e evidência sobrevivente.

Isso preserva uma captura lógica por corpus; não exige voltar à matriz integral indiscriminadamente.

## Pontos confirmados e correspondência com o código

### Fusão barata e rank por grupo

A fórmula proposta corresponde à decomposição do M0:

- semantic-ranking.ts:219-222 combina 1/rank de identity, passagem e reranker, com pesos 1, 1 e 2;
- hybrid-ranking.ts:14-18 e :101-124 acrescenta os pesos lexicais 2, 0.75 e 0.5;
- semantic-ranking.ts:165-170 e :202-211 mostra que o rank atual do reranker é global por documento, não por grupo.

Logo, retirar apenas o termo do reranker produz um sinal barato implementável sem modelo novo. Extrair essa computação compartilhada evita uma réplica divergente. A mudança para rank por grupo está delimitada às variantes de funil; não deve contaminar a referência DEPTH0/M0.

Reconstituí, com as funções reais semanticHitsForChannels, denseRanksByKind e consolidateThreads, a quantidade de documentos que o M0 enviaria ao reranker na captura: **114 casos, mínimo 99, mediana 120, máximo 135**. Confirma a contagem do handoff. Os aproximadamente 7 pares/s continuam sendo uma estimativa por tempo total, a ser substituída pela vazão medida da T0.

### Camadas e DEPTH0

operations.ts:218-236 não envia layers; os stores usam [0] por padrão. A revisão corrige isso e prevê pool por camada para evitar expulsão dos summaries.

**Cuidado de cobertura, sem regressão já demonstrada:** DEPTH0 igual ao M0 precisa ser verificado em índice realmente misto [0,1,2], contra a referência [0], e não apenas nos dois replays de uma captura já filtrada. O canal lexical summary atual não restringe kind; não presumir que ele contém apenas passagens. Adicionar filtro de kind não pode eliminar hits de identity que o M0 atual considera.

O store usa um índice FTS por coluna e aplica where por camada (lancedb-store.ts:154-184). A documentação confirma BM25 e filtragem, mas não estabelece aqui uma garantia de estatísticas independentes por subconjunto. Portanto, limite 100 e filtro de camada, sozinhos, não são uma prova de invariância lexical. Recomendo fixture com documentos das camadas posteriores que mudem fortemente as frequências dos termos, verificando os canais e a sequência final admitida.

Referências primárias consultadas via Context7: [QueryBase e filtros](https://github.com/lancedb/lancedb/blob/main/rust/lancedb/src/query.rs) e [FTS e BM25](https://docs.lancedb.com/search/sql/fts-sql). Trata-se de risco a testar, não de uma afirmação de falha reproduzida do LanceDB.

### Interpretação

recall-support.ts:50-51 lê todas as linhas com vetores. Restringir o vocabulário à camada 0 é necessário para não alterar a interpretação de DEPTH0. Reusar a consulta efetiva nos passos seguintes é coerente com a decisão anterior e evita novas correções durante a expansão.

### Status e reconcile

O handoff está correto: status.ts:70-98 compara threadId e hash; rebuild-operations.ts:131-171 compara sourcePath, hash, authority, sourceType, layer e remoções. Um único comparador com esse conjunto evita divergência entre stale e trabalho de reconcile. A contagem de summaries deve continuar separada da quantidade total de fontes.

O orçamento de aproximadamente 100 ms é uma meta a medir no corpus real; a inspeção estática não comprova esse tempo.

### Artifact e messageId

O campo já existe no contrato de chunk e no armazenamento LanceDB, inclusive como opcional/null. O leitor de artifacts ainda não o resolve. ClosedThread já carrega CHAT.md, e o vínculo de anexos está no metadado artifacts.

Concordo com resolver a primeira mensagem que anexou o arquivo, deixar ausente se não houver vínculo e incluir a resolução no hash que o reconcile compara. Não há necessidade de mudança de schema para preencher esse campo existente.

### groupId e groupKind

Os leitores já produzem @rules e @document/<path> como identificadores sintéticos; a consolidação atual agrupa por threadId. Formalizar groupId/groupKind evita fingir que esses resultados são threads. A separação de reference, nextActions e UI por tipo está adequada. Os tipos e consumidores atuais ainda exigem threadId/summaryPath, como indicado no handoff.

### Faixa alta e D10

Concordo com a não inferioridade da precisão externa da faixa alta de ADAPTIVE contra DEPTH0, δ=0,05 e bootstrap por família, mantendo inconclusivo como reprovação. Isso não transforma a faixa heurística em promessa de precisão absoluta.

Os cortes devem ser os da partição de treino também para decidir a parada adaptativa, não apenas para apresentar a métrica depois. A redação de folds externos para medidas é compatível com isso; B2 pede que a mesma separação alcance os novos parâmetros ajustados por julgamentos. Os cortes de produção ficam para a configuração final.

### Julgamentos por camada e evidência

Manter graus antigos apenas na camada 0, aceitar grupos não thread e usar o máximo dos graus nas camadas disponíveis é uma adaptação explícita e coerente com as novas fontes. Continua necessária a avaliação por passageId e conteúdo da citação: uma passagem diferente da mesma seção não prova sobrevivência. Mantêm-se aprovados os critérios de armadilhas e a comparação com ALL_PASSAGES.

## Referências do handoff

Conferi os trechos centrais citados do núcleo, armazenamento, leitores, metadados, status/reconcile, harness, tipos, transportes e UI. Eles apontam os contratos atuais relevantes; a lista é de trabalho a realizar, não evidência de que a E3 já esteja implementada.

Os locais de depth, leitura irrestrita da interpretação, ausência de filtro lexical por kind, rank global, campos de messageId existentes, comparação do status, falta de evidence no dataset e ausência de seleção por depth nas variantes correspondem ao disco. Não identifiquei uma referência central incorreta que bloqueie o handoff.

## Preservação e limites da revisão

Manifest conferido: **61 registros**, geração 20261022025654947_cbb6ce74, SHA-256:

b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a

Não rodei Git, rebuild, captura, modelos, pnpm validate ou outros checks com correção de arquivos. A análise executável limitou-se à contagem de documentos da captura existente, sem inferência. Não alterei código, testes, docs, datasets ou .marc/memory. Não fiz dispatch e não encerrei a thread.

O aceite técnico do plano espera os três ajustes. Os demais pontos acima não reabrem as decisões da E2 nem a arquitetura aprovada na revisão 3.
