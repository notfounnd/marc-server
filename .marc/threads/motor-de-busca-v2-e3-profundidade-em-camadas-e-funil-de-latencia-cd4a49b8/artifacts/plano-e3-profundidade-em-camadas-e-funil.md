# Plano da E3: profundidade em camadas e funil de latência

## Resumo

A E3 liga as camadas 1 e 2 no índice e redefine `depth` como camadas de corpus (D3):

| Depth | Camadas buscadas |
|---|---|
| 0 | `SUMMARY.md` |
| 1 | + artifacts, `RULES.md` e documentos configurados |
| 2 | + `CHAT.md` |

A etapa também cobre:

- **H5:** a UI faz uma busca única, com expansão adaptativa e determinística, que só para com resultado na faixa alta;
- **remoção do Deep da UI:** botão, estado e configuração;
- **H4:** funil de latência com orçamento. A fusão do M0 antes do reranker escolhe os finalistas, e só eles recebem o reranqueamento.

**Revisão 4 (2026-10-22).** Esta revisão adapta o plano ao resultado da E2 (marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2):
- não existe score calibrado nem modelo completo;
- a produção mantém a ordem e a admissão do M0;
- as faixas são um indicador heurístico (D10).

A revisão também incorpora a decisão de latência do humano e as correções de handoff. A arquitetura de camadas, a parada só na faixa alta, as armadilhas e a evidência por `passageId` continuam como estavam.

**Revisão 5 (2026-10-22).** Responde ao parecer de marc://@codex-software-architect sobre a revisão 4 (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_1d432bb2fa6649ccaa):
- **B1:** o orçamento ganha contabilidade executável (seção 4);
- **B2:** K passa a ser escolhido dentro dos folds de treino, e a curva da T0 fica só exploratória (seção 4);
- **B3:** a matriz da captura tem escopo fechado, e o seletor e as variantes vão para a T1, antes da captura (seção "Captura da E3").

Também entra o teste de invariância do BM25 com o índice misto, e sai o filtro lexical de `kind` (seção 1).

**Revisão 7 (2026-10-23).** Registra o que os dois arquitetos coaprovaram depois da Entrega 1 (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_c4dec7d170fb47a0b3, marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_6d8959f0dd2a463891 e marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_35ceeccdc9014a47b1):
- o rank do reranker no funil segue a semântica do M0, e não um rank por grupo (seção 4, item 5);
- casos e quantidade: 137 no marc e 79 no ledgerline (seção "Passo dos aprovadores");
- as estimativas de poder ficam registradas como sensibilidades. O aceite continua pela não inferioridade no IC da métrica real.

Os critérios de H5 são herdados de marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f. Rota: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

## Gate de entrada

- **E2:** aprovada, aceita e encerrada, com o rebuild produtivo feito (commit fb9c030). Cumprido.
- **Custo das camadas medido na E1:** no marc, [0] tem 352 registros e [0,1,2] tem 2.769, com rebuild de 147,6 s. Cumprido.
- **Referências de linha:** conferidas no handoff-e3-correcoes.md.
- **Produção intacta:** o manifest de referência é `b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a` (61 summaries), sem mudança até a aceitação.

## Decisão de latência do humano (2026-10-22)

Qualidade primeiro. A mediana da busca adaptativa com camadas não pode passar de **1,2 × a mediana do M0**, medidas na mesma execução. O orçamento do reranker é o maior que cabe nesse limite. Os 5 s e o p95 de 10 s da revisão 3 ficam registrados como alvo do estudo de modelos depois da E3. Eles são reportados, mas não decidem.

**Por que a meta mudou:** o M0 manda em mediana 120 documentos ao reranker por consulta (de 99 a 135, na captura 1b68a7e3f4e6), a cerca de 7 pares por segundo, o que explica os 18,2 s. O funil da revisão 3 (20 finalistas × 12 passagens = 240 pares) seria duas vezes mais lento que o M0. Os 5 s só caberiam com 25 a 30 pares por passo, um quarto do que vai ao reranker hoje.

## Fontes obrigatórias

- regras, registro da rota, relatórios da E0, E1 e E2, e os ADRs 0010 e 0011;
- proposta da thread `4f477d9f` (`proposta-estudo-profundidade-adaptativa-deep-search.md`);
- `docs/memory.md` (`Source layers and provenance`, `UI search depth`, `UI search`, `Recall flow`);
- o handoff-e3-correcoes.md desta thread.

## Desenho

### 1. Camadas no núcleo

- `INDEXED_LAYERS` passa a `[0, 1, 2]`. A depth d busca as camadas ≤ d: `MEMORY_DEPTH_LAYERS: Record<MemorySearchDepth, MemoryLayer[]>`, com `MemorySearchDepth = 0 | 1 | 2`.
- **Busca por camada:**
  - os canais passage e lexical-summary rodam **uma vez por camada** permitida, com o limite atual de 100 cada;
  - o identity só existe na camada 0 e roda uma vez;
  - o limite por depth (100 a 400) deixa de existir.
- **Por que buscar por camada:**
  - `DEPTH0` continua idêntico ao M0;
  - o pool de uma depth contém o da depth anterior, então a expansão nunca perde um candidato;
  - os artifacts (1.878 de 2.769 registros) não expulsam os summaries de um pool fixo.
- **Busca lexical sem filtro de `kind`:** na camada 0, o canal lexical continua igual ao do M0, inclusive com os hits de identity. As camadas 1 e 2 não têm identity, então o filtro de camada basta. O filtro de `kind` da revisão 4 sai do escopo.
- **Invariância do BM25:** o índice FTS é um só por coluna, e o filtro de camada é aplicado na consulta. Por isso, as estatísticas do BM25 podem mudar quando as camadas 1 e 2 entram no índice. A T1 testa isso em dois níveis:
  - uma fixture em que documentos das camadas 1 e 2 mudam muito a frequência dos termos da consulta;
  - o índice real do marc, [0] contra [0, 1, 2], nos 114 casos, comparando cada canal e a sequência final admitida.
