# Plano detalhado - Rebuild incremental e batches limitados da memory

## Contexto confirmado

- O rebuild atual chama `provider.embedDocuments()` uma unica vez com todos os records. O manifesto local registra 35 summaries e 223 chunks.
- A tentativa real falhou no ONNX Runtime ao alocar aproximadamente 2,67 GiB para uma unica operacao `Add`.
- A memory permanece derivada dos `SUMMARY.md` de threads fechadas. Markdown continua sendo a fonte de verdade.
- O health atual esta `stale` com 36 summaries encontradas e 35 indexadas. A UI apresenta o estado degradado depois da falha.
- `memory_recall` nao sera usado como fonte de planejamento nesta etapa porque o indice esta stale e a consulta poderia carregar o modelo. A thread, o manifesto e o codigo atual foram lidos diretamente.

## Decisoes de fluxo

### Automatico

- O daemon executa somente reconciliacao `incremental`.
- Com memory `missing` ou `stale`, modelo preparado e auto rebuild habilitado, ele inicia a reconciliacao incremental.
- Com memory `degraded`, ele nao retenta automaticamente. O erro permanece visivel ate uma acao manual.
- `model_missing` e `incompatible` nao iniciam job automatico.
- Quando o processo do daemon reinicia, o health volta a ser calculado a partir da fonte e do manifesto, como no comportamento atual.

### Manual

- UI e MCP aceitam os modos `incremental` e `full`.
- O default de toda chamada manual e `incremental`.
- `full` exige o modo explicito e reprocessa todos os chunks para substituir a projecao vetorial e o manifesto.
- Os dois modos usam o mesmo executor limitado e o mesmo lock global por workspace.
- Um job ja ativo continua bloqueando outro job. O segundo solicitante recebe o estado `rebuilding`, sem fila e sem trabalho duplicado.

## Implementacao

1. Introduzir o tipo interno `MemoryRebuildMode` com `incremental` e `full`, usando dispatch por modo em vez de ramificacoes aninhadas.
2. Criar executor unico de embeddings que recebe records e processa batches sequenciais.
   - Batch default: 4 records.
   - Valores configuraveis: 2 a 16, apenas numeros pares.
   - Um unico batch de inferencia em voo por workspace.
   - Validar que cada batch devolve exatamente um vetor por record e preservar a ordem total.
3. Separar reconciliacao incremental do rebuild completo.
   - Comparar summaries atuais ao manifesto por `sha256`.
   - Adicionar summary: upsert dos chunks novos.
   - Alterar summary: upsert dos chunks atuais e excluir apenas IDs antigos que nao existem mais.
   - Remover summary: excluir seus IDs derivados.
   - Sem delta: nao carregar o modelo nem escrever no LanceDB.
   - Indice ou manifesto ausente: reconciliar os records atuais por upsert e remocao, mantendo o modo incremental sem usar overwrite.
4. Estender o adapter interno do LanceDB com reconciliacao via `mergeInsert(recordId)` e `delete(predicate)`.
   - Gerar todos os embeddings antes de mutar o store.
   - Aplicar upserts, depois remocoes e somente entao escrever o manifesto.
   - Falha de batch preserva indice e manifesto anteriores.
   - Falha de storage nao publica manifesto novo. O health continua stale ou degraded e a proxima reconciliacao permanece idempotente.
5. Manter o rebuild full com o mesmo executor limitado. Ele continua sendo a recuperacao explicita para provider incompativel, dimensao alterada ou suspeita de corrupcao.
6. Garantir `provider.dispose()` no `finally` da operacao de memory, inclusive em erro e lock nao adquirido. Nenhum chamador duplicara essa responsabilidade.

## Contratos

- `POST /api/workspaces/:workspaceId/memory/rebuild` recebera corpo opcional `{ mode: "incremental" | "full" }`. Corpo ausente significa incremental. Nao sera criada rota nova.
- `memory_rebuild` do MCP recebera `mode` opcional com default incremental. `mode: "full"` e a unica forma de iniciar o full via MCP.
- `.marc/marc.config.json` recebera `memory.embeddingBatchSize`.
  - Ausente ou invalido resolve para 4.
  - A atualizacao valida inteiros pares entre 2 e 16.
  - O valor e capturado no inicio de cada job. Uma alteracao durante o processamento vale apenas para o proximo job.
- O health de workspace incluira o batch size configurado para a UI.

## UI

- O atual botao sera `Rebuild incremental`.
- Um novo botao `Rebuild full` executara o modo explicito.
- Os dois botoes permanecem indisponiveis durante prepare ou rebuild.
- O painel recebe Slider oficial do Neobrutalism.
  - Controlado por estado local.
  - `min=2`, `max=16`, `step=2`.
  - `onValueChange` atualiza apenas a tela.
  - `onValueCommit` persiste uma vez.
- O indicador existente conserva a sequencia `degraded` para `rebuilding` para `ready` depois de um job manual bem-sucedido.

## Testes e validacao

- Executor: tamanho maximo, ordem, cardinalidade invalida e dispose.
- Reconciliacao: inclusao, alteracao, remocao, indice ausente, no-op e falha em batch.
- Full: todos os chunks em batches e manifesto coerente.
- Lock: automatico incremental, manual incremental e manual full nao executam em paralelo.
- MCP e HTTP: default incremental e full somente explicito.
- Settings e UI: JSON, faixa permitida, Slider controlado, commit unico e botoes por modo.
- Health: degraded nao agenda retry automatico. Acao manual transita para rebuilding e sucesso para ready.
- Documentacao: atualizar os contratos em `docs/memory.md`, `docs/mcp-tools.md` e `docs/ui-and-daemon.md`.
- Encerramento: executar `pnpm run validate`, `pnpm test` e `pnpm build`. A validacao visual usara `$playwright-cli` pelo Bash/context-mode, sem MCP de navegador.

## Referencias

- marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- marc://$oportunidade-status-health-e-rebuild-da-memory-d540c6b4
- marc://$oportunidade-coordenacao-global-de-rebuild-memory-774d1e99
- marc://$oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac
