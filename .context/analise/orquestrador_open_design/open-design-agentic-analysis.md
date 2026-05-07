# Open Design — Análise de Chamadas Agênticas a partir do Frontend

**Escopo:** entender, com referências a arquivos e funções reais, como o
projeto `C:/Projetos/ideia/open-design` orquestra ferramentas agênticas
disparadas a partir do frontend, para que o `mARC` possa avaliar uma
arquitetura análoga.

**Resposta curta:** o frontend do Open Design **não chama um SDK de
"agentic tools" diretamente do navegador**. Ele delega tudo a um
**daemon local** (`apps/daemon`) que faz `child_process.spawn` da CLI
agêntica do usuário (Claude Code, Codex, Cursor Agent, etc.) e
multiplexa o stdout JSONL/ACP/JSON-RPC de volta como **SSE
(`text/event-stream`)** para o navegador. As únicas exceções são modos
de fallback BYOK (Anthropic SDK no browser via `dangerouslyAllowBrowser`
ou o proxy `/api/proxy/anthropic/stream`).

Este documento mapeia o fluxo completo, os contratos de mensagem e os
pontos de extensão relevantes.

---

## 1. Topologias suportadas

Documentadas em `open-design/docs/architecture.md` §1:

| Topologia | Onde roda | Como o frontend "chama ferramentas" |
|---|---|---|
| **A — Local total** (default) | Web + daemon na máquina do usuário | Frontend → `POST /api/runs` no daemon → daemon faz `spawn` da CLI agêntica → SSE de volta |
| **B — Vercel + daemon remoto** | Web na Vercel, daemon no laptop via túnel | Igual a A, só muda o host do daemon |
| **C — Vercel direto (sem daemon)** | Apenas web | Frontend chama `Anthropic SDK` direto no browser (BYOK), sem ferramentas agênticas reais — modo "tente agora" |

A topologia de interesse para o mARC é a **A**: o navegador dispara
**execuções agênticas locais** sem precisar de um servidor remoto.

---

## 2. Componentes-chave (do frontend até a CLI)

```
┌───────────────────────────────────────── apps/web (Vite/Next React) ───────────┐
│                                                                                │
│   ChatComposer.tsx ── onSend ──▶ App.tsx (orquestra histórico, seleciona modo)│
│                                       │                                        │
│                                       ▼                                        │
│            providers/daemon.ts  (streamViaDaemon)                              │
│            providers/anthropic.ts (fallback BYOK)                              │
│            providers/anthropic-compatible.ts (proxy)                           │
│            providers/openai-compatible.ts (proxy)                              │
└───────────────────────────────────────────┬────────────────────────────────────┘
                                            │  fetch('/api/runs', POST)
                                            │  fetch('/api/runs/:id/events', SSE)
                                            ▼
┌─────────────────────────────────── apps/daemon (Express + SSE) ────────────────┐
│  server.ts → /api/runs                                                         │
│             → runs.ts (createChatRunService)                                   │
│             → spawn(invocation) ─── child_process ──▶ claude / codex / ...    │
│                                                                                │
│  claude-stream.ts  → parser de --output-format stream-json (JSONL)             │
│  copilot-stream.ts → parser do GH Copilot CLI                                  │
│  acp.ts            → cliente ACP JSON-RPC sobre stdio                          │
│  pi-rpc.ts         → cliente pi-ai JSON-RPC                                   │
│  json-event-stream.ts → parser genérico para CLIs com eventos JSON            │
└────────────────────────────────────────────────────────────────────────────────┘
```

Arquivos reais:

- Frontend: `apps/web/src/providers/daemon.ts`, `apps/web/src/providers/sse.ts`
- Contratos compartilhados: `packages/contracts/src/sse/chat.ts`, `packages/contracts/src/api/chat.ts`
- Daemon: `apps/daemon/src/server.ts` (rotas), `apps/daemon/src/runs.ts` (estado),
  `apps/daemon/src/agents.ts` (definições de CLIs detectadas), `apps/daemon/src/claude-stream.ts` (parser).

---

## 3. O caminho da chamada — clique do usuário até execução da ferramenta

### 3.1 Camada UI (composer → App)

Em `apps/web/src/components/ChatComposer.tsx`, o botão "Enviar" chama
`onSend(prompt, attachments, commentAttachments)`, prop fornecida por
`ProjectView`/`App.tsx`. O `App.tsx` resolve qual provider usar
(daemon vs. direct API) com base em `AppConfig` (settings do usuário) e
chama o respectivo `streamViaDaemon` / `streamMessage`.