- **Recuo pré-declarado, se só o BM25 divergir:** o critério de `DEPTH0` deixa de ser identidade e passa a ser não inferioridade contra a captura 1b68a7e3f4e6 do M0, nos casos comuns (Top1-alvo, recall dos casos `implicit` e abstenção correta, δ 0,05). O relatório lista cada caso divergente e o canal.
- **Resultado da T1c-c e decisão (revisão 6):** no índice real do marc, o BM25 diverge em 114 de 114 casos. Além disso, 3 de 351 vetores da camada 0 mudam quando o índice tem as três camadas (cosseno mínimo 0,99757). O índice só da camada 0 é determinístico. A divergência está ligada à composição do índice; o lote do embedding como causa é hipótese não isolada. Os dois arquitetos aprovaram estender o recuo a essa divergência vetorial (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_d39050ee3df9432985 e marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_895b510eac054a4ebf). Vale a não inferioridade acima, com a baseline congelada, casos comuns pareados, bootstrap por família e inconclusivo reprovando. As três diferenças vetoriais não são declaradas desprezíveis antes da medida.
- **Interpretação da consulta:** lê só as linhas da camada 0, para que o vocabulário de `DEPTH0` não mude com o chat.
- **`messageId` do artifact:**
  - o leitor resolve a primeira mensagem do `CHAT.md` cuja lista `artifacts` contém o arquivo; sem mensagem, o artifact fica sem `messageId`;
  - o campo já existe no registro e no schema LanceDB, então **não há mudança de versão de schema nem de contrato**;
  - o `messageId` resolvido entra no sha256 da fonte, para reindexar quando o anexo muda.
- **Status e reconcile:**
  - os dois usam **um único comparador** por `sourcePath`: a regra de `isChangedSource` mais os caminhos removidos, sobre `readIndexedSources(INDEXED_LAYERS)`. Assim, `stale` sempre significa que o reconcile tem trabalho a fazer;
  - `indexedSummaryCount` conta só os summaries;
  - o status roda em toda busca, por isso tem orçamento de cerca de 100 ms, medido em teste com o corpus do marc.

### 2. Grupos e contrato do hit

- **Grupo de resultado:** a thread (com summary, artifacts e chat), `@rules` ou `@document/<sourcePath>`.
- `MemoryRecallHit` ganha:
  - `groupId`, sempre presente, com o valor que hoje vai em `threadId`;
  - `groupKind: "thread" | "rules" | "document"`.
- `threadId` e `summaryPath` só aparecem nos grupos do tipo thread.
- `reference` segue uma tabela pelo tipo da melhor evidência:

| Melhor evidência | `reference` |
|---|---|
| summary | `marc://$<threadId>` |
| chat | `marc://$<threadId>/#<messageId>` |
| artifact com mensagem | `marc://$<threadId>/#<messageId>/!<arquivo>` |
| artifact sem mensagem | `marc://$<threadId>` |
| rules ou document | o `sourcePath` como texto simples |

- `nextActions` segue o tipo de grupo e só sugere `thread_read` para threads.
- `MemoryRecallResult` ganha:
  - `layersSearched: MemoryLayer[]`, só com as camadas dos passos que de fato rodaram;
  - `rerankPairs: number`, o total de pares inéditos enviados ao reranker na consulta;
  - `expansionStop?: "high-band" | "deepest-layer" | "budget"`, só com `adaptive: true`.
- **MCP, CLI e HTTP:** `depth` aceita de 0 a 2, com padrão 0. O valor 3 é rejeitado com uma mensagem que explica as camadas. No HTTP, isso substitui o 400 enganoso "Search query is required".

### 3. Expansão adaptativa (H5)

O core ganha `adaptive?: boolean` em `MemoryRecallOptions`, com padrão `false`. Com `adaptive: true`:

1. busca em depth 0;
2. se nenhum resultado estiver na faixa **alta**, repete em depth 1;
3. depois em depth 2, pela mesma regra;
4. cada passo reusa a consulta efetiva da primeira interpretação, em modo literal, e os scores de reranker já calculados para o mesmo par (consulta, documento);
5. cada passo gasta só o saldo que a seção 4 lhe dá. Um passo sem saldo não roda: a busca para com `expansionStop: "budget"`, e a camada não entra em `layersSearched`.

A faixa média não encerra a busca, porque a precisão dela no marc é de 0,41. A regra antiga (parar em alta ou média) fica no harness como `ADAPTIVE_HM`, só como referência.

A rota HTTP da UI usa `adaptive: true`. O MCP não expõe a opção: os agentes escolhem `depth` explicitamente.

### 4. Funil (H4) com orçamento

1. **Sinal barato:** a fusão do M0 antes do reranker, ou seja, 1/rank do identity, mais 1/rank da passagem, mais os pesos lexicais. É o `hybridScore` sem o termo do reranker. Não tem parâmetros novos, é determinístico e não depende da montagem dos lotes.
2. **Finalistas (K):** os primeiros ⌈K/2⌉ pela fusão. As vagas restantes vão para os grupos ainda não escolhidos, pela ordem do melhor rank denso de passagem. Desempate pela fusão e depois por `recordId`. Isso protege grupos cuja evidência só está em passagens (artifact, chat ou `@rules`), que não têm o termo do identity nem o título lexical.
3. **Passagens por finalista (P):**
   - a função pura `selectRerankPassages(queryVector, groupRows, p)` ordena as passagens do grupo nas camadas permitidas pelo cosseno calculado em JS, a partir dos vetores float32, e devolve as p primeiras. Desempate por `recordId`. É a mesma função em produção e no replay;
   - **identity:** como no M0 (`semantic-ranking.ts:174-177`), o identity só é pontuado quando o grupo não tem passagem nas camadas permitidas. Nesse caso, ocupa uma das P vagas. Um finalista custa, portanto, no máximo P pares.
