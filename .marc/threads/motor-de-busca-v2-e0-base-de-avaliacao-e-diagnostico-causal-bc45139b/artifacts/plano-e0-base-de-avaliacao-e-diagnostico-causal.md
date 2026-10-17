# Plano da E0: base de avaliação e diagnóstico causal

## Resumo

A E0 cria a régua do programa do motor de busca v2. Nenhuma mudança no motor é aceita sem passar por ela. A etapa entrega:

- conjunto de avaliação versionado, com julgamentos graduados;
- segundo corpus fictício em inglês (H6);
- captura única das evidências dos modelos e reprodução offline (replay);
- métricas com intervalos pareados;
- atribuição da perda por etapa e teste de admissão perfeita;
- baseline do motor atual (M0).

A E0 **não altera `src/**`**. O motor de produção fica idêntico. A rota e as decisões D1–D10 e H1–H6 estão em marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

## Fontes obrigatórias antes de qualquer edição

O desenvolvedor lê estas fontes e as cita no `OK_BOOTSTRAP`:

1. `.marc/RULES.md`, inclusive `Custom Rules`, e `AGENTS.md`.
2. O registro da rota indicado no resumo.
3. `avaliacao-baseline-e-diagnostico-memory.md` na thread `57488bab`: as 30 consultas históricas, os 8 controles C1–C8 e o diagnóstico de 3P, 6I e 9I.
4. `resultado-estudo-1-pontuacao-ordenacao-descarte.md` e `resultado-estudo-4-reranker-especializado-qwen.md` na mesma thread: o protocolo e a matriz dos 44 casos.
5. `docs/memory.md`, seções `Query interpretation`, `Recall flow` e `Quality benchmark`.
6. `scripts/memory-quality-v4.ts`: os 14 controles, `RecordingQueryInterpreter` e o fluxo atual de avaliação.
7. `src/core/memory/operations.ts`, `hybrid-ranking.ts`, `semantic-ranking.ts`, `semantic-eligibility.ts`, `types.ts`, `store.ts` e `summaries.ts`.

## Objetivo e não objetivos

**Objetivo:** medir o motor atual com precisão conhecida e deixar uma interface de variantes pronta para a E1, a E2 e a E3 plugarem alternativas sem tocar no harness.

**Não objetivos:**

- mudar ranking, elegibilidade, interpretação, índice ou modelos;
- fazer rebuild do índice de produção em `.marc/memory`;
- baixar modelos novos;
- remover `scripts/memory-quality-v4.ts` ou o benchmark de modelos (a remoção é tratada na E2).

## Escopo de escrita autorizado

| Caminho | Uso |
|---|---|
| `scripts/memory-eval/**` | Harness novo, datasets e tipos |
| `test/memory-eval-*.test.ts` | Testes do harness |
| `test/fixtures/memory-eval/ledgerline-en/**` | Segundo corpus fictício |
| `package.json` | Apenas a entrada `"memory:eval": "tsx scripts/memory-eval/cli.ts"` em `scripts` |
| `docs/memory.md` | Apenas a seção `Quality benchmark` |

**Exclusões explícitas:** `src/**`, `.marc/memory/**`, `.marc/threads/**` (escrita só pelas ferramentas mARC), `scripts/memory-quality-v4.ts`, `scripts/memory-quality-selection.ts`, `scripts/memory-model-benchmark*.ts`, `pnpm-lock.yaml` (nenhuma dependência nova) e `tsconfig*.json`.

Os arquivos de trabalho e saída ficam em `.marc/cache/memory-eval/`, que já é ignorado pelo Git.

## Desenho

### 1. Conjunto de avaliação

Arquivos:

- `scripts/memory-eval/datasets/marc.json` (corpus do próprio mARC);
- `scripts/memory-eval/datasets/ledgerline-en.json` (corpus fictício).

Tipo em `scripts/memory-eval/dataset.ts`:

```ts
export type RelevanceGrade = 0 | 1 | 2 | 3;

export type EvalCaseStyle =
  | "direct"
  | "indirect"
  | "implicit"
  | "typo"
  | "overcorrection-control"
  | "negative";

export type EvalCase = {
  id: string;
  family: string;
  style: EvalCaseStyle;
  query: string;
  queryMode: "auto" | "literal";
  expectedInterpretation?: {
    effectiveQuery: string;
    suggestedQuery?: string;
  };
  judgments: Record<string, RelevanceGrade>;
  origin: string;
};

export type EvalDataset = {
  schemaVersion: 1;
  corpus: "marc" | "ledgerline-en";
  cases: EvalCase[];
};
```

**Escala dos julgamentos:**

| Grau | Significado |
|---|---|
| 3 | Thread que responde à pergunta. Cada caso positivo tem pelo menos uma |
| 2 | Thread relevante: ajuda a responder, mas não é a fonte principal |
| 1 | Menção incidental: cita o assunto sem ajudar a responder |
| 0 | Julgada e não relevante |

