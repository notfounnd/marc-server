# Oportunidade - Rebuild incremental e batches limitados da memory

Thread: `oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682`
Created: `2026-07-16T19:22:10.120Z`

<!-- marc-message
id: msg_4e7fff05247e491e8d
threadId: oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
timestamp: 2026-07-16T19:24:00.187Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-rebuild-incremental-e-batches-limitados.md
-->

Oportunidade registrada para tornar a manutencao da memory incremental e segura em memoria.

O anexo consolida:

- o diagnostico do pico de 2,67 GiB no ONNX Runtime
- batches limitados com um unico batch de inferencia em voo
- reconciliacao incremental como fluxo normal
- rebuild completo manual usando o mesmo executor
- consistencia, locks, testes e criterios de aceite

A oportunidade reune os dois mecanismos em uma unica entrega. Nenhum desenvolvimento foi iniciado.

<!-- /marc-message -->

<!-- marc-message
id: msg_df7311920f4d4751a6
threadId: oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
timestamp: 2026-07-20T19:23:14.121Z
agentId: ui-user
role: user
-->

Esse desenvolvimento tem fit com marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682 .

<!-- /marc-message -->

<!-- marc-message
id: msg_d51ed9a5f53f488191
threadId: oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
timestamp: 2026-07-20T19:23:48.597Z
agentId: ui-user
role: user
-->

Memória está quebrada, devido ao problema de geração que essa a atual thread se propõe a resolver.

<!-- /marc-message -->

<!-- marc-message
id: msg_aefb34dbdfb1428fa2
threadId: oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
timestamp: 2026-07-20T20:34:49.115Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-rebuild-incremental-e-batches-limitados.md
-->

Analise concluida e plano detalhado anexado antes do desenvolvimento.

Decisoes confirmadas:

- O fluxo automatico executa somente reconciliacao incremental.
- Chamadas manuais pela UI e pelo MCP usam incremental como default.
- Rebuild full exige modo explicito.
- Os dois modos compartilham batches sequenciais, batch size configuravel e lock global por workspace.
- Memory degraded nao entra em loop de retentativa automatica.

Inicio agora os testes de regressao e a implementacao descrita no anexo.

<!-- /marc-message -->

<!-- marc-message
id: msg_dd3341cfab5048ea98
threadId: oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
timestamp: 2026-07-20T22:27:00.559Z
agentId: codex-dev
role: developer
-->

Implementação concluída.

Entregue:
- Reconciliação incremental como fluxo padrão para UI, MCP e automação.
- Rebuild full somente por escolha explícita na UI ou com `mode: "full"` no MCP.
- Executor sequencial com batches configuráveis de 2 a 16 registros, com default 4.
- Persistência de `memory.embeddingBatchSize` em `.marc/marc.config.json`.
- Remoção de vetores de summaries excluídos e reembeddings apenas para summaries novos ou alterados.
- Liberação do provider local ao terminar, falhar ou não adquirir o lock.
- UI com slider de batch size e ações separadas para rebuild incremental e full.
- Documentação atualizada para os contratos de UI, daemon, MCP e memory.

Validações executadas:
- `pnpm run validate`
- `pnpm test` com 131 testes aprovados
- `pnpm build`
- `workspace_audit` sem findings críticos nesta thread. Restam apenas avisos preexistentes de metadata em perfis de outros agentes.

Reinicialização necessária agora:
- Reiniciar o daemon.
- Reconectar ou reiniciar o cliente MCP para atualizar o schema de `memory_rebuild`.
- Atualizar a UI. A UI de desenvolvimento está disponível em http://127.0.0.1:5173/.

Aguardo seu feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_c24bfbfb5cbc465b9a
threadId: oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
timestamp: 2026-07-20T22:46:41.122Z
agentId: codex-dev
role: developer
-->

Correção complementar concluída na documentação.

Removi as quebras físicas inseridas no meio de frases em `docs/memory.md` e `docs/mcp-tools.md`. Parágrafos e itens agora permanecem em uma única linha física, preservando apenas as quebras estruturais de listas e blocos de código.

Validação executada:
- `pnpm run format:check` passou.

<!-- /marc-message -->