4. **Orçamento (B), com contabilidade explícita:**
   - **Unidade:** um par (consulta efetiva, `recordId`) inédito na consulta. O cache dos pares vive na memória da própria busca. Como a consulta efetiva é a mesma em todos os passos, um par já pontuado não custa de novo. Só contam as chamadas do reranker para pares inéditos, independentemente da montagem dos lotes.
   - **Teto da consulta:** a soma dos pares inéditos de todos os passos nunca passa de B.
   - **Saldo por passo:**
     - um passo que ainda pode ser seguido de outro recebe metade do saldo, ⌊(B − gasto) / 2⌋;
     - o último passo possível recebe o saldo inteiro;
     - na busca adaptativa, as depths 0 e 1 levam metade do saldo, e a depth 2 leva o resto;
     - na busca com depth explícita (MCP e CLI), o único passo é também o último e recebe B.
   - **P do passo:** P = max(3, ⌊saldo do passo / K⌋).
   - **Ordem de gasto:**
     - os pares pedidos seguem a ordem dos finalistas (item 2) e, dentro de cada finalista, a ordem de `selectRerankPassages`;
     - um par que já está no cache é usado sem custo;
     - um par inédito só é pontuado se ainda houver saldo no passo;
     - os demais ficam sem score, e o harness marca o passo como truncado.
   - **Finalista sem score:** um finalista sem nenhum par pontuado no passo sai da lista de finalistas desse passo e não pode ser admitido.
   - **Passo sem saldo:** não roda (seção 3).
   - **Viabilidade:**
     - uma configuração só é válida se 3 × K ≤ ⌊B / 2⌋, para que o passo 0 da busca adaptativa nunca seja truncado;
     - a função `validateFunnelBudget(B, K)` verifica isso e é usada nas variantes, nos recuos e num teste das constantes de produção;
     - os passos de expansão podem ser truncados, e o relatório mostra quantas vezes isso aconteceu.
5. **Rank do reranker com a semântica do M0 (revisão 7):**
   - `rerankerRank` é a posição ordinal global da melhor passagem pontuada do grupo no passo (`numericRanks`), como no M0. O rank por grupo da revisão 4 saiu, sem opção nova;
   - a melhor passagem do grupo é a de maior score. Os empates são resolvidos por `denseRank`, como em `applyBestPassage`. Um grupo pontuado só pelo identity usa o rank do identity;
   - a admissão aplica o teto monotônico na ordem híbrida dos semanticamente elegíveis (`hybridAdmissionOrder`), como no M0;
   - controle de paridade: `ALL_CANDIDATES` com todas as passagens reproduz o conjunto admitido do M0 em 114/114 (marc) e 40/40 (ledgerline);
   - `bestDense`, `passageSupport` e `evidenceConcentration` continuam calculados sobre as 3 passagens do topo do canal;
   - quem não é finalista não é admitido.
6. **Grupos sem identity** (`@rules` e documentos). A eligibility do M0 zera os termos do identity para eles. Recuo pré-declarado: usar o rank da melhor passagem no lugar do rank do identity. O relatório mostra a admissão por tipo de grupo.

**Escolha de B, K e P (procedimento pré-declarado):**

- **B (na T0, sem julgamentos):** B = ⌊v × (1,2 × M0 − f_interp − 3 × f_passo)⌋, em que:
  - v é a vazão do reranker medida na T0, em pares por segundo, com a ordenação por tamanho se ela for aprovada;
  - M0 é a mediana de ponta a ponta do M0, medida na mesma execução da T0;
  - f_interp é o custo da interpretação, que acontece uma vez por consulta;
  - f_passo é o custo fixo de um passo sem reranker (embedding, canais e fusão), medido no M0 e contado três vezes.
  - A estimativa supõe que toda consulta gasta B inteiro em três passos, então o limite vale mesmo que todas as consultas expandam. A medição de ponta a ponta da T5 confirma.
  - B depende só de tempo, não de graus, por isso não precisa de folds.
- **Grade de K (na T0):** K ∈ {8, 10, 12, 15, 20, 25, 30, 40}, limitada aos valores viáveis (3K ≤ ⌊B / 2⌋). K_max é o maior valor viável e define o escopo da captura.
- **K (na decisão, dentro dos folds):**
  - para cada fold externo f, K_f é o menor K da grade com perda de recall de grupos de grau ≥ 2 de no máximo 0,02 contra todos os candidatos, em cada uma das três depths;
  - essa perda é medida **só nos folds de treino** de f, por replay da captura da E3;
  - os casos de f são avaliados com K_f, o P que sai dele e os cortes do treino de f;
  - as medidas confirmatórias são as previsões externas juntadas;
  - os folds são os da E2 (`fit.ts:317-341`), por família, e os casos novos entram pela mesma regra de atribuição.
- **K de produção:** a mesma regra aplicada a todos os casos autorizados. Ele é reportado e vai para as constantes da T3, mas não serve de confirmação.
- **Curva da T0:** a curva por K na captura 1b68a7e3f4e6 é exploratória. Ela orienta a grade e não escolhe K.
- **P:** sai do saldo de cada passo, pela regra acima.

**Resultado da T0 (2026-10-22):**

| Medida | Valor | Observação |
|---|---|---|
| v | 11,74 pares/s | Com a ordenação por tamanho. Na ordem original, 6,42 (+82,8%) |
| M0 | 18,25 s | Medido ao vivo no código atual, 30 casos. O captureId da 1b68a7e3f4e6 não corresponde mais ao código depois da E2 |
| f_interp | 1,285 s | |
| f_passo | 0,262 s | Calculado com o tempo do reranker medido em cada recall |
| **B** | **232** | |
| K viáveis | 8, 10, 12, 15, 20, 25, 30 | |
| **K_max** | **30** | |