Uma thread **sem julgamento** é desconhecida, não irrelevante. As métricas tratam esse caso de forma explícita (seção 6).

**Família:** a thread de grau 3 do caso. Casos negativos usam `negative:<id>` como família própria. A família agrupa as reamostragens e a divisão em folds.

**Validação** (`validateDataset`), que rejeita:

- `id` duplicado;
- `threadId` em `judgments` que não existe como thread fechada no corpus;
- grau fora de 0–3;
- caso não negativo sem nenhuma thread de grau 3;
- caso negativo com qualquer grau ≥ 2;
- `style: "typo"` ou `"overcorrection-control"` sem `expectedInterpretation`.

**Conteúdo inicial do `marc.json`,** migrado sem alterar o texto das consultas:

- 30 consultas históricas `1D`…`10P`, copiadas literalmente da matriz do artifact de baseline, com `origin: "baseline-2026-08-04"`;
- 14 controles `Q01`…`Q14`, copiados de `qualityCases` em `scripts/memory-quality-v4.ts` na ordem do arquivo, com `origin: "memory-quality-v4"`;
- 8 controles `C1`…`C8` do artifact de baseline, com o `queryMode` registrado lá, com `origin: "baseline-controls"`.

Os julgamentos existentes são migrados como estão. O restante é completado na etapa de julgamento.

**Expansão do `marc.json`,** escrita pelos aprovadores (passo A1), não pelo desenvolvedor:

- uma consulta indireta ou implícita para cada thread fechada que ainda não tenha caso positivo, até 40 casos;
- 10 negativos: 5 fora do domínio e 5 do domínio de software, mas sobre assuntos que o projeto nunca discutiu;
- 8 casos `typo` com erro real de uma edição;
- 4 casos `overcorrection-control` no padrão de 2I e 9P, em que a consulta deve permanecer como está.

**Regra de autoria:** a consulta é escrita a partir do título e da primeira mensagem do `CHAT.md` da thread, nunca do `SUMMARY.md`. O comando `validate` aplica uma checagem de sobreposição: a consulta não pode compartilhar uma sequência de 4 ou mais palavras consecutivas, normalizadas em minúsculas e sem acentos, com o `SUMMARY.md` da thread de grau 3. Os casos de origem histórica ficam isentos, porque o texto deles é preservado como registro.

### 2. Segundo corpus fictício (H6)

Diretório: `test/fixtures/memory-eval/ledgerline-en/`, que espelha `.marc/` de um workspace.

**Projeto fictício:** "Ledgerline", um daemon open source de sincronização de finanças pessoais. Tem CLI, API HTTP local, importadores bancários (OFX e CSV), regras de categorização, criptografia em repouso e uma UI web.

**Estrutura:**

- `threads/<slug>-<8 hex>/SUMMARY.md`, `CHAT.md` e `artifacts/*.md`, nos formatos atuais do mARC. O desenvolvedor copia a estrutura de cabeçalho (`# título`, `Thread: marc://$…`, `Closed: \`…\``) e o formato de mensagens de uma thread fechada real do repositório, por exemplo `.marc/threads/oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac/`;
- `RULES.md` com 8 a 12 regras do projeto fictício.

**Composição obrigatória:**

- 30 threads fechadas e 3 abertas. As abertas não têm `SUMMARY.md` e servem para provar que D4 continua valendo;
- `SUMMARY.md` de 150 a 600 palavras, com 2 a 5 seções `##`;
- `CHAT.md` de 4 a 10 mensagens; de 0 a 3 artifacts por thread;
- 6 pares de threads próximas, por exemplo a v1 e a v2 de uma mesma funcionalidade. Esses pares exercitam rótulos incompletos;
- 4 threads em que a informação decisiva está só em um artifact ou no `CHAT.md`, e não no `SUMMARY.md`. Elas preparam a avaliação das camadas da E3;
- 3 conceitos com nomes diferentes em threads diferentes (deriva de vocabulário), por exemplo "rules engine" e "categorizer";
- texto integralmente em inglês, sem dados reais de pessoas ou empresas.

**Dataset `ledgerline-en.json`:** escrito pelos aprovadores (passo A2) depois que o corpus existir. São 40 casos: 30 positivos distribuídos entre os estilos, 6 negativos e 4 `typo`.

### 3. Captura (requer modelos; executada uma vez por corpus e geração)

Comando: `pnpm memory:eval capture --corpus marc|ledgerline-en [--resume]`.

**Workspace temporário.** A captura nunca lê nem escreve o índice de produção:

