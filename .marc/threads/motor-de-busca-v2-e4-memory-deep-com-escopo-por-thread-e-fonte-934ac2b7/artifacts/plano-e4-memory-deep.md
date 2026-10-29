# Plano da E4: `memory_deep` com escopo por thread e fonte

## Resumo

A E4 cria a ferramenta MCP `memory_deep` e o comando de CLI equivalente. O `memory_recall` responde **"qual thread?"**; o `memory_deep` responde **"onde, dentro das fontes fechadas, está o trecho que explica isso?"**.

A ferramenta devolve trechos (passagens), e não threads agrupadas. Cada trecho vem com a proveniência completa da E1. Ela tem dois modos:
- **com escopo:** dentro de uma thread fechada (`threadId`), opcionalmente filtrada por tipo de fonte;
- **sem escopo:** os trechos dos grupos que a busca em depth 2 admite.

Esta é a **revisão 4.1**. A revisão 4 alinhou o plano coaprovado em 15/10 (revisão 3) aos resultados da E1 a E3 e à decisão de latência do humano de 2026-10-27; as diferenças estão em "Mudanças em relação à revisão 3". A revisão 4.1 incorpora os ajustes B1 a B3 do parecer de marc://@codex-software-architect (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_81b1fbd8207a4ee3a9): cobertura de julgamento para o diagnóstico e o recuo, os dois gates sobre a configuração final, entradas de latência pré-registradas por modo e precedência das classes de falha.

Esta thread substitui marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae. Rota: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

## Gate de entrada (cumprido)

- E3 (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8) aceita pelo humano em 2026-10-27.
- Camadas [0, 1, 2] ativas, rebuild produtivo feito, commit 7e3bf91.

## Decisão de latência do humano (2026-10-27)

**Qualidade primeiro, como na E3.** A mediana de cada modo do `memory_deep` fica em até **1,2 × a mediana do M0**, medida na mesma execução. Os 5 s ficam como referência informativa para o estudo de modelos.

O motivo: com o modelo atual (cerca de 11,7 pares por segundo), 5 s só permitiriam cerca de 35 trechos por consulta, com pré-seleção agressiva nas threads grandes. Na E3, uma pré-seleção desse tipo perdeu a evidência em cerca de 1 de cada 4 casos.

## Dados de produção que guiam o desenho

- 63 grupos e 3.763 trechos: summary 321, artifact 2.683, rules 26, chat 733.
- Trechos por grupo: mediana de 31, p75 de 49, p90 de 104 e máximo de 597.
- 12 grupos passam de 60 trechos, e 3 passam de 232: `57488bab` (597), `cd4a49b8` (502) e `c34cf4a2` (242).

## Fontes obrigatórias

- `RULES.md`, as ADRs 0010 a 0012 e os relatórios da E3: `decisao-e3.md`, `revisao-final-e3.md` e `revisao-ativacao-e3.md`.
- **Pipeline do recall:**
  - `src/core/memory/operations.ts` (164-258);
  - `semantic-ranking.ts` (84-173 e 295-337);
  - `hybrid-ranking.ts` (23-117);
  - `recall-hits.ts`, `recall-actions.ts`, `recall-support.ts`, `layered-search.ts`, `search-depth.ts` e `scoring/bands.ts`.
- **Store:**
  - `src/core/memory/types.ts` (96-121 e 243-288);
  - `lancedb-store.ts` (65-192), `lancedb-store-support.ts` (231-248) e `store.ts`.
- **Transportes:**
  - `src/mcp/memory-tools.ts`, `src/mcp/responses.ts`, `src/mcp/tool-registration.ts`;
  - `src/mcp/thread-resolution.ts` e `src/mcp/thread-tools.ts` (205-224);
  - `src/cli.ts` (74 e 116-163) e `src/core/workspace-memory.ts` (137-158);
  - `src/core/marc-ops-skill.ts`.
- **Harness (`scripts/memory-eval/`):**
  - `dataset.ts`, `judgments.ts`, `capture-plan.ts`, `capture-scope.ts`, `capture-fingerprint.ts`, `replay.ts`, `cached-providers.ts`, `evidence-match.ts` e `t2-run.ts` (`survivalOf`, como padrão de linha de relatório separada);
  - `t0-funnel-prestudy.ts` (`runLatencyE2e`, 681-822).

## Desenho

### 1. Modo com escopo (`threadId`)