### 3.2 Camada provider — `streamViaDaemon`

`apps/web/src/providers/daemon.ts` (linhas 76–151) faz **duas chamadas
HTTP**:

1. **`POST /api/runs`** — cria o run e recebe `{ runId }` (não bloqueia
   na execução). Body é o tipo `ChatRequest` de
   `packages/contracts/src/api/chat.ts`:
   ```ts
   {
     agentId, message, projectId, conversationId, assistantMessageId,
     clientRequestId, skillId, designSystemId, attachments,
     commentAttachments, model, reasoning
   }
   ```
2. **`GET /api/runs/:id/events`** — abre um stream SSE
   (`text/event-stream`) que entrega os eventos do agente. Suporta
   reconexão via `Last-Event-ID` (header) ou `?after=` (query).

A função `consumeDaemonRun` lê o `ReadableStream`, faz frame splitting
em `\n\n` (formato SSE padrão) e usa `parseSseFrame` (em
`providers/sse.ts`) para extrair `id`, `event`, `data`. Cada frame é
roteado:

| `event` | Significado | Tratamento UI |
|---|---|---|
| `start` | run iniciou (`bin`, `cwd`, `model`) | dispara `onAgentEvent({kind:'status', label:'starting'})` |
| `agent` | evento estruturado do agente | passa por `translateAgentEvent` (mapa para `AgentEvent` do tipo `text \| thinking \| tool_use \| tool_result \| usage`) |
| `stdout` | chunk plain (CLIs sem JSONL) | acumula em `acc` e dispara `onDelta` |
| `stderr` | chunk de erro | bufferiza para mensagem de falha |
| `error` | erro fatal do daemon/CLI | encerra com `onError` |
| `end` | exit com `code`, `signal`, `status` | encerra com `onDone(acc)` |

O cancelamento explícito (`cancelSignal`) faz `POST /api/runs/:id/cancel`
para que o daemon mate o `child_process` com SIGTERM
(`runs.ts::cancel`).

### 3.3 Camada daemon — `runs.ts` + `server.ts`

`apps/daemon/src/runs.ts` exporta `createChatRunService` que mantém um
`Map<runId, run>` em memória, com:

- buffer de eventos (até `maxEvents = 2000`) para reconexões;
- conjunto de clientes SSE conectados (`run.clients`);
- handle do `child_process` (`run.child`) para cancel;
- TTL de cleanup (`30 min`) após estados terminais
  (`succeeded | failed | canceled`).

`apps/daemon/src/server.ts`:

- `POST /api/runs` (linhas 2137–2143) cria o run, retorna `{runId}` em
  `202`, e dispara `startChatRun(...)` em background.
- `GET /api/runs/:id/events` (2159–2163) chama `runs.stream(run, req,
  res)` — replays eventos passados se vier `Last-Event-ID`/`after` e
  então adiciona o cliente ao `run.clients`.
- `POST /api/runs/:id/cancel` (2165–2172) chama `runs.cancel`.

### 3.4 O `spawn` da CLI agêntica

Em `server.ts` (linhas 2042–2076), depois de:

1. resolver `def = AGENT_DEFS.find(d => d.id === agentId)` (definições em
   `agents.ts`);
2. compor o prompt final (`composeSystemPrompt` mais histórico + comment
   attachments + skill);
3. resolver `cwd` (pasta do projeto em `.od/projects/<id>/`);

o daemon faz literalmente:

```ts
const invocation = createCommandInvocation({ command: resolvedBin, args, env });
child = spawn(invocation.command, invocation.args, {
  env,
  stdio: [stdinMode, 'pipe', 'pipe'],
  cwd: cwd || undefined,
  shell: false,
});
if (def.promptViaStdin) child.stdin.end(composed, 'utf8');
```

E acopla um parser conforme `def.streamFormat`:

| `streamFormat` | Parser | Origem |
|---|---|---|
| `claude-stream-json` | `createClaudeStreamHandler` | `claude --output-format stream-json --verbose --include-partial-messages` |
| `copilot-stream-json` | `createCopilotStreamHandler` | GH Copilot CLI |
| `acp-json-rpc` | `attachAcpSession` (em `acp.ts`) | Agent Client Protocol — Cursor/Gemini/Qwen via JSON-RPC sobre stdio |
| `pi-rpc` | `attachPiRpcSession` | pi-ai (Mario Zechner) |
| `json-event-stream` | `createJsonEventStreamHandler` | parser configurável por CLI |
| `plain` (default) | `child.stdout` → `send('stdout', { chunk })` | qualquer CLI sem formato estruturado |

