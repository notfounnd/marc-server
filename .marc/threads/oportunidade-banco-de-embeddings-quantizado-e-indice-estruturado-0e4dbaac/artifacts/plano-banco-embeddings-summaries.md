# Plano - Banco de Embeddings de `SUMMARY.md` das Threads mARC

## Resumo

Implementar uma memoria historica compartilhada do mARC baseada exclusivamente nos `SUMMARY.md` das threads. O mARC continua sendo o harness/chat de coordenacao; este recurso adiciona uma infraestrutura auxiliar de recuperacao semantica para agentes descobrirem decisoes ja registradas antes de propor ou desenvolver mudancas.

A execucao deve comecar anexando este plano como artifact na thread `oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac` e postando um comentario curto em pt-BR. So depois iniciar codigo.

## Decisoes

- Fonte de verdade: `.marc/threads/*/SUMMARY.md`.
- Banco commitado: `.marc/memory/`, com LanceDB, manifesto e indice estruturado dos summaries.
- Cache local nao commitado: `.marc/cache/memory-models/`, para o modelo de embedding.
- Encoder v1: local/offline via adapter `EmbeddingProvider`; implementacao inicial com Transformers.js e modelo multilingue leve compativel com Node/CPU.
- Sem API externa na v1; `memory_prepare` pode baixar o modelo uma vez, mas summaries nao sao enviados a servicos remotos.
- Rebuild explicito: `memory_status` detecta stale; `memory_rebuild` atualiza banco e manifesto.
- Sem carregar modelo no bootstrap; carregar apenas em `memory_prepare`, `memory_rebuild` e `memory_recall`, liberando referencia apos operacao ou usando TTL curto no MCP persistente.

## Mudancas

- Criar nucleo `src/core/memory/` com:
  - scanner de `SUMMARY.md`;
  - parser por thread e secoes Markdown;
  - `EmbeddingProvider` interface;
  - `LocalEmbeddingProvider`;
  - `MemoryIndexStore` para LanceDB;
  - manifesto com schema, provider, dimensao, distancia, modelo, hashes dos summaries e status de indice.
- Criar tools MCP:
  - `memory_prepare`: prepara/valida modelo local.
  - `memory_status`: informa pronto/stale/modelo ausente, sem carregar modelo.
  - `memory_rebuild`: reconstrói `.marc/memory` a partir dos summaries.
  - `memory_recall`: recebe intencao da tarefa e retorna “memory pack” com threads relevantes, trechos de summary, score, motivo e referencias mARC.
- Adicionar CLI equivalente para humano/CI:
  - `marc memory status`
  - `marc memory prepare`
  - `marc memory rebuild`
  - `marc memory recall --query "..."`
- Atualizar `workspace_status` para incluir saude da memoria.
- Atualizar `src/core/marc-ops-skill.ts` para orientar agentes a chamar `memory_recall` antes de propor/desenvolver quando houver tarefa de mudanca; se houver match forte, ler a thread original antes de agir.
- Atualizar docs em en-US explicando:
  - `SUMMARY.md` como fonte;
  - `.marc/memory` como derivado commitado;
  - `.marc/cache/memory-models` como cache local;
  - fluxo prepare/status/rebuild/recall;
  - quando rodar rebuild apos fechar/alterar summaries.

## Contratos

- `EmbeddingProvider`:
  - `describe(): EmbeddingProviderMetadata`
  - `embedDocuments(texts: string[]): Promise<number[][]>`
  - `embedQuery(text: string): Promise<number[]>`
  - futuras implementacoes entram atras dessa interface, sem alterar `memory_rebuild`/`memory_recall`.
- `memory_recall` entrada:
  - `query: string`
  - `limit?: number`
  - `minScore?: number`
  - `bootstrapConfirmed?: boolean`
- `memory_recall` saida:
  - `query`
  - `indexStatus`
  - `results[]` com `threadId`, `title`, `closedAt`, `summaryPath`, `reference`, `matchedText`, `score`, `reason`
  - `nextActions[]`, incluindo ler thread quando match for forte.
- Manifesto:
  - `schemaVersion`
  - `builtAt`
  - `embeddingProvider`
  - `model`
  - `dimensions`
  - `distance`
  - `records[]` com `threadId`, `summaryPath`, `sha256`, `mtimeMs`, `recordIds`.

## Fluxo Operacional

- Ao fechar/alterar uma thread com `SUMMARY.md`, agente/humano roda `memory_status`.
- Se stale, roda `memory_rebuild`.
- Banco e manifesto em `.marc/memory` entram no commit junto com o summary.
- Ao iniciar tarefa de desenvolvimento, agente faz bootstrap normal e chama `memory_recall` com a intencao da tarefa.
- Se `memory_recall` apontar decisoes historicas relevantes, agente le a thread referenciada e discute com o humano antes de reabrir ou contrariar decisao anterior.
- Se modelo local faltar, `memory_recall` instrui rodar `memory_prepare`; nao tenta download silencioso.

## Testes

- Unit tests para scanner/parsing:
  - ignora threads sem `SUMMARY.md`;
  - extrai `threadId`, titulo, `Closed`, secoes e texto normalizado;
  - preserva referencias mARC.
- Unit tests para manifesto:
  - detecta indice atual;
  - detecta stale por hash/mtime;
  - detecta mudanca de provider/schema/dimensao.
- Unit tests com `FakeEmbeddingProvider`:
  - `memory_rebuild` cria registros deterministicos;
  - `memory_recall` retorna thread correta para consulta parecida;
  - erro claro quando modelo/provider indisponivel.
- MCP tests:
  - tools exigem `bootstrapConfirmed`;
  - `memory_status` nao carrega provider;
  - `memory_recall` retorna next actions e referencias.
- Validacao final:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`
  - inspecao de tools MCP registradas em `dist/mcp/server.js`.
  - `workspace_audit` preflight antes do comentario final na thread.

## Assumptions

- A v1 usa so `SUMMARY.md`; `CHAT.md`, artifacts, docs e regras ficam fora do banco de embeddings.
- O modelo local nao sera commitado.
- `.marc/memory` sera commitado como derivado reconstruivel.
- `.marc/cache` continua ignorado e pode armazenar modelo/cache local.
- Codigo e docs do produto ficam em en-US; thread, plano operacional e comentarios ficam em pt-BR.
- Implementacao deve manter guard clauses com early return, sem `else` e sem `if` aninhado.