1. **Resolução:** id completo ou sufixo de 8 hex. A `resolveThreadId` passa de `src/mcp/thread-resolution.ts` para `src/core/thread-resolution.ts`, e o arquivo do MCP vira re-export, o que mantém `thread-tools.ts` e os testes atuais.
2. **Elegibilidade:** a `resolveThreadId` só confere o `CHAT.md` e aceita thread aberta. O `memory_deep` confere mais duas coisas:
   - `SUMMARY.md` existente e não vazio. Se faltar, o erro é `thread_not_closed`, com a mensagem `memory_deep only covers closed threads.`;
   - o grupo presente no manifest, comparado por `relativeSummaryPath`. Se faltar, o erro é `thread_not_indexed`, com orientação de `memory_rebuild`.
3. **Leitura do escopo:** `store.readRows(info, generation, { layers: presentes, threadId })`. É um filtro novo, `threadPredicate` com `sqlString`, também no store em memória. Ficam só as linhas `kind: "passage"` e, se houver `sourceTypes`, só as desses tipos.
   - Com `threadId`, os tipos válidos são `summary`, `artifact` e `chat`. `rules` e `document` pertencem aos grupos `@rules` e `@document/...` e são rejeitados com `invalid_source_types`.
4. **Ordenação:** `rankScopePassages({ query, queryVector, rows, reranker, budget })`, uma função pura em `deep.ts`.
   - Até **B = 232** trechos, todos vão ao reranker numa chamada única, com documentos de `semanticRerankingDocument`.
   - Acima de B, a pré-seleção é pelos B melhores por cosseno em JS (`selectRerankPassages(..., B, "cosine")`, `funnel-selection.ts:67`), com `scopeTruncated: true`. Não se usa `cosine-fts`, porque o FTS não filtra por thread.
   - Ordem final: score desc, cosseno desc, `recordId`. O desempate é pré-declarado porque o score sigmoide satura perto de 1.
5. **Sem `groupBand`:** a faixa exigiria a busca global, e o agente já escolheu a thread.

**Por que B = 232:** é o orçamento medido na E3 dentro de 1,2 × M0. 232 pares levam cerca de 19,8 s, mais 1,5 a 2 s de interpretação e embedding, contra o limite de 1,2 × 18,4 ≈ 22,1 s. Só 3 grupos passam de B. Como a ADR 0012 proíbe orçamento em caminho de usuário sem nova avaliação, esta etapa é essa avaliação e registra a ADR 0013.

### 2. Modo sem escopo

1. **Pool:** é o pool exato da depth 2. `deep.ts` compõe as funções já exportadas: `semanticHitsForChannels`, `denseRanksByKind`, `consolidateThreads`, `rerankingEntriesOf`, `applyRerankScores`, `rankThreadCandidates`, `hybridAdmissionOrder` e `lexicalRanksByThread`.
2. **Reranker:** a mesma chamada única `reranker.rerank(query, documentos, DEFAULT_RERANK_BATCH_SIZE)`, com os mesmos documentos na mesma ordem, guardando o score de cada trecho. O recall descarta esses scores.
3. **Função pura:** `rankDepthPoolPassages(query, channels, reranker)` devolve `{ ranked, passageScores }`. `ranked` é profundamente igual a `rankHybridMemoryCandidates`.
4. **Admissão:** só voltam trechos de grupos admitidos (eligibility ≥ 0,5), com `groupBand = memoryBandOf(eligibility)` do grupo. É exatamente a faixa que o `memory_recall` em depth 2 mostraria (ADR 0011).
5. **Filtro de tipos:** `sourceTypes` filtra **só a saída**. Filtrar o pool antes mudaria a eligibility e removeria a identity dos grupos.
   - Um grupo só com identity continua pontuado, porque isso preserva a paridade dos grupos, mas a identity nunca vira trecho de saída.
6. **Ordem:** score desc, rank denso, `recordId`. Zero pares a mais que a depth 2.

### 3. Comum aos dois modos

- **Deduplicação e limite:** dedupe por `passageId`, mantendo o melhor score; corte em `limit`, com padrão 5 e máximo 20.
- **`nextActions` por `authority`, numa tabela:**

| `authority` | Ação |
|---|---|
| `decision` | Ler a thread |
| `rule` | Revisar `sourcePath` nas linhas indicadas (um documento normativo também é `rule`) |
| `artifact` | Abrir o artifact |
| `document` | Abrir o documento |
| `conversation` | Tratar como contexto intermediário e confirmar no `SUMMARY.md` ou na mensagem final |

  Quando o índice está stale, entra antes o prefixo de rebuild, como em `recall-actions.ts:19-31`.