1. Cria um diretório com `fs.mkdtemp(path.join(os.tmpdir(), "marc-memory-eval-"))`.
2. Chama `initWorkspace(tempRoot)`.
3. Copia para `<tempRoot>/.marc/`:
   - no corpus `marc`: só as threads listadas em `scripts/memory-eval/datasets/marc.corpus.json` (o corpus congelado da E0, com as 56 threads fechadas em 2026-10-15) e o `.marc/RULES.md` do repositório. Threads fechadas depois não entram, para que as capturas da E1 à E4 comparem o mesmo corpus;
   - no corpus `ledgerline-en`: o conteúdo do fixture.
4. Executa o rebuild completo de produção (`rebuildMemoryInWorkspace`) com `LocalEmbeddingProvider`, `LocalRerankingProvider` e `LocalQueryInterpretationProvider` do workspace temporário.
5. Remove o diretório temporário em `finally`.

No corpus `marc`, a captura confirma que os `recordIds` do manifest temporário são iguais aos do manifest de produção. Se divergirem, a captura falha e informa a diferença.

**Provedores de gravação** (`scripts/memory-eval/recording-providers.ts`):

- `RecordingEmbeddingProvider`: grava o vetor de cada texto de consulta;
- `RecordingRerankingProvider`: grava o score de cada par, com chave `sha256(query + "\0" + document)`;
- `RecordingQueryInterpreter`: movido do padrão de `memory-quality-v4.ts` para este arquivo, sem alterar o script original.

**Para cada caso:**

1. Interpretação com `interpretMemoryQuery` no modo do caso, registrando o trace.
2. Para cada texto distinto entre a consulta original, a efetiva e a sugerida:
   - vetor da consulta;
   - canais de produção (`searchVector` de identity e passage e `searchLexical`) com `candidateLimitForDepth(0)`, registrando posição, score e `recordId`. Os campos lexicais seguem a regra de `lexicalFieldsForQuery` (`src/core/memory/operations.ts:259-268`): `title` e `summary`, mais `titlePrefix` quando a consulta tem um único termo. A regra é replicada no harness porque a função não é exportada, e um teste compara as duas com as mesmas entradas;
   - **matriz completa do reranker:** score de todas as linhas de identity e passage de todas as threads do corpus, usando `semanticRerankingDocument` como texto.
3. Recall de produção em modo `literal` com a consulta efetiva, `limit: 50` e `depth: 0`, para a checagem de equivalência.
4. **Latência de ponta a ponta (revisão 6):** fica fora da captura de conteúdo e roda numa passada própria, `memory:eval latency --corpus <c>`, sobre uma captura completa. A passada usa `recallMemoryInWorkspace` no modo do caso, com `limit: 5` e `depth: 0`, e faz 1 aquecimento e 3 medições com `performance.now()`. O resultado vai para `latency.json`, ao lado de `capture.json`, com `captureId`, data, memória total e memória livre no início e após cada caso.

**Saída:** `.marc/cache/memory-eval/<corpus>/<captureId>/capture.json`. O `captureId` são os 12 primeiros caracteres hex do fingerprint, que é o SHA-256 de:

- o `queryFingerprint` do dataset: SHA-256 do JSON da lista de casos ordenada por `id`, contendo só `id`, `query`, `queryMode` e `expectedInterpretation`. `judgments` e `origin` ficam de fora, porque os julgamentos são gravados depois da captura (seção 5) e não alteram o que foi capturado. Os julgamentos são sempre lidos do dataset atual no `replay`, no `report` e no `compare`;
- o `corpusDigest`: SHA-256 do conteúdo copiado para o workspace temporário, com os arquivos ordenados por caminho relativo;
- os ids e as variantes dos três modelos ativos (`activeMemoryModelSelection()`);
- a versão do `package.json`;
- o hash agregado dos arquivos `src/core/memory/*.ts`, ordenados pelo caminho.

**Retomada:** depois de cada caso, a captura grava `checkpoint.json` com os casos concluídos. `--resume` pula esses casos. A captura exibe o progresso por caso em stderr.

### 4. Replay offline e variantes

Comando: `pnpm memory:eval replay --capture <captureId> --corpus <corpus> --variants M0,D0,ORACLE_ADMISSION`.

O replay usa apenas `CachedEmbeddingProvider` e `CachedRerankingProvider` (`scripts/memory-eval/cached-providers.ts`). Os dois lançam um erro com a chave ausente quando a captura não cobre um pedido. O replay não instancia provedores locais nem carrega modelos.

**Interface de variante** (`scripts/memory-eval/variants.ts`), que a E1, a E2 e a E3 vão estender:

```ts
export type VariantInput = {
  query: string;
  channels: MemorySearchChannels;
  reranker: RerankingProvider;
  judgments: Record<string, RelevanceGrade>;
};

export type VariantResult = {
  threadId: string;
  score: number;
  admitted: boolean;
  band?: "high" | "medium" | "low";
};

export type RankingVariant = (input: VariantInput) => Promise<VariantResult[]>;

export const rankingVariants: Record<string, RankingVariant> = {
  M0: …,
  D0: …,
  ORACLE_ADMISSION: …
};
```