- A ordenação por tamanho entra na T1.

**M0 de referência do critério de latência:** é a busca de produção de antes da E3, com os lotes na ordem original. A ordenação por tamanho é um ganho da própria E3 e não pode encolher a referência. Se encolhesse, o mesmo B passaria a estourar o limite. Para medir os dois na mesma execução:
- o provider do reranker ganha a opção de ordem `length` (padrão) ou `input`;
- só o harness usa `input`, para reproduzir o M0.
- **Ordenação por tamanho:** os documentos são ordenados por tamanho antes de montar os lotes do reranker (`inference-worker.ts`), porque hoje cada lote é preenchido até o maior documento. Isso entra se a T0 medir ganho de vazão ≥ 20%. Nesse caso, entra na T1, antes das capturas, porque muda levemente os scores (ressalva CA1 da E0).

**O trecho útil chega ao reranker?** A E3 mede três coisas:

- **recall de grupos:** grupos de grau ≥ 2 entre os finalistas;
- **sobrevivência da evidência:** entre os grupos de grau ≥ 2 que viraram finalistas, a proporção em que alguma das P passagens selecionadas é uma das passagens que contêm a citação de `evidence`, identificadas pelo `passageId` registrado na captura. Selecionar outra passagem da mesma seção **não** conta;
- **`ALL_PASSAGES`:** igual ao funil, mas o reranker avalia todas as passagens de cada finalista. Mostra quanto se perde com P.

O relatório lista cada perda de evidência, com o caso, o grupo, o número de passagens do grupo e a posição do grupo em `FUNNEL` comparada com a posição em `ALL_PASSAGES`.

### 5. Faixas entre camadas

- As faixas continuam a vir da eligibility, com os cortes do procedimento `fallbackCuts`. Os cortes são reajustados na captura da E3 dentro dos folds. Os cortes do treino de cada fold servem para as medidas e também para a regra de parada da expansão nesse fold. Os cortes de produção usam todos os folds.
- **Critério:** a precisão externa da faixa alta nos resultados de `ADAPTIVE` é não inferior à de `DEPTH0` (regra da E0, δ 0,05, bootstrap por família).
- **Recuo 1:** tabelas de corte por depth, com o mesmo procedimento.
- **Recuo 2:** se ainda falhar, consulta ao humano (D10).

### 6. Retirada do Deep da UI

- **Remoções:**
  - `src/ui/memory-search-depth.ts`;
  - o botão `Deep retry`, o estilo `.memory-search-deep-retry` e a cadeia de props (`deepRetryAvailable`, `onDeepRetry`, `memorySearchDeepRetryAvailable`, `onMemorySearchDeepRetry`);
  - o laço de profundidades do cliente (`recallMemorySearchDepths`).
- **Settings:** sai a seção `Search depth` de `workspace-settings-panel.tsx`, com sua cadeia (`workspace-settings-modal.tsx`, `app-modals.tsx`, `use-workspace-memory-actions.ts`). Saem também as chaves sem uso da tradução.
- **`memory.searchRetryDepth`:** sai de `WorkspaceSettings`, de `WorkspaceSettingsInput`, da saúde da memória, de `settings.ts`, de `background.ts` e da rota de settings. Um JSON antigo com a chave continua válido: a leitura ignora a chave, e a próxima escrita a remove.
- **Snapshot:** `MEMORY_SEARCH_SCHEMA_VERSION` sobe de 6 para 7, e o snapshot deixa de guardar profundidades.
- **Grupos sem thread na UI:**
  - a UI mostra resultados de `rules` e `document` com o caminho e sem link de thread;
  - a validação do estado guardado aceita hits sem `threadId`;
  - selecionar um desses hits não mostra "Thread not found".

## Passo dos aprovadores: casos de camada

A T1 acrescenta ao dataset da E0:

- os estilos `layer` e `adaptive-trap` em `EvalCaseStyle`;
- o campo opcional `evidence?: { sourcePath: string; quote: string }[]` em `EvalCase`. A `quote` é uma citação literal, de 5 a 40 palavras, do trecho que responde à consulta. A evidência é reconhecida pelo conteúdo, e não pelas linhas da seção;
- a regra `contém(passagem, quote)`: aplica `markdownToIndexText` (E1) aos dois textos, junta espaços em branco e compara em minúsculas;
- três regras novas no `validate`:
  - casos `layer` e `adaptive-trap` sem `evidence` são rejeitados;
  - a `quote` precisa ter de 5 a 40 palavras;
  - a `quote` precisa aparecer no arquivo de `sourcePath`;
- **checagem na captura:** cada `quote` precisa estar contida inteira em pelo menos uma passagem indexada do `sourcePath`. Se ficar dividida entre duas passagens, a captura marca o caso como `evidence_unindexable`, e o caso fica `incomplete` até os aprovadores escolherem uma citação menor. O `passageId` das passagens que contêm a citação fica registrado;
- **julgamentos por camada:**
  - os graus atuais foram dados olhando o summary e valem para a camada 0;
  - os julgamentos ficam por (caso, `groupId`, camada) e aceitam `@rules` e `@document/…`;
  - a worksheet mostra a melhor evidência do grupo na camada julgada;
  - o grau efetivo na depth d é o maior grau entre as camadas ≤ d;
  - o julgamento incremental cobre só os pares que as variantes alcançam.

Antes das capturas, os aprovadores fazem a estimativa de poder com os dados da E2 e escrevem e julgam os casos com a escala da E0:

- **`layer`:** pelo menos 15 por corpus em que a resposta está só em artifact, chat, `RULES.md` ou documento.
  - No `ledgerline-en`, entram as 4 threads preparadas na E0 (`ofx-importer-currency-handling-2f5d8a6c`, `retry-policy-for-bank-connector-timeouts-4b3a9f20`, `benchmark-sqlite-storage-for-transactions-e07d5c18` e `key-rotation-procedure-for-encrypted-store-a85f3e27`).
  - No `marc`, pelo menos 4 casos têm a evidência em threads com 100 ou mais passagens.
- **`adaptive-trap`:** pelo menos 8 por corpus. O `SUMMARY.md` de uma thread traz um resultado plausível de grau ≤ 1, e a resposta de grau 3 está só no artifact ou no chat de **outra** thread.
- Se a estimativa de poder indicar que esses mínimos deixam a decisão provavelmente inconclusiva, os aprovadores aumentam a quantidade antes da captura.

**Casos coaprovados (revisão 7):** o detalhe, os ajustes e as sensibilidades estão no artifact casos-e-poder-e3.md (revisão 3).

| Corpus | Casos | Positivos | Novos na E3 |
|---|---|---|---|
| marc | 137 | 123 | 15 `layer` e 8 `adaptive-trap` |
| ledgerline-en | 79 | 73 | 21 `layer`, 8 `adaptive-trap` e 10 `indirect` |

- **Regra das threads grandes:** cumprida com 6 casos `layer` no marc, em 834716ba (194 passagens), 3b4a8787 (113) e 2f441fa7 (104).
- **Ampliação decidida antes da captura:** o ledgerline ganhou 6 casos `layer` e 10 `indirect`, um em cada família que tinha só 1 caso positivo. Os casos `indirect` não ampliam a comparação histórica DEPTH0 × M0, que fica só nos casos comuns.
- **Sensibilidade, e não regra:**
  - as tabelas simulam uma perda, sem nenhum ganho, na unidade de cada métrica: caso para o Top-1 e a abstenção, par relevante para o recall, sempre com reamostragem por família;
  - elas mostram onde a folga é pequena;
  - o aceite continua sendo a regra da E0, sem gate por contagem de perdas: δ 0,05, IC da métrica real com bootstrap por família, e inconclusivo reprova, com a rodada única de ampliação.

## Escopo do julgamento (revisão 8)