- **Prontidão e lock:** seguem `operations.ts:171-190` (`tryWithMemoryOperationLock`), com mensagens que citam `memory_deep`. Se o store não tiver `readRows`, o erro é claro.
- **Contador:** o reranker é envolvido por `CountingRerankingProvider`.
- **`memory_recall` não muda:** `semantic-ranking.ts`, `hybrid-ranking.ts` e `operations.ts` não são editados. O teste de paridade P1 protege contra divergência futura.

## Contrato

```ts
type MemoryDeepInput = {
  query: string;
  threadId?: string;                 // id completo ou sufixo de 8 hex
  sourceTypes?: MemorySourceType[];  // com threadId: summary | artifact | chat
  queryMode?: "auto" | "literal";
  limit?: number;                    // padrão 5, de 1 a 20
};

type MemoryDeepHit = {
  groupId: string;
  groupKind: MemoryGroupKind;
  threadId?: string;
  sourceType: MemorySourceType;
  authority: MemoryAuthority;
  passageId: string;                 // <sourcePath>#<16 hex do sha256 do texto>
  recordId: string;
  reference: string;                 // tabela da E3, via memoryReferenceOf(record)
  sourcePath: string;
  lineStart: number;                 // linhas da seção de origem (limite da E1)
  lineEnd: number;
  passageOrdinal: number;
  sectionTitle?: string;
  messageId?: string;
  agentId?: string;
  artifactFileName?: string;
  matchedText: string;
  score: number;                     // score do reranker, não é probabilidade
  groupBand?: MemoryBand;            // só no modo sem escopo
};

type MemoryDeepResult = {
  query: string;
  interpretation: MemoryQueryInterpretation;
  indexStatus: MemoryStatus;
  mode: "scoped" | "unscoped";
  threadId?: string;
  results: MemoryDeepHit[];
  nextActions: string[];
  abstained?: boolean;               // só no modo sem escopo
  layersSearched: MemoryLayer[];
  rerankPairs: number;
  scopePassages?: number;            // só no modo com escopo
  scopeTruncated?: boolean;
};
```

- `memoryReferenceOf(record)` é exportado de `recall-hits.ts`, numa mudança aditiva.
- **Erros:** o core lança `MemoryDeepError{ code, message, details? }`, com os códigos `thread_not_found`, `ambiguous_thread_id`, `invalid_thread_id`, `thread_not_closed`, `thread_not_indexed`, `invalid_source_types` e `invalid_limit`.
  - O MCP o mapeia para `toolError`, porque um erro lançado viraria `internal_error` (`tool-registration.ts`).
  - O zod valida `limit` (inteiro de 1 a 20) e o enum de `sourceTypes`.
  - O core repete as validações, porque a CLI não passa pelo zod.

## Interfaces

- **MCP:** a ferramenta `memory_deep` usa `gatedSchema` e `withBootstrap`. A descrição diz que se usa depois do `memory_recall`, que o score é relevância do reranker e não probabilidade, e qual é o custo do modo com escopo.
- **CLI:** `marc memory deep --query <text> [--thread <id>] [--source-types a,b] [--limit <n>] [--query-mode auto|literal]`, como nova entrada em `memoryCommandHandlers`, com `--query` obrigatório e a linha de usage atualizada.
- **Core:** `deepMemory(workspaceRoot, input)` em `workspace-memory.ts`, espelhando `recallMemory`, e os exports em `src/core/memory/index.ts`.
- **Fora do escopo:** HTTP e UI.
- **Skill `marc-ops`:** `src/core/marc-ops-skill.ts` ganha, depois do passo do `memory_recall`, a seguinte orientação:
  - usar `memory_deep` com `threadId` quando o recall apontou uma thread fechada e falta detalhe, antes de ler o `CHAT.md` inteiro;
  - usar sem `threadId` para evidência por trecho;
  - tratar resultados de chat como intermediários.

  O `SKILL.md` gerado é atualizado pelo `workspace_update_recommendations`, nunca editado à mão.
- **ADR 0013:** registra o `memory_deep`, os dois modos e o B = 232 como orçamento avaliado nesta etapa.

## Mudanças em relação à revisão 3

