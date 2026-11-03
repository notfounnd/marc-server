# Entrega da F1: marc wait manual e reconciliador

Autor: marc://@claude-dev (perfil compartilhado de desenvolvedor). Revisão integrada do principal: pendente.

## Escopo

Implementação da F1 conforme o plano aprovado (`plano-f1-nucleo-e-marc-wait.md`), com as decisões do principal de 03/11/2026: reuso sem o grafo de memória, `import()` dinâmico em `src/cli.ts`, testes de fecho transitivo e skill sem regeneração das cópias.

## Arquivos novos

- `src/core/thread-mentions.ts` (110 linhas): `mentionsProfile`, `architectChainLength`, `reconcileMentions`. Reaproveita `messageReferences` e `removeFencedMarkdownCode` de `src/core/audit/messages.ts`.
- `src/core/thread-wait.ts` (140 linhas): laço `waitForMention` com a classe `WaitLoop`. Observador ligado antes da primeira reconciliação, consulta periódica de 2 s, prazo, abort e reconciliações serializadas.
- `src/core/thread-wait-runtime.ts` (68 linhas): dependências reais. `workspaceInfoFor` monta o `WorkspaceInfo` sem importar `workspace.ts`. `createWaitRuntimeDeps` usa `inspectThreadFiles` de `thread-summary-paths.ts`, que está limpo, para o caminho do `SUMMARY.md`.
- `src/cli-wait-command.ts` (258 linhas): entrada, validação, tabelas de código e de `next`, trava de sessão, sinais SIGINT e SIGTERM, e uma linha JSON.
- `src/mcp/listening-command.ts` (64 linhas): `buildWaitCommand`, `posixQuote` e `currentWaitRuntime`, que lê só `argv[1]`.

## Arquivos alterados

- `src/cli.ts` (258 linhas): despacho de `wait` (linha 227) e linha de uso (linha 67). Os imports de daemon, MCP, memória e `cli-memory-command` viraram `import()` dinâmico dentro dos handlers (linhas 77, 94, 114, 123, 152, 236). O topo tem um único import de valor, `cli-wait-command`.
- `src/mcp/helper.ts` (291 linhas): tópico `listening` (linha 16), guia (linha 228), `TOPIC_EXTRAS` que gera `command` (linha 256) e `marcHelper(topic, context)` (linha 267).
- `src/mcp/workspace-tools.ts` (142 linhas): `marc_helper` passa o contexto do servidor (linhas 34 a 36).
- `src/core/marc-ops-skill.ts` (131 linhas): seção `## Listening for Mentions` antes de `## Audit Discipline` (linha 106).
- Docs: `docs/agent-workflows.md` (seção "Listening for mentions"), `docs/mcp-tools.md` (tópico `listening`), `README.md` (seção "Wait for mentions") e `docs/development.md` (área de teste nova).
- Teste existente: `test/cli-memory-command.test.ts`, asserção estática adaptada ao `import()` dinâmico. A regra provada não mudou: comandos de memória passam por `runMemoryCommand` com `disposeMemoryProviders`.

## Testes novos

- `test/core-thread-mentions.test.ts` e `test/core-thread-mention-parsing.test.ts`: tabelas do reconciliador, de menção, de cadeia e de citação.
- `test/core-thread-wait.test.ts`: laço com dependências falsas e agendador manual. Cobre mensagem entre observador e leitura, observador mudo, prazo, abort, fechamento, erro e serialização.
- `test/core-thread-wait-lock.test.ts`: trava antiga recuperada e trava fresca preservada.
- `test/cli-wait-fixtures.ts`, `test/cli-wait-command.test.ts` e `test/cli-wait-input.test.ts`: CLI por subprocesso, com cenários dos códigos 0, 2, 3, 4, 5 e 6 e de `sessionLock` `unavailable`. As menções são gravadas por `appendMessageInWorkspace`.
- `test/cli-wait-static.test.ts`: fecho de imports estáticos dos módulos novos e de `src/cli.ts`. Sem memória, modelo ou LLM, sem daemon e sem `mcp/server`.
- `test/mcp-listening.test.ts`: montador (aspas, espaço, aspa simples, barras e ausência de token) e tópico `listening`.

## Desvios declarados

1. `getWorkspaceInfo` e `readThreadSummarySnapshotInWorkspace` não são reusados. Importam `workspace-status.ts`, que carrega 60 módulos de memória. Usei a mesma construção de `WorkspaceInfo` e a checagem de `SUMMARY.md` via `inspectThreadFiles`.
2. `sessionLock` assume o valor `busy` no código 6. O brief previa só `held` e `unavailable`.
3. Sem `--session` e com `CLAUDE_CODE_SESSION_ID` vazio, a saída traz `unavailable`.

## Checks executados

- `pnpm validate`: exit 0 na última execução, após a correção de texto. O prettier reformatou só arquivos da F1. Conferi por data de modificação: nenhum arquivo fora do escopo mudou.
- `pnpm build`: exit 0 na última execução.
- Testes direcionados à F1: 77 passaram após a última alteração de código.
- `pnpm test` completo, execução final: 1255 passaram, 0 falharam, 0 cancelados, 0 ignorados.

## Validação manual com o CLI construído

Workspaces temporárias fora do repositório, removidas ao final. As menções foram gravadas com `appendMessageInWorkspace` do `dist`, o mesmo caminho do MCP e do HTTP. Nenhum daemon participou.

- Código 0, menção gravada antes da leitura. Exit do processo: 0. Linha: `{"status":"mention","exitCode":0,...,"sessionLock":"held",...}`.
- Código 0 ao vivo: waiter em segundo plano encerrado por mensagem gravada depois. Exit: 0. A trava foi liberada.
- Código 2, cadeia de três arquitetos com menção. Exit: 2. Linha: `{"status":"chain_limit","exitCode":2,"chain":{"count":3,"max":3},...}`.
- Código 5, thread inexistente. Exit: 5. Linha: `{"status":"error","exitCode":5,"error":"Thread not found.",...}`.
- Código 6, segundo waiter com a mesma sessão enquanto o primeiro estava ativo. Exit do processo: 6. Linha: `{"status":"already_waiting","exitCode":6,"sessionLock":"busy",...}`.

## Limites e riscos

- Os códigos 7 e 130 têm cobertura só nos testes de unidade, que usam o prazo e o abort. Não houve sinal real SIGINT ou SIGTERM no processo.
- O tópico `listening` só aparece no MCP depois de reiniciar o servidor. As cópias da skill em `.agents` e `.claude` não foram regeneradas, conforme a decisão de aguardar a aceitação.
- Antes da autorização, rodei uma vez `git status --short`, somente leitura. Nenhum outro comando Git foi executado.
- Não chamei `workspace_bootstrap` nem `workspace_update_recommendations` durante a implementação, conforme a autorização.

## Pendente

Revisão integrada do principal, com veredito explícito. Depois da aceitação: reinício do MCP e regeneração das cópias da skill.
