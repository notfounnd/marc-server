# Proposta - Modo Online de Orquestracao Agentica Local

## Fontes

- `.context/analise/orquestrador_open_design/marc-agentic-orchestration-spec.md`
- `.context/analise/orquestrador_open_design/open-design-agentic-analysis.md`

## Resumo

Criar um modulo experimental e opt-in de orquestracao agentica local para o mARC. O objetivo e permitir que uma interacao em uma thread dispare agentes locais, com controle do usuario, sem substituir o modo offline atual e sem trocar o MCP como caminho principal de colaboracao.

O modelo segue a topologia local do Open Design: o frontend chama o daemon, o daemon cria um run, spawna uma CLI agentica local e devolve eventos por SSE. No mARC, o agente disparado deve continuar usando as tools MCP do proprio mARC para ler contexto e postar respostas.

## Principios

- O modo offline atual continua funcionando sem mudancas quando o modo online estiver desligado.
- O modo online e opt-in por workspace e controlavel por thread.
- O daemon nao inventa um protocolo paralelo para agentes; ele spawna a CLI como o usuario faria.
- O agente disparado usa o mesmo MCP do mARC, com `cwd` do workspace e prompt inicial direcionado para a thread.
- `CHAT.md` continua sendo a fonte da verdade.
- O orquestrador consome e reage ao historico, mas nao substitui `message_post`, `thread_read` ou os demais fluxos MCP.

## Arquitetura Proposta

Fluxo de alto nivel:

1. Usuario habilita o modo online em um workspace.
2. Usuario configura agentes permitidos e limites operacionais.
3. Uma thread recebe uma mensagem com destinatario logico, como `@codex-reviewer`.
4. O daemon observa a mensagem e consulta o router.
5. Se os guards permitirem, o daemon cria um run local.
6. O run spawna a CLI agentica permitida.
7. O agente le a thread via MCP e responde via `message_post`.
8. A UI acompanha o run via SSE.

O fluxo deve usar SSE para eventos de run, seguindo o desenho do Open Design:

- `POST /api/runs` cria o run e retorna `{ runId }`.
- `GET /api/runs/:id/events` abre stream `text/event-stream`.
- `POST /api/runs/:id/cancel` cancela o processo local.
- Em modo semi-automatico, `POST /api/runs/:id/confirm` confirma execucao pendente.

## Guards

O modelo possui dois guards independentes:

- Workspace: `onlineMode.enabled`.
- Thread: `dispatchMode`.

`onlineMode.enabled=false` desativa completamente o roteamento automatico. Em workspace online, cada thread pode operar em:

- `auto`: o daemon cria e inicia o run quando o router decide disparar.
- `semi`: o daemon cria um run pendente e aguarda confirmacao humana.
- `off`: sem dispatch automatico para aquela thread.

Esses guards apenas atrasam ou impedem disparos. Eles nao relaxam outras barreiras de seguranca.

## Estado e Configuracao

Adicionar `onlineMode` ao workspace:

```ts
type WorkspaceOnlineMode = {
  enabled: boolean;
  enabledAt?: string;
  allowedAgents?: string[];
  defaultThreadDispatchMode?: "auto" | "semi";
  maxCostUsdPerChain?: number;
  maxHops?: number;
  pendingRunTtlMs?: number;
  maxConcurrentRuns?: number;
};
```

Adicionar metadata de dispatch por thread:

```ts
type ThreadDispatchMeta = {
  dispatchMode?: "auto" | "semi" | "off";
  lastRunId?: string;
  chainId?: string;
  hopCount?: number;
};
```

Persistencia sugerida:

- Workspace: store do daemon.
- Thread: arquivo local sob a pasta da thread, preservando `CHAT.md` como fonte de mensagens.
- Runs: estado do daemon com snapshot suficiente para UI, cancelamento e retomada de status.

## Componentes Novos

- `daemon/runs.ts`: gerencia runs, status, spawn, cancelamento, eventos SSE e TTL.
- `daemon/agent-defs.ts`: descreve CLIs permitidas, binarios, args e parsers.
- `daemon/router.ts`: decide se uma mensagem deve disparar agente e qual agente.
- `daemon/thread-meta.ts`: le e grava dispatch mode e estado auxiliar de thread.
- `daemon/chain-tracker.ts`: controla hop count, chain id e limites.