| Revisão 3 | Revisão 4 | Motivo |
|---|---|---|
| `groupBand` "do modelo da E3" | `memoryBandOf(eligibility)` do grupo, só no modo sem escopo | A E3 não adotou modelo de faixa; as faixas são a heurística da ADR 0011 |
| Pré-filtro de 60 trechos por cosseno | Teto B = 232, por cosseno, só acima dele | 232 é o orçamento da E3 dentro de 1,2 × M0; o corte de 60 é o regime que perdeu a evidência na E3 |
| Mediana ≤ 5 s | Mediana ≤ 1,2 × M0 na mesma execução; 5 s informativo | Decisão do humano de 2026-10-27 |
| Uma busca com escopo | Dois modos: com escopo, e sem escopo pelo pool da depth 2 | O modo sem escopo reaproveita os pares da depth 2 e herda a admissão e a faixa |
| `sourceTypes` antes da pontuação | Com escopo, antes; sem escopo, só na saída | Filtrar o pool sem escopo mudaria a eligibility |
| "Thread aberta" pela resolução atual | Checagem de `SUMMARY.md` e do manifest no core | A `resolveThreadId` só confere o `CHAT.md` e vive em `src/mcp` |
| `nextActions` com `rule` → "arquivo de regras" | `rule` aponta `sourcePath` e as linhas | Documentos normativos também são `rule` |
| Casos `deep` no `marc.json` | Dataset e corpus `marc-deep` separados | Evita mudar o captureId da E0 a E3, a cobertura por thread e `missingTargetRule` |
| Recuo `ordering`: remover o pré-filtro | Classes `segmentation`, `cap`, `ordering` e `admission/pool`, com destino pré-declarado | Separa o corte do teto da ordenação do modelo |
| Escopo de escrita sem store nem resolução | Inclui store, `recall-hits.ts`, resolução no core, testes do catálogo MCP e ADR 0013 | Exigido pelo desenho |

## Mudanças em relação à proposta original da `f04c7cae`

| Proposta original | Agora |
|---|---|
| Snapshot de índice separada | O mesmo índice por camadas da E1 e da E3 |
| Três ferramentas (`memory_deep_status`, `memory_deep_rebuild`, `memory_deep_recall`) | Só `memory_deep`. Status e rebuild são os da memory |
| `minScore` | Removido. A confiança vem de `groupBand` no modo sem escopo |
| Modelo `paraphrase-multilingual-MiniLM` | Modelos atuais (D8) |
| Sem documentos externos | Documentos configurados (D5) entram como `sourceType: "document"` |

## Escopo de escrita autorizado

| Caminho | Uso |
|---|---|
| `src/core/memory/deep.ts` (novo) | Os dois modos, `rankScopePassages` e `rankDepthPoolPassages` |
| `src/core/memory/types.ts`, `lancedb-store.ts`, `lancedb-store-support.ts`, `store.ts` | Filtro `threadId` em `readRows` |
| `src/core/memory/recall-hits.ts` | Exportar `memoryReferenceOf` (aditivo) |
| `src/core/thread-resolution.ts` (novo), `src/mcp/thread-resolution.ts` (re-export) | Resolução de thread no core |
| `src/core/memory/index.ts`, `src/core/workspace-memory.ts`, `src/mcp/memory-tools.ts`, `src/cli.ts`, `src/core/marc-ops-skill.ts` | Exposição e skill |
| `scripts/memory-eval/**` | Dataset, captura, `deep-run.ts`, `deep-worksheet.ts` e `deep-latency.ts` |
| `test/**` | Testes |
| `docs/memory.md`, `docs/mcp-tools.md`, `docs/adrs/0013-*.md`, `docs/adrs/README.md` | Documentação |

**Exclusões:** `semantic-ranking.ts`, `hybrid-ranking.ts`, `operations.ts`, `scoring/**`, `src/ui/**`, `src/daemon/**`, `.marc/memory/**` e `pnpm-lock.yaml`.

## Avaliação

### Dataset e corpus

- `scripts/memory-eval/datasets/marc-deep.json` e `marc-deep.corpus.json`, registrados como corpus `marc-deep` em `CORPORA` (`cli.ts:161`), com os mesmos caminhos de threads, regras e settings do marc.
- O corpus fixa as threads fechadas na data em que os casos são escritos, incluindo a E3. Nada muda nas capturas e relatórios da E0 a E3.
- **`dataset.ts`:**
  - estilo `"deep"` em `EvalCaseStyle`;
  - os campos `scope?: { threadId?: string; sourceTypes?: MemorySourceType[] }` e `passageJudgments?: Record<passageId, RelevanceGrade>`;
  - `deep` entra em `EVIDENCE_STYLES` e fica isento de `missingTargetRule`.
- **Regras novas:**
  - `scope-only-deep`;
  - `scope-thread-not-closed`;
  - `scope-source-types-invalid`;
  - `deep-evidence-outside-scope`: a evidência de um caso com escopo deve pertencer ao grupo do escopo;
  - `passage-grade-out-of-range`;
  - `passage-judgment-unknown-source`.
