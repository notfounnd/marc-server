# Análise arquitetural da busca da memory e direção proposta para o motor

## Síntese

Os estudos desta thread trocaram modelos de interpretação e reranking sem conseguir promover nenhuma variante. A análise indica que o platô não está nos modelos. Ele vem da camada que decide o que aparece e em que ordem: uma elegibilidade com coeficientes manuais, que depende da lista de candidatos, acoplada a uma fusão por posição muito concentrada no primeiro lugar. Além disso, o conjunto de avaliação é pequeno demais para separar ganho de ruído.

A direção proposta separa o motor em etapas independentes:

1. **Fontes:** quais documentos entram no índice.
2. **Candidatos:** quais documentos são considerados para a consulta.
3. **Features:** sinais absolutos de cada par consulta/documento.
4. **Score calibrado:** combinação desses sinais, com pesos globais aprendidos e escala calibrada por projeto.
5. **Faixas:** alta, média, baixa ou abstenção.
6. **Apresentação:** o mesmo contrato para UI e MCP.

Essa separação é pré-requisito comum para a profundidade adaptativa (marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f) e para a `memory_deep` (marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae). Por isso as três frentes devem ser tratadas como um único programa, entregue em etapas medidas pelo mesmo banco de avaliação.

Este documento é análise e direção arquitetural. Ele não é o plano de desenvolvimento. O plano detalhado, com escopo por arquivo, critérios de aceite e verificações, deve ser preparado na thread do programa antes de qualquer implementação.

## Escopo e fontes analisadas

- Thread completa marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab, com 42 mensagens até marc://#msg_c167bdfd01d94644b7.
- Artifacts de baseline e diagnóstico e resultados dos estudos 1, 2, 3 e 4.
- Resumo de marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba, que deu origem à regra de elegibilidade atual.
- Threads abertas marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f e marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae, com seus artifacts.
- `docs/memory.md`.
- Código em `src/core/memory/`: `operations.ts`, `query-candidates.ts`, `query-interpretation.ts`, `semantic-ranking.ts`, `hybrid-ranking.ts`, `semantic-eligibility.ts`, `passage-segmentation.ts`, `summaries.ts`, `lancedb-store.ts`, `lancedb-store-support.ts`, `recall-support.ts` e `search-depth.ts`.
- A inspeção do repositório usou context-mode e leitura direta. Nenhum arquivo do projeto foi alterado e nenhum comando Git foi executado.

## Leitura dos estudos

| Estudo | O que mudou | Resultado observado | Leitura |
|---|---|---|---|
| Baseline | Nada | 27/30 Top 1 histórico. Falhas 3P, 6I e 9I. 19 a 34 s por consulta | Nos casos 3P e 6I o alvo estava entre os candidatos e foi descartado pela elegibilidade |
| Interpretadores | LFM 350M, LFM 1.2B, Qwen3.5 0.8B, prompts, temperaturas, decisão por logit | Nenhuma variante promovida. O LFM 350M escolheu a variante corrigida nas 49 inferências | Um LLM pequeno não discrimina bem entre duas variantes de consulta |
| Estudo 1 | Variantes de ordenação M0 a M5 | M0 mantido. M3 recuperou 9I e quebrou 3 controles. M5 (sem margem) perdeu `brutal` | A ordenação está ajustada caso a caso. Mexer nela troca um acerto por regressões |
| Estudo 2 | Mais fontes (CHAT, 450 passagens) | Top 1 caiu de 26 para 24. Em `brutal`, a elegibilidade caiu de 0,84 para 0,03 com o mesmo score do reranker | A elegibilidade depende do conjunto de candidatos |
| Estudo 4 | Qwen3-Reranker-0.6B | Em 38 positivos, Top 1 caiu de 31 para 29 e Top 10 subiu de 32 para 35 | O modelo melhora a recuperação, mas foi avaliado com uma regra de decisão ajustada para o mMARCO |

## Diagnóstico

### 1. A recuperação não filtra nada no corpus atual

