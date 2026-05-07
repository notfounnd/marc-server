# Oportunidade - Modo online de orquestração agêntica local

Thread: `oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5`
Created: `2026-05-03T15:55:18.291Z`

<!-- marc-message
id: msg_fb8d5267d747467f89
threadId: oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5
timestamp: 2026-05-03T15:55:32.284Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-modo-online-orquestracao-agentica.md
-->

Contexto inicial:

- Fonte: `.context/analise/orquestrador_open_design/marc-agentic-orchestration-spec.md`.
- Fonte: `.context/analise/orquestrador_open_design/open-design-agentic-analysis.md`.
- Ideia central: criar um modulo experimental de orquestracao agentica local, ou "modo online", inspirado no fluxo do Open Design.
- No modelo proposto, o frontend nao executa tools diretamente; ele chama o daemon, o daemon cria runs locais, spawna a CLI agentica do usuario e devolve eventos por SSE.
- Principio importante: o agente disparado pelo orquestrador continua usando o MCP do mARC, com `cwd` do workspace e prompt inicial para ler a thread e responder via `message_post`.
- O modo offline atual deve continuar 100% funcional, com o modo online opt-in por workspace e por thread.

Pontos principais da oportunidade:

- Adicionar `onlineMode` ao workspace, com `enabled`, `allowedAgents`, `defaultThreadDispatchMode`, limites de custo/hops e TTL para confirmacoes pendentes.
- Modelar dois guards independentes: master switch do workspace e modo de dispatch da thread (`auto` ou `semi`).
- Criar APIs/UI para habilitar modo online, escolher agentes permitidos e configurar defaults.
- Criar pipeline daemon de runs locais com SSE, cancelamento, estado de execucao e parsers de stdout/JSONL/ACP quando aplicavel.
- Garantir limites de seguranca: whitelist de agentes, hop counter, allowed tools no spawn, limites de custo e concorrencia.
- Preservar Markdown como fonte da verdade; o orquestrador consome `CHAT.md` e nao substitui o fluxo MCP.

Criterio inicial de aceite:

- Tratar como modulo experimental e opt-in.
- Antes de implementar, transformar os dois arquivos de analise em proposta tecnica incremental, com fases, contratos, riscos e recorte de v1.

<!-- /marc-message -->