- **Fingerprint:** `queryFingerprintCases` inclui `scope` só quando definido, para que marc e ledgerline mantenham o captureId (com teste).

### Casos (aprovadores)

São 14 casos com `style: "deep"`, `evidence` (citação literal do trecho que responde) e `scope`:
- as 4 consultas originais, sem escopo:
  1. "por que a rotação de token não foi implementada?";
  2. "quais regras definem organização das informações na UI?";
  3. "qual foi o raciocínio para indexar apenas summaries na memory v1?";
  4. "quais regras operacionais dizem para preservar Markdown como fonte da verdade?";
- 10 casos novos com `threadId`. Pelo menos 6 deles têm a resposta numa seção específica, em threads em que outros trechos tratam do assunto só de forma incidental;
- estratificação pré-declarada por tamanho da thread: pelo menos 2 threads abaixo da mediana (31 trechos) e pelo menos 2 acima de 120;
- **ramo truncado:** pelo menos 1 caso com escopo com **mais de B = 232 trechos elegíveis depois de `sourceTypes`**. Os candidatos no índice atual são `57488bab` (597) e `cd4a49b8` (502). O relatório deep lista `scopePassages` por caso; sem esse caso, o protocolo fica incompleto e o gate não é aplicado. Isso não muda a meta de 12/14 nem o tamanho do dataset.

Os escopos são escritos junto com os casos, antes da captura, e nunca derivados dos resultados do recall ou do deep.

### Entradas da medição de latência (pré-registradas)

| Caminho | Consultas | Campos enviados | Referência M0 |
|---|---|---|---|
| Deep com escopo | As 10 consultas com escopo | `query`, `queryMode`, `threadId` e `sourceTypes` exatamente como no caso | M0 das mesmas 10 consultas |
| Deep sem escopo | As 14 consultas | `query` e `queryMode`; `threadId` e `sourceTypes` removidos | M0 das mesmas 14 consultas |
| M0 | As 14 consultas | `query` e `queryMode`, em depth 0 na cópia só com a camada 0, ordem `input` | — |

- As medianas de referência saem das amostras do M0 da mesma execução, filtradas pelas consultas de cada caminho.
- A igualdade de pares é com o replay **do próprio caminho**, não entre o deep e o M0. Por isso a captura do marc-deep inclui o pool da depth 2 das 14 consultas.
- A qualidade do modo sem escopo continua julgada só nos 4 casos sem escopo; as outras 10 execuções sem escopo servem só à latência e não exigem julgamento.

### Captura

- `kMax` vira parâmetro de `scopeRecordIdsOf`, no lugar do literal `E3_K_MAX` (`capture-plan.ts:77`). O marc-deep usa `kMax: 0`. O kMax entra no fingerprint quando difere de 30, como as camadas.
- O escopo dos grupos (`evidence ∪ scope.threadId`) já recebe todos os trechos por `matrixScope`, inclusive acima de B, o que permite o diagnóstico `DEEP_ALL`.
- O modo sem escopo só precisa do pool da depth 2, que já está no escopo.
- Custo estimado de cerca de 20 minutos.

### Replay

`scripts/memory-eval/deep-run.ts` é novo e fica fora do registro de métricas por thread, no padrão de `survivalOf`. A tabela `DEEP_VARIANTS` tem três variantes:

| Variante | Como ordena | Papel |
|---|---|---|
| `DEEP` | `rankScopePassages` ou `rankDepthPoolPassages` do core, com reranker em cache | Variante avaliada |
| `DEEP_ALL` | Como `DEEP`, com B = ∞ | Diagnóstico do teto, sem pares novos |
| `DEEP_COSINE` | Só o cosseno, no mesmo escopo e nos mesmos grupos admitidos | Referência |

O erro de par ausente do reranker em cache vira `incomplete`.

### Julgamento por trecho