- O corpus tem 53 threads e cerca de 338 registros (53 de identidade e cerca de 285 passagens).
- `MEMORY_SEARCH_CANDIDATE_LIMITS = [100, 200, 300, 400]` (`search-depth.ts:3`). O canal de identidade sempre devolve todas as threads e a profundidade 2 já cobre todas as passagens.
- Na prática, o reranker avalia quase tudo e a fórmula de elegibilidade decide o que aparece. Trocar o modelo de embedding ou aumentar a profundidade não muda o resultado, e os estudos confirmam isso.

### 2. A elegibilidade é relativa, não absoluta

Fórmula atual (`semantic-eligibility.ts:71-84`):

```text
logit = -9.25 + 4·bestDense + 12·reranker + channelAgreement + evidenceConcentration
        + 3·identityRerankerAgreement + identitySupport + passageSupport + rerankerSupport
        + 12·rankingMargin·identityRerankerAgreement
```

- Vários termos dependem de posição (`1/rank`), concentração ou margem para o segundo colocado. Portanto não medem a relevância do par consulta/thread: medem a posição da thread entre as outras.
- O estudo 2 mostrou o efeito. A mesma passagem, com o mesmo score do reranker, saiu de elegível para não elegível só porque entraram outros candidatos.
- **Consequência para o produto:** cada novo resumo fechado pode mudar respostas que antes estavam corretas, e o efeito cresce com o corpus. Uma fonte nova como a `memory_deep` repetiria o estudo 2.
- **Consequência para múltiplos resultados relevantes:** a margem favorece um único vencedor e penaliza consultas com mais de uma thread relevante.

### 3. Os coeficientes são manuais e presos ao mMARCO

- Os coeficientes não vieram de um ajuste reproduzível. O plano da `834716ba` mencionava regressão logística calibrada offline, mas ela não foi implementada.
- O termo de margem só vale para o primeiro colocado. Quando o estudo 1 o removeu (M5), `brutal` desapareceu. O termo existe para sustentar um caso específico.
- Um novo modelo de reranking nunca é avaliado de forma justa, porque o corte de 0,5 e o peso `12·reranker` foram calibrados para a escala do mMARCO. O estudo 4 é o exemplo direto.

### 4. A fusão concentra o peso no primeiro lugar

- `RRF_K = 0` (`semantic-ranking.ts:18`) produz pesos `1/rank`: o 1º lugar vale o dobro do 2º e o triplo do 3º.
- Os pesos lexicais (`hybrid-ranking.ts:14-18`: título 2, summary 0,75, prefixo 0,5) também multiplicam `1/rank`. Um primeiro lugar no título soma 2, o mesmo que o primeiro lugar do reranker (`RERANKER_RANK_WEIGHT = 2`).
- Com isso, pequenas oscilações de posição viram grandes mudanças de ordem. É por isso que toda variante de ordenação dos estudos trocou um acerto por regressões.

### 5. A interpretação por LLM não discrimina

- `query-candidates.ts` gera no máximo uma correção com distância de edição 1, e o LFM escolhe entre a consulta original e a corrigida.
- Os dados mostram que o LFM 350M não discrimina. Os modelos maiores discriminam melhor, mas alteram a gramática de consultas corretas (casos 2I e 9P).
- O LFM custa 297 MB de modelo, um worker e latência.

### 6. A representação do texto perde informação

Em `summaries.ts:234-243`:

- `[texto](url)` é trocado pela URL. O texto do link, que costuma ser o termo útil, é descartado.
- `[#>*_-]+` é trocado por espaço. Identificadores como `create_thread`, `memory_recall` e `multilingual-e5-small` são quebrados.
- Blocos de código são removidos por inteiro, inclusive nomes de comandos e de tools.

Também:

- O registro de identidade usa só o título e a primeira seção (`summaries.ts:161-180`). Decisões e resultados das outras seções não entram nele.
- Só as 3 melhores passagens por thread, escolhidas pela ordem do E5, chegam ao reranker (`MAX_RERANK_PASSAGES_PER_THREAD = 3`). O estudo 2 mostrou evidência útil sendo cortada antes do reranker.
- O índice textual usa tokenizer `simple` sem stemming (`lancedb-store-support.ts:63-68`) e consulta com `Operator.Or` (`lancedb-store.ts:161`). Palavras comuns da consulta geram acertos sem significado. Uma lista de stopwords violaria a regra "sem listas por idioma" da `834716ba`. A alternativa compatível é medir a fração da massa de IDF da consulta que foi casada.

