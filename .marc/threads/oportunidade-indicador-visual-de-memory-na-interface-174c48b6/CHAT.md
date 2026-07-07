# Oportunidade - Indicador visual de memory na interface

Thread: `oportunidade-indicador-visual-de-memory-na-interface-174c48b6`
Created: `2026-07-07T00:38:44.020Z`

<!-- marc-message
id: msg_0a0287eb364a4df2b3
threadId: oportunidade-indicador-visual-de-memory-na-interface-174c48b6
timestamp: 2026-07-07T00:44:31.454Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-indicador-visual-memory.md
-->

Oportunidade registrada para discutir e implementar indicador visual de estado da memory na interface.

Anexei um artifact detalhado com:

- contexto da evolução base de memory;
- diferença entre `Connected`, `Synced` e estado de memory;
- estado atual do core/MCP/UI;
- perguntas de produto para amadurecer a ideia visual;
- estados candidatos e critérios de aceite.

Referência principal: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac

<!-- /marc-message -->

<!-- marc-message
id: msg_2274f986c6dd49ffa0
threadId: oportunidade-indicador-visual-de-memory-na-interface-174c48b6
timestamp: 2026-07-07T01:16:32.880Z
agentId: ui-user
role: user
-->

Ideia visual adicionada pelo usuário para orientar a oportunidade.

## Proposta

Renderizar o estado da memory diretamente no card da workspace, no canto direito do item da lista de workspaces, em vez de usar apenas badges no topo da tela.

## Ícones lucide-react sugeridos

- `database-check`: memory OK / snapshot pronta e atual.
- `database-backup`: memory NOK por estar desatualizada ou precisar ser gerada novamente.
- `database-zap`: memory sendo gerada/rebuild em andamento.
- `database-x`: erro ou impossibilidade de leitura/criação, índice ausente ou falha bloqueante.

## Racional

O estado de memory é por workspace. Mostrar o ícone no card da workspace parece mais claro do que misturar esse estado com `Connected` e `Synced`, que representam conexão com daemon e sincronização da UI.

<!-- /marc-message -->

<!-- marc-message
id: msg_d44a7488a7e84769bf
threadId: oportunidade-indicador-visual-de-memory-na-interface-174c48b6
timestamp: 2026-07-07T03:42:46.300Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-indicador-visual-memory-ui.md
-->

Plano detalhado registrado como artifact.

Vou iniciar o desenvolvimento seguindo o plano aprovado:

- expor memory por workspace em `/api/status`;
- renderizar indicador no card da workspace;
- atualizar `lucide-react` se o upgrade validar os ícones necessários;
- cobrir o comportamento com testes e validação completa.

Preservação do SoT: a UI consumirá somente o estado derivado exposto pelo daemon; Markdown e `SUMMARY.md` continuam sendo a fonte da verdade.

<!-- /marc-message -->

<!-- marc-message
id: msg_b5d285b30a504935ae
threadId: oportunidade-indicador-visual-de-memory-na-interface-174c48b6
timestamp: 2026-07-07T04:21:08.166Z
agentId: codex-dev
role: developer
-->

Desenvolvimento realizado.

O que mudou:

- `/api/status` agora expõe `modules.memory.workspaces[workspaceId]`, reaproveitando `readWorkspaceStatus` e mantendo Markdown/`SUMMARY.md` como fonte da verdade.
- A UI React mantém `memoryHealthByWorkspace` em paralelo ao health do thread index.
- O card de workspace renderiza indicador visual à direita:
  - `DatabaseCheck`: memory ready;
  - `DatabaseBackup`: stale/missing/model missing;
  - `DatabaseZap`: rebuilding futuro;
  - `DatabaseX`: incompatible/degraded.
- `lucide-react` foi atualizado para `^1.23.0`, porque `0.547.0` ainda não exportava `DatabaseCheck` e `DatabaseX`.
- Docs atualizadas em `docs/ui-and-daemon.md` e `docs/memory.md`.
- Plano registrado em artifact antes do desenvolvimento.

Validação:

- RED inicial confirmado para `/api/status` sem memory e helper visual ausente.
- `pnpm run validate`: passou.
- `pnpm test`: passou com 92/92.
- `pnpm build`: passou; permanece apenas o aviso conhecido de chunk Vite acima de 500 kB.
- Context-mode usado para inspeção e revisão de saída.
- Playwright carregou a UI em `127.0.0.1:4187`; o browser de validação estava sem token travado, então a inspeção visual ficou limitada à shell.
- `workspace_audit` preflight da thread: 0 achados.

Observação operacional:

- É necessário reiniciar o daemon para que o processo carregue a nova implementação server-side de `/api/status`. Sem restart, a UI nova cai no fallback compatível e pode não mostrar o indicador de memory ainda.

Aguardando seu feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_249eebf0e1d645e9ac
threadId: oportunidade-indicador-visual-de-memory-na-interface-174c48b6
timestamp: 2026-07-07T05:06:12.571Z
agentId: codex-dev
role: developer
-->

Validação pós-restart concluída.

Evidências:

- `workspace_status` e `memory_status`: memory `ready`, 28 sumários, 28 indexados, `modelPrepared: true`, sem itens ausentes ou stale.
- `/api/status` autenticado: `ok: true`, `modules.memory.status: "ready"`, workspace `marc-dd422176e1` com `ready: true`, `stale: false`, `summaryCount: 28`, `indexedSummaryCount: 28`.
- UI via `playwright-cli`: card da workspace renderizou `.memory-indicator.memory-indicator-ready` com `aria-label/title` `Memory ready` e ícone `lucide-database-check`.
- Screenshot salvo localmente como `memory-indicator-after-restart.png`.

A sessão de navegador aberta pelo `playwright-cli` foi fechada ao final da validação. Aguardo feedback para orientar a finalização da thread.

<!-- /marc-message -->
