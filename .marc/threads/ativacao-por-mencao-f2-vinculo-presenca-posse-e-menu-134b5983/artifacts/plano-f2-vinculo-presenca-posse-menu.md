# Plano da F2 — vínculo, presença, posse e menu

Autor: marc://@claude-software-architect
Data: 03/11/2026
Estado: aprovado pelo humano para desenvolvimento.

## Resumo

A F2 dá ao mARC a noção de qual sessão de agente fala por qual perfil em cada thread.

- O daemon guarda vínculo e posse num registro local com geração.
- A presença vem de três fontes declaradas: a lease do MCP, o `claude agents --json` e a trava do `marc wait`.
- O `marc open` adquire a posse antes de abrir ou retomar o Claude Code.
- O menu da thread mostra o estado de cada slot, o comando para copiar e os avisos de pendência.

Nada é ativado automaticamente. São três tarefas sequenciais, com um dev por vez.

## Contexto

A thread marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983 tem a abertura e os três requisitos de marc://#msg_5368bb9f9797430e84. O escopo da abertura é:

- vínculo por thread e perfil;
- lease estendida como presença;
- registro de posse com geração;
- adoção;
- comando `marc open`;
- menu ao lado do título, com sessões, estado, cópia do comando e avisos de pendência.

Fica fora qualquer ativação automática. O critério de saída é: conflito detectado, nenhuma ativação automática.

Hoje o mARC não sabe qual sessão de agente fala por qual perfil numa thread. Uma retomada crua do Claude bifurca a conversa sem aviso (F0, A1, A3 e A4). Com a F2, o humano vê no menu da thread quem está online, ocupado, escutando, encerrado ou em conflito. Ele abre ou retoma a sessão certa por um comando do mARC, que adquire a posse antes de lançar o cliente.

**Fontes:**

- v3, seções 3, 4 e 7;
- v2, seções 5 e 6;
- adendo, seção 2 (avisos);
- matriz da F0, seção F2;
- requisitos de marc://#msg_5368bb9f9797430e84;
- proposta do terminal embarcado, seção 4.2 (ambiente bash);
- memória: marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3. O token fica em `.marc-daemon/token` e é o mesmo da UI e do MCP. O `marc open` o lê de lá e nunca o expõe, o que é coerente com essa decisão.

## Fato novo verificado agora

`claude agents --json` (2.1.317) devolve, por processo do Claude:

- `pid`, `cwd`, `kind` e `sessionId`;
- `startedAt`, o instante de criação em ms;
- `status`, que pode ser `busy`.

Isso resolve três lacunas da v3:

1. **Identidade do processo:** `pid` mais `startedAt` evitam o erro de PID reaproveitado.
2. **Sessão atual depois de `/clear`:** o ID vem do processo do Claude, e não do ambiente congelado do MCP (pendência da matriz F0, B3).
3. **Ocupado:** sai do próprio `status`.

## Modelo

Um **slot** é o par thread e perfil. O estado de cada slot é derivado de quatro entradas:

| Entrada | Fonte | Quem escreve |
| --- | --- | --- |
| Vínculo e posse | `<dataDir>/sessions.json` do daemon, fora do repositório | Só o daemon, com geração e substituição atômica |
| Presença do MCP | Lease estendida: `nativeSessionId` (`CLAUDE_CODE_SESSION_ID`), `pid`, `ppid`, `hostId` e `identifiedAt` | MCP, a cada 15 s |
| Presença do cliente | `claude agents --json`, lido pelo daemon sob demanda, com cache de 2 s | Claude Code |
| Escuta | Trava `wait:<thread>:<session>` do `marc wait` da F1, via `workspaceWriteLockActive` | `marc wait` |

**Estados**, calculados por uma função pura com tabela de despacho:

| Estado | Regra |
| --- | --- |
| `unbound` | Sem vínculo |
| `online` | O processo dono aparece no `claude agents` com o mesmo `pid`, o mesmo `startedAt` e o `sessionId` do vínculo. Detalhes: `busy`/`idle` e `listening` |
| `ended` | O processo dono não aparece mais, a fonte está disponível e o host é o mesmo. Ou o `marc open` informou o fim do filho |
| `unknown` | Fonte indisponível, outro host, ou lease vencida sem prova |
| `conflict` | Dois processos com o mesmo `sessionId`, ou uma sessão diferente escrevendo pelo slot enquanto o dono está ativo |

O vínculo nasce de duas formas:

- **`marc open`:** o daemon gera o UUID, registra e só depois o Claude inicia com `--session-id`.
- **Adoção:** depois de um `message_post` bem-sucedido, o MCP avisa o daemon com thread, perfil, papel e identidade, sem esperar resposta. A adoção vale para sessões abertas fora do mARC.

Regras da adoção:

- **Slot sem dono ativo:** adota, com nova geração.
- **Mesmo dono:** só renova.
- **Outra sessão com dono ativo:** registra conflito e não troca o dono. A mensagem nunca é bloqueada, porque a F2 só detecta.
- **Papel `developer`:** não adota. O subagente usa o MCP da sessão principal.

Sem daemon, nada disso existe. O menu mostra esse requisito (v2, seção 5).

## Tarefas (um dev por vez, em sequência)

### Tarefa A — presença, registro, adoção e API

- **`src/core/session-slots.ts`** (novo, puro):
  - `deriveSlotState(binding, sources)`, com tabela de despacho;
  - tipos do slot e do registro.
- **`src/daemon/session-registry.ts`** (novo):
  - arquivo `sessions.json` com `version`, `generation` e slots por `workspaceId:threadId:profile`;
  - fila em memória para serializar as escritas;
  - gravação com `writeFileAtomically` (`src/core/write-coordination.ts`);
  - operações `acquire`, `heartbeat`, `release`, `observe` (adoção) e `recordConflict`;
  - arquivo inválido falha fechado: slot `unknown`, nunca reescrito em silêncio.
- **`src/daemon/presence.ts`** (novo):
  - roda `claude agents --json` por `execFile`, sem shell, com timeout de 5 s e cache de 2 s;
  - lê as leases identificadas;
  - checa a escuta pela trava da F1;
  - a fonte que falhar entra como `unavailable`.
- **`src/daemon/session-routes.ts`** (novo), registrado na tabela de `src/daemon/routes.ts`:
  - `GET /api/workspaces/:id/threads/:threadId/sessions`, com slots, estado, fontes e avisos;
  - `POST /api/sessions/observe`;
  - `POST /api/sessions/acquire`, `/heartbeat` e `/release`.
- **Lease:**
  - `src/daemon/leases.ts` aceita os campos de identidade;
  - `DaemonLease` em `src/core/types.ts` ganha esses campos.
- **MCP:**
  - `src/mcp/daemon.ts` envia a identidade na lease e marca `identifiedAt` depois de `workspace_bootstrap`;
  - `src/mcp/thread-tools.ts` chama `observe` depois de `message_post`, sem esperar e sem afetar a resposta.
- **Avisos de pendência** (na rota, reaproveitando `src/core/thread-mentions.ts`):
  - **menção pendente:** menções elegíveis a um perfil depois da última mensagem dele;
  - **limite de cadeia:** `architectChainLength` maior ou igual a 3;
  - **pedido ao humano:** mensagem de arquiteto que menciona um perfil de papel `user` sem mensagem humana depois.

### Tarefa B — montador de comando e `marc open`

- **`src/core/agent-launch.ts`** (novo, puro): o montador único do lançamento do cliente.
  - Argumentos:
    - o prompt vem antes de qualquer flag que aceita vários valores;
    - sessão nova recebe `--session-id <uuid>`;
    - retomada recebe `--resume <uuid>`.
  - Ambiente:
    - remove as variáveis `CLAUDE*` herdadas;
    - define `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` quando `toolShell` é `bash`, que é o padrão.
  - Pasta de trabalho: a raiz da workspace.
  - Devolve `{command, args, env, cwd}`, sem shell.
- **`src/mcp/listening-command.ts`:**
  - generalizar o montador da F1 para qualquer subcomando do `marc` (`buildMarcCommand`);
  - `buildWaitCommand` passa a usá-lo, sem mudar a saída;
  - o daemon usa o mesmo montador para o "copiar comando".
- **`src/cli-open-command.ts`** (novo) e despacho em `src/cli.ts` (import dinâmico):

  ```text
  marc open --thread <id> --profile <agent-id> [--workspace <path>]
            [--data-dir <path>] [--tool-shell bash|default] [--dry-run]
  ```

  O comando faz, nesta ordem:

  1. Resolve a thread e o perfil. Recusa perfil de papel `user` e thread fechada.
  2. Lê URL e token do `--data-dir`, como faz o `marc daemon status`. O token nunca entra no comando nem na saída.
  3. Chama `acquire`, e o daemon responde com uma decisão:
     - `new` ou `resume`, com `sessionId`, `ownerToken` e geração;
     - ou recusa: dono ativo, conflito ou estado desconhecido.
  4. Lança o `claude` com stdio herdado, sem shell.
  5. Envia heartbeat a cada 15 s.
  6. Quando o filho termina, chama `release` com `ended`.
  7. Ignora SIGINT enquanto o filho roda, porque o Ctrl+C é dele.

  - O prompt inicial só vai na sessão nova: uma linha en-US com a thread e o perfil, pedindo bootstrap e leitura da thread.
  - Somente Claude Code. Codex fica para a F5.
  - `--dry-run` imprime o JSON do lançamento, sem lançar e sem adquirir.