| Variante | Definição |
|---|---|
| `M0` | `rankHybridMemoryCandidates` de produção. `admitted` = `eligibility >= SEMANTIC_ELIGIBILITY_THRESHOLD`. A ordem da lista é a de produção |
| `D0` | A mesma ordem de `rankHybridMemoryCandidates` com todos os candidatos admitidos. Só para diagnóstico |
| `ORACLE_ADMISSION` | A ordem de `D0`, admitindo exatamente as threads de grau ≥ 2. Mostra o teto de um corte perfeito |

Só `ORACLE_ADMISSION` lê `judgments`. Uma variante candidata a produção não pode lê-los, e um teste garante isso para `M0` e `D0`.

**Checagem de equivalência (revisão 7):** o reranker é fp16, e o score de um par depende do comprimento com padding do lote em que ele é pontuado. A matriz e a chamada de produção usam lotes diferentes, então os scores não podem coincidir exatamente. A checagem tem duas partes:

- **Exatidão do caminho (CA1a):** o caminho do replay, quando recebe os scores do reranker no layout da chamada de produção, reproduz a elegibilidade de produção com diferença de no máximo `1e-9` e a mesma sequência de threads, em todos os casos. A evidência vem de uma verificação com o modelo vivo, fora do harness, anexada à entrega.
- **Fidelidade da matriz (CA1b):** o replay de `M0` com os scores da matriz admite a mesma sequência de `threadId` que o recall de produção em todos os casos. A diferença de score não reprova. O relatório registra, por caso, a diferença máxima, e por corpus, a mediana, o p95 e o máximo. Se a sequência divergir em algum caso, o relatório marca `equivalence: failed` e lista os casos.

Todas as variantes usam os scores da matriz. Assim, M0 e as variantes são comparados sobre a mesma fonte de score.

### 5. Julgamento

Comandos:

- `pnpm memory:eval worksheet --capture <captureId> --corpus <corpus> [--variants <v1,v2,...>]`
- `pnpm memory:eval merge-judgments --corpus <corpus> --inputs <a.json>,<b.json>`

**Julgamento incremental das variantes:** com `--variants`, o pool de cada caso passa a incluir também todo o alcance das métricas de decisão de cada variante indicada, conforme a tabela `metricReach` (seção 6). Isso inclui toda a lista admitida, e não só as 10 primeiras. A planilha mostra **somente os pares ainda sem julgamento**. A planilha não informa de qual variante veio cada thread. É esse modo que a E1, a E2, a E3 e a E4 usam antes de cada decisão: os aprovadores julgam o que as variantes novas trouxeram, com o mesmo rigor e o mesmo `merge-judgments` usados no baseline.

**Pool de cada caso:** a união de

- todas as threads admitidas por `M0`;
- as 10 primeiras de `D0`;
- as 5 primeiras pela melhor identity densa;
- as 5 primeiras pelo melhor score do reranker na matriz completa;
- as threads já julgadas no dataset.

O `worksheet` gera `.marc/cache/memory-eval/<corpus>/<captureId>/worksheet.md`. Para cada caso, ele mostra a consulta e, para cada thread do pool, o título, a primeira seção do `SUMMARY.md` e o melhor trecho. A ordem do pool é alfabética por `threadId`, para não induzir o julgador pela posição.

**Os julgamentos são feitos pelos aprovadores,** não pelo desenvolvedor. marc://@claude-software-architect e marc://@codex-software-architect julgam de forma independente, cada um gravando um JSON `{ caseId: { threadId: grade } }`.

O `merge-judgments`:

- calcula o kappa de Cohen com pesos quadráticos entre os dois arquivos;
- lista as divergências;
- grava no dataset apenas os pares concordantes.

Os aprovadores resolvem as divergências juntos e as gravam pelo mesmo comando, passando um terceiro arquivo de consenso. Se o kappa ficar abaixo de 0,6, os aprovadores revisam a escala com exemplos antes de resolver as divergências. O kappa e o número de divergências entram no relatório.

### 6. Métricas

Arquivo `scripts/memory-eval/metrics.ts`. Cada métrica é calculada por corpus, por estilo e no total.

**Lista admitida** (o que o usuário vê):

- **Top1-alvo:** o primeiro admitido tem grau 3;
- **Top1-relevante:** o primeiro admitido tem grau ≥ 2;
- **Top3-alvo;**
- **MRR:** posição do primeiro grau ≥ 2 na lista admitida, valendo 0 se não houver;
- **nDCG@10** com ganho `2^grau - 1`;
- **precisão de admissão:** admitidos de grau ≥ 2 sobre admitidos julgados;
- **recall de admissão:** admitidos de grau ≥ 2 sobre threads de grau ≥ 2;
- **exposição incidental:** casos com algum admitido de grau ≤ 1;
- **abstenção correta:** casos negativos sem admitidos.