**Importante:** o frontend nunca conhece o `child_process`. Tudo que ele
"vê" é o stream SSE com a união normalizada de eventos.

---

## 4. Protocolo de mensagens (SSE)

Definido em `packages/contracts/src/sse/chat.ts`:

```ts
export const CHAT_SSE_PROTOCOL_VERSION = 1;

export type DaemonAgentPayload =
  | { type: 'status'; label: string; model?: string; ttftMs?: number }
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'thinking_start' }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean }
  | { type: 'usage'; usage?: {...}; costUsd?: number; durationMs?: number }
  | { type: 'raw'; line: string };

export type ChatSseEvent =
  | SseTransportEvent<'start',  ChatSseStartPayload>
  | SseTransportEvent<'agent',  DaemonAgentPayload>
  | SseTransportEvent<'stdout', ChatSseChunkPayload>
  | SseTransportEvent<'stderr', ChatSseChunkPayload>
  | SseTransportEvent<'error',  SseErrorPayload>
  | SseTransportEvent<'end',    ChatSseEndPayload>;
```

O protocolo usa SSE puro (não WebSocket), pelo benefício prático de:

- atravessar proxies HTTP/1.1 com a mesma rota `/api/*`;
- reconectar automaticamente via `Last-Event-ID`;
- não precisar de upgrade de protocolo.

A documentação de arquitetura (`docs/architecture.md` §8) faz alerta
explícito sobre nginx e SSE: `proxy_buffering off; gzip off;` ou risco
de `ERR_INCOMPLETE_CHUNKED_ENCODING`.

---

## 5. Como ferramentas reais (file edits, web fetch, etc.) são executadas

**Não pelo frontend.** A CLI agêntica que o daemon spawna é a dona das
ferramentas. Por exemplo, com Claude Code:

1. Daemon spawna `claude -p --output-format stream-json
   --include-partial-messages --permission-mode bypassPermissions
   --model <x> --add-dir <skill-dirs>` com `cwd` apontando para
   `.od/projects/<id>/`.
2. Claude Code roda em modo non-interactive, vê o `cwd` como sandbox e
   executa **suas próprias** ferramentas (`Read`, `Edit`, `Write`,
   `Bash`, MCP tools registradas).
3. Cada `tool_use`/`tool_result` que o modelo emite vira um evento
   `stream_event` no JSONL — o `claude-stream.ts` (linhas 23–~250) decodifica
   e emite `{ type: 'tool_use', id, name, input }` para a UI.
4. A UI renderiza o tool_use como um "card" via
   `apps/web/src/runtime/tool-renderers.ts` e `components/ToolCard.tsx`
   (apenas visualização — nenhuma execução acontece no browser).

Comentário do código (`agents.ts` linhas 60–65):
> "Permission posture: the daemon spawns each CLI with cwd pinned to the
> project folder, and the web app has no terminal to surface an
> interactive approve/deny prompt. So every agent runs with its
> non-interactive/auto-approve switch on."

**Conclusão:** o frontend é puramente um **observador e disparador**. As
ferramentas são executadas pelo CLI agente local sob o controle dele
mesmo. O daemon serve como adaptador (transporte + multiplexação +
parsing de protocolos heterogêneos).

---

## 6. Gestão de estado e streaming

### 6.1 Estado por turno (frontend)

`App.tsx` mantém `messages: ChatMessage[]` (em React state) e enriquece
cada assistant message com `runId`, `runStatus`
(`queued|running|succeeded|failed|canceled`) e `agentEvents: AgentEvent[]`.
O `daemon.ts::translateAgentEvent` é a função pivô que converte o payload
bruto do daemon na união tipada `AgentEvent` consumida pelo
`AssistantMessage.tsx` para renderizar texto, thinking, tool cards, etc.

### 6.2 Resilience / reconexão

`consumeDaemonRun` tem laço com até 5 reconexões automáticas e usa
`lastEventId` para retomar o stream. O daemon mantém os eventos em um
ring buffer (`run.events`, máximo 2000) — se o usuário recarregar a
página, `App.tsx` consulta `listActiveChatRuns(...)` (em
`providers/daemon.ts`) e reanexa via `reattachDaemonRun`.