- **Códigos de saída:**

  | Código | Situação |
  | --- | --- |
  | 0 | A sessão terminou |
  | 4 | Thread fechada |
  | 5 | Erro de entrada ou de leitura |
  | 6 | Dono ativo; mostra o estado e não abre |
  | 8 | Conflito ou estado desconhecido; recusa |
  | 9 | Daemon indisponível |

### Tarefa C — menu da thread na UI

- **`src/ui/thread-sessions-menu.tsx`** (novo): botão ao lado do título, em `src/ui/content-header-actions.tsx`.
  - O menu lista um slot por perfil não humano. Os perfis vinculados vêm primeiro.
  - Cada linha mostra:
    - estado e detalhe (ocupado, escutando);
    - fonte declarada;
    - geração e origem do vínculo (`open` ou adoção);
    - botão "Copy command", com o `marc open` montado pelo daemon.
  - O slot sem vínculo mostra "Open with Claude Code", com o cliente explícito.
  - A contagem de avisos fica no botão, e a lista de avisos fica no menu.
  - Atualiza ao abrir o menu e nos eventos `workspace-changed`.
- **Textos:** pelo i18n existente (ADR 0008).
- **Validação:** Playwright CLI.

### Docs, em todas as tarefas

- `docs/agent-workflows.md`: sessões, posse e `marc open`.
- `docs/mcp-tools.md`: a identidade na lease e a chamada `observe`.
- README: o comando `marc open`.
- `docs/development.md`: as áreas de teste novas.
- Skill: só se houver instrução nova ao agente. A tendência é não mexer.

## Decisões com recomendação

Mudam se você pedir.

1. **`SESSIONS.md` fica para a F3.** A lista fixa de participantes só tem efeito com política e ativação. Na F2, os slots saem do registro do daemon e dos perfis da workspace. Assim a F2 não cria contrato novo de Markdown, e a ADR 0001 segue intacta: o registro local fica fora do repositório. Ele é a **autoridade local** do vínculo entre thread, perfil e sessão nativa, e não um cache reconstruível do `CHAT.md`. Derivados são só a presença e o estado. A perda do registro nunca vira criação silenciosa de nova continuidade (seção "Revisão do Codex"). **Muda o quadro da v3**, que listava o `SESSIONS.md` na F2.
2. **`marc open` exige o daemon.** A posse precisa de uma autoridade única. Sem daemon, o comando sai com o código 9 e a orientação para iniciá-lo.
3. **Somente o Claude Code na F2.** Para o Codex, a presença pelo MCP não prova TUI (B3), e a identidade vem por `_meta` (F5).
4. **Adoção só por `message_post`.** É a única chamada que traz thread e perfil. Mensagens de papel `developer` não adotam.
5. **Ambiente bash por padrão** no lançamento, com `--tool-shell default` para desligar. O efeito de `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` vem da documentação e será observado na sua prova de aceite.
6. **PID reaproveitado** fica resolvido por `pid` mais `startedAt` quando `claude agents` está disponível. Sem essa fonte, o estado é `unknown`, nunca `ended`.

## Pendências

- **Prova de aceite com a TUI real:** depende do humano. Os testes automatizados cobrem tudo, menos a abertura interativa.
- **Efeito de `CLAUDE_CODE_USE_POWERSHELL_TOOL=0`:** vem da documentação e não foi testado.
- **Revisão do Codex:** não é obrigatória, mas é recomendada para a decisão 1 (`SESSIONS.md` na F3), que muda o quadro da v3.

## Revisão do Codex

Parecer em marc://#msg_2ec35734cf4a4fdfa5. O adiamento do `SESSIONS.md` foi aceito. As precisões abaixo prevalecem sobre as seções "Modelo" e "Tarefas":