**Lista completa** (ordem de `D0`): Recall@10 e MRR, para diagnóstico.

**Interpretação**, nos casos com `expectedInterpretation`:

- correção aplicada corretamente;
- correção indevida (a consulta mudou quando não devia);
- sugestão correta;
- sugestão indevida;
- sugestão ausente.

**Latência:** mediana e p95 por corpus, a partir de `latency.json`, com a memória livre mínima registrada durante a medição. Sem `latency.json` com o mesmo `captureId`, o `report` falha com uma mensagem clara.

**Threads não julgadas:** remover threads sem julgamento antes do cálculo favorece a variante que traz resultados desconhecidos. Exemplo: uma variante devolve uma thread não julgada em 1º lugar e a resposta correta em 2º. Sem a não julgada, ela ganharia um acerto em 1º lugar que o usuário não veria. Por isso:

- **métricas de decisão** exigem cobertura completa: **todo resultado que participa de uma métrica de decisão** precisa estar julgado, em **cada variante comparada**, inclusive `M0`. O alcance de cada métrica é declarado numa tabela `metricReach` em `metrics.ts`, e é essa tabela que o `report`, o `compare` e o `worksheet --variants` consultam:

  | Métricas | Alcance que precisa estar julgado |
  |---|---|
  | Top1-alvo, Top1-relevante, Top3-alvo, MRR, nDCG@10, precisão de admissão, recall de admissão, exposição incidental e abstenção correta | **Toda a lista admitida** da variante, e não só as 10 primeiras. Precisão de admissão e exposição incidental usam todos os admitidos; uma thread não julgada em 11º altera essas métricas |
  | Recall@10 e MRR da lista completa (diagnóstico) | As 10 primeiras da lista completa |
  | Métricas novas das etapas seguintes | A etapa declara o alcance na tabela antes de rodar a comparação. Exemplos: os 20 finalistas do funil (E3) e os 5 primeiros trechos por `passageId` (E4) |

  O `D0` admite todos os candidatos e só serve para diagnóstico. Por isso, a exigência para ele é o alcance da lista completa;
- o `report` e o `compare` verificam essa cobertura por variante. Se faltar julgamento, a variante recebe o estado `incomplete`, com a lista de pares pendentes, e **nenhum veredito é emitido** para ela. Os pares pendentes vão para o julgamento incremental (seção 5);
- a **lista condensada**, sem as threads não julgadas, continua no relatório só como diagnóstico, marcada como tal, e nunca entra em critério de aceite.

### 7. Estatística

Arquivo `scripts/memory-eval/statistics.ts`, sem dependências novas:

- **gerador pseudoaleatório** mulberry32 com semente `20261015`;
- **bootstrap pareado por família:** 10.000 reamostragens de famílias com reposição. Para cada métrica, calcula a diferença entre a variante e `M0` e o intervalo percentil de 95%;
- **McNemar exato** (binomial bilateral) para Top1-alvo, informando os discordantes `b` e `c`;
- **folds:** 5 folds agrupados por família. As famílias são ordenadas por `sha256("20261015:" + family)` e distribuídas em rodízio. A E0 só publica a atribuição dos folds; a E2 os usa para ajustar pesos.

**Vocabulário de decisão,** declarado antes de qualquer resultado:

| Termo | Condição |
|---|---|
| melhora | limite inferior do IC da diferença > 0 |
| piora | limite superior do IC < 0 |
| não inferior | limite inferior > −δ |
| inconclusivo | nenhum dos anteriores |

As margens são δ = 0,05 para proporções e δ = 0,03 para MRR e nDCG@10.

**Regra de decisão para todo o programa:**

- um critério que exige "não inferior" só é atendido com o limite inferior do IC acima de −δ. **Inconclusivo reprova o critério**; a ausência de piora demonstrada nunca é aceita como aprovação;
- quando o resultado for inconclusivo, os aprovadores podem fazer **uma única rodada de ampliação** do recorte afetado. Ela acrescenta casos novos daquele estilo, seguindo as mesmas regras de autoria, até dobrar o tamanho do recorte. Depois disso, a comparação é rodada de novo;
- se continuar inconclusivo, aplica-se o recuo da hipótese, definido no plano da etapa.

Como a comparação é pareada, uma variante que muda poucos casos tem um intervalo estreito e consegue provar não inferioridade. O inconclusivo tende a aparecer quando a variante muda muitos casos, e é justamente aí que mais evidência é necessária.

### 8. Atribuição da perda e admissão perfeita