- A célula é `passage:<passageId>` em `judgments.ts` (`cellKeyOf`, `cellOf`, `parseRater`, `gradeOfCell`, `withCellGrades`). `serializeDataset` ordena e só escreve `passageJudgments` quando presente, e marc e ledgerline continuam idênticos byte a byte.
- **`deep-worksheet.ts`:** mostra a **união dos 5 primeiros trechos de `DEEP`, `DEEP_ALL` e `DEEP_COSINE`** ainda sem julgamento, em ordem de `passageId`, com `sourcePath`, `sectionTitle` e o texto completo, sem score, posição nem variante.
  - Se houver recuo para B', a worksheet roda de novo e acrescenta os 5 primeiros novos da configuração `DEEP(B')`, com o mesmo cegamento.
  - **Grau ausente nunca vale zero.** Uma variante com algum dos seus 5 primeiros sem grau fica `incomplete` naquele caso, e nenhuma classe de falha é decidida enquanto a cobertura não estiver completa.
- A escala é a da E0, aplicada à pergunta "este trecho responde à consulta?".
- O avaliador a e o avaliador b julgam separadamente, e o `merge-judgments --corpus marc-deep` grava os trechos com kappa.

### Métricas

- **Success@5:** pelo menos um trecho de grau ≥ 2 entre os 5 primeiros.
- **Diagnóstico:** MRR@5 e P@5.
- **Conformidade de escopo:** com escopo, todo resultado respeita `threadId` e `sourceTypes`; sem escopo, todo resultado é de grupo admitido.
- Também: incompletos por variante (par ausente ou grau ausente), pares por caso, `scopePassages` por caso, quantos dos 5 primeiros têm score saturado, diferenças entre `DEEP` e `DEEP_ALL`, e a classe de cada falha.

## Tarefas

| Passo | Responsável | Entrega | Checks |
|---|---|---|---|
| T1 | desenvolvedor | Resolução no core, filtro do store, `memoryReferenceOf`, `deep.ts`, MCP, CLI e testes | `validate`, `build` e `test`; testes de recall existentes sem edição; replay M0/DEPTH2 das capturas E3 congeladas idêntico antes e depois; `marc memory deep` manual no índice de produção, com e sem escopo |
| T2 | desenvolvedor | Schema e regras do dataset, corpus marc-deep, kMax, células de trecho, `deep-run.ts` e `deep-worksheet.ts`. **Entrega 1** | Testes de harness, `validate`, `build` e `test` |
| Casos | aprovadores | 14 casos com evidência e escopo | `validate --corpus marc-deep` limpo |
| Captura e julgamento | desenvolvedor e aprovadores | Captura (com o pool da depth 2 das 14 consultas), worksheet da união `DEEP` ∪ `DEEP_ALL` ∪ `DEEP_COSINE`, avaliadores a e b, merge e relatório deep | Captura completa, zero incompletos, cobertura completa dos 5 primeiros das três variantes, ao menos 1 caso com `scopePassages` > B |
| Decisão | aprovadores | Critérios aplicados, publicados e coaprovados (D10 quando o critério mandar) | — |
| T3 | desenvolvedor | `deep-latency.ts`, skill, docs, ADR 0013 e `workspace_update_recommendations`. **Entrega 2** | JSON do gate com as entradas por caminho; `validate`, `build` e `test` |
| Reavaliação (só se houver) | desenvolvedor e aprovadores | Configuração congelada (D10 ou B'), replay, worksheet dos novos 5 primeiros, julgamentos, latência | Critério 5 inteiro sobre a configuração final |
| Final | principal | `revisao-final-e4.md`, coaprovação do Codex e aceitação do humano | — |

## Critérios de aceite

1. 100% dos resultados dentro do escopo, no replay e nos testes.
2. **Utilidade:** Success@5 de `DEEP` em pelo menos **12 dos 14** casos, sem incompletos. Cada falha é classificada uma vez, mecanicamente, **na ordem de precedência da tabela** (a primeira condição verdadeira decide):

   | Ordem | Classe | Condição | Variante de referência | Destino |
   |---|---|---|---|---|
   | 1 | `segmentation` | A citação é `evidence_unindexable` | — | Registrar como limite de normalização da E1 e levar à D10 |
   | 2 | `admission/pool` | Só sem escopo: o grupo da evidência não foi admitido, ou nenhuma passagem da evidência (identificada por `passageId` pelo casamento da citação na captura) está entre os 3 densos consolidados do grupo. A condição é mecânica e não usa graus: passagem sem grau nunca é presumida irrelevante | `DEEP` | D10 |
   | 3 | `cap` | Só com escopo truncado: `DEEP` falha e `DEEP_ALL` passa | `DEEP_ALL` | D10, com os dois números: qualidade (B = ∞) ou o gate de latência |
   | 4 | `ordering` | As demais falhas: mesmo sem teto (`DEEP_ALL`), nenhum trecho de grau ≥ 2 fica entre os 5 primeiros | `DEEP_ALL` | Estudo de modelos, sem ajuste fino em 14 casos |

   - Quando a evidência ficou fora do teto **e** `DEEP_ALL` também falha, a classe é `ordering`, e o relatório marca `alsoTruncated: true`. As duas perdas ficam visíveis, sem forçar `cap`.
   - Um caso com grau ou par ausente é `incomplete` e não recebe classe; julgamento ausente nunca é falha do modelo.
3. Sem escopo, nenhum trecho de grupo não admitido aparece (teste).
4. **Latência:** medida por `deep-latency.ts`, que reaproveita `runLatencyE2e` com `instrumentedProviders` e `probedRecall` exportados mais um `probedDeep`.
   - Entradas e referências conforme "Entradas da medição de latência", na máquina de referência, com 1 aquecimento e 3 medições por caminho, intercaladas por caso.
   - Cada mediana do deep fica em até 1,2 × a mediana do M0 **das mesmas consultas**. O p95 e a referência de 5 s são reportados. Os pares de cada caminho são iguais aos do replay desse caminho.
   - **Recuo B'** (só para o modo com escopo, porque o modo sem escopo não tem orçamento):
     - `M0` é a mediana do M0 das 10 consultas com escopo, em ms;
     - `overhead` é a mediana, nas amostras com escopo, de (latência total − tempo do reranker), em ms. A interpretação e o embedding entram uma vez só, porque estão fora do tempo do reranker;
     - `r` é Σ pares ÷ Σ segundos de reranker, nas amostras com escopo, em pares por segundo;
     - B' = ⌊((1,2 × M0 − overhead) ÷ 1000) × r⌋, um inteiro de pares, todos os valores da mesma execução;
     - B' só é válido se 1 ≤ B' < 232. Se não for, a E4 reporta falha de latência ao humano com os números, sem criar teto inválido.
   - Falha de latência do modo sem escopo vai à D10 com os números, sem recuo.
5. **Configuração final e reavaliação única:**
   - A configuração adotada é congelada e precisa passar, **ao mesmo tempo**: Success@5 ≥ 12/14, zero incompletos, conformidade de escopo e os dois gates de latência.
   - A E4 tem **no máximo uma reavaliação**, consumida pelo primeiro destes eventos: a escolha D10 depois de uma falha de qualidade, ou o recuo B' depois de uma falha de latência.
   - A reavaliação refaz, sobre a nova configuração: o replay de qualidade, a worksheet com os 5 primeiros novos (B1), os julgamentos a e b com merge, a conformidade de escopo e a latência. A aprovação de B = 232 não se transfere para B'.
   - Se qualquer gate falhar na reavaliação, a E4 reporta a falha ao humano com os números. Não há segunda tentativa.
6. `pnpm validate`, `pnpm build` e `pnpm test` passam, com as regras de estilo e de teste.
7. Docs e ADR 0013 escritos. A ADR registra o orçamento como decisão específica do deep, condicionada a estes resultados, e não como adoção do funil rejeitado pela E3. O `SKILL.md` foi regenerado pelo `workspace_update_recommendations` e revisado como mudança de harness.

## Testes declarados

- **Paridade (P1):** `rankDepthPoolPassages(...).ranked` profundamente igual a `rankHybridMemoryCandidates`. O reranker de gravação deve receber os mesmos documentos na mesma ordem, nos casos de empate, de grupo só com identity e de hit só lexical.
- **Com escopo:**
  - só a thread e os tipos pedidos, nunca a identity;
  - ordem e desempate;
  - `rerankPairs` igual ao tamanho do escopo quando ≤ B; com 233 trechos, exatamente B escolhidos por cosseno e `scopeTruncated`.
- **Limites:** padrão 5, 20 aceito, 21 rejeitado.
- **Erros:** thread aberta (com a mensagem exata), inexistente, sufixo ambíguo, inválida, `thread_not_indexed`, e `rules` ou `document` com `threadId`.
- **Sem escopo:**
  - um grupo não admitido com score alto fica fora;
  - `groupBand` igual à faixa do recall em depth 2;
  - pares iguais aos da depth 2;
  - `sourceTypes` muda só a saída.
- **Saída:**
  - `nextActions` das 5 autoridades, incluindo documento normativo, e o prefixo stale;
  - `reference` igual à do recall;
  - dedupe por `passageId`.
- **Store:** `readRows({ threadId })` no Lance e em memória, inclusive com aspas no id.
- **Resolução de thread:** testes do core para a função movida. `test/mcp-thread-resolution.test.ts` passa sem edição.
- **Transportes:**
  - zod rejeita limite 21 e tipo desconhecido;
  - erro de thread volta com o código, e não como `internal_error`;
  - a CLI interpreta `--thread`, `--source-types` e `--limit` e exige `--query`;
  - atualizar `test/mcp.test.ts` (26 ferramentas), `test/mcp-memory.test.ts` e `test/core-recommendations-bootstrap.test.ts`.
- **Harness:**
  - regras do dataset e estabilidade do fingerprint;
  - chave de trecho no round-trip, e merge gravando `passageJudgments`;
  - serialização idêntica byte a byte do marc e do ledgerline;
  - worksheet cega, só com trechos sem julgamento e ordenada, cobrindo a união das três variantes e, no recuo, os 5 primeiros de `DEEP(B')`;
  - grau ausente deixa a variante `incomplete` no caso, nunca grau zero;
  - escopo com kMax 0 incluindo todos os trechos do grupo do escopo;
  - replay em cache igual ao core numa fixture;
  - par ausente → incompleto;
  - métricas calculadas à mão;
  - `admission/pool` decidido pela passagem da evidência por `passageId`, inclusive com uma passagem do pool sem grau e fora de todos os Top5, que não produz a classe;
  - cada classe de falha, a precedência entre elas e o caso `alsoTruncated` (evidência fora do teto e `DEEP_ALL` também falhando → `ordering`);
  - aritmética do gate de latência por caminho, com a referência M0 filtrada pelas mesmas consultas;
  - fórmula de B' com unidades, incluindo o caso sem orçamento válido (B' ≤ 0 ou B' ≥ 232 → falha reportada).
- **Inalterados:** os testes de `core-memory-recall`, `core-memory-depth-production` e de ranking semântico e híbrido continuam sem edição.

## Riscos

- **Latência no limite de cerca de 22 s** nos casos em threads acima de B: coberta pelo recuo B', pela estratificação e pelo caso obrigatório no ramo truncado. B = 232 vem de uma medição anterior e não garante latência para qualquer thread ou comprimento de trecho.
- **Saturação do score perto de 1:** o desempate é pré-declarado, e o relatório mostra quantos dos 5 primeiros estão saturados.
- **Aspas no filtro do Lance:** coberto por teste.
- **`passageId` depende da segmentação:** uma mudança futura na E1 deixa julgamentos órfãos. A validação confere os ids contra a captura.
- **Lock de até cerca de 22 s por chamada com escopo:** igual ao da depth 2 hoje.
- **Sucesso sem escopo limitado pela admissão e pelos 3 trechos densos por grupo:** a classe `admission/pool` torna isso visível.
- **Agentes usando `memory_deep` no lugar do `memory_recall`:** a skill e a descrição da ferramenta orientam a ordem.

## Pendências antes do dispatch

- Coaprovação de marc://@codex-software-architect sobre esta revisão 4.1 (fechamento de B1 a B3).
- **Desenvolvedor:** claude-dev, com Haiku 5.5 em xhigh, a configuração já confirmada pelo humano. Modo sequencial, com um desenvolvedor.

## Histórico de revisões

- **Revisão 2 (2026-10-15):** incorpora a revisão de marc://@codex-software-architect. A avaliação passa a julgar cada trecho devolvido, e os 14 casos `deep` ganham critério de aceite (Success@5 em pelo menos 12 de 14).
- **Revisão 3 (2026-10-15):** a chave de `passageJudgments` passa a ser o `passageId` da E1, baseado no conteúdo. O hit ganha `passageId`.
- **Revisão 4 (2026-10-27):** alinha o plano à E1 a E3 e à decisão de latência do humano (qualidade primeiro, 1,2 × M0). Entram os dois modos, B = 232 com cosseno só acima do teto, `groupBand` pela ADR 0011 só sem escopo, checagem de thread fechada e indexada no core, dataset `marc-deep` separado, classes de falha com destino pré-declarado e escopo de escrita ampliado. As métricas e a chave por `passageId` aprovadas nas revisões 2 e 3 continuam.
- **Revisão 4.1 (2026-10-27):** incorpora o parecer de marc://@codex-software-architect (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_81b1fbd8207a4ee3a9). B1: a worksheet cobre a união de `DEEP`, `DEEP_ALL` e `DEEP_COSINE` e os novos 5 primeiros de um recuo, e grau ausente deixa o caso `incomplete`. B2: a configuração final passa qualidade, completude, escopo e latência ao mesmo tempo; B' tem unidades e domínio válido (1 ≤ B' < 232); há uma única reavaliação para D10 ou recuo; e há ao menos um caso obrigatório acima de B depois de `sourceTypes`. B3: entradas de latência pré-registradas por caminho, com M0 das mesmas consultas. As classes de falha ganham precedência, variante de referência e a marca `alsoTruncated`. A identity de grupo só com identity é pontuada, mas não sai como trecho. Depois da conferência do Codex (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_52632354b860460da3), `admission/pool` passa a usar a presença da passagem da evidência por `passageId`, e não graus.
