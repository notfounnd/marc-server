# Plano - Busca UI sobre memory existente

## Resumo

Criar a busca na UI usando o mecanismo ja existente de `memory_recall`, sem agente conectado e sem reimplementar outro buscador.

A UI adiciona o modo `search` na coluna do meio. O usuario abre pelo icone `Search`, digita a consulta e executa por Enter ou botao dentro do painel de busca. O daemon recebe a chamada HTTP autenticada, chama `recallMemory(...)` no core e devolve o mesmo contrato conceitual usado pela tool MCP.

A busca nao roda a cada tecla. Nesta thread nao muda o ciclo de vida do modelo: o provider segue carregando para gerar embedding da query, consulta LanceDB e chama `dispose()` ao final.

## Mudancas principais

- Adicionar endpoint no daemon:
  - `POST /api/workspaces/:workspaceId/memory/recall`
  - body: `{ query: string, limit?: number, minScore?: number }`
  - resposta: `MemoryRecallResult`
  - query vazia retorna `400`
  - workspace inexistente retorna `404`
- Disponibilidade:
  - busca habilitada apenas quando memory esta `ready` ou `stale`;
  - `stale` permite buscar, mas mostra aviso discreto no painel;
  - `missing`, `model_missing`, `incompatible`, `rebuilding` e `degraded` bloqueiam a busca;
  - botao `Search` permanece visivel, mas desabilitado com tooltip/status quando indisponivel.
- UI:
  - ampliar `MiddleMode` para incluir `search`;
  - adicionar botao `Search` a esquerda do botao de Marckers no modo `threads`;
  - em modos nao-`threads`, manter o padrao atual: so botao `X` no header;
  - no modo `search`, trocar o icone do header de `Search` para `RefreshCw` com `className="spin"` enquanto busca processa;
  - criar painel com input, botao explicito de busca e execucao por Enter;
  - nao usar `Skeleton` nem `Progress` nesta entrega;
  - renderizar resultados como cards no formato da imagem discutida: icone de thread, titulo, slug/reference e `matchedText` limitado visualmente a 3 linhas;
  - ao clicar em resultado, abrir a thread pelo fluxo existente de `selectThread`.
- Estados do corpo da busca:
  - sem busca anterior: empty state com icone e texto curto, tipo `Nothing here yet`;
  - buscando: mensagem simples `Searching memory...`, com o spinner no header;
  - busca concluida sem resultados: `No results`;
  - memory indisponivel: notice/empty state com mensagem de status e acao esperada, sem permitir disparar busca.
- Persistencia:
  - usar um unico `localStorage` key, por exemplo `marcMemorySearchState`;
  - sobrescrever esse slot a cada busca concluida;
  - armazenar `{ schemaVersion, workspaceId, query, result, savedAt }`;
  - restaurar apos F5 apenas se `workspaceId` bater com o workspace selecionado;
  - nao manter historico nem lista incremental;
  - limitar `results` a 5 e armazenar snippets compactos para evitar crescimento.
- Registrar uma oportunidade separada para investigar provider aquecido com TTL curto.

## Notas de implementacao

- Reusar `recallMemory(workspace.rootPath, input)` do core.
- Nao tocar no provider, store LanceDB, ranking ou corpus.
- Preservar Markdown como source of truth: UI e endpoint leem apenas indice derivado `.marc/memory`.
- Product/UI text em en-US. Mensagens mARC e este artifact em pt-BR.
- Codigo deve seguir regras locais: sem `else`, sem `if` aninhado, guards com early return.
- Usar Bash via context-mode para inspecao/validacao. Nao executar comandos git. Nao usar Playwright/Chrome via MCP.

## Plano de testes

- TDD antes da implementacao:
  - daemon: query vazia em `/memory/recall` retorna `400`;
  - daemon: workspace sem modelo preparado retorna `200`, `indexStatus.status = "model_missing"` e `results = []`;
  - UI helper: busca disponivel somente para `ready` e `stale`;
  - UI helper: serializa/restaura o ultimo estado de busca sem acumular historico;
  - UI helper: ignora estado salvo quando o `workspaceId` nao bate;
  - UI helper: mapeia hit de memory para thread existente e mantem snippet/reference.
- Validacao final:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`
- Validacao manual apos restart:
  - abrir UI;
  - confirmar botao Search habilitado com memory `ready` ou `stale`;
  - abrir modo Search;
  - confirmar empty state inicial ou restauracao via `localStorage`;
  - buscar `rotacao de token da interface`;
  - confirmar `RefreshCw.spin` no header e mensagem de processamento no corpo;
  - confirmar card com titulo, slug e trecho;
  - clicar no resultado e confirmar abertura da thread correta.