Arquivo `scripts/memory-eval/attribution.ts`. Para cada caso positivo e para cada thread de grau 3, o resultado em `M0` com `depth: 0` é classificado em exatamente uma categoria:

| Categoria | Condição |
|---|---|
| `success` | primeira admitida |
| `candidate_recall` | ausente de todos os canais |
| `admission` | presente, com `semanticEligibility < 0,5` |
| `ordering` | admitida, mas fora da primeira posição |

Para `admission` e `ordering`, o relatório adiciona a marca `passage_selection_suspect` quando duas condições valem juntas:

- o melhor score da thread na matriz completa é maior que o melhor score entre as 3 passagens selecionadas por `MAX_RERANK_PASSAGES_PER_THREAD` (`src/core/memory/semantic-ranking.ts:20`; a constante não é exportada, então o harness a declara com o mesmo valor e cita a origem);
- com esse melhor score, a thread ficaria em primeiro entre os melhores scores por thread.

O relatório mostra:

- a contagem por categoria;
- a lista de casos por categoria;
- o Top1 de `ORACLE_ADMISSION`, que é quanto o Top 1 subiria com um corte ideal.

Isso responde à objeção de causalidade da réplica antes de qualquer mudança no motor.

### 9. Relatório

Comando: `pnpm memory:eval report --capture <captureId> --corpus <corpus>`.

O comando gera `report.json` e `report.md` em `.marc/cache/memory-eval/<corpus>/<captureId>/`, com:

- identificação (fingerprint, geração temporária, modelos, quantidade de casos por estilo);
- resultado da equivalência;
- métricas por variante, com IC e McNemar contra `M0`;
- tabela de atribuição e Top1 da admissão perfeita;
- métricas de interpretação;
- latência;
- kappa dos julgamentos;
- atribuição dos folds;
- tamanho do corpus comparado ao limite de candidatos por canal.

**Comparação entre capturas:** `pnpm memory:eval compare --corpus <corpus> --baseline <captureId>:<variant> --candidate <captureId>:<variant>`. O comando pareia os casos por `id`, exige o mesmo `queryFingerprint` e o mesmo `corpusDigest` nas duas capturas e aplica as mesmas métricas e a mesma estatística da seção 7. A E1 usa esse comando, porque a mudança de representação altera o índice e exige uma captura nova.

## Tarefas do desenvolvedor

As tarefas rodam em sequência, um handoff por vez, com `OK_BOOTSTRAP` e autorização explícita antes de cada uma. Cada tarefa termina com testes próprios e com `pnpm validate`, `pnpm build` e `pnpm test`.

| Tarefa | Entrega | Testes |
|---|---|---|
| T1 | `dataset.ts`, `validate` no `cli.ts`, checagem de sobreposição e migração dos 52 casos para `marc.json` | `test/memory-eval-dataset.test.ts`: cada regra de rejeição com um fixture declarado; os 52 casos carregam sem erro; a sobreposição de 4 palavras é detectada |
| T2 | `recording-providers.ts`, `cached-providers.ts`, `corpus.ts` e `capture.ts` com checkpoint e fingerprint | `test/memory-eval-capture.test.ts` com provedores falsos determinísticos e um workspace temporário de 3 threads: a captura grava canais, matriz e latência; `--resume` não repete casos; o cache lança erro em chave ausente; mudar só `judgments` mantém o `captureId`, e mudar `query` o altera |
| T3 | `variants.ts` e `replay.ts` com a checagem de equivalência | `test/memory-eval-replay.test.ts`: `M0` replay é igual ao recall de produção com provedores falsos; `D0` admite todos; `ORACLE_ADMISSION` admite exatamente grau ≥ 2; `M0` e `D0` não leem `judgments` |
| T4 | `metrics.ts`, `statistics.ts`, `folds.ts`, `attribution.ts`, `report.ts` e o comando `compare` | `test/memory-eval-metrics.test.ts` e `test/memory-eval-statistics.test.ts` com valores esperados calculados à mão: nDCG, MRR, lista condensada como diagnóstico, bootstrap com semente fixa (resultado estável), McNemar com tabela conhecida, kappa com matriz conhecida, folds determinísticos, pareamento do `compare`; estado `incomplete` sem veredito quando há não julgado no alcance de `metricReach` de uma variante, inclusive uma thread admitida em 11º lugar; cenário declarado em que a variante devolve uma thread não julgada em 1º e o alvo em 2º: antes do julgamento, a variante fica `incomplete` e não recebe acerto Top1; depois de a thread receber grau 0, o Top1-alvo do caso é 0; inconclusivo nunca classificado como não inferior; `test/memory-eval-attribution.test.ts` com um caso por categoria |
| T5 | `judgments.ts` com `worksheet` e `merge-judgments` | `test/memory-eval-judgments.test.ts`: pool montado com as cinco fontes; ordem alfabética; com `--variants`, só pares sem julgamento e sem indicação da variante de origem; merge grava só concordâncias; consenso resolve divergências |
| T6 | Corpus `ledgerline-en` conforme a seção 2 | `test/memory-eval-corpus-fixture.test.ts`: 30 fechadas e 3 abertas; cabeçalhos válidos; contagens de palavras, mensagens e artifacts dentro dos limites |
| T7 | Execução das capturas dos dois corpora, relatório baseline e atualização de `docs/memory.md` | Sem teste novo; evidência na entrega |