### 7. Latência

- Cada consulta leva de 19 a 34 s, quase tudo reranqueando cerca de 110 passagens em CPU.
- Nos estudos, 4.470 passagens levaram cerca de 1.343 s, ou aproximadamente 0,3 s por passagem.

### 8. A medição não sustenta decisões

- Com 30 consultas históricas e 14 controles, cada caso vale cerca de 3 pontos percentuais. As diferenças dos estudos foram de ±2 casos e não houve teste estatístico.
- Os julgamentos são parciais, há consultas efetivas duplicadas, e a amostra está contaminada porque threads fechadas discutem essas mesmas consultas.
- Cada estudo custou um ciclo completo de captura (cerca de 24 minutos por captura nos estudos 1 e 4) para medir diferenças dentro do ruído.

## Princípios da direção proposta

- **Decidir com sinais absolutos e ordenar com qualquer sinal.** Admissão e abstenção dependem só do par consulta/documento. Sinais relativos podem ordenar, nunca admitir.
- **Pesos aprendidos e versionados.** Os pesos do score são ajustados de forma reproduzível em dados rotulados, com separação de treino e validação por família de thread, e versionados junto com o modelo de reranking. Trocar o modelo implica recalibrar.
- **Escala calibrada por projeto.** A escala e os cortes das faixas são recalibrados no corpus de cada projeto durante o rebuild.
- **Um contrato único para UI e MCP.** Score calibrado, faixa e abstenção são iguais nos dois. Só a apresentação muda.
- **Modelos pequenos e locais.** Nenhum modelo novo é obrigatório. O LFM pode sair.
- **Preservar os princípios do projeto.**
  - Markdown continua sendo a fonte da verdade. Índice, calibração e cache de features são derivados e reconstruíveis.
  - Configuração estruturada fica em JSON.
  - Código e textos de produto ficam em en-US.
  - Sem listas de palavras por idioma.
  - Só threads fechadas entram no índice.

## Arquitetura proposta

### Camada de fontes

- Um adaptador por tipo de fonte, cada um produzindo registros com origem explícita: `sourceType`, `threadId`, `messageId`, `artifactPath`, `sectionTitle`, `relativePath`, `sha256` e `authority`.
- Tipos previstos:
  - `summary`: `SUMMARY.md` de threads fechadas, como hoje.
  - `artifact`: Markdown de threads fechadas.
  - `rules`: `RULES.md`.
  - `chat`: mensagens de threads fechadas.
  - `document`: caminhos configurados pelo usuário.
- **Regra preservada:** thread aberta não entra em nenhuma camada. A cobertura é deliberadamente sobre o que já aconteceu, e threads abertas são consultadas pela UI e por `thread_list`.
- **Documentação configurável:**
  - Lista de fontes nas settings JSON do workspace. O padrão é vazio, então em projetos de terceiros nada muda sem opt-in.
  - Cada fonte declara globs relativos à raiz do workspace, resolvidos com `safeJoin`, um tipo e uma autoridade (`decision` ou `reference`).
  - ADRs e docs do mARC só passam a ser indexados neste repositório se forem configurados aqui. Eles não viram fonte fixa do produto.
  - Docs mudam com edições, ao contrário de threads fechadas. O rebuild incremental por hash, que já existe, cobre isso.
- **Correções de representação:**
  - Preservar o texto dos links.
  - Não quebrar identificadores com `_` e `-`.
  - Manter o texto de inline code e de blocos curtos de código.
  - Enriquecer o registro de identidade com título, síntese e as seções de resultado e decisão.

### Profundidade como camadas de corpus

A profundidade deixa de ser a quantidade de candidatos da busca vetorial e passa a ser a camada de corpus consultada:

| Nível | Corpus | Papel |
|---|---|---|
| 0 | `SUMMARY.md` | Bússola: decisões consolidadas |
| 1 | Artifacts, `RULES.md` e documentos configurados | Lupa: planos, análises, regras |
| 2 | `CHAT.md` | Lupa fina: conversa intermediária, com menor autoridade |

- **Busca adaptativa:** consulta o nível 0. Se nenhum resultado atingir a faixa alta, sobe um nível. Para quando houver confiança ou quando a última camada terminar.
- **Retorno:** o resultado principal continua sendo a thread, acompanhada da evidência que a trouxe (por exemplo, "encontrado no artifact X"), com a autoridade da fonte.
- **`memory_deep` com escopo:** aceita `threadId` e tipo de fonte e devolve trechos com origem. É a lupa descrita na `f04c7cae`.
- **Determinismo:** a expansão é determinística e observável em diagnósticos, como exige o critério da `4f477d9f`.
- **Pré-requisito:** isso só funciona com o score absoluto. Com a elegibilidade atual, adicionar camadas muda a decisão sobre as camadas anteriores, como mostrou o estudo 2.

### Geração de candidatos

- **Corpus pequeno** (como o atual): todos os registros da camada são candidatos. Não há perda por busca aproximada.
- **Corpus grande:** um funil. Um score barato (denso combinado com lexical normalizado) escolhe de 15 a 20 threads finalistas, e só as passagens delas vão para o reranker.
- **Finalistas:** todas as passagens de cada finalista vão para o reranker, ou pelo menos a união das melhores pelo denso e pelo lexical, e não só as 3 primeiras do E5.
- O tamanho do funil é escolhido pelo recall@K medido no banco de avaliação.

### Features por par consulta/thread

Todas são absolutas, calculadas sem olhar outros candidatos:

- cosseno da identidade e melhor cosseno de passagem (E5);
- maior logit do cross-encoder entre as passagens da thread e, como opção, a média dos dois maiores;
- BM25 normalizado pela fração da massa de IDF da consulta que foi casada;
- acerto exato de identificador ou do título;
- tipo e autoridade da fonte (para as camadas 1 e 2).

### Score e calibração

- **Pesos globais:** regressão logística com cerca de 10 pesos e restrição de monotonicidade (mais evidência nunca reduz o score). Treinada no banco de avaliação do mARC e validada num segundo corpus. Os pesos ficam versionados no código, junto com a identidade do modelo de reranking.
- **Escala por projeto:** calibração feita no rebuild com consultas sintéticas tiradas do próprio corpus (Inverse Cloze Task):
  - trechos de título, de seções e de frases servem de consulta;
  - a thread de origem é o positivo e as outras threads são negativos;
  - o ajuste é monotônico (Platt ou isotônico) e só mexe na escala e nos cortes das faixas;
  - a amostragem tem semente fixa, então o mesmo corpus gera a mesma calibração;
  - o resultado é salvo como estado derivado em `.marc/memory`.
- **Projetos pequenos:** abaixo de um mínimo de threads fechadas (por exemplo, 15 a 20), usar a calibração padrão do pacote.
- **Custo:** cada par exige uma inferência do reranker. 150 consultas × 10 passagens ≈ 7 minutos de CPU. Mitigar com amostra limitada e recalibração só quando o corpus mudar de forma relevante (por exemplo, +20% de threads).
- **Validação desta abordagem:** no mARC, comparar as faixas obtidas com consultas sintéticas com as faixas obtidas com o conjunto real rotulado. Se forem compatíveis, há base para confiar na calibração sintética em outros projetos.

### Faixas, abstenção e apresentação

- **Contrato único:** cada resultado traz o score calibrado e uma faixa (alta, média ou baixa). Abaixo do piso da faixa baixa, nada aparece: isso é a abstenção, igual na UI e no MCP.
- **UI:**
  - mostra as faixas alta e média;
  - a faixa baixa fica recolhida em "mostrar resultados menos prováveis";
  - o botão Deep sai, porque a expansão por camadas passa a ser interna;
  - `depth` continua no core e no MCP.
