# Oportunidade - Encerramento de threads por SUMMARY e índice JSON

Thread: `oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a`
Created: `2026-05-01T03:36:33.951Z`

<!-- marc-message
id: msg_f901a68def7d46c196
threadId: oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
timestamp: 2026-05-01T03:37:09.151Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-encerramento-summary-indice-json.md
-->

Oportunidade registrada:

- Tema: encerramento de threads por `SUMMARY.md`.
- Regra: presença do summary fecha; remoção reabre.
- Índice: usar JSON derivado em `.marc/cache/thread-index.json`, com adapter para possível SQLite futuro.
- UI: lista principal mostra abertas; área closed/arquivo mostra fechadas por `closedAt desc`.
- Benchmarks: arquivos `.benchmark.mjs` em `/performance`, rodando via `pnpm test:benchmark`.
- Detalhes completos: `artifacts/oportunidade-encerramento-summary-indice-json.md`.

<!-- /marc-message -->

<!-- marc-message
id: msg_70c5826d10364140a1
threadId: oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
timestamp: 2026-05-01T04:04:11.298Z
agentId: codex-dev
role: developer
-->

Implementação realizada:

- Core: `SUMMARY.md` agora determina thread fechada; remoção reabre.
- Índice: criado cache derivado em `.marc/cache/thread-index.json` com adapter JSON e reconciler.
- Listagem: `listThreads` aceita `status: open | closed | all` e ordena abertas/fechadas conforme combinado.
- API/MCP: daemon aceita `?status=...`; `thread_list` aceita filtro opcional `status`.
- UI: lista principal mostra abertas; seção Closed mostra encerradas; detalhe renderiza `SUMMARY.md` como Executive Summary.
- Benchmark: adicionado `/performance/thread-index.benchmark.mjs` e script `pnpm test:benchmark`.

Validação:

- `pnpm typecheck` passou.
- `pnpm test` passou: 12/12.
- `pnpm build` passou.
- `dist` validado com 12 tools MCP canônicas e `thread_list.status` presente.

Observação: não executei o benchmark completo; ficou para você rodar e me passar os resultados.

<!-- /marc-message -->

<!-- marc-message
id: msg_2d254c2ad4dc455f8d
threadId: oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
timestamp: 2026-05-01T04:58:19.558Z
agentId: codex-dev
role: developer
artifacts: artifacts/thread-index-benchmark-results.md
-->

Resultado do benchmark anexado:

- Arquivo: `artifacts/thread-index-benchmark-results.md`.
- Warm list ficou estável em ~26-31 ms até 10k threads.
- Scan direto/cold rebuild ficaram próximos em volumes altos.
- Rebuild 10x chegou a ~24s em 5k/10k, então faz sentido rodar rebuild pesado em background.
- Próxima oportunidade relacionada: status/health por módulo via MCP para indicar índice/rebuild em andamento.

<!-- /marc-message -->

<!-- marc-message
id: msg_e5c2a354c9a7405cbf
threadId: oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
timestamp: 2026-05-01T05:26:04.593Z
agentId: codex-dev
role: developer
-->

Correção complementar tratada: a UI agora não renderiza mais a seção `Closed` fixa junto da lista aberta. O botão de arquivo alterna para a lista de encerradas, threads fechadas ficam taxadas, e a lista aberta filtra defensivamente qualquer item com `status: closed`. O `SUMMARY.md` segue acessível no painel `Executive Summary` ao selecionar a thread encerrada. Validações: `pnpm typecheck`, `pnpm test` e `pnpm build` passaram.

<!-- /marc-message -->

<!-- marc-message
id: msg_35bf2951ec3c4f6887
threadId: oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
timestamp: 2026-05-01T05:37:44.934Z
agentId: codex-dev
role: developer
-->

Ajuste adicional aplicado na UI: o botão de arquivo agora fica alinhado à direita por grid no header da lista, troca para ícone `X` ao entrar no modo `Closed`, e a classificação local usa `status`, `closedAt` e `summaryPath`. A lista aberta remove qualquer thread que também esteja no conjunto fechado, evitando duplicidade como `ce47939a`. Validações: `pnpm typecheck`, `pnpm test` e `pnpm build` passaram.

<!-- /marc-message -->

<!-- marc-message
id: msg_fc7d5c77b9414ccf9b
threadId: oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
timestamp: 2026-05-01T05:49:27.812Z
agentId: codex-dev
role: developer
-->

Correção de regressão aplicada: o header de `Threads` recebeu a classe de layout correta para manter o botão de arquivo no extremo direito, enquanto `Workspaces` voltou ao layout normal. Corrigi também a escrita concorrente do `.marc/cache/thread-index.json`: saves agora são serializados por caminho e usam arquivo temporário único, eliminando colisões `ENOENT/EPERM`. O watcher do daemon passou a ignorar alterações em `.marc/cache`, evitando loop de refresh entre cache -> evento -> front -> cache. Adicionado teste `handles concurrent thread index rebuilds`. Validações: `pnpm typecheck`, `pnpm test` (13/13) e `pnpm build` passaram.

<!-- /marc-message -->

<!-- marc-message
id: msg_6746bf51eaf548c681
threadId: oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
timestamp: 2026-05-01T06:08:17.198Z
agentId: codex-dev
role: developer
-->

Polimento final aplicado: no header da thread, os badges agora ficam em coluna alinhada à direita, com `Synced` acima e `Closed` abaixo. Bundle atualizado. Validações: `pnpm typecheck` e `pnpm build` passaram.

<!-- /marc-message -->