Entre T6 e T7 acontecem os passos dos aprovadores:

- **A1:** expandir e julgar `marc.json`;
- **A2:** escrever e julgar `ledgerline-en.json`.

A T7 só começa depois que os dois datasets passam no `validate`.

**Regras de código para todas as tarefas:**

- sem `else` e sem `if` aninhado;
- guardas com early return;
- variantes, comandos e categorias como tabelas de dispatch;
- testes sem ramificação, com cenários declarados.

**Cobertura de checagem:** o `tsconfig.json` inclui só `src` e `test`, e o ESLint não cobre `scripts/`. Por isso, todo arquivo de `scripts/memory-eval/`, inclusive o `cli.ts`, precisa ser importado por algum teste, para entrar no `pnpm typecheck`. O estilo de código desses arquivos é conferido na revisão do principal.

## Critérios de aceite da etapa

1. **CA1, equivalência (revisão 7):**
   - CA1a passa em 100% dos casos dos dois corpora.
   - CA1b também passa em 100%. Se houver desvio, cada caso divergente é explicado, e as métricas de decisão de M0 são iguais às de `PRODUCTION_RECALL`, ou cada diferença é listada com a causa.
2. **CA2, offline:** o replay, as métricas e o relatório rodam sem instanciar provedores locais, o que é provado pelo teste da T3.
3. **CA3, dataset:** os dois datasets passam no `validate`, e o `marc.json` tem pelo menos 52 casos migrados mais os casos de A1.
4. **CA4, julgamentos:** nenhuma variante do baseline em estado `incomplete` nos dois corpora. Em `M0`, isso significa toda a lista admitida e as 10 primeiras da lista completa julgadas. Em `D0`, as 10 primeiras da lista completa. Kappa e divergências registrados.
5. **CA5, relatório completo:** contém todos os itens da seção 9 para os dois corpora.
6. **CA6, produção intacta:** nenhuma mudança em `src/**`. O hash de `.marc/memory/manifest.json` é igual antes e depois da T7.
7. **CA7, validação:** `pnpm validate`, `pnpm build` e `pnpm test` passam. As regras de estilo de código e de teste foram respeitadas.
8. **CA8, documentação:** `docs/memory.md` descreve os comandos, as saídas e o vocabulário de decisão do `memory:eval`.

## Evidência esperada na entrega do desenvolvedor

- caminhos alterados com referências de linha;
- comandos executados e resultados;
- `captureId` de cada corpus, duração da captura e tamanho da matriz do reranker;
- `report.md` dos dois corpora anexado como artifact da entrega;
- hash do manifest de produção antes e depois;
- riscos e limites.

## Riscos

- **Duração da captura:** a matriz completa do reranker no corpus `marc` deve ficar na casa de dezenas de milhares de pares. O checkpoint permite interromper e retomar.
- **Viés de autoria das consultas:** é mitigado pela regra de sobreposição e pela autoria a partir do `CHAT.md`, mas não é eliminado. Os aprovadores declaram esse limite no relatório.
- **Amostra pequena:** mesmo com cerca de 100 casos, muitos ICs vão sair inconclusivos. Isso é um resultado válido, não uma falha da E0.
- **Corpus pequeno:** com 53 threads, todos os candidatos já cabem em `depth: 0`. O relatório registra isso porque afeta H4 e H5 na E3.

## Pendências antes do dispatch

Resolvidas em 2026-10-15:

- **Desenvolvedor:** marc://@claude-dev, modelo Haiku 5.5, reasoning xhigh, confirmados pelo humano.
- **Veredito conjunto:** revisão 3 aprovada pelos dois aprovadores.

## Histórico de revisões