- **MCP:** até 5 resultados com faixa, e o agente decide o que fazer com cada um.
- **Significado do score:** a calibração dá significado ao número. Um score de 0,8 corresponde a cerca de 80% de resultados relevantes no conjunto de calibração.

### Interpretação de consulta

- Substituir a escolha feita pelo LLM por busca com a consulta original **e** com a variante corrigida (a geração determinística de `query-candidates.ts` continua). O score de cada thread é o maior entre as duas buscas.
- A sugestão de "você quis dizer", que já existe na UI, continua como é.
- **Efeito:** o LFM sai do pacote, o que remove 297 MB, um worker e o risco de alterações gramaticais. Não é preciso decidir qual variante vale, porque as duas concorrem pelo mesmo score absoluto.

### Pacote de modelos

| Componente | Hoje | Proposta |
|---|---|---|
| E5-small (busca) | 135 MB | mantém |
| mMARCO MiniLM (reranker) | 252 MB | mantém, só sobre os finalistas |
| LFM 350M (interpretação) | 297 MB | sai |
| Combinador de scores | coeficientes manuais | ~10 pesos versionados no código |
| Total | ~685 MB | ~390 MB |

Depois do programa, com a calibração por modelo pronta, o Qwen3-Reranker-0.6B pode ser reavaliado de forma justa. Se for promovido, aumenta o pacote, e isso precisa ser pesado contra a restrição de modelos pequenos.

## Generalização para projetos de terceiros

- **O risco:** pesos ajustados no mARC (pt-BR, estilo próprio de resumo, 53 threads) rodam em projetos com outro idioma, estilo e tamanho. Isso já acontece hoje com os coeficientes manuais, só que sem medição.
- **Mitigações já incluídas:**
  - poucas features, todas absolutas;
  - restrição de monotonicidade;
  - modelos de base multilíngues;
  - escala recalibrada por projeto.
- **Medição exigida:** um segundo corpus de validação, por exemplo um projeto sintético em inglês ou um projeto real que use o mARC, com algumas dezenas de consultas rotuladas. O critério é que as faixas mantenham o significado entre os corpora.
- **Aprendizado por uso** (sinais como `thread_read` depois de `memory_recall`, ou cliques na UI): fica fora da primeira versão. Projetos pequenos geram poucos sinais, a ordem exibida distorce os cliques, e seria preciso definir onde guardar o log de uso.

## Banco de avaliação (pré-requisito de todas as etapas)

- **Volume:** 150 a 300 consultas, geradas offline durante o desenvolvimento pelos próprios agentes. Nenhum LLM entra em produção.
- **Estilos cobertos:**
  - direta, indireta e implícita;
  - identificador (por exemplo, `create_thread`);
  - termo curto;
  - typo;
  - fora do domínio;
  - consultas que dependem das camadas 1 e 2.
- **Julgamento:**
  - graduado (0, 1 ou 2);
  - por pooling do Top k de todas as variantes avaliadas;
  - LLM como juiz, com conferência humana por amostragem.
- **Separação de treino e validação por família de thread,** para respeitar a regra "sem ajuste pelo gabarito".
- **Métricas:**
  - recall@K de cada etapa;
  - Top 1, Top 3 e Top 10;
  - nDCG;
  - taxa de abstenção correta nos negativos;
  - calibração (confiabilidade das faixas);
  - latência.
- **Intervalos de confiança** pareados por bootstrap.
- **Cache de features:** as features de todos os pares consulta × registro são calculadas uma vez. Com isso, testar uma variante de score ou de fusão leva milissegundos em vez de um ciclo de captura.
- **Segundo corpus** para medir a generalização.

## Programa proposto em etapas

O desenho é feito de uma vez e a entrega é incremental. Cada etapa é medida contra o mesmo banco de avaliação, para que se saiba qual mudança causou cada efeito.

| Etapa | Conteúdo | Saída esperada | Critério de aceite |
|---|---|---|---|
| E0 | Banco de avaliação, julgamentos, segundo corpus, cache de features e harness offline | Medição reproduzível do motor atual por etapa | Baseline do M0 reproduzido com intervalos de confiança |
| E1 | Camada de fontes, origem dos registros, correções de representação e configuração de documentos | Índice com origem por registro e texto preservado | Recall@K do índice não piora. Identificadores e links passam a ser recuperáveis |
| E2 | Features absolutas, pesos aprendidos, calibração por projeto, faixas e abstenção | Score calibrado substitui elegibilidade, margem, teto e fusão `K=0` | Melhora significativa nos casos de admissão (3P, 6I, `brutalism`, `toggle`) sem perder controles negativos. Faixas calibradas nos dois corpora |
| E3 | Profundidade como camadas e busca adaptativa. Deep sai da UI e entra "mostrar resultados menos prováveis" | Uma única ação de busca na UI | Critérios da `4f477d9f`: o Top 1 se mantém ou melhora, consultas implícitas não perdem recall, falsos positivos não aumentam |
| E4 | `memory_deep` com escopo e origem | Ferramenta de lupa | Critérios da `f04c7cae`, atualizados para o modelo atual |
| E5 | Remoção do LFM, consulta dupla e funil de latência | Pacote de ~390 MB e latência menor | Nenhuma regressão de qualidade. Latência mediana dentro da meta acordada |

**Rebuilds:** as etapas E1 e E2 mudam o índice e o versionamento. A recomendação é fazer um único rebuild completo para as duas.

**Estado do repositório:** no início desta sessão, a árvore de trabalho tinha alterações não commitadas do estudo (atualização do runtime 4.3.1, `model-config.ts`, `rebuild-operations.ts`, `package.json`). É preciso decidir se elas entram como base do programa ou são descartadas antes da E0.

## Decisões históricas afetadas

- **marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba:**
  - "manter o motor atual" (decisão do humano) seria reaberta;
  - "acerto lexical não concede elegibilidade sozinho" passaria a ser uma feature com peso aprendido, contida pelos controles negativos do treino.
  - Os princípios "sem listas por idioma" e "sem ajuste pelo gabarito" são mantidos.
- **marc://$oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac:** os retries de Deep expostos na UI seriam substituídos pela expansão interna por camadas. `depth` continua no core e no MCP.
- **marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae:** o artifact original precisa ser atualizado. Ele cita o modelo `paraphrase-multilingual-MiniLM` e o parâmetro `minScore`, que já foram substituídos.

## Decisões pendentes do humano

1. Reabrir as decisões da `834716ba` listadas acima.
2. Remover o LFM e adotar a consulta dupla.
3. Redefinir `depth` como camadas de corpus.
4. Definir onde entram os documentos configurados (camada 0 ou 1) e se a autoridade é declarada por fonte.
5. Escolher o segundo corpus de validação.
6. Definir a meta de latência.
7. Decidir o destino das alterações não commitadas do estudo.
8. Definir o registro do programa: a proposta é uma nova thread que referencia esta, a `4f477d9f` e a `f04c7cae`. As três seriam encerradas com resumo apontando para ela.

## Riscos

- **Volume e qualidade dos julgamentos:** o banco de avaliação exige julgamentos com qualidade suficiente. Se forem fracos, os pesos aprendidos herdam o erro.
- **Distância entre consultas sintéticas e reais:** consultas sintéticas são mais literais. Por isso a calibração por projeto mexe só na escala, e não nos pesos.
- **Corpus pequeno para aprender pesos:** 53 threads é pouco. Poucas features e a restrição de monotonicidade reduzem o risco de sobreajuste.
- **Custo de rebuild com calibração e camadas extras:** mitigado por amostra limitada e recalibração eventual.
- **Mudança de comportamento percebida pelo usuário:** faixas e abstenção vão mostrar resultados diferentes dos atuais. A comparação lado a lado no banco de avaliação deve preceder a troca.

## Fora do escopo desta análise

- Plano de desenvolvimento por arquivo e por tarefa. Ele será detalhado na thread do programa, para que qualquer desenvolvedor designado consiga executá-lo.
- Escolha de novos modelos.
- Indexação de threads abertas ou de código-fonte.