Esta decisão foi coaprovada antes de qualquer grau (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_208b303274a44fd099, marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_f982e225044341a38e e marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8/#msg_61937669f89f4bdc86).

- **Universo U por caso:**
  - os admitidos e o top 10 de todas as variantes da grade, inclusive as DEPTHd com reranqueamento completo e cada passo do ADAPTIVE;
  - os graus anteriores;
  - as fontes de evidence;
  - as fontes herdadas da E2.

  Cada grupo recebe células até a depth em que alguma variante o alcança.
- **Saturação:** com summary = 3, as células de camada desse grupo são dispensadas na worksheet e na completude. Nenhum grau de camada é inventado.
- **Referência comum (H4 e H5):** em cada comparação, o conjunto de relevantes do caso é fixado pelo maior grau julgado entre as camadas no universo comum, e o mesmo denominador vale para as duas variantes. O numerador conta só a evidência da depth acessível à variante.
- **Alcance de H4:** H4 mede a perda de seleção no universo julgado U, contra o reranqueamento completo nesse universo. A lista inteira de candidatos é praticamente o corpus (56 de 57 no marc, 31 de 31 no ledgerline). O IC com margem 0,02 não garante recall sobre o corpus inteiro.
- **Auditoria do pool:**
  - U inicial, candidatos externos, semente e sorteio ficam congelados num manifesto antes dos graus;
  - sorteio sem reposição de 2 pares (caso, grupo) externos por caso, ou de todos, se houver menos de 2;
  - cada par sorteado é julgado nas camadas da depth de referência, com saturação;
  - os pares sorteados entram misturados na worksheet, sem marcação, para os avaliadores julgarem às cegas.
- **Gatilho:** se mais de 2% dos pares auditados tiverem grau consensual ≥ 2, U ganha todos os candidatos dos casos das famílias com achado, e os julgamentos são completados antes da decisão.
  - O gatilho é regra operacional, e não garantia estatística: o relatório mostra o tamanho externo, a amostra e os achados.
  - Todo par auditado entra na referência final, mesmo sem o gatilho disparar.
- **Faixas:** os cortes são ajustados só nos folds de treino, sobre todos os pares rotulados.
- **fullRecall10 e fullMrr10:** ficam como diagnóstico nas depths ≥ 1. Com lacuna, saem "não calculáveis", nunca 0.

## Avaliação e decisão (passo dos aprovadores)

Antes da decisão, os aprovadores fazem o julgamento incremental (`worksheet --variants`) dos pares novos de todas as variantes. "Não inferior" segue a regra de decisão da E0: inconclusivo reprova, com uma rodada única de ampliação antes do recuo.

| Hipótese | Critério de aceite | Se falhar |
|---|---|---|
| H4, recall | Recall de grupos de grau ≥ 2 entre os finalistas, comparado a todos os candidatos: limite inferior do IC da diferença > −0,02 | A regra de K passa a perda ≤ 0,01 nos folds de treino, o que escolhe K maiores dentro da grade viável, e o critério é reavaliado uma vez. Se algum fold já usava K_max, ou se ainda falhar, D10 |
| H4, evidência | As duas condições juntas: sobrevivência ≥ 0,90 nos casos `layer` e `adaptive-trap`; Top1-alvo de `FUNNEL` não inferior ao de `ALL_PASSAGES` | A seleção passa a intercalar as passagens de maior cosseno com as que casaram no canal FTS (cosseno, FTS, cosseno…), sem repetição e com o mesmo P, então o custo não muda. O critério é reavaliado uma vez. Se ainda falhar, D10 |
| H4, latência | Na máquina de referência do humano, mediana de `ADAPTIVE` de ponta a ponta ≤ 1,2 × a mediana do M0 (a busca de antes da E3, com os lotes na ordem original; ver seção 4), as duas na mesma execução de `latency`. O p95 e a referência de 5 s são reportados | Os aprovadores registram a medição e consultam o humano (D10) |
| H5 | `ADAPTIVE` contra `DEPTH0`: Top1-alvo, recall dos casos `implicit` e `layer`, exposição incidental e abstenção correta nos negativos, todos não inferiores. Nas armadilhas, a busca para antes da camada da evidência em no máximo 1 caso por corpus, e o relatório compara Top1-alvo e Top3-alvo de `ADAPTIVE` e `DEPTH2` nesses casos. `layersSearched` idêntico em duas execuções da mesma captura. `ADAPTIVE_HM` é reportada só como referência | Se só a latência falhar por causa da expansão, D10 com os números de `ADAPTIVE` e `ADAPTIVE_HM`, sem troca automática. Nos demais casos: busca única em depth 0, com as camadas acessíveis só pelo MCP e pela E4 |
| Faixas | Seção 5 | Recuos da seção 5 |
| Rebuild | Rebuild completo do `marc` com as três camadas ≤ 15 min na máquina de referência | Os aprovadores levam a medição ao humano |

A decisão é publicada na thread e coaprovada antes da T3.

## Captura da E3

- **Uma captura por corpus**, sobre as camadas [0, 1, 2], com os canais de cada depth (`CAPTURE_DEPTH` deixa de ser fixo). Só a consulta efetiva é capturada, sem a original nem as sugeridas e sem as consultas sintéticas da E2.
- **Vetores:** os de todos os registros são gravados uma vez por captura, para que o cosseno de `selectRerankPassages` possa ser repetido no replay.
- **Seletor antes da captura:** `selectFinalists`, `selectRerankPassages`, o alocador do orçamento, `validateFunnelBudget` e as definições das variantes entram na T1, porque definem o escopo da matriz. A T2 fica com as métricas, os folds e os relatórios.
- **Matriz do reranker com escopo fechado.** Para cada caso, entra a união, nas três depths, de:
  - todo registro de qualquer canal;
  - o identity de cada grupo candidato;
  - todas as passagens, nas camadas ≤ 2, dos grupos que estão entre os K_max primeiros pela fusão ou entre os K_max primeiros pelo melhor rank denso de passagem;
  - todas as passagens dos grupos de grau ≥ 2 já conhecidos (E0 e E2) e dos grupos dos `sourcePath` de `evidence`.
- **Por que o escopo fecha:** para qualquer K ≤ K_max, os finalistas do item 2 da seção 4 ficam dentro desse conjunto. Todas as passagens deles estão na matriz, então ela cobre o K de cada fold, o recuo de K, o recuo do FTS e `ALL_PASSAGES`.
- **Contagem antes de pontuar:** a captura grava a contagem de pares do escopo por caso antes de chamar o reranker. Isso substitui a estimativa de 1.000 a 1.500 pares por caso (de 6 a 8 h no `marc`). Se a contagem indicar mais de 12 h, os aprovadores são consultados antes de rodar. A captura roda em segundo plano, com `--resume`, numa janela que o humano agenda.
  - **Contagem real (Entrega 1d):**
    - marc: 320.241 pares, 7,96 h com o production recall;
    - ledgerline-en: 20.917 pares, 0,66 h.
    - Janela total de cerca de 8,6 h, dentro do gate.
- **Complementação monotônica:** `capture --resume --complement <julgamentos>` acrescenta as passagens dos grupos que passarem a ter grau ≥ 2 no julgamento incremental. Ela só acrescenta células: não muda canais, vetores nem scores já gravados, e registra cada rodada no manifest da captura.
- **Score ausente:** o replay lança um erro de célula ausente. O caso fica `incomplete`, e uma variante com caso `incomplete` não é aprovável. Um score ausente nunca vira zero nem exclusão silenciosa.
- **Relatório:** distingue a seleção, a cobertura da matriz e a evidência sobrevivente.
- **Ajustes no harness:**
  - o corpus fixado passa a incluir `RULES.md` e os documentos configurados;
  - a validação de produção compara só as camadas presentes no manifest;
  - `report` e `compare` aceitam as variantes novas;
  - `decisionTerm` deixa de dizer "piora" quando `nonInferior` é verdadeiro.

## Escopo de escrita autorizado

| Caminho | Uso |
|---|---|
| `src/core/memory/sources/**` | `INDEXED_LAYERS`, `messageId` do artifact |
| `src/core/memory/search-depth.ts`, `semantic-ranking.ts`, `semantic-eligibility.ts`, `hybrid-ranking.ts`, `operations.ts`, `recall-support.ts`, `recall-actions.ts`, `status.ts`, `rebuild-operations.ts`, `background.ts`, `workspace-status.ts`, `query-candidates.ts`, `lancedb-store*.ts`, `store.ts`, `types.ts`, `settings.ts`, `index.ts`, `scoring/**` | Camadas, grupos, funil, expansão, status e settings |
| `src/core/types.ts`, `src/core/workspace-memory.ts` | Contrato e validação de depth |
| `src/core/memory/inference-worker.ts` | Só a ordenação por tamanho, se a T0 aprovar |
| `src/mcp/memory-tools.ts`, `src/daemon/memory-routes.ts`, `src/cli.ts` | Contrato de depth e `adaptive` |
| Arquivos de UI citados na seção 6, `src/ui/styles/shell-navigation.css`, `public/locales/en_US/translation.json` | Retirada do Deep e grupos sem thread |
| `scripts/memory-eval/**`, `test/**` | Variantes, captura, dataset, testes e a mudança dos módulos de scoring |
| `docs/memory.md`, `docs/mcp-tools.md`, `docs/ui-and-daemon.md`, `docs/adrs/0011-memory-confidence-bands.md`, `docs/adrs/0012-memory-depth-as-corpus-layers.md`, `docs/adrs/README.md` | Documentação |

**Exclusões:**

- `pnpm-lock.yaml`;
- `.marc/memory/**`: o rebuild produtivo com as três camadas só acontece depois da aceitação humana;
- `src/core/memory/inference-*` fora da ordenação aprovada;
- `model-config.ts` e `maintenance.ts`.

## Tarefas do desenvolvedor

| Tarefa | Entrega | Testes |
|---|---|---|
| T0 | Pré-estudo na máquina de referência: benchmark de vazão do reranker (pares/s, com e sem ordenação por tamanho, cerca de 10 min); f_interp, f_passo e mediana do M0 na mesma execução; B pela fórmula da seção 4; grade viável de K e K_max; curva exploratória de recall por K na captura 1b68a7e3f4e6 (replay, sem modelos), sem escolher K | O próprio relatório, com o comando de cada medida |
| T1 | Camadas e busca por camada; interpretação só na camada 0; `messageId` do artifact; comparador único de status e reconcile; contrato do hit (`groupId`, `groupKind`, `reference` por tipo, `nextActions` por tipo, `layersSearched`, `rerankPairs`, `expansionStop`); depth de 0 a 2 no core, MCP, CLI e HTTP; ordenação por tamanho, se aprovada; `features.ts`, `judge-document.ts` e `synthetic-queries.ts` movidos para `scripts/memory-eval/`, com os testes. Funções puras do funil: `selectFinalists`, `selectRerankPassages`, alocador do orçamento e `validateFunnelBudget`. Definições das variantes `DEPTH0`, `DEPTH1`, `DEPTH2`, `ADAPTIVE`, `ADAPTIVE_HM`, `FUNNEL`, `ALL_PASSAGES` e `ALL_CANDIDATES`. No harness: `evidence`, `validate`, julgamentos por grupo e camada, corpus com RULES e documentos, validação de produção por camada, captura por depth com vetores, matriz com escopo fechado, contagem antes de pontuar, `--complement` e erro de célula ausente. **Entrega 1** | Mapeamento de depth para camadas; pool da depth contém o da anterior; `DEPTH0` igual ao M0 (mesma sequência admitida); invariância do BM25 na fixture e no índice real do marc; interpretação só na camada 0; `reference` por tipo, em tabela declarada; artifact sem mensagem; depth 3 rejeitado com a mensagem nova; status `ready` depois do reconcile com as três camadas, dentro do orçamento de tempo. Orçamento: três passos com conjuntos disjuntos, cache parcial, identity de grupo sem passagem, 3K > ⌊B / 2⌋ rejeitado e recuo do FTS com o mesmo custo; o total de pares inéditos nunca passa de B; passo sem saldo fora de `layersSearched`. Captura: finalista novo depois de aumentar K dentro do escopo; grupo que passa a grau ≥ 2 complementado sem mudar células existentes; célula ausente gera `incomplete`, não zero; `validate` rejeita `layer` e `adaptive-trap` sem `evidence`, `quote` fora de 5 a 40 palavras e `quote` ausente do arquivo; captura marca `evidence_unindexable` |
| — | **Revisão do harness pelo Codex; casos `layer` e `adaptive-trap` escritos; capturas; julgamento; complementação, se houver** | — |
| T2 | Métricas de recall de grupos, sobrevivência e parada antecipada; escolha de K e cortes de faixa dentro dos folds, com a regra de produção à parte; relatório com seleção, cobertura da matriz e evidência sobrevivente; correção do `decisionTerm` | Determinismo do funil; alterar os graus de um fold externo não muda K, P nem os cortes que predizem esse fold; sobrevivência por `passageId`, com o cenário declarado: numa seção com duas passagens, selecionar só a que não contém a citação produz falha; `ADAPTIVE` continua com resultado médio e para com resultado alto |
| — | **Decisão dos aprovadores, publicada e coaprovada** | — |
| T3 | Funil e expansão adaptativa em produção, com B, K e P da decisão | `layersSearched`; parada na primeira camada com resultado alto; resultado médio não interrompe; não finalista nunca admitido; reuso dos scores entre passos; `rerankPairs` ≤ B; constantes de produção aprovadas por `validateFunnelBudget`; verificação de replay da produção (mesma sequência admitida) também para o funil |
| T4 | Retirada do Deep da UI, settings sem `searchRetryDepth`, grupos sem thread e snapshot v7 | Testes de UI atualizados (`ui-memory-search-depth.test.ts` removido); Playwright CLI: busca única, resultado de `RULES.md` exibido com caminho, ausência do botão e da seção de settings |
| T5 | ADR 0012, nota de continuidade no ADR 0011 e docs; medição de latência de ponta a ponta (`ADAPTIVE` e M0 na mesma execução). **Entrega 2** | Busca no repositório sem `Deep retry`, `searchRetryDepth` ou depth 3 |

## Critérios de aceite da etapa

1. As decisões de H4, H5, faixas e rebuild estão registradas com a evidência do harness.
2. A implementação corresponde à decisão.
3. Não sobra referência a `Deep retry`, `searchRetryDepth` ou depth 3 em `src/**`, `docs/**` e `public/**`, verificado por busca no repositório.
4. A UI foi validada com Playwright CLI, e o backlog de marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a foi revisado.
5. `pnpm validate`, `pnpm build` e `pnpm test` passam, com as regras de estilo e de teste respeitadas.
6. Depois da aceitação humana, o humano autoriza o rebuild produtivo com as três camadas, e o `memory_status` volta a `ready`.

## Riscos

- **Orçamento contra evidência:** um B pequeno pode descartar o trecho útil. A sobrevivência, o recuo do FTS e `ALL_PASSAGES` medem a perda, e o trade-off vai ao humano.
- **Metade do saldo no passo 0:** a busca adaptativa pontua menos pares em depth 0 do que a busca com depth explícita. A comparação de `ADAPTIVE` com `DEPTH0` em H5 mede esse custo.
- **BM25 e vetores com o índice misto:** confirmado na T1c-c. `DEPTH0` passa a ser medido por não inferioridade contra o M0 (seção 1).
- **Matriz maior com K_max:** a contagem antes de pontuar mostra o custo real, e acima de 12 h os aprovadores são consultados.
- **Grupos sem identity:** `@rules` e documentos dificilmente atingem a admissão do M0. O recuo é pré-declarado, e a admissão é reportada por tipo de grupo.
- **Poucos casos:** a abstenção, o recall `layer` e o recall `implicit` do ledgerline têm pouca folga nas sensibilidades simuladas. Se o resultado ficar inconclusivo, ele reprova, com a rodada única de ampliação.
- **Captura longa:** a contagem real é de cerca de 8,6 h no total. Os cuidados são uma consulta por caso, nenhuma sintética e `--resume`.
- **Ruído do chat:** discussões intermediárias podem superar decisões. A autoridade aparece no resultado, e a E4 orienta a leitura da fonte original.
- **Mudança de contrato do MCP:** depth 3 deixa de existir. A mensagem de erro explica as camadas.
- **Teste intermitente:** a E2 viu uma rodada com 743 de 744. Se aparecer, o nome do teste é anotado.

## Estado e pendências

- captura feita (marc 87cd2e4d96f7, ledgerline 0d31bd4afd3f); próximo passo: worksheet com o escopo da revisão 8 e julgamento;
- desenvolvedor: claude-dev, com Haiku 5.5 em xhigh, a configuração confirmada pelo humano nas etapas anteriores. Modo sequencial, com um desenvolvedor.

## Histórico de revisões

- **Revisão 2 (2026-10-15):** incorpora a revisão de marc://@codex-software-architect. A expansão adaptativa só para com resultado na faixa alta, e os casos armadilha testam a parada antecipada; o funil passa a medir a sobrevivência da evidência contra `ALL_PASSAGES`, além do recall de grupos; os critérios de H5 exigem não inferioridade; julgamento incremental antes da decisão. Arquitetura sem mudança.
- **Revisão 3 (2026-10-15):** responde ao parecer de marc://@codex-software-architect sobre a revisão 2. A evidência passa a ser uma citação literal reconhecida pelo conteúdo, e a sobrevivência passa a ser verificada pelo `passageId` da E1.
- **Revisão 4 (2026-10-22):** adapta o plano ao resultado da E2 e à decisão de latência do humano.
  - Funil: o sinal barato passa a ser a fusão do M0 antes do reranker, no lugar do modelo barato da E2; o orçamento B de pares do reranker substitui o 20 × 12 fixo; B, K e P são escolhidos por procedimento pré-declarado na T0; o rank do reranker passa a ser por grupo nas variantes de funil; há recuo para grupos sem identity.
  - Meta de latência: 1,2 × M0 no lugar de 5 s.
  - Critério das faixas: não inferioridade da faixa alta, compatível com a D10.
  - Camadas: busca por camada.
  - Correções de produção: interpretação só na camada 0, comparador único de status, `messageId` sem mudança de schema, `groupId` e `groupKind`.
  - Harness: julgamentos por camada e captura com escopo.
  - Pendência da E2: os módulos de scoring só do harness vão para `scripts/memory-eval/`.
- **Revisão 5 (2026-10-22):** responde ao parecer de marc://@codex-software-architect sobre a revisão 4.
  - B1: contabilidade do orçamento por pares inéditos, identity numa das P vagas só sem passagem, metade do saldo por passo e saldo inteiro no último, truncamento determinístico, viabilidade 3K ≤ ⌊B / 2⌋ e recuos com o mesmo custo; B por fórmula de tempo, com custo fixo por passo.
  - B2: K escolhido dentro dos folds de treino, cortes do treino também na regra de parada, K de produção à parte e curva da T0 só exploratória.
  - B3: seletor e variantes na T1; matriz fechada por K_max e pelos grupos conhecidos; contagem antes de pontuar; complementação monotônica; célula ausente vira `incomplete`.
  - Também entram o teste e o recuo de invariância do BM25. Sai o filtro lexical de `kind`.
- **Revisão 6 (2026-10-22):** registra a decisão dos dois arquitetos sobre `DEPTH0`, depois da T1c-c: não inferioridade contra o M0 da 1b68a7e3f4e6, estendida à divergência vetorial da camada 0 (seção 1). O harness volta à revisão do Codex depois das correções B1 a B8 do parecer sobre a Entrega 1; o desenho do plano não muda.
- **Revisão 7 (2026-10-23):** registra as coaprovações posteriores à Entrega 1.
  - Rank do reranker no funil com a semântica do M0, no lugar do rank por grupo.
  - Admissão na ordem híbrida do M0, com o controle de paridade 114/114 e 40/40.
  - Casos: 137 no marc e 79 no ledgerline.
  - Sensibilidades de poder registradas sem gate por contagem de perdas.
  - Contagem real da captura: cerca de 8,6 h.
- **Revisão 8 (2026-10-24):** registra o escopo do julgamento, coaprovado antes dos graus.
  - O universo é U, com saturação por summary = 3.
  - H4 e H5 usam uma referência comum.
  - H4 passa a valer explicitamente sobre U, e não sobre todos os candidatos, com auditoria cega por amostra e gatilho de expansão.
  - As faixas são ajustadas sobre todos os pares rotulados do treino.
  - Os diagnósticos sem cobertura saem "não calculáveis".