- **Revisão 2 (2026-10-15):** incorpora a revisão de marc://@codex-software-architect. Julgamento incremental das variantes, cobertura completa exigida para métricas de decisão (lista condensada só como diagnóstico) e regra de que inconclusivo reprova critério de não inferioridade, com uma rodada de ampliação antes do recuo. Arquitetura sem mudança.
- **Revisão 3 (2026-10-15):** responde ao parecer de marc://@codex-software-architect sobre a revisão 2. A cobertura deixa de ser "top 10" e passa a ser o alcance real de cada métrica de decisão, declarado na tabela `metricReach`. Isso inclui toda a lista admitida. O julgamento incremental passa a seguir o mesmo alcance.
- **Revisão 4 (2026-10-15), na preparação do dispatch:** o fingerprint da captura usava o JSON inteiro do dataset, inclusive `judgments`. Como os julgamentos são gravados depois da captura, isso invalidaria a captura que os originou. O fingerprint passa a usar o `queryFingerprint` (só `id`, `query`, `queryMode` e `expectedInterpretation`), e o `compare` exige o mesmo `queryFingerprint`. É correção de consistência interna, sem efeito em arquitetura ou critérios.
- **Revisão 5 (2026-10-15), na revisão da T2:** o corpus `marc` cresce a cada thread fechada, e isso confundiria as comparações entre etapas. O corpus passa a ser fixado em `scripts/memory-eval/datasets/marc.corpus.json`, com as 56 threads fechadas. A captura copia só essas threads, o `corpusDigest` do conteúdo copiado entra no fingerprint, e o `compare` exige o mesmo `queryFingerprint` e o mesmo `corpusDigest`. Uma thread fixada que deixe de existir vira issue `pinned-thread-missing` no `validate`.
- **Revisão 6 (2026-10-16), na T7:** duas capturas reais foram interrompidas por falta de memória da máquina, que é compartilhada com outros trabalhos. O conteúdo capturado é determinístico e continua válido depois de uma interrupção. A latência não continua válida: o `--resume` reaproveita os tempos gravados, medidos sob pressão. A latência sai da captura e passa para uma passada própria (`latency`), rodada numa janela em que a máquina está quieta. Ela grava a memória livre durante a medição, para que as condições possam ser auditadas. Protocolo, métricas e critérios não mudam.
- **Revisão 7 (2026-10-16), na T7:** o CA1 falhou por score em 5 de 40 casos no `ledgerline-en` e em 45 de 114 no `marc`.
  - **Diagnóstico:** o reranker `model_O4.onnx` é fp16, e o score de um par depende do comprimento com padding do lote. O resultado é determinístico para cada formato e não depende dos outros documentos do lote. A produção e o replay reproduzem exatamente o próprio layout: a diferença entre eles é toda explicada pelo score do reranker, com resíduo 0.
  - **Mudança:** o CA1 passa a ter duas partes. O CA1a cobre a exatidão do caminho, com o score do layout de produção. O CA1b cobre a fidelidade da matriz, com a mesma sequência de threads, e a diferença de score é registrada sem reprovar.
  - **Rejeitado:** alimentar o M0 com scores do layout de produção. Isso faria o M0 e as variantes usarem fontes de score diferentes e enviesaria as comparações.
  - **Achado para a E2:** a elegibilidade de produção varia com o comprimento de candidatos sem relação com a consulta. A variação bruta chega a 2,2e-3 (`ledgerline-en`, L08). O máximo de 0,036 no `marc` (9I) não é ruído bruto: é uma inversão de quase-empate propagada pelo limite monotônico (`applyMonotonicConfidence`).
  - **Resultado:** o CA1a passou em 100% dos casos dos dois corpora, com delta 0. O CA1b passou em 40 de 40 no `ledgerline-en` e em 113 de 114 no `marc`. O critério declarado falhou no caso 9I: as posições 9 e 10 se inverteram num quase-empate.
  - **Decisão dos aprovadores:** o desvio é aceito com uma condição de impacto. O `report` passa a ter a pseudovariante `PRODUCTION_RECALL`, que lê o recall de produção capturado. Para a E0 ser aceita, as métricas de decisão de M0 precisam ser iguais às de `PRODUCTION_RECALL` nos dois corpora, ou cada diferença precisa ser listada com a causa. A taxa observada de inversão de cauda, 1 em 154 casos, entra nos riscos da E2.
- **Revisão 8 (2026-10-17), na T7:** o humano decidiu que a latência não é medida em máquina quieta, e sim com a carga típica de uso: navegador, editor, terminais, mensageiro e dois agentes de código abertos e sem uso.
  - **Motivo:** no uso real, o marc disputa a máquina com esses programas. Uma máquina vazia daria um número que nenhum usuário vê.
  - **Condição registrada:** 15,7 GiB de RAM, cerca de 5,8 GiB livres no início e CPU ociosa em torno de 5%, ligada na tomada. O `latency.json` grava a memória livre de cada caso.
  - **Regra:** as comparações de latência das etapas seguintes repetem essa condição. A medição não vale como prova para máquinas de 8 GB.
  - Protocolo, métricas e critérios não mudam.

## Relação com as outras etapas

- **E1:** marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
- **E2:** marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2
- **E3:** marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8
- **E4:** marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7

Todas usam este harness como critério de aceite. Cada uma adiciona variantes em `rankingVariants` e não altera as métricas nem a estatística, a menos que um aprovador registre a mudança antes de rodar a comparação.