Mudancas minimas em componentes existentes:

- UI: controles de modo online no workspace e dispatch mode na thread.
- API daemon: endpoints para configurar workspace/thread e operar runs.
- Core types: tipos opcionais para online mode, dispatch e runs.
- MCP: manter fluxo existente; agentes disparados continuam usando MCP.

## UI e UX

Workspace:

- Toggle de modo online perto do workspace.
- Lista de agentes permitidos baseada em `.marc/agents/`.
- Selector de dispatch padrao para novas threads.
- Campos de limite: custo, hops, concorrencia e TTL.

Thread:

- Controle de dispatch mode: `off`, `semi`, `auto`.
- Indicador visual de online mode ativo.
- Card de run pendente no modo `semi`.
- Acoes: confirmar, cancelar, ver eventos.

Runs:

- Status: `queued`, `pending-confirmation`, `running`, `completed`, `failed`, `cancelled`, `expired`.
- Eventos SSE para status, texto, tool use/result, erro, usage e fim.
- Cancelamento explicito deve matar o `child_process` com encerramento controlado.

## Seguranca

Guardrails obrigatorios:

- `onlineMode` desligado por default.
- `allowedAgents` vazio nao dispara nada.
- Dispatch por thread pode ser `off`.
- Modo `semi` permite supervisao humana.
- Limite de hops por chain.
- Limite de custo por chain.
- Limite de concorrencia por workspace.
- TTL para runs pendentes.
- Allowed tools no spawn, quando a CLI suportar.
- Logs e eventos suficientes para auditoria local.

Nao deve haver execucao remota obrigatoria. O modelo v1 e local-first.

## Recorte de V1

V1 deve priorizar um caminho pequeno, testavel e reversivel:

- Configurar `onlineMode` por workspace.
- Configurar agentes permitidos.
- Configurar dispatch mode por thread.
- Criar runs locais com status e SSE.
- Suportar `semi` antes ou junto de `auto`.
- Spawnar uma CLI inicialmente suportada.
- Fazer o agente disparado ler a thread via MCP e responder via `message_post`.
- Registrar mensagens com algum marcador de origem automatica ou chain id.

Fora do v1:

- LLM router avancado.
- Resolucao fuzzy de agentes.
- Multi-provedor completo.
- Tuning de UX sofisticada.
- Execucao remota.
- Substituir Markdown como fonte da verdade.

## Riscos

- Avalanche de runs em cadeias automaticas.
- Agente disparado sem contexto ou regras corretas.
- Ambiguidade de mencoes multiplas.
- Falha de parsing de stdout das CLIs.
- Processos filhos presos.
- Custo inesperado.
- UI indicar estado desatualizado se SSE cair.
- Dificuldade de diagnostico sem eventos estruturados.

Mitigacoes:

- Comecar com `semi`.
- Exigir whitelist e limites baixos por default.
- Usar chain tracker.
- Usar bootstrap/guards MCP antes de confiar em agentes disparados.
- Expor eventos de run e logs locais.
- Manter cancelamento visivel.

## Criterios de Aceite

- Com online mode desligado, o mARC se comporta como hoje.
- Com online mode ligado e sem agentes permitidos, nenhum run e disparado.
- Em modo `semi`, uma mensagem roteavel cria run pendente e aguarda confirmacao.
- Em modo `auto`, uma mensagem roteavel dispara um run respeitando whitelist, hops, custo e concorrencia.
- O agente disparado usa MCP para ler thread e postar resposta.
- A UI recebe eventos SSE de status e fim de run.
- Cancelamento encerra o processo filho e atualiza o estado.
- Markdown continua sendo fonte da verdade para mensagens.
- Testes cobrem guards, router, runs, thread meta e fluxo semi-automatico.

## Proximos Passos

1. Revisar esta proposta contra os dois documentos-fonte.
2. Definir o recorte exato do v1.
3. Implementar primeiro os prerequisitos de bootstrap MCP.
4. Implementar thread references/agent mentions se ainda forem prerequisito para routing.
5. Criar plano tecnico de fases antes de qualquer implementacao do modo online.