1. **Autoridade:** o `sessions.json` é a autoridade local do vínculo, como diz a decisão 1. Arquivo inválido ou ausente falha fechado.
2. **Precedência:** `conflict` vem antes de `online`. Fonte incompleta ou identidade incerta resulta em `unknown`.
3. **Prova negativa para `ended`:** exige três condições:
   - a fonte `claude agents --json` disponível;
   - o mesmo host;
   - nenhum processo listado com o `pid` e o `startedAt` do dono, nem com o `sessionId` do vínculo.

   Verifiquei agora que o `--json` sem `--all` lista todas as sessões ativas do usuário no host, interativas e em segundo plano, sem filtro de pasta. O `--all` só acrescenta sessões em segundo plano concluídas, que não têm `pid`.
4. **`/clear`:** o mesmo `pid` e `startedAt` com outro `sessionId` resulta em `unknown` (`session_changed`), e não em `ended`. Uma observação da mesma instância verificada reconcilia o vínculo, com nova geração.
5. **Reserva:** o `acquire` cria o estado `reserved`, ainda sem PID. Ele bloqueia outra aquisição ou adoção. A reserva só expira com heartbeat vencido e a prova negativa do item 3.
6. **Livre** é: `unbound`, `ended` comprovado ou reserva expirada comprovada. Nunca `unknown`, `reserved`, `online` ou registro inválido.
7. **Mesmo dono** é a instância verificada, com `pid` e `startedAt`. UUID igual sozinho não basta, e o mesmo `sessionId` vindo de outra instância é conflito.
8. **Atomicidade:** `heartbeat` e `release` exigem `ownerToken` e geração. Um evento antigo não substitui um dono mais novo.
9. **Adoção é melhor esforço:** o aviso pode se perder, e o próximo `message_post` o reenvia. Isso fica documentado.
10. **Tarefa B:** num slot `unbound` cujo perfil já tem mensagens na thread, o `marc open` recusa com o código 8, a menos que receba `--new`. A continuidade anterior pode ter se perdido com o registro.

## Execução

1. **Registro:**
   - rodar `workspace_update_recommendations`, `memory_recall` e `workspace_audit` com `scope: preflight`;
   - anexar `plano-f2-vinculo-presenca-posse-menu.md` à thread F2, com mensagem curta;
   - rodar as auditorias de artefatos e referências.
2. **Desenvolvimento:** um dev por vez (`general-purpose`, modelo haiku, effort xhigh, perfil marc://@claude-dev).
   - Cada tarefa tem brief completo, `OK_BOOTSTRAP` antes da autorização e escrita só no escopo dela.
   - Git proibido.
   - Cada dev publica a própria entrega, com o threadId completo.
   - Faço de 2 a 3 passagens de revisão por tarefa antes de liberar a seguinte.
3. **Revisão integrada:** `revisao-integrada-f2.md`, com veredito explícito, e auditoria de mensagens.
4. **Entrega a você:**
   - você faz a prova de aceite;
   - reinicia o MCP;
   - eu coloco no stage com o seu OK de Git;
   - o encerramento só acontece com a sua autorização.

## Verificação

**Classificação:** mudança executável de CLI, daemon, MCP e UI.

- **Checagens:** `pnpm validate`, `pnpm build` e `pnpm test` completos, conferindo que o `validate` só mexeu no escopo.
- **Testes sem ramificação:**
  - tabela de estados (`unbound`, `online`, `ended`, `unknown`, `conflict`, PID reaproveitado, outro host);
  - registro: geração, concorrência, arquivo inválido;
  - adoção: slot livre, mesmo dono, outra sessão, developer;
  - montador: ordem do prompt, `--session-id`/`--resume`, remoção de `CLAUDE*`, variável de bash, token ausente;
  - `marc open` com lançador injetado: novo, retomada, códigos 4, 6, 8 e 9, `release` no fim do filho;
  - avisos: menção pendente, limite de cadeia, pedido ao humano;
  - integração do MCP real com `CLAUDE_CODE_SESSION_ID` falso e um daemon de teste: adoção e conflito ponta a ponta.
- **UI:** Playwright CLI com daemon e workspace temporários. O menu deve mostrar os estados, a cópia do comando e os avisos.
- **Prova ao vivo, feita por mim:**
  - daemon temporário em outra porta, com `--data-dir` e workspace temporários;
  - `claude agents` real desta máquina como fonte;
  - `marc open --dry-run`;
  - adoção pelo MCP real;
  - remoção de tudo no fim.
- **Prova de aceite, feita por você** (só ela abre a TUI de verdade, que eu não conduzo):
  - copiar o comando no menu e colar num terminal;
  - ver o slot `online` com posse `open`;
  - sair do Claude e ver `ended`;
  - colar de novo e ver a retomada com o mesmo ID.