### 6.3 Erros

Três caminhos:

- **`event: error`** → `onError(new Error(...))` → UI mostra `error`
  banner.
- **`event: end` com `status: 'failed'` ou `code != 0`** → mensagem com
  tail dos últimos 400 chars do stderr.
- **AbortError** (usuário cancelou) → silencioso.

---

## 7. Fallbacks BYOK (sem daemon)

Para Topologia C (e como fallback quando a CLI não está instalada), o
projeto tem dois caminhos diretos:

- `providers/anthropic.ts::streamMessage` — cria
  `new Anthropic({ dangerouslyAllowBrowser: true })` e chama
  `client.messages.stream(...)` no próprio browser. Sem ferramentas,
  apenas geração de texto.
- `providers/anthropic-compatible.ts::streamMessageAnthropicProxy` e
  `providers/openai-compatible.ts::streamMessageOpenAI` — chamam
  `/api/proxy/anthropic/stream` ou `/api/proxy/openai/stream` no daemon
  (`server.ts` linha ~2209) que faz a chamada real e re-streama via SSE,
  resolvendo CORS para BYOK customizado.

Estes não são "agentic tool calling" — são apenas chat com modelo. O
agentic real **só existe via daemon + CLI local**.

---

## 8. Padrões e abstrações reutilizáveis

| Padrão | Benefício para o mARC |
|---|---|
| **Run service como Map em memória + ring buffer + TTL** (`runs.ts`) | Modelo simples, sem DB, com replay/reattach |
| **União discriminada `AgentEvent`** (`packages/contracts/src/sse/chat.ts`) | Contrato tipado entre frontend e backend; UI imune a CLIs novos |
| **`AGENT_DEFS` array de definições** (`agents.ts`) | Adicionar nova CLI = um objeto novo, sem tocar no core |
| **`streamFormat` discrimina parser** | Suporta CLIs heterogêneas (JSONL, ACP JSON-RPC, plain) com a mesma rota |
| **SSE com `Last-Event-ID`** | Recuperação de stream sem WebSocket / sem libs extras |
| **`POST /run` separado de `GET /events`** | Permite múltiplos observadores no mesmo run; admite UI e CLI vendo o mesmo stream |
| **`cwd` pinado por projeto** | Sandbox natural via filesystem |

---

## 9. O que o Open Design **não** faz (importante para o mARC)

- **Não** chama ferramentas agênticas no browser. Não há chamada direta
  do tipo `tool.execute(...)` no React. Tudo é mediado pelo daemon.
- **Não** roteia mensagens entre múltiplos agentes. É um único agente
  por run. Multi-agente fica a cargo da CLI (ex.: subagents do Claude
  Code).
- **Não** registra agentes em um diretório compartilhado. O agente é
  selecionado por `agentId` no `ChatRequest`, mas a "identidade" é a da
  CLI instalada — não há um cadastro como o `.marc/agents/<id>.md`.
- **Não** mantém um chat compartilhado entre vários agentes. Cada
  conversa é 1:1 entre o usuário e uma CLI por vez.

Estas lacunas são exatamente onde o mARC **complementa** o modelo: ele
já tem o pedaço social (sala compartilhada + identidade de agentes); o
que falta é a parte de **disparo automático** que o Open Design já
resolveu.

---

## 10. Síntese — o que copiar conceitualmente

1. **Daemon local + `child_process.spawn` da CLI agêntica.** Não tente
   chamar SDK de agente no browser; o "modo online" do mARC deve usar
   o mesmo padrão.
2. **HTTP `POST /run` que retorna `runId` + `GET /events` SSE.** Já há
   SSE no mARC (`/api/events`); estender é natural.
3. **Contrato tipado de eventos** (`AgentEvent` discriminada). O mARC
   pode reaproveitar o vocabulário (`text_delta`, `tool_use`,
   `tool_result`, `status`, `end`).
4. **`AGENT_DEFS`-style registry** mapeando `agentId → spawn config`.
   Reaproveitar até a estrutura de `streamFormat`/`buildArgs` é
   recomendado.
5. **`cwd` na pasta de workspace** (no caso do mARC, `rootPath` do
   workspace) — mantém o sandbox.
6. **Cancel via `POST /runs/:id/cancel` matando o child** com SIGTERM.

A próxima especificação (`marc-agentic-orchestration-spec.md`) detalha
como aplicar isso no mARC.
