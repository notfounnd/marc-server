# Plano da F3: ADR, política, orçamento, reserva e supervisor

Autor: marc://@claude-software-architect
Data: 04/11/2026
Estado: aprovado pelo humano em 04/11/2026. A F3a está concluída e commitada. A F3b foi detalhada na revisão 4, aprovada pelo humano em 05/11/2026 e ajustada na revisão 4.1 com as precisões do Codex, que a aprovou em msg_d39ac755ec324b09ba. As tarefas D e E foram aprovadas tecnicamente. A revisão 5 (09/11/2026), decidida pelo humano, troca o condutor pelo lead e move o avanço do agente para o post, criando a tarefa G antes da F. O Codex aprovou a revisão 5 em msg_2286cef9b8a145a8b4, com critérios para a tarefa G. Na revisão integrada, o Codex deixou pendente a leitura da autorização fora da fila (msg_306a9112f8f54043ac), corrigida pela tarefa H e confirmada por ele em msg_0e0ff05aabb3423a86. No aceite, o humano encontrou três ajustes no painel de uma thread encerrada, que formam a tarefa I, confirmada pelo Codex em msg_880725648dd3410ea9. Depois, encontrou pendências falsas no menu de sessões de uma thread encerrada, que vêm da F2 e formam a tarefa J, confirmada pelo Codex em msg_e4e3375c52c7427695. A F3b foi aceita pelo humano e incluída por amend no commit da F3 em 10/11/2026. A F3c foi detalhada na revisão 6 (10/11/2026), com as decisões do humano, e ajustada na revisão 6.1 com as precisões do Codex (msg_fa5ee092182c499e8d), que ele confirmou em msg_cd559d56f35b4cfe93. A tarefa K começa.

**Revisão 6 (10/11/2026): detalhamento da F3c.** A seção "F3c" abaixo substitui o esboço. Ela traz o supervisor em modo confirmar, a precedência das linhas 2, 4, 6 e 7 da v3, a pendência de confirmação no estado da thread, a aprovação dentro da fila, o adaptador do Claude por tabela de despacho, a recuperação, os pedidos de permissão, a identidade do waiter e o campo `Client:` no perfil. As decisões do humano estão no fim da seção.

**Revisão 5 (09/11/2026): mecanismo no mARC, processo no RULES**, por decisão do humano depois de ver a maquete do painel. Prevalece sobre as decisões 9 e 10 da F3b e sobre a tarefa F onde houver diferença.

1. **Princípio.** O mARC oferece mecanismo: quem acorda quem, quantos ciclos antes de parar e o freio que o humano controla. A forma de trabalhar vem do RULES.md de cada workspace.
   - Os três estágios fixos (Planning, Execution, Review) são o encaixe macro. Se o RULES tiver mais fases, o agente encaixa cada uma num desses três.
   - Uma thread simples, com plano do próprio usuário e sem conversa entre agentes, funciona do mesmo jeito: com o interruptor desligado é o fluxo de hoje, e com ele ligado nada conta se ninguém acordar ninguém.
   - Um rótulo livre de "momento", definido pelo agente, foi considerado e trocado pelos três estágios fixos.
2. **Saldo por estágio e só para a frente:** ficam como estão. O saldo por estágio impede que o estágio inicial consuma tudo. Só ir para a frente impede que alguém renove o freio indo e voltando entre estágios. Uma correção pedida na revisão faz parte do Review.
3. **Lead no lugar do condutor.** O lead é o ponto focal da thread: é quem o humano aciona para saber o que está acontecendo.
   - Padrão: o primeiro autor do `CHAT.md` cujo perfil tem papel de arquiteto, como a decisão 9 já calcula.
   - O humano troca o lead pelo painel ("Make lead"), com comparação do lead esperado. A troca fica no estado da thread (`lead`, `leadChanges`) e vai para a seção Activity do `SUMMARY.md` no encerramento.
   - Só o lead avança o estágio como agente. O humano sempre pode avançar pelo painel.
4. **O agente avança ao postar.** O `message_post` ganha o campo opcional `advanceTo`, que aceita qualquer estágio à frente do atual. Uma thread pode começar direto em Execution ou em Review. Pular um estágio não enfraquece o freio: o avanço só vai para a frente, então quem pula só perde o saldo do estágio pulado, e o máximo continua sendo 3 × 5 mais o que o humano liberar. A ferramenta `thread_advance_stage` e o parâmetro `reference` saem: a própria mensagem é a referência.
   - Ordem: o MCP pede o avanço ao daemon com a identidade da sessão, grava a mensagem já carimbada com o novo estágio e depois confirma, ligando o `messageId` ao registro do avanço.
   - O daemon confere as condições da decisão 10: o agente é o lead, a identidade é verificada, o estágio atual é o esperado, o estágio não está esgotado, o destino está à frente do estágio atual e o avanço não parte da última etapa.
   - Recusado o avanço, a mensagem é gravada sem avançar e o resultado traz o aviso `stage_advance_refused` com o motivo. O post nunca é bloqueado.
   - Se a gravação falhar depois do avanço concedido, o avanço fica registrado com `reference: null` e o erro do post sobe como hoje.
   - Limite mantido: o Codex não tem identidade verificada até a F5. Como lead, ele recebe `identity_unverified`, e o humano avança pelo painel.
5. **Painel**, aprovado pelo humano na maquete https://claude.ai/artifact/Fb4iBZHfvUNFnJVTPT6wmx, que substitui as maquetes anteriores:
   - **Estágio:** um selo único ao lado de "Stage", com o estágio atual que o daemon guarda. O painel não desenha a fileira de três passos, para não sugerir um processo obrigatório.
   - **Ciclos:** abaixo do selo, "N of 5 cycles" e a barra segmentada que já existe na F3a.
   - **Retidas:** ficam logo acima de "More N cycles" e "Advance stage".
   - **Avanço pelo humano:** "Advance stage" abre a escolha entre os estágios à frente. Se houver retidas, a confirmação diz quantas serão encerradas.
   - **Participantes:** mostram "Leads" e "Make lead".
   - **Histórico de estágios:** sai do painel e continua no estado e na seção Activity.
   - **Selo das mensagens:** o estágio e o ciclo ("Planning · cycle 2"). A mensagem com que o lead avança ganha a marca "Advanced to <stage>" e funciona como o registro visível do avanço.

**Revisão 4.1 (05/11/2026): precisões do Codex** (msg_1a1b987d760c4b6da8). Elas mudam as decisões 2, 3, 5, 6, 8, 9, 10, 11 e 12, criam a decisão 13 e ajustam as tarefas D e E:

- a ordem do juízo: o saldo vale só para abrir um ciclo, e as ações humanas funcionam no limite;
- o destino explícito das retidas quando a etapa avança;
- as tentativas contadas por execução do waiter, sem gastar no poll nem na repetição;
- a retenção sem gravar nada quando o estado foi perdido, o piso na recuperação e a poda segura das reservas;
- o autor e o destinatário lidos da mensagem canônica, e o carimbo em duas fases;
- o freio de cadeia da F1 dispensado no waiter governado;
- a correção sobre o condutor.

**Revisão 4 (05/11/2026): detalhamento da F3b.** A seção "F3b" abaixo substitui o esboço. Ela traz:

- o débito só na reserva;
- o ciclo por correlação de destinatários;
- a retenção no limite, em vez de encerrar o waiter;
- os códigos 8 `activation_refused` e 9 `daemon_unavailable`;
- o carimbo `stage`/`cycle` pelo MCP;
- o condutor derivado do `CHAT.md`;
- a ferramenta `thread_advance_stage` com identidade verificada;
- o piso contra restauração.

A F3b é independente de cliente. A interface `ClientAdapter` e o campo `client` no perfil ficam para o plano da F3c.

**Revisão 2 (04/11/2026), por decisão do humano.** O estado local do daemon passa a ter **um arquivo por thread**, apagado quando a thread é encerrada. O encerramento grava uma seção **Activity** no cabeçalho do `SUMMARY.md`, para preservar a atividade. Isso cria a tarefa A0 e muda a decisão 3, a tarefa A e a verificação. A decisão nova é a 9.

**Revisão 3 (05/11/2026), por decisão do humano depois de usar a UI da F3a.** O modelo de estágios configuráveis foi trocado por um modelo sem campos para preencher. Esta revisão prevalece sobre as decisões 1 a 9 e sobre as tarefas abaixo onde houver diferença:

- **Etapas fixas:** planejamento, execução e revisão final. Não há ID, condição de saída nem lista de estágios para o usuário preencher.
- **Ciclo:** uma ida e volta entre arquitetos conta 1, isto é, A acorda B por menção e B acorda A de volta. Menção serve para acordar: toda menção a outro arquiteto conta. Arquiteto e subagente não contam.
- **Orçamento:** 5 ciclos por etapa, 15 no total. Mais que 5 numa etapa é sinal de problema (briga de ego ou escopo grande demais), por isso o loop para. O padrão é ajustável uma vez nas configurações gerais da workspace, no mesmo painel do rebuild da memória.
- **Painel da thread:**
  - um interruptor, desligado por padrão;
  - a etapa atual e "N de 5 ciclos";
  - os participantes são automáticos (todos os arquitetos) e aparecem só para leitura.
  - Thread que não precisa de colaboração entre arquitetos, como uma migração mecânica, fica desligada e funciona como hoje.
- **Troca de etapa:**
  - o arquiteto que conduz a thread marca a passagem por uma ferramenta do MCP: planejamento para execução quando os arquitetos chegam a consenso sobre o plano; execução para revisão quando um avisa o outro que terminou;
  - só para a frente, e nunca a partir de uma etapa esgotada;
  - o humano também pode avançar pelo painel.
- **No limite:** o loop pausa e o humano escolhe entre "Mais 5 ciclos" e "Avançar etapa".
- **Fluxo:** com o interruptor ligado, o principal só delega ao dev depois do consenso com o outro arquiteto sobre o plano.
- **Divisão de papéis prevista:** um arquiteto planeja e revisa, e o outro executa com o próprio subagente. O acordar automático do Codex depende do adaptador da F5. Até lá, o humano acorda o Codex.
- **Base no código da F3a:** o núcleo da F3a já guarda tudo por estágio. As etapas fixas passam a ser os três estágios internos, e o campo `stage` da mensagem recebe a etapa. A contagem em ciclos e a ferramenta de troca de etapa entram na F3b, junto com a reserva. A tarefa C abaixo ajusta a F3a ao modelo.

**Resumo:**

- a F3 se divide em três estágios sequenciais nesta thread;
- a F3a cria a base, sem ativar ninguém:
  - armazenamento por thread, inclusive para as sessões da F2, e a seção Activity no resumo;
  - ADR 0014;
  - política da thread no `policy.json`;
  - razão local do daemon;
  - "Pausar tudo";
  - avisos de saldo;
  - campo `stage`/`pass` no bloco da mensagem;
- a F3b traz a reserva comum e o waiter com falha fechada;
- a F3c traz o supervisor em modo confirmar e o adaptador Claude.

**Pendências para o Codex:**

- a decisão 2, que dispensa o `SESSIONS.md`;
- as decisões 3, 4 e 9, sobre onde mora cada dado, o arquivo por thread e a seção Activity;
- a revisão das ideias do Tucano, na decisão 8.

## Contexto

A F3 é a thread marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598, aberta na mensagem marc://#msg_ef39cf1fb07b40c98a. Ela é a primeira fase em que uma menção pode **ativar** um agente: o supervisor do daemon, em modo **confirmar**, faz isso com a aprovação do humano em cada criação ou retomada.

A F2 já entregou presença, posse, `marc open` e o menu. Hoje nada ativa ninguém.

O critério de entrada da F3 tem três partes: um plano detalhado, a revisão das ideias do adendo e a decisão sobre dividir a fase.

**Fontes:**

- v3, seções 4 a 6, 8 e 9;
- v2, seções 3 e 4 e seções 6 a 8;
- adendo, seções 1, 2 e 4;
- revisões do Codex sobre a v2 e a v3;
- matriz da F0, seções F3 e F4 (E1 a E3, A1 a A4, C1, C2 e G1);
- resumos da F1 e da F2.

Requisitos extraídos: 21 itens, 14 cenários da v2 e 12 cenários da v3.

## O que já existe e será reaproveitado

| Peça | Onde | Uso na F3 |
| --- | --- | --- |
| Elegibilidade de menção, freio de cadeia | `src/core/thread-mentions.ts` (`mentionsProfile`, `reconcileMentions`, `architectChainLength`) | Mesma regra de menção elegível |
| `marc wait` | `src/cli-wait-command.ts`, `src/core/thread-wait.ts` | Ganha reserva e falha fechada na F3b |
| Bloco da mensagem | `src/core/markdown.ts` (`renderMessage`, `parseMessages`, `addArtifactToMessage`), escrita única em `appendMessageInWorkspace` (`src/core/threads.ts:59`) | Campo opcional de estágio e passagem |
| Registro local com falha fechada | `src/daemon/session-file.ts`, `session-registry.ts` (fila, `writeFileAtomically`, marcador meta) | Base do armazenamento por thread (tarefa A0) |
| Cabeçalho do resumo gerado pelo núcleo | `thread_write_summary` (título, thread, data de fechamento) | Recebe a seção Activity |
| Posse e lançamento | `registry.acquire` no próprio processo, `buildAgentLaunch` e `clientForModel` (`src/core/agent-launch.ts`), `runOwnedClient` (`src/cli-open-session.ts`) | Supervisor e adaptador na F3c |
| Avisos | `src/core/session-warnings.ts` | Aviso em 80% e no fim do orçamento |
| Rota de mensagem da UI | `src/daemon/message-routes.ts` (`role: user`) | Origem UI registrada no daemon |

**Lacunas:**

- não há política por thread, interruptor de pausa, reserva compartilhada, supervisor ou assinante interno de eventos (`UiEventBus` só envia SSE);
- não há modo `-p` no montador;
- a ADR 0004 proíbe roteamento automático.

## Decisões, com recomendação (mudam se você pedir)

1. **Dividir a F3 em três estágios sequenciais nesta mesma thread.**
   - F3a: base de política.
   - F3b: reserva e waiter.
   - F3c: supervisor e adaptador.
   - Cada estágio tem tarefas de dev, revisão integrada e checkpoint seu.
   - Só a F3a fica detalhada agora. A F3b e a F3c ficam esboçadas e ganham plano detalhado ao entrar, porque o resultado da F3a pode mudá-las. É o mesmo método usado na F0.
2. **Sem `SESSIONS.md`.** Os participantes elegíveis ficam no JSON de política da thread, junto com os estágios. É configuração, e a ADR 0001 permite JSON para isso. **Muda a v2, seção 6**, que previa um `SESSIONS.md`; o Codex deve revisar esse ponto.
3. **Onde mora cada dado:**

   | Dado | Local | Motivo |
   | --- | --- | --- |
   | Política autorizada: habilitada, modo, participantes, estágios, revisão | `.marc/threads/<id>/policy.json`, versionado | Viaja com a thread |
   | Pausa global da workspace | Um arquivo da workspace no dataDir do daemon | Estado local, por máquina |
   | Sessões vinculadas (F2), estágio corrente, passagens e tentativas, reservas | Um arquivo por thread no dataDir do daemon, fora do repositório, apagado no encerramento | Cada escrita mexe só na thread afetada; nada cresce sem limite |
   | Atividade da thread encerrada | Seção Activity no cabeçalho do `SUMMARY.md` | Preserva o histórico sem ID nativo, PID ou host |

   Só a rota da UI no daemon grava a política. Uma mensagem `role: user` no `CHAT.md` não habilita nada.
4. **"Pausar tudo" é local, por máquina e por workspace.** Ele não vai para o repositório, porque um commit não pode pausar a máquina de outra pessoa.
5. **Custo:** nenhum limite em dinheiro bloqueia, como você definiu. A F3c grava o custo de cada ativação a partir do delta de `total_cost_usd` informado pelo Claude, como dado para a F4. A estimativa por tokens fica na oportunidade marc://$oportunidade-custo-estimado-de-agentes-por-thread-e-workspace-ce4af389.
6. **Freio de cadeia da F1:** continua só no modo manual. Numa thread com política, quem manda é o orçamento.
7. **Valores iniciais:**
   - 3 passagens por estágio;
   - teto de 2 tentativas por passagem;
   - pendência de confirmação vence em 24 h, sem ação automática no vencimento.
8. **Ideias do Tucano (revisão pedida pelo adendo):**

   | Ideia | Destino |
   | --- | --- |
   | Passagem gravada na mensagem | F3a cria o campo; F3b carimba a partir da reserva, nunca do agente |
   | Pausar tudo | F3a |
   | Avisos de 80% e de fim | F3a |
   | Limite de menções por mensagem | Fica na F6 |
9. **Arquivo por thread e seção Activity** (revisão 2, decisão do humano):
   - **Problema:** o `sessions.json` da F2 é regravado inteiro a cada post e heartbeat e nunca é limpo. Com 500 threads e 4 agentes, ele chegaria perto de 1,4 MB (medido: cerca de 700 bytes por slot). A primeira versão desta revisão dizia 14 MB, um erro de conta apontado pelo Codex. O crescimento sem limite e a regravação inteira a cada escrita continuam sendo o motivo.
   - **Por que não SQLite:** o `marc.sqlite` é opcional hoje, porque o `node:sqlite` só funciona sem flag a partir do Node 22.13 e o projeto aceita Node a partir do 22.0. Tornar o SQLite obrigatório exigiria subir esse mínimo. Fica descartado nesta fase.
   - **Arquivos:** o dataDir do daemon guarda um arquivo por thread, com as sessões, a contagem e, na F3b, as reservas. Um arquivo da workspace guarda a pausa.
   - **Limpeza:** o daemon apaga o arquivo quando vê o `SUMMARY.md` da thread. Se estiver parado nessa hora, apaga quando subir.
   - **Falha fechada:** política habilitada sem arquivo da thread conta como autorização ausente. A thread fica parada até o humano salvar a política de novo.
   - **Seção Activity:** ao encerrar, o `thread_write_summary` pede ao daemon um retrato da atividade e o grava no cabeçalho gerado pelo núcleo, antes do `---`. O agente não edita essa seção.
     - Por perfil: papel, origem do vínculo (`open`, `adopted`, `supervisor` ou `none`), início, último sinal e número de ativações.
     - Por estágio: passagens usadas, máximo e como terminou.
     - Uma linha final com a revisão da política, a pausa, os conflitos gravados e, depois da F3c, o custo informado pelo cliente.
     - Nunca entram o ID nativo da sessão, o PID ou o host. A v2, seção 6, decidiu que o ID nativo não circula no repositório, e thread fechada não retoma: o `marc open` recusa com o código 4.
     - Daemon fora do ar no encerramento: o cabeçalho recebe a linha "Activity not recorded: the daemon was unavailable at closure". Encerrar nunca depende do daemon.
     - Thread sem atividade: a seção não aparece.

## F3a: base de política (detalhada)

**Saída:** você define e habilita a política pela UI, pausa tudo e vê o estágio e o saldo. A ADR é aceita e o campo de passagem é lido e escrito. **Nada ativa ainda.**

### Tarefa A0: armazenamento por thread e seção Activity (dev)

- **Arquivo por thread** no dataDir do daemon: um arquivo de estado por thread, com escrita atômica e fila por thread, mais um arquivo da workspace para a pausa. Aproveitar os auxiliares que a tarefa A já extraiu (`src/daemon/registry-file.ts`).
- **Migração da F2:**
  - o `sessions.json` existente é dividido por thread uma única vez;
  - o original é mantido com um sufixo de migração, e não é apagado;
  - registro inválido ou perdido continua falhando fechado, como na F2.
- **Limpeza no encerramento:** o assinante de eventos do daemon apaga o arquivo da thread quando aparece o `SUMMARY.md`. Na subida, o daemon remove os arquivos de threads já encerradas.
- **Protocolo de encerramento**, pedido pelo Codex em marc://#msg_a7b14739bd7f4f7d93:
  - **Ordem:** o retrato da atividade é tirado antes de apagar.
  - **Serialização:** a limpeza passa pela mesma fila de escrita da thread.
  - **Escritas atrasadas:** heartbeat, adoção, acquire ou release que chegam depois do encerramento são recusados e não recriam o arquivo.
  - **Subida:** a limpeza na subida é idempotente.
  - **Consulta do resumo:** tem prazo finito, com a linha de fallback explícita. Sem daemon, nunca mostra totais zerados.
  - **Migração:** o arquivo `.migrated-*` nunca é lido como fonte autoritativa.
- **Seção Activity:**
  - rota do daemon que devolve o retrato da atividade da thread;
  - `thread_write_summary` (modo create) consulta essa rota pelo daemon que o MCP já conhece, só como melhor esforço, e grava a seção no cabeçalho gerado pelo núcleo;
  - formato em Markdown, com as tabelas de perfis e de estágios e a linha final;
  - sem ID nativo, PID ou host;
  - o modo update do resumo preserva a seção.
- **Testes:**
  - migração com um registro de várias threads;
  - escrita em uma thread não toca outra;
  - limpeza no encerramento e na subida;
  - retrato da atividade com e sem daemon;
  - o cabeçalho do resumo com e sem a seção;
  - nenhum ID nativo, PID ou host no `SUMMARY.md`;
  - as provas da F2 continuam passando.

### Tarefa A: ADR, política, razão, rotas e campo do bloco (dev)

- **ADR 0014**, "Policy-gated mention activation":
  - substitui só a parte de roteamento da 0004, que é marcada como substituída em parte;
  - uma menção canônica pode ativar um participante vinculado, sob política habilitada pelo humano;
  - continua proibido escolher destinatário por similaridade, texto ou LLM;
  - desligada por padrão; revogar para novas ativações na hora;
  - ativar não é autorizar;
  - só o humano e os arquitetos participantes disparam;
  - a menção vale só dentro da própria thread.
  - Atualizar `docs/adrs/README.md` e `docs/agent-workflows.md`, que hoje diz que o roteamento automático está fora do escopo.
- **Núcleo puro**, `src/core/activation-policy.ts`:
  - esquema e validação da política: versão, `revision`, `enabled`, `mode: "confirm"`, participantes, estágios (`id`, descrição, `maxPasses` de 1 a 9 com padrão 3, condição de saída), `attemptCap` e `pendingTtlMinutes`;
  - cálculo de saldo e avisos de 80% e de fim, com tabelas de despacho.
- **Razão do daemon**, `src/daemon/activation-ledger.ts`, sobre o armazenamento da tarefa A0:
  - o arquivo da workspace guarda `paused`;
  - o arquivo da thread guarda a revisão autorizada, o estágio corrente e as passagens e tentativas por estágio;
  - revisão incompatível ou arquivo ausente com política habilitada pausa a thread;
  - **conteúdo autorizado preso**, pedido pelo Codex:
    - o razão guarda também o hash do conteúdo autorizado da política;
    - editar o `policy.json` fora da rota, mesmo mantendo a revisão, falha fechado;
    - um `policy.json` versionado vindo de outra máquina, sem registro local compatível, continua parado;
  - a recuperação pela UI move o conteúdo inválido para o lado e exige salvar a política de novo.
- **Rotas** (`src/daemon/activation-routes.ts`, na tabela de `routes.ts`):
  - `GET` e `PUT` da política da thread, que grava `policy.json` sob a trava da thread e gera nova revisão;
  - `POST` de pausar e de retomar a workspace;
  - `GET` do estado de ativação: estágio, saldo e avisos.
  - O `PUT` aceita só a forma da UI. O MCP não ganha ferramenta para isso.
- **Transição do waiter**, pedida pelo Codex:
  - na F3a, a política pode ser habilitada antes de a reserva existir;
  - o `marc wait` confere o `policy.json` na partida e a cada ciclo, e sai com um código novo (`policy_active`) quando a política está habilitada, sem liberar a menção;
  - thread sem política, ou com política desligada, mantém o fluxo manual;
  - teste para a habilitação durante a espera.
- **Campo do bloco:**
  - `stage` e `pass` opcionais em `ChatMessage` e `MessageInput` (`src/core/types.ts`);
  - suporte em `renderMessage`, `parseMessages` e `addArtifactToMessage`, que hoje perderia o campo;
  - no regex duplicado de `src/core/memory/sources/chat.ts`;
  - no `Message` da UI.
  - Registros antigos ficam intactos.
  - O `message_post` do MCP **não** aceita esses campos como entrada do agente.
- **Testes:**
  - tabela de validação da política;
  - razão: perda, conteúdo inválido, revisão incompatível e concorrência;
  - rotas;
  - ida e volta do bloco com e sem os campos, inclusive depois de anexar artefato;
  - entrada do `message_post` ignorando o campo.

### Tarefa B: UI de política e de pausa (dev, depois da maquete)

- Primeiro publico uma maquete visual com variantes e você escolhe. O dev só começa depois da escolha.
- **Controle da thread no cabeçalho:**
  - ligar e desligar;
  - escolher participantes;
  - editar estágios e `maxPasses`;
  - ver estágio e saldo.
- **Decisões do humano sobre a maquete** (https://claude.ai/artifact/JmzVwPosU3McRgH47NpxRD):
  - **Política da thread:** variante A, um botão próprio no cabeçalho da thread, ao lado de anexos e sessões, que abre um painel. O ícone fica pressionado enquanto o painel está aberto, e Salvar fica no rodapé.
  - **Ícones (lucide):** `Zap` no botão da política e `Pause` no "Pausar tudo".
  - **Ordem no cabeçalho** (ajuste do humano depois da entrega): o `Zap` fica à esquerda do botão de sessões. A ordem fica anexos, `Zap`, sessões.
  - **Componentes**, a partir da indicação do humano sobre o neobrutalism.dev, que migrou para Base UI:
    - **Reaproveitados:** os que o projeto já tem, `switch`, `badge`, `input` (para o máximo de passagens), `button` e `dropdown-menu`.
    - **Único componente novo:** o `checkbox`, para escolher participantes, instalado da versão atual do site em Base UI, com `pnpm dlx shadcn@latest add https://neobrutalism.dev/r/checkbox.json`. O `@base-ui/react` já é dependência do projeto, por causa do toast. O dev confere o diff do CLI e não aceita mudança fora do componente.
    - **Fora da F3:** os componentes Radix existentes não são migrados aqui. Radix e Base UI convivem, e a migração é uma oportunidade separada.
  - **Linha de perfil `developer` sem sessão** no menu de sessões: o humano pediu para deixar claro que "no session" não significa dev parado.
    - A sub-linha continua "no session", porque é o fato.
    - A dica explica os dois casos que o desenho permite:
      - um dev subagente roda dentro da sessão do arquiteto e nunca é vinculado;
      - um dev fixo (F6) tem sessão própria, vinculada pelo `marc open`.
    - O texto não pode supor que todo dev é subagente. O desenho admite dev fixo e outros papéis, como um designer, e esses adotam a sessão normalmente.
  - **"Pausar tudo":** ao lado do botão Settings da workspace (`content-header-actions.tsx`), porque é uma configuração da workspace. A barra lateral foi descartada por ser poluída. Com a pausa ligada, uma faixa âmbar aparece no topo do conteúdo da thread aberta.
- Textos pelo i18n (ADR 0008). Validação com Playwright CLI.

### Tarefa C: ajuste da F3a ao modelo da revisão 3 (dev)

- **Política:**
  - o `policy.json` passa a guardar o interruptor, a revisão e o hash;
  - as etapas fixas e os participantes automáticos vêm do núcleo, não do arquivo;
  - um `policy.json` antigo, com estágios configurados, é lido sem quebrar, e o próximo save da UI o normaliza.
- **Workspace:** a configuração "ciclos por etapa", padrão 5 e entre 1 e 20, fica nas configurações gerais da workspace, junto à memória. Ela é gravada pela rota de configurações da UI.
- **Saldo:** a view mostra a etapa atual, os ciclos usados e o máximo, com os avisos "último ciclo" e "esgotado".
- **Painel da thread:**
  - remover a edição de estágios e o "Add stage";
  - participantes só para leitura;
  - interruptor, etapa e "N de M ciclos";
  - o botão `Zap` fica à esquerda do botão de sessões.
- **Ações no limite:** os botões "Mais N ciclos" e "Avançar etapa" chamam rotas da UI que gravam a decisão humana no razão. A troca de etapa pelo arquiteto, via MCP, fica para a F3b.
- **Testes e navegador:** ajustar os testes e refazer a validação no navegador.
- **Critérios do Codex** (marc://#msg_63b84e1afc97401b8b):
  - **Política antiga:** o formato v1 é lido de forma compatível e só é normalizado num save autorizado pela UI. O mapeamento para as etapas fixas é explícito: nunca volta em silêncio ao planejamento, e os contadores antigos são preservados como histórico, nunca convertidos em ciclos por renomeação.
  - **Extensões e saldo:** as extensões humanas entram no saldo efetivo. Salvar ou religar não zera consumo, extensões nem pausas.
  - **Última etapa:** avançar na revisão final não cria uma quarta etapa.
  - **Ciclos por etapa presos por uma autorização local confiável** (revisão mais conteúdo efetivo, no armazenamento do daemon), validada junto com a política. Um hash dentro do próprio JSON não é autorização. Uma edição manual, mesmo válida, bloqueia as threads com o interruptor ligado. O save pela UI reautoriza sem apagar consumo. Threads desligadas seguem no fluxo manual.
  - **Migração durável** (marc://#msg_33304c8d70de4b96a4): a conclusão fica gravada, o `sessions.json` que reaparecer é ignorado, e a retomada de migração interrompida é preservada.
- **Para a F3b:** correlacionar a ida e a volta pelos destinatários, sem dividir um contador global por 2. Reservar antes de liberar o trabalho, sem devolver saldo por resposta ausente. Identificar o condutor pela identidade verificada.

## F3b: reserva, waiter, contagem de ciclos e troca de etapa (detalhada, revisão 4)

**Saída:** o loop entre arquitetos funciona sob a política.

- O waiter pede uma reserva ao daemon antes de liberar o trabalho.
- Cada ida e volta conta um ciclo.
- No limite, o loop pausa até o humano decidir.
- As mensagens recebem o carimbo de etapa e de ciclo.
- O condutor avança a etapa pelo MCP.

**Fora da F3b, porque é da F3c:**

- o supervisor;
- iniciar ou retomar um cliente;
- as linhas 2, 4, 6 e 7 da precedência da v3, seção 5.

**Lacunas encontradas no código da F3a:**

- `readinessOf` roda fora da fila da thread e ignora a pausa da workspace e o saldo esgotado;
- `appendMessageInWorkspace` descarta `stage` e `pass`;
- não existe "condutor";
- o post do MCP não passa pelo daemon antes de gravar;
- o waiter não fala com o daemon.

### Decisões da F3b

1. **O débito acontece na reserva do waiter e em nenhum outro ponto.**
   - Um post não debita nada.
   - Uma ativação manual não debita: quando o humano acorda o Codex, ele mesmo está no loop.
2. **Ciclo por correlação de destinatários,** sem dividir um contador por 2. Uma reserva X→Y (o waiter de Y acorda por menção de X) segue esta regra:
   - se a etapa de origem tem um ciclo aberto por Y→X, a reserva **fecha** esse ciclo e não debita;
   - senão, ela **abre** um ciclo novo e debita 1;
   - um ciclo aberto no mesmo sentido e ainda não fechado é marcado como superado.
   - Com os dois lados automáticos, a ida debita e a volta é grátis. Até a F5 só o Claude acorda sozinho, e cada volta do Codex abre um ciclo. Nos dois casos, uma ida e volta conta 1.
   - Fechar um ciclo nunca é barrado por saldo, porque ele já foi pago na abertura. Por isso o saldo é conferido **depois** da correlação e só na abertura (decisão 12).
3. **No limite o loop pausa e não morre.** Com o saldo esgotado, a pausa da workspace ou um estado que se resolve no painel (`policy_tampered`, `settings_tampered`, `policy_outdated`, `ledger_lost`, `ledger_invalid`, `revision_mismatch`, `ledger_restored`):
   - o daemon grava a reserva como **retida**, com o motivo;
   - **exceção:** com `ledger_lost` ou `ledger_invalid` o daemon responde `held` sem gravar nada e sem recriar o arquivo. A falha continua fechada, e a pergunta seguinte do waiter recalcula a resposta;
   - o waiter continua esperando e pergunta de novo a cada ciclo de poll;
   - quando o humano age no painel ("More N cycles", "Resume", salvar a política, recuperar o estado), a próxima pergunta do waiter é concedida e o loop segue sozinho;
   - se o prazo vencer, o waiter sai com o código 7 e `held: <motivo>` no JSON, sem avançar o cursor.
   - **Retidas quando a etapa avança:** o avanço, pelo humano ou pelo condutor, encerra **todas** as reservas retidas de etapas anteriores com a recusa `stage_advanced`. O número delas fica no registro do avanço em `stageHistory` (`droppedHolds`), e o painel mostra esse número na confirmação antes de avançar. O waiter retido recebe a recusa e sai com 8. Nada é liberado sozinho nem transferido de etapa em silêncio. Para continuar, um arquiteto menciona o outro de novo na etapa nova. As reservas já concedidas não mudam (cenário 11).
4. **Códigos do `marc wait` numa thread com política ligada:**
   - **8 `activation_refused`**, com `reason`: recusa definitiva para a mensagem (`already_reserved` por outro detentor, `attempts_exhausted`, `ineligible_origin`, `stage_advanced`, `reservation_expired`). Esse código substitui o `policy_active` da F3a.
   - **9 `daemon_unavailable`**: falha fechada.
   - O modo manual continua idêntico nas threads com a política desligada.
5. **Origem verificável, lida da mensagem canônica.** O pedido de reserva leva só `messageId`, `recipient`, `holder` e `runId`. O daemon lê a mensagem no `CHAT.md` e tira dela o autor, as menções e o carimbo. Ele não confia em nenhum remetente informado.
   - O `recipient` precisa estar entre as menções da mensagem; senão a resposta é `ineligible_origin`.
   - A rota de mensagem da UI grava o `messageId` no estado da thread, numa lista limitada. Uma menção vinda de uma mensagem gravada pela UI reserva sem debitar.
   - Uma mensagem com `role: user` que não passou pela rota é `ineligible_origin`. Se o ID saiu da lista pela poda, o resultado também é `ineligible_origin`: a falha é fechada.
   - O autor arquiteto é conferido pelo papel do perfil no registro, não pelo `role` escrito na mensagem.
   - Desenvolvedores continuam inelegíveis.
6. **Deduplicação e tentativas.** A chave é mensagem e destinatário. A reserva guarda a etapa de origem, a revisão, o detentor (o `--session` do waiter) e o `runId` da última entrega.
   - O `runId` é um identificador gerado a cada execução do `marc wait`.
   - **Consulta ou repetição idempotente** (mesmo detentor e mesmo `runId`): devolve o estado atual e não gasta tentativa nem debita. Isso cobre o poll de uma reserva retida e a repetição de uma chamada que falhou na rede.
   - **Nova entrega** (mesmo detentor e `runId` novo, numa reserva já concedida): é o waiter rearmado depois de morrer, o cenário 3. Conta uma tentativa até o `attemptCap` (padrão 2) e depois responde `attempts_exhausted`. Nunca debita de novo.
   - Uma reserva retida não gasta tentativa, qualquer que seja o `runId`, porque nada foi entregue.
   - Outro detentor recebe `already_reserved`.
   - Uma reserva concedida nunca é estornada, nem no timeout do waiter.
   - **Poda segura:** a lista `reservations` é limitada. Ao podar, o daemon guarda `prunedThrough`, o maior horário de mensagem entre as reservas removidas. Uma mensagem com horário até esse piso e sem reserva registrada recebe `reservation_expired`, sem débito. Assim uma concessão esquecida não gera um novo débito.
7. **Etapa de origem.** A mensagem carimbada leva a sua etapa. A reserva debita o ciclo nessa etapa, mesmo que a etapa já tenha avançado (cenário 11). Sem carimbo, vale a etapa corrente no momento da reserva.
8. **Carimbo pelo MCP em duas fases, sem nunca bloquear o conteúdo.**
   - **Preparar:** antes de gravar numa thread com política ligada, o `message_post` pergunta ao daemon a etapa e o ciclo. Se o autor tem uma reserva concedida e ainda não respondida, o carimbo vem dela (etapa e ciclo). Senão, o carimbo leva só a etapa corrente. Essa consulta não muda nada e é idempotente.
   - **Confirmar:** só depois de a mensagem ser gravada, o MCP envia `{agentId, messageId, reservation}` e o daemon marca a reserva como respondida, ligada ao `messageId`. Repetir a confirmação com o mesmo `messageId` não muda nada.
   - Se a gravação falhar, nada foi confirmado e a reserva continua aberta. Se a confirmação falhar, o post seguinte do autor recebe o mesmo carimbo, o que está correto: as duas mensagens respondem ao mesmo ciclo.
   - As duas chamadas têm timeout curto (padrão 1,5 s). Com o daemon fora do ar ou lento, o post é gravado sem carimbo e devolve um aviso.
   - O agente nunca informa esses campos.
   - O campo `pass` vira `cycle`. Nenhum registro usa `pass` ainda, porque não havia escritor antes da F3b.
9. **Condutor da thread:** o autor da primeira mensagem no `CHAT.md` cujo perfil, pelo registro, tem o papel de arquiteto. É derivado do Markdown, sem campo para preencher, e aparece no painel só para leitura.
   - O condutor é fixo na F3b: avançar pela UI muda a etapa, não o condutor.
   - Se o condutor não puder avançar, por exemplo o Codex sem identidade verificada, o humano avança pela UI. Trocar o condutor não faz parte da F3b.
   - A ferramenta de avanço só vale para a sessão verificada que ocupa o slot do condutor (decisão 10).
10. **Ferramenta MCP `thread_advance_stage`** (`threadId`, `agentId`, `expectedStage`, `reference`). Para avançar, todas estas condições precisam valer:
    - o agente é o condutor;
    - a identidade está verificada (`clientStartedAt`, mesma instância do slot dono e sessão online);
    - a etapa corrente é igual à esperada, com comparação na fila (cenário 9);
    - a etapa não está esgotada (cenário 7);
    - `reference` é um `marc://` de mensagem ou artefato que existe na thread (cenário 8);
    - a etapa não é a última.
    - O avanço é gravado no histórico de etapas com `by: agent|human`, a referência e `droppedHolds` (decisão 3).
    - **Limite:** a referência é evidência para auditoria, não prova de consenso. O consenso continua sendo responsabilidade dos arquitetos e é verificável pelo humano na mensagem citada.
    - **Limite:** o Codex ainda não tem identidade verificada, o que vem da F5. Como condutor, ele recebe `identity_unverified`, e o humano avança pela UI. Um portador do token compartilhado poderia forjar pid e ppid; esse limite das interfaces cooperantes já está na ADR 0014.
11. **Piso contra restauração** (cenário 10): se o maior ciclo carimbado no `CHAT.md` numa etapa for maior que o `cyclesUsed` gravado, a thread pausa com `ledger_restored`.
    - A ação humana de recuperação, a mesma que a F3a oferece para `ledger_lost` e `ledger_invalid`, grava em cada etapa `cyclesUsed = max(gravado, maior ciclo carimbado)`. Ela nunca baixa o contador nem zera o piso.
12. **Ordem do juízo, dentro da fila da thread.** A tabela de despacho da reserva segue esta ordem:
    1. thread fechada dá recusa;
    2. `ledger_lost` ou `ledger_invalid` dá retenção sem gravar (decisão 3), porque sem o estado não há como conferir mais nada;
    3. origem inelegível dá recusa (decisão 5);
    4. pausa da workspace ou outro estado que se resolve no painel dá retenção gravada. Uma reserva já concedida e entregue de novo também fica retida: nada é estornado, só a entrega espera;
    5. deduplicação pela chave e pelo `runId`, com reconciliação, recusa por outro detentor ou `attempts_exhausted` (decisão 6), e `reservation_expired` abaixo do piso da poda;
    6. correlação: se fecha um ciclo aberto, concede sem débito e sem olhar o saldo;
    7. abertura: com saldo, concede e debita 1; sem saldo, retém com `budget_exhausted`.
    - O saldo é a última pergunta e só vale para a abertura.
    - As rotas humanas de `extend` e `advance` usam um juízo próprio, que confere só a autorização (política, configuração e estado). O saldo esgotado nunca as recusa, porque elas existem justamente para o limite.
13. **Waiter governado sem o freio de cadeia da F1.** Numa thread com política ligada, o saldo substitui o freio. O waiter não sai com 2 `chain_limit`, e o `reconcileMentions` continua intacto: a dispensa fica na camada do waiter, que ignora esse resultado quando a política está ligada. Com a política desligada, o freio continua igual.

### Tarefa D: núcleo e daemon (dev)

**Avaliador puro de reserva**, `src/core/activation-reservation.ts`:

- uma tabela de despacho na ordem de sete passos da decisão 12;
- a correlação de ciclos e a classificação consulta/nova entrega (decisão 6) ficam em funções puras próprias.

**Modelo:**

- `ThreadActivity` ganha `reservations` (limitado, com `prunedThrough`), `stageHistory` (com `droppedHolds`) e `uiMessages` (limitado), com validação em `isThreadExtras`;
- cada reserva guarda chave, etapa de origem, revisão, detentor, `runId`, tentativas, estado (`granted`, `held` com motivo, `answered` com `messageId`, `refused` com motivo) e o papel no ciclo (abre, fecha ou superado);
- `StageCounters` fica como está.

**Rotas** (em `activation-routes.ts`):

| Rota | O que faz |
| --- | --- |
| `POST …/activation/reservations` | `{messageId, recipient, holder, runId}`. O daemon lê o autor, as menções e o carimbo da mensagem canônica. A resposta é `granted`, `held` ou `refused`, mais o motivo, a etapa e o ciclo |
| `POST …/activation/stamp` | `{agentId}` devolve a etapa e o ciclo e a chave da reserva aberta, sem mudar nada |
| `POST …/activation/stamp/confirm` | `{agentId, messageId, reservation}`, depois da gravação: marca a reserva como respondida, de forma idempotente |
| `POST …/activation/agent-advance` | Com a identidade do MCP, verifica o condutor e a identidade e avança |

**Mudanças nas rotas existentes:**

- a rota de mensagem da UI grava a origem;
- o juízo da reserva vai para dentro da fila; `extend` e `advance` ganham o juízo humano, que não recusa por saldo esgotado (decisão 12);
- o avanço, humano ou do condutor, encerra as retidas das etapas anteriores com `stage_advanced` e grava `droppedHolds` (decisão 3);
- o piso `ledger_restored`, e a recuperação da F3a passa a gravar o piso carimbado (decisão 11).

**Outros pontos:**

- a view do painel ganha o condutor, as reservas retidas e o histórico de etapas;
- o campo `pass` vira `cycle` em `types.ts`, `markdown.ts`, no regex de `src/core/memory/sources/chat.ts` e no `Message` da UI;
- `appendMessageInWorkspace` copia `stage` e `cycle` só de chamadores confiáveis, e o schema do `message_post` continua sem esses campos.

**Testes, sem ramificação:**

- correlação: A→B depois B→A dá 1; só um lado automático dá 1 por volta; o sentido superado;
- fechar um ciclo com o saldo esgotado concede sem débito;
- `extend` e `advance` humanos funcionam com o saldo esgotado;
- retenção e liberação depois de `extend`;
- retidas de etapa anterior recusadas com `stage_advanced` e contadas em `droppedHolds`, enquanto as concedidas continuam iguais;
- deduplicação: o poll da retida e a repetição com o mesmo `runId` não gastam tentativa; o `runId` novo numa concedida gasta uma tentativa até `attempts_exhausted`; outro detentor recebe `already_reserved`; nada disso debita;
- poda: mensagem abaixo de `prunedThrough` e sem reserva recebe `reservation_expired`, sem débito;
- `ledger_lost` e `ledger_invalid` respondem `held` sem criar o arquivo;
- recuperação com piso: `cyclesUsed` nunca fica abaixo do maior ciclo carimbado;
- origem: o autor vem da mensagem canônica, o destinatário fora das menções é recusado, e a UI é comparada com um `role: user` forjado;
- carimbo: a preparação não muda nada, a confirmação é idempotente, e uma gravação que falhou deixa a reserva aberta;
- etapa de origem depois do avanço;
- dois avanços concorrentes;
- avanço por agente: não condutor, não verificado, sem referência, esgotado e última etapa;
- piso restaurado;
- prontidão com a pausa.

### Tarefa E: CLI e MCP (dev)

**`marc wait`** numa thread com política ligada:

- descobre o daemon como o `marc open` (`discoverDaemon`, `connectDaemon`);
- gera um `runId` por execução;
- a cada menção elegível pede a reserva;
- `granted` libera o JSON com a etapa, o ciclo e `reservation`;
- `held` mantém a espera e pergunta de novo a cada poll, com o mesmo `runId`;
- `refused` sai com 8, e a falha de conexão sai com 9;
- o timeout com retenção sai com 7 e `held`, sem avançar o cursor;
- o resultado `chain_limit` é ignorado nessa thread (decisão 13).

O `reconcileMentions` fica como está. A reserva entra numa dependência nova do `WaitLoop`, para o núcleo continuar puro.

**`message_post`:** faz o carimbo em duas fases (preparar antes de gravar, confirmar depois), em melhor esforço e com timeout, como na decisão 8.

**Ferramenta nova `thread_advance_stage`:** registrada em `registerThreadTools`, envia a identidade da sessão e é descrita no `helper.ts`.

**Textos:**

- os códigos 8 e 9 e o waiter numa thread com política em `src/core/marc-ops-skill.ts` e no tópico de escuta;
- a atualização de `docs/mcp-tools.md` e `docs/agent-workflows.md`.

**Testes:**

- um daemon temporário;
- o waiter concedido, retido e liberado, recusado e com o daemon fora;
- o waiter que morre e é rearmado com `runId` novo, e o poll retido que não gasta tentativa;
- o freio dispensado: com o módulo real em memória e saldo disponível, três mensagens seguidas de arquitetos produzem `chain_limit` no `reconcileMentions`, e mesmo assim o waiter governado pede a reserva e não sai com 2. Com a política desligada, a mesma sequência sai com 2;
- o carimbo com e sem reserva, com o daemon fora ou lento (timeout) e com a confirmação que falhou;
- a ferramenta de avanço com a identidade falsa ou ausente.

### Tarefa G: lead e avanço ao postar (dev, revisão 5)

Ajusta o que as tarefas D e E entregaram:

- **Núcleo e daemon:**
  - o condutor vira lead: derivação padrão mais troca guardada no estado (`lead`, `leadChanges`), com validação em `isThreadExtras`;
  - rota humana `PUT …/activation/lead` com `{agentId, expectedLead}` e comparação; só aceita perfil de arquiteto;
  - a rota de avanço do agente passa a ter preparar e confirmar: preparar avança com as condições da revisão 5, item 4; confirmar liga o `messageId`. Repetir a confirmação não muda nada;
  - a rota humana de avanço ganha o destino (`{expectedStage, to}`) e aceita qualquer estágio à frente. As retidas são encerradas como antes;
  - a view do painel traz o lead e o próximo estágio permitido;
  - a seção Activity do `SUMMARY.md` passa a incluir o histórico de estágios e as trocas de lead.
- **MCP:**
  - `message_post` com `advanceTo` opcional, seguindo a ordem da revisão 5, item 4, com os avisos `stage_advance_refused` e `activation_stamp_unavailable`;
  - sai a ferramenta `thread_advance_stage`, o seu registro, os seus testes e as suas descrições.
- **Critérios do Codex** (msg_2286cef9b8a145a8b4):
  - **Preparar efetiva o avanço**, e confirmar só associa a mensagem. O preparar devolve um identificador da operação concedida. A confirmação é idempotente e confere se a mensagem gravada é da mesma thread e do mesmo autor.
  - **Comparação do estágio:** o MCP captura o estágio corrente (`expectedStage`) da resposta do preparo do carimbo e o envia junto com `advanceTo`. O `advanceTo` não substitui a comparação.
  - **Conferências na mesma fila:** o lead atual, o estágio, a revisão e o saldo são conferidos na mesma fila da thread. Um retrato anterior do lead não basta.
  - **Timeout do avanço não prova recusa.** A mensagem é gravada com o carimbo do preparo e o aviso `stage_advance_unknown`, sem repetir o post nem o avanço. Uma confirmação que falha deixa `reference: null` e devolve aviso. Os timeouts continuam.
  - **Salto:** os destinos são estritamente crescentes, nenhum contador é zerado e o saldo pulado não é transferido. O teto é 3 × N (o N autorizado) mais as liberações do humano. O humano pode sair de um estágio esgotado, e o agente não. Saltar não comprova a conclusão das fases do RULES.
  - **Trocar o lead** não muda o saldo nem o estágio.
  - **Carimbo da mensagem que avança:** ela usa o estágio de destino e não carrega o `cycle` de uma reserva concedida no estágio antigo. Essa reserva continua com o débito e é confirmada como respondida por essa mensagem.
  - **Cenários da v3:**
    - o 7 vira avanço recusado com o post preservado;
    - o 9 exige dois pedidos com o mesmo estágio esperado e um único vencedor;
    - no 8, a mensagem passa a ser a referência, gravada depois e ausente quando a gravação falha.
    Os testes desses cenários migram para o caminho novo. A referência continua sendo evidência, não prova automática de consenso.
- **Textos:** `src/core/marc-ops-skill.ts`, o `helper.ts`, `docs/mcp-tools.md` e `docs/agent-workflows.md`. Neles entram:
  - o encaixe das fases do RULES nos três estágios;
  - o lead como ponto focal;
  - o avanço ao postar.
- **Testes, sem ramificação:**
  - o lead padrão;
  - a troca de lead pelo humano, inclusive com o lead esperado desatualizado;
  - o avanço do lead ao postar, com a mensagem carimbada no novo estágio e o `messageId` ligado;
  - o salto de Planning direto para Review, pelo lead e pelo humano, com o saldo do estágio pulado perdido;
  - o avanço recusado para quem não é lead, para o estágio esgotado, para trás, para o mesmo estágio e a partir da última etapa, sempre com o post gravado e o aviso;
  - a falha da gravação depois do avanço;
  - a seção Activity com estágios e leads.
  Os testes de integração com o daemon real seguem a montagem da tarefa E.

### Tarefa F: UI e documentação (dev)

- **Painel `Zap`**, na forma da revisão 5, item 5:
  - o selo único do estágio e a barra de ciclos;
  - as retidas acima das ações;
  - a escolha do estágio à frente no avanço, com o número de retidas;
  - os participantes com "Leads" e "Make lead";
  - o texto de `ledger_restored`, com a ação de recuperar também para esse estado.
- **Cartão da mensagem:** um selo discreto com o estágio e o ciclo, e a marca "Advanced to <stage>" na mensagem que avançou.
- **Textos** pelo i18n.
- **Validação:** Playwright CLI com prints.
- **Documentação:**
  - ADR 0014:
    - o princípio da revisão 5 (mecanismo no mARC, processo no RULES) e os três estágios como encaixe macro;
    - o lead;
    - os ciclos, a reserva, a retenção, os códigos 7, 8 e 9 e o carimbo `cycle`;
    - os limites;
  - `docs/ui-and-daemon.md`: as rotas novas e o painel.

### Tarefa H: autorização lida dentro da fila (dev, correção da revisão integrada)

O Codex deixou a revisão integrada pendente em msg_306a9112f8f54043ac. O código não cumpre por inteiro a decisão 12: três caminhos leem a autorização antes de entrar na fila da thread e decidem com esse retrato dentro dela.

- **Reserva:** `contextOf` (`activation-reservation-store.ts:134-162`) lê a política, a pausa da workspace, a configuração de ciclos, o piso e os arquitetos antes de `threads.update`. Com a pausa ligada enquanto o pedido espera na fila, a reserva é concedida e debita 1.
- **Avanço do agente:** a rota lê `cyclesState` (`activation-stage-routes.ts:147`) e `agentAdvanceIn` usa esse valor no máximo e no estado da configuração. Com o limite reduzido de 5 para 3 e 4 ciclos usados, o avanço passa em vez de ser recusado com `stage_exhausted`.
- **Ações humanas:** `readinessOf` roda antes de `extendStage` e `advanceStage`, e `checkedStage` não revalida a política nem a configuração.

**Correção:**

- tudo o que autoriza é lido dentro do passo da fila, no mesmo passo que grava: a política, a pausa, a configuração de ciclos, o piso dos carimbos e os arquitetos. As leituras desses arquivos não usam a fila da thread, então não há deadlock;
- a prontidão é julgada com o `activation` do arquivo que a fila entrega, e não com um `threads.read` à parte;
- o caminho sem gravação (thread fechada ou estado ilegível) pode continuar lendo fora, porque não grava nada;
- a semântica não muda: as ações humanas continuam sem olhar a pausa, e o avanço do agente continua sem olhar a pausa;
- `postUiMessageIn` fica como está, porque o retrato dele só decide se a origem humana é registrada e nunca concede nada.

**Testes de regressão, com a fila ocupada.** Um passo bloqueante segura a fila da thread, o pedido entra na fila, o estado muda e o bloqueio é solto. O resultado precisa ser o mesmo de uma chamada feita depois da mudança:

- reserva com a pausa ligada: retida com `workspace_paused` e sem débito;
- reserva com a política desligada ou com o pin invalidado;
- avanço do agente com o limite reduzido: `stage_exhausted`;
- avanço do agente com a configuração adulterada;
- "More N cycles" com a configuração alterada concede o valor atual;
- avanço humano com a política desligada: recusado.

**Escopo:** `src/daemon/activation-reservation-store.ts`, `activation-agent-advance.ts`, `activation-stage-routes.ts`, `activation-stage-actions.ts`, `activation-views.ts`, um módulo novo de leitura na fila em `src/daemon/` se for preciso para manter os arquivos com menos de 300 linhas, os testes dessas peças e um arquivo de teste novo. Comentários e documentação só onde afirmam o contrário. Sem UI, MCP, CLI nem Git.

### Tarefa I: thread encerrada sem painel e com a pasta limpa (dev, aceite do humano)

No aceite, o humano abriu o painel ⚡ de uma thread encerrada que tinha a política ligada. O painel mostrou "Paused" e "Saved policy changed outside mARC. Save again to authorize it." e ofereceu "Save", "Advance stage" e "Make lead". O daemon recusa todas essas ações com `thread_closed`, mas o painel não deveria aparecer.

A causa: no encerramento, o daemon apaga o arquivo de estado da thread (`removeClosedThreads` e `onThreadFolderChange` em `src/daemon/server.ts:123-130`), mas o `policy.json` continua na pasta da thread dizendo que a política está ligada. A view vê a política ligada sem autorização e conclui que ela foi alterada fora do mARC.

**Decisões do humano (10/11/2026):**

1. **Sem ⚡ numa thread encerrada.** O botão do painel não aparece, como já acontece sem thread selecionada. Se o painel estiver aberto quando a thread encerra, ele some junto.
2. **O lead não aparece depois do encerramento.** O registro fica na seção Activity do `SUMMARY.md`, que já guarda as etapas, os avanços, as trocas de lead e a revisão da política.
3. **A mãozinha no "Make lead".** O botão com cara de link usa `cursor: pointer`, e `not-allowed` quando está desabilitado, como `.activation-add` e `.activation-link`.
4. **A pasta da thread encerrada fica limpa.** Além do estado do daemon, o encerramento remove o `policy.json` da pasta da thread. A revisão da política continua registrada no Activity do `SUMMARY.md`.

**Implementação:**

- **UI:** `ThreadActivationSlot` (`src/ui/content-header-actions.tsx:95`) devolve `null` quando `isClosedThread(selectedThread)`. Sem mudança no painel aberto.
- **CSS:** `.activation-participant .activation-make-lead` em `src/ui/styles/activation-stage.css` ganha o cursor, com a regra `:disabled`.
- **Daemon:** a mesma limpeza que remove o estado remove o `policy.json`, nos dois caminhos: na partida (`removeClosedThreads`, que também limpa as threads encerradas com o daemon fora do ar) e quando o `SUMMARY.md` aparece (`onThreadFolderChange`).
  - A remoção é idempotente: um arquivo ausente não é erro.
  - Usa o mesmo caminho seguro de `policyPath` e a coordenação de escrita que já existe para o `policy.json`.
  - Só age numa thread com `SUMMARY.md`. Uma workspace ilegível mantém tudo, como hoje.
  - O retrato do Activity é tirado antes do `SUMMARY.md` ser gravado, então a revisão chega ao resumo antes da remoção.
- **Documentação:** `docs/ui-and-daemon.md` (o botão some na thread encerrada; o encerramento remove o estado e o `policy.json`) e o ponto do encerramento na ADR 0014.

**Testes:**

- a thread encerrada perde o estado e o `policy.json` pela observação da pasta e pela limpeza da partida;
- a thread aberta mantém os dois;
- uma segunda limpeza não falha com o arquivo já ausente;
- uma workspace ilegível não perde nada;
- a UI não mostra o botão ⚡ numa thread encerrada e mostra numa aberta;
- validação visual com Playwright num daemon temporário: o cursor do "Make lead" e a ausência do ⚡ na thread encerrada.

**Escopo:** `src/ui/content-header-actions.tsx`, `src/ui/styles/activation-stage.css`, `src/daemon/thread-cleanup.ts`, `src/daemon/server.ts`, `src/core/activation-policy-store.ts`, os testes dessas peças, `docs/ui-and-daemon.md` e a ADR 0014. Sem MCP, CLI nem Git, e sem tocar no daemon real do humano.

### Tarefa J: menu de sessões fora da thread encerrada (dev, aceite do humano)

Ainda no aceite, o humano abriu o menu de sessões (👥) de uma thread encerrada, a marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf. O menu mostrou "Pending 2": uma menção ao `codex-dev` sem resposta e a troca entre arquitetos esperando uma mensagem humana. A thread não tem pendência nenhuma, porque foi encerrada. O defeito vem da F2 e só apareceu agora.

**As causas:**

- `buildThreadSessionsView` (`src/daemon/session-views.ts:99`) deriva as pendências das mensagens com `deriveSessionWarnings` e não confere o encerramento;
- o vínculo com a sessão nativa mora no arquivo de estado da thread, que o encerramento apaga. Numa thread encerrada, todos os perfis aparecem como "no session linked";
- os comandos de copiar levam a um `marc open` que o daemon recusa com `thread_closed` (`src/daemon/session-operations.ts:226`).

O menu de uma thread encerrada não tem, portanto, nada útil a oferecer.

**Decisão do humano (10/11/2026):** o menu de sessões segue a regra do ⚡ e não aparece numa thread encerrada. Para reabrir uma sessão antiga depois do encerramento, o vínculo teria de sobreviver num registro, e isso seria um recurso novo. Não entra aqui.

**Implementação:**

- **UI:** `ThreadSessionsSlot` (`src/ui/content-header-actions.tsx:164`) devolve `null` quando `isClosedThread(selectedThread)`, como `ThreadActivationSlot`. Se o menu estiver aberto quando a thread encerra, ele some junto.
- **Daemon:** `buildThreadSessionsView` devolve `warnings: []` numa thread encerrada.
  - A conferência usa a mesma regra de encerramento do resto do daemon, `closedThreadChecker(store)`, injetada em `SessionServices` (montado em `src/daemon/server.ts`), como já acontece no registro (`isClosed`, `server.ts:80`).
  - Sem a injeção, o padrão é "não encerrada", para não quebrar quem monta os serviços nos testes.
  - Os slots e o formato da resposta não mudam. Só as pendências somem.
- **Documentação:** em `docs/ui-and-daemon.md`, o menu de sessões não aparece numa thread encerrada, e a view de sessões dela volta sem pendências.

**Testes:**

- a view de sessões de uma thread com `SUMMARY.md` volta sem pendências, mesmo com uma menção sem resposta e uma sequência de arquitetos que gerariam pendências numa thread aberta;
- a mesma thread aberta continua mostrando as pendências;
- a UI não monta o menu de sessões numa thread encerrada e monta numa aberta, por renderização no servidor, como em `test/ui-thread-activation-closed.test.ts`;
- validação visual com Playwright num daemon temporário: a ausência do 👥 na thread encerrada e a presença na aberta.

**Escopo:** `src/ui/content-header-actions.tsx`, `src/daemon/session-views.ts`, `src/daemon/server.ts`, os testes dessas peças e `docs/ui-and-daemon.md`. Sem MCP, CLI nem Git, sem mexer na derivação pura de `src/core/session-warnings.ts` (o encerramento é conferido na view), e sem tocar no daemon real do humano.

### Verificação da F3b

- **Checagens:** `pnpm validate`, `pnpm build` e `pnpm test` completo.
- **Ponta a ponta em daemon temporário:**
  - A posta mencionando B, e o waiter de B obtém a reserva, abrindo o ciclo 1;
  - B responde: a reserva do waiter de A fecha o ciclo 1;
  - no limite, a reserva fica retida, e "More N cycles" libera o waiter sozinho;
  - outra retenção no limite seguida de "Advance stage": o waiter sai com 8 `stage_advanced`, e o histórico registra `droppedHolds`;
  - o lead avança ao postar com `advanceTo`, e a mensagem sai carimbada no novo estágio;
  - o humano troca o lead pelo painel, e o lead antigo passa a ser recusado ao avançar;
  - o carimbo aparece no `CHAT.md` e no cartão.
- **Regressão:** uma thread sem política mantém o `marc wait` manual e o freio de cadeia.
- **Cenários da v3:** 1 a 3 e 6 a 11. O cenário 1 é coberto pela deduplicação, porque o supervisor só chega na F3c.

### Fica para a F3c

- o supervisor;
- as linhas 2, 4, 6 e 7 da precedência;
- a identidade do waiter, já que o ppid dele é o shell e não o cliente;
- a interface `ClientAdapter` (Adapter por cliente, escolhido por tabela de despacho);
- o campo `client` no perfil, que depende da decisão do humano.

## F3c: supervisor em modo confirmar e adaptador Claude (detalhada, revisão 6)

### Resumo

- O daemon passa a observar as menções das threads com a política ligada. Quando um arquiteto é mencionado e ninguém está escutando por ele, o daemon cria uma **pendência de confirmação**, um card no painel ⚡. Nada começa sem o clique do humano.
- O card aparece **a cada início**. A regra "aprovar só na primeira vez de cada agente em cada thread" fica para a F4, na thread e no commit dela, para o commit da F3 não crescer mais.
- Um agente com uma sessão aberta escutando continua acordando sozinho, como na F3b, sem card.
- Ao aprovar, o daemon confere tudo de novo dentro da fila da thread. Depois adquire a posse do slot com a origem `supervisor`, reserva o ciclo pela mesma reserva do waiter e inicia `claude -p` sem shell. O turno retoma a sessão vinculada ou cria uma nova, com o ID escolhido pelo mARC.
- O resultado do turno volta ao estado da thread e ao painel: erro, negações de permissão e custo. Uma falha vira um estado de recuperação visível, com o teto de tentativas e sem repetição automática.
- Só o Claude Code. O Codex continua sendo acordado pelo humano até a F5.
- Os pedidos de permissão do turno sem humano vão ao painel pela opção `--permission-prompt-tool` do Claude, na última tarefa de código.

**Fontes:**
- v3, seções 4, 5 e 7, e invariantes 1 a 8;
- v2, seção 4, a tabela de decisão por estado do vínculo, e seção 10, os cenários 1 a 14;
- adendo, decisões 1, 2 e 5;
- matriz da F0, seção 4, impactos na F2 e na F3: as células A1, A3, A4, C1, C2, E1, E2, E3 e G1;
- o código depois da F3b.

### Revisão 6.1 (11/11/2026): precisões do Codex

O Codex revisou a revisão 6 em msg_fa5ee092182c499e8d. As precisões abaixo prevalecem sobre as decisões e as tarefas da F3c onde houver diferença. Confirmei no código os pontos 1 e 2: `busy` só vale para `online` (`src/core/session-state.ts:148`), e `acquireIn` (`src/daemon/session-operations.ts:81`) e `reserveIn` (`src/daemon/activation-reservation-store.ts:56`) já entram na fila da thread.

1. **Tabela de precedência:**
   - `reserved` entra na linha 4;
   - a identidade só barra um ocupante existente, nunca `unbound`, a primeira criação ou `ended` comprovado;
   - o saldo esgotado não barra a volta que fecha um ciclo já pago. A linha 1 consulta `judgeReservation` em vez de repetir os portões.
2. **Aprovação numa única gravação.**
   - A posse com a origem `supervisor`, a reserva com o detentor estável e o estado `starting` são compostos por funções puras e gravados numa só passada de `threads.update`.
   - Nunca se chama `acquireIn` nem `reserveIn` dentro de `threads.update`, porque os dois já enfileiram e travariam a fila.
   - Uma recusa ou uma retenção da reserva não deixa posse órfã: nada é gravado.
   - A segunda passada, antes de iniciar, relê a revisão e a geração, e também as impressões digitais da política e da configuração, a pausa, a configuração de prazo e a elegibilidade.
3. **Persistência.**
   - A poda dos 50 registros não pode ressuscitar um card `declined` ou `expired` na passada da partida. O estado guarda um piso de mensagens já processadas por destinatário, e a partida não recria nada abaixo dele.
   - `starting` e `running` nunca vencem nem são podados.
   - Depois de um reinício do daemon, o supervisor reconcilia os turnos em andamento: confere o processo pelo PID e pelo instante de início, renova a posse se ele ainda vive e grava `failed: crashed` se ele morreu. Sem outro escritor e sem estorno.
4. **Adaptador.**
   - Fixa `--model` com o modelo do perfil.
   - Confere que o `session_id` do resultado é o esperado.
   - Prazo vencido e queda do processo prevalecem sobre um JSON incompleto.
   - Um diagnóstico ambíguo continua `error`.
5. **Prazo.**
   - O aviso pelo MCP é cooperativo: sem nova chamada às ferramentas, ele não chega, em qualquer sistema operacional. Isso fica declarado como limite.
   - Ao vencer, os pedidos de permissão pendentes são negados.
   - O encerramento forçado atinge só a árvore ou o grupo do turno, conferindo PID e instante de início.
   - Os temporizadores são cancelados quando o turno termina.
   - "Continue" revalida a autorização e o `attemptCap`, com o mesmo detentor e sem novo débito.
6. **Pedidos de permissão.**
   - Um `runId` conhecido não autentica outro processo MCP. O daemon vincula o pedido ao turno ativo pelo `runId` lido do ambiente do processo MCP e pela identidade desse processo: o pai precisa ser o processo do turno, conferido por PID e início, com o slot e a geração ativos.
   - As decisões vêm só da UI.
   - A resposta segue o contrato do Claude: um bloco de texto com o JSON `behavior` ("allow", com `updatedInput` opcional, ou "deny" com `message`), sem o envelope do mARC nem `structuredContent` ([contrato](https://code.claude.com/docs/en/errors#permission-prompt-tool-returned-an-invalid-result)). A ferramenta `permission_prompt` é registrada sem o envelope de bootstrap.
7. **Tarefas.**
   - **K** também prova a identidade e a presença do `-p` e do seu MCP: se o `claude agents` lista o processo `-p`, porque `resolveIdentityFrom` depende dele. A prova cobre ainda a cadeia de processos na TUI e no `-p`. Se a prova falhar, ainda valem as checagens de host e de posse.
   - **L** usa o cliente falso até a M e prova Retry, Continue, o reinício do daemon e a disputa entre o waiter e o `marc open`.
   - **M** prova o callback real de permissão.
   - O turno real da verificação passa pelo MCP e pelo `permission_prompt`, e não só pela saída JSON.

O Codex confirmou `--permission-mode auto` no `--help` do Claude Code 2.1.322.

### O que já existe e será reaproveitado

| Peça | Onde | Uso na F3c |
| --- | --- | --- |
| Ouvinte de mudanças na pasta da thread | `ThreadFolderListener` (`src/daemon/events.ts:25`), já usado pela limpeza do encerramento | Gatilho do supervisor |
| Menção elegível | `reconcileMentions` e `mentionsProfile` (`src/core/thread-mentions.ts`) | Mesma regra do waiter |
| Juízo da reserva em tabela | `judgeReservation` (`src/core/activation-reservation.ts:41`), chamado dentro da fila | Linhas 1 e 3 da precedência, e o débito |
| Estado do slot | `deriveSlotState` e `SlotDetails` (`src/core/session-slots.ts:92-117`), com `busy` e `listening` | Linhas 2, 4, 5, 6 e 7 |
| Posse com geração | `registry.acquire` (`src/daemon/session-registry.ts:84`), `BindingOrigin` (`session-slots.ts:21`) | Ganha a origem `supervisor` |
| Montador sem shell | `buildAgentLaunch` e `envChanges` (`src/core/agent-launch.ts:73-94`): prompt antes das flags, `CLAUDE*` e `MARC_TOKEN` fora do ambiente | Base do adaptador |
| Cliente do perfil | `clientForModel` (`agent-launch.ts:51`), pelo prefixo do modelo | Passa a ler o campo `Client:` primeiro |
| Dono e liberação | `runOwnedClient` (`src/cli-open-session.ts:89`) | Modelo do executor do turno |
| Prazo da pendência | `pendingTtlMinutes` da política (padrão 1.440) | Vencimento da confirmação |

### Decisões, com recomendação

1. **Escopo.** Modo confirmar, só para o Claude Code. O supervisor fica dentro do daemon, ligado por thread pela política, sem iniciar no login (adendo, decisão 1). O modo automático é da F4, e o Codex é da F5.

2. **Gatilho.**
   - O supervisor assina o `ThreadFolderListener` e reage à mudança do `CHAT.md` numa thread com a política `ready` e ligada.
   - Na partida do daemon, ele faz uma passada por essas threads. Uma menção antiga vira pendência, nunca execução, então não há rajada (v2, cenário 1).
   - Depois de reiniciar, o daemon não decide nenhuma linha que dependa de presença antes de um TTL completo das leases (45 s). Até lá, essas pendências mostram "Checking sessions" (v2, cenário 5).
   - Os destinatários são os perfis com papel de arquiteto e cliente suportado, exceto o autor. Desenvolvedores nunca são acordados (v2, cenário 8).
   - A origem segue a mesma regra da reserva: um autor arquiteto, ou uma mensagem que a UI registrou. Um `role: user` gravado pelo MCP não dispara (v2, cenários 9 e 10).

3. **Precedência**, numa função pura `judgeSupervision` em `src/core/activation-supervision.ts`. É uma tabela de despacho avaliada de cima para baixo, como a da reserva:

   | Linha da v3 | Condição | Resultado |
   | --- | --- | --- |
   | 1 | Thread fechada, política desligada ou ilegível, origem inelegível | Nada é criado |
   | 1 | O que `judgeReservation` reteria: pausa da workspace, estado que se resolve no painel, ou saldo esgotado para **abrir** um ciclo | Pendência `waiting` com o motivo, sem "Approve". Libera sozinha quando o humano resolve. A volta que **fecha** um ciclo já pago nunca é barrada pelo saldo (revisão 6.1) |
   | 2 | Slot `unknown` ou `conflict`, outro host, ou identidade não verificada **de um ocupante existente** | Pendência `waiting` com o motivo, sem "Approve". Um slot `unbound` ou `ended` comprovado não passa por esta linha (revisão 6.1) |
   | 3 | Já há reserva ou pendência para a mesma mensagem e o mesmo destinatário | Atualiza a existente, sem duplicar |
   | 4 | Slot `online` e ocupado (`busy`), ou slot `reserved` | Pendência `waiting: busy`; reavaliada a cada passada. `SlotDetails.busy` não cobre `reserved` (revisão 6.1) |
   | 5 | Slot `online` com escuta | Nada: o waiter reserva, como na F3b |
   | 6 | Slot `online` sem escuta | Pendência `waiting: not_listening`, sem "Approve". Retomar bifurcaria a sessão aberta (F0, A1 e A3) |
   | 7 | Slot `unbound` ou `ended` | Pendência `awaiting_confirmation`, com "Approve" |

4. **Pendência no estado da thread.**
   - **Campo:** `supervision` em `ThreadActivity`, limitado a 50 registros, com poda dos terminais mais antigos e validação em `isThreadExtras`.
   - **Chave:** mensagem e destinatário.
   - **Dados:** estágio de origem, estado, motivo, `createdAt`, `expiresAt` (criação mais `pendingTtlMinutes`), tentativa, `runId` e o resultado do turno.
   - **Estados:** `waiting`, `awaiting_confirmation`, `starting`, `running`, `done`, `failed`, `declined`, `expired` e `superseded`.
   - **Vencimento:** passa a `expired` sem nenhuma ação automática (decisão 7 da F3). Uma pendência vencida sai do painel e conta no Activity.
   - **Resposta antes da confirmação:** se o destinatário postar na thread depois da menção, a pendência vira `superseded`, a mesma regra que o menu de sessões já usa para "mencionado e sem resposta".

5. **Aprovação** por `POST …/activation/supervision/approve` com `{messageId, recipient}`, e recusa por `…/decline`. Ao aprovar, a passada da fila faz tudo, lendo cada dado no próprio passo (princípio da tarefa H):
   1. julga de novo com os dados atuais: revisão da política, portões, estado do slot e saldo. Se a pendência não estiver mais em `awaiting_confirmation`, responde 409 com o estado atual;
   2. adquire a posse com a origem `supervisor` e a geração esperada. Um `marc open` concorrente perde, ou ganha e a aprovação recebe 409 (v2, cenário 2);
   3. reserva com o detentor estável `supervisor:<mensagem>:<destinatário>`, pela mesma `judgeReservation`. O débito e a abertura ou o fechamento do ciclo seguem a F3b;
   4. grava o estado `starting`, com um `runId` novo, e responde.

   Logo antes de iniciar o processo, o executor faz uma segunda passada curta na fila. Ela confere que a revisão, a geração da posse e o estado `starting` não mudaram. Se algo mudou, o turno não começa, e a pendência vai para `failed: revoked`. A reserva continua debitada (v3, cenário 6 e invariante 5).

6. **Adaptador por cliente**, em `src/core/client-adapters.ts`: a interface `ClientAdapter` e uma tabela de despacho `{ "claude-code": claudeCodeAdapter }`.
   - **`headlessLaunch`:** usa as regras de ambiente de `buildAgentLaunch`. A ordem dos argumentos é `[prompt, "-p", "--output-format", "json", "--permission-mode", "auto", "--resume" | "--session-id", id, ...flags de vários valores]`. O modo "auto mode on" do Claude é o `--permission-mode auto`; o turno real da verificação confirma a flag.
     - Numa sessão nova, o mARC gera o UUID, grava o vínculo e só então inicia com `--session-id`.
     - Nunca usa `--bg`, que cria uma cópia da sessão (F0, A4). Nunca usa shell. Usa `windowsHide: true` e não recebe stdin.
   - **Prompt do turno:** `headlessPrompt(threadId, profile, messageId, author, deadline)`. Ele diz quem mencionou e em qual mensagem, pede para ler a thread desde o cursor e agir pelo RULES, informa o horário-limite e pede que o agente poste o progresso antes de trabalhos longos. Também pede para não armar o `marc wait` nesse turno. O `-p` espera os processos em segundo plano antes de sair (F0, E3), então um waiter prenderia o turno.
   - **`parseResult`:** lê a saída JSON e devolve `sessionId`, `isError`, `subtype`, `permission_denials`, `total_cost_usd` e `duration_ms`. Uma saída inválida vira `failed: invalid_output`.
   - **`failureReason`:** mapeia para `session_not_found`, `auth`, `client_missing`, `timeout`, `crashed`, `invalid_output` ou `error`. A mensagem "No conversation found" não distingue os casos (F0, C2), então um caso sem mapeamento vira `error`.

7. **Prazo por turno**, só para o turno que o supervisor iniciou. Uma sessão aberta pelo humano, no terminal ou pelo `marc open`, nunca é encerrada pelo mARC.
   - **Valor:** padrão de 60 minutos, configurável no painel global da workspace.
     - Fica em `marc.config.json` como `activation.turnTimeoutMinutes`.
     - O daemon guarda a impressão digital do último salvamento pela UI, no mesmo padrão de `activation.cyclesPerStage` (`src/core/activation-cycles.ts`). Uma edição fora da UI vale como alteração externa.
   - **Aviso antes do fim:** nos últimos 10 minutos, toda resposta das ferramentas do mARC ao turno, identificado por `MARC_SUPERVISOR_RUN_ID`, traz "N minutes left: finish the current change, post your progress and stop".
   - **Parada com calma, independente de sistema operacional:**
     - quando o prazo vence, as respostas das ferramentas passam a pedir "stop now", e o daemon dá 2 minutos de carência para o turno terminar sozinho;
     - essa fase usa o canal do MCP e não sinais do sistema operacional, então funciona igual em Windows, Linux e macOS.
   - **Encerramento forçado,** só depois da carência: uma estratégia por sistema operacional, numa tabela de despacho.
     - Windows: encerrar a árvore pelo PID iniciado (`taskkill /T /F`).
     - POSIX: iniciar o processo num grupo próprio e encerrar o grupo.
   - **Depois:** o card fica `failed: timeout` e oferece "Continue".
     - Ele retoma a mesma sessão com o prompt "you were stopped by the time limit; check what was left half done and continue".
     - O detentor é o mesmo, então não há novo débito de ciclo, e a tentativa conta.
     - Os arquivos já editados continuam no disco, e a conversa retomada mantém o contexto. Perde-se só o passo em andamento.

8. **Posse durante o turno.**
   - O vínculo fica com a origem `supervisor`, e o slot aparece como ocupado.
   - Um `marc open` nesse intervalo é recusado com `reserved`.
   - No fim, o executor libera a posse e grava `endedAt`. Com isso, o slot vai para `ended`, e a próxima menção pode retomar a sessão depois de uma nova confirmação.

9. **Recuperação.**
   - Uma falha grava `failed` com o motivo.
   - "Retry" aparece enquanto a tentativa estiver abaixo do `attemptCap` e o motivo não for `revoked`. O detentor é o mesmo, então a nova tentativa não debita de novo, como no waiter que morreu (cenário 3).
   - Sem nova tentativa, a pendência fica `failed` até vencer.

10. **Custo.**
    - O `total_cost_usd` do Claude acumula ao longo da sessão quando ela é retomada. Por isso o executor grava a diferença em relação ao último valor visto naquela sessão, guardado no vínculo.
    - O custo fica no registro da pendência e soma uma linha no Activity.
    - Nenhum limite em dinheiro bloqueia (decisão 5).

11. **Pedidos de permissão.**
    - O turno inicia no modo automático do cliente, `--permission-mode auto`, que já decide a maior parte das ações sem perguntar. No Codex, o modo equivalente é "approve for me", registrado para a F5.
    - O que o modo automático ainda perguntar vai ao painel: o turno inicia com `--permission-prompt-tool mcp__mcp-marc__permission_prompt` (F0, E2). O adaptador passa ao MCP a variável `MARC_SUPERVISOR_RUN_ID`, que não é um token.
    - A ferramenta nova `permission_prompt` envia ao daemon o pedido: `runId`, nome da ferramenta, entrada e `tool_use_id`. Depois espera a decisão do humano.
    - O painel mostra o pedido no cartão da pendência, com "Allow" e "Deny".
    - Sem decisão em 10 minutos, a resposta é negar com o motivo `timeout`. Quando o turno termina, os pedidos ainda abertos são negados.
    - O turno nunca é reenviado.
    - Um `runId` desconhecido ou encerrado é recusado, então outro agente não usa a ferramenta.
    - As negações que vierem em `permission_denials` aparecem no resultado do turno (F0, E1).

12. **Identidade do waiter.**
    - O waiter passa a enviar o próprio PID na reserva. O daemon sobe a cadeia de processos pais, até 8 níveis, e exige encontrar o `clientPid` e o `clientStartedAt` do vínculo do slot cujo `nativeSessionId` é o `--session` do waiter.
    - Se não encontrar, a reserva fica `held: identity_unverified` (linha 2).
    - **Condição:** a tarefa K prova primeiro que essa cadeia existe no Windows, do `claude.exe` ao `node marc wait`, passando pelo shell da ferramenta, na TUI e no `-p`. Se a prova falhar, a verificação não entra, e o limite fica declarado.

13. **Campo `Client:` no perfil.**
    - É uma linha opcional, `Client: claude-code` ou `Client: codex`, lida em `AgentProfileSummary.client`.
    - `clientForModel` vira `clientOf(profile)`: primeiro o campo explícito, depois o prefixo do modelo, como hoje.
    - O valor `codex` é reconhecido, mas fica sem adaptador (`unsupported_client`) até a F5.
    - O `agent_register` aceita `client` como opcional.
    - Preencher a linha nos perfis desta workspace é administração do catálogo. O humano autorizou o principal a fazê-lo nos quatro perfis, depois da tarefa K.

14. **UI**, com uma maquete aprovada antes:
    - **Painel ⚡:** uma seção "Waiting for you" acima das retidas, com um cartão por pendência. O cartão mostra o destinatário, a mensagem com "ir para", o motivo, as ações ("Approve", "Decline" e "Retry" quando cabe) e os pedidos de permissão do turno em andamento.
    - **Botão do ⚡:** um contador de pendências que pedem ação.
    - **Painel global:** o campo do prazo por turno, ao lado do padrão de ciclos.
    - Nada a mais. O painel continua mínimo (revisão 5, item 1).

15. **Activity no encerramento:** a seção ganha ativações pelo supervisor, falhas, cards vencidos (só a contagem) e o custo estimado somado, sem ID nativo, PID nem host.

16. **Custo:** sem mudança de critério. O valor é o delta do `total_cost_usd` por turno, mostrado como custo estimado no valor da API. Logado com o plano, o `claude -p` consome a mesma cota da assinatura.

### Tarefas (um dev por vez, `claude-dev`, haiku com effort xhigh, sem Git)

**Tarefa K: núcleo puro e prova da cadeia de processos**
- `src/core/activation-supervision.ts`: `judgeSupervision`, as transições de estado da pendência, o vencimento e a poda.
- `src/core/client-adapters.ts`: a interface, o adaptador do Claude (`headlessLaunch`, `headlessPrompt`, `parseResult` e `failureReason`) e a tabela de despacho.
- Campo `Client:`: leitura no perfil, `clientOf` e o `client` opcional no `agent_register`.
- A leitura e a autorização de `activation.turnTimeoutMinutes`, os textos do aviso de prazo e do "stop now", e a tabela de encerramento forçado por sistema operacional.
- Prova da cadeia de processos da decisão 12, num script que só lê a tabela de processos, sem tocar em sessões do humano. O resultado vai na entrega.
- Testes em tabela, sem ramificação, para cada linha da precedência, cada transição, cada motivo de falha e a ordem dos argumentos.

**Tarefa L: supervisor no daemon**
- O assinante do ouvinte da pasta e a passada da partida, com a espera de um TTL.
- O campo `supervision` no estado e a validação.
- As rotas `approve`, `decline`, `retry` e `continue`.
- A origem `supervisor` na posse, a reserva com o detentor estável e a segunda passada antes de iniciar.
- O executor: início sem shell, prazo da configuração, aviso nas respostas do MCP, carência, encerramento forçado por sistema operacional, leitura do resultado, delta de custo, liberação e `endedAt`.
- A verificação da identidade do waiter na rota de reserva, se a prova da tarefa K passar.
- **Testes de integração** com um cliente falso, um script Node que imprime o JSON do Claude ou falha conforme o caso. Cobrem os cenários 1 a 14 da v2 que se aplicam e os cenários 1, 4, 5 e 6 da v3.

**Tarefa M: pedidos de permissão**
- A ferramenta MCP `permission_prompt`.
- As rotas do daemon para criar o pedido, decidir e consultar.
- O prazo, a negação quando o turno termina e a recusa de `runId` desconhecido.
- Testes com o cliente falso chamando a ferramenta.

**Tarefa N: UI e documentação**, depois da maquete aprovada pelo humano
- A seção "Waiting for you", o contador no ⚡, o prazo por turno no painel global e os textos pelo i18n.
- Validação com Playwright CLI num daemon temporário.
- **ADR 0014:** o supervisor, o adaptador, a origem `supervisor`, a recuperação, os pedidos de permissão e os limites.
- `docs/ui-and-daemon.md` (as rotas novas e o painel), `docs/mcp-tools.md` (`permission_prompt` e o `client` do registro) e `docs/agent-workflows.md` (o turno sem humano).

### Verificação da F3c

- **Checagens:** `pnpm typecheck`, `pnpm code:check`, `pnpm build` e `pnpm test` completo.
- **Ponta a ponta em daemon temporário, com o cliente falso:**
  - política ligada;
  - A menciona B, que não tem sessão: aparece a pendência;
  - "Approve" adquire a posse, reserva, inicia e grava o resultado;
  - uma nova menção retoma a sessão de B depois de outra confirmação;
  - "Decline", o vencimento, a falha com "Retry" e a revogação entre a reserva e o início;
  - um pedido de permissão aprovado e outro vencido;
  - **prazo do turno, com um prazo curto de teste:**
    - o aviso aparece nas respostas das ferramentas do mARC;
    - um cliente falso que obedece ao "stop now" termina na carência, sem encerramento forçado;
    - um cliente falso que ignora o aviso e tem um processo neto é encerrado com a árvore inteira, sem deixar órfão;
    - "Continue" retoma a mesma sessão sem novo débito.
- **Independência de sistema operacional:** a parada com calma é coberta por testes que não dependem do sistema. O encerramento forçado é testado no Windows, nesta máquina. O caminho POSIX tem teste de unidade da tabela e fica como limite declarado se não houver uma máquina POSIX para rodá-lo.
- **Um turno real com `claude -p --permission-mode auto`**, num perfil haiku de uma workspace temporária, autorizado pelo humano. Confirma a flag, a retomada, a saída JSON e o custo, que deve ser de centavos (F0, G1).
- **Regressão:**
  - uma thread sem política não cria pendência;
  - o waiter governado da F3b continua igual quando o dono está escutando;
  - o `marc wait` manual e o freio de cadeia não mudam.

### Decisões do humano (10/11/2026)

1. **Card a cada início.** "Aprovar só na primeira vez de cada agente em cada thread" fica para a F4.
2. **Card sem clique:** some no prazo da política (24 h) e conta no Activity, só como número.
3. **Prazo por turno:** 60 minutos, configurável no painel global, com aviso nos últimos 10 minutos, parada com calma pelo canal do MCP, encerramento forçado por sistema operacional e "Continue". A parada com calma precisa funcionar independentemente do sistema operacional.
4. **Permissões nesta fase:** modo automático do cliente (`--permission-mode auto`) mais `--permission-prompt-tool` para o que ainda for perguntado.
5. **Campo `Client:`** com o prefixo do modelo como reserva. O principal preenche os quatro perfis.
6. **Turno real com `claude -p`** na verificação.
7. **Custo:** sem mudança. É o `total_cost_usd` por turno, como estimativa no valor da API.

## Execução

1. **Registro na thread:**
   - rodar `workspace_update_recommendations` e `workspace_audit` com `scope: preflight`;
   - anexar `plano-f3-politica-orcamento-reserva-supervisor.md` com mensagem curta mencionando o Codex para revisão (decisões 2 a 4 e ideias do Tucano);
   - rodar as auditorias de artefatos e referências.
2. **F3a:**
   - tarefa A0 e tarefa A pelo mesmo dev, em sequência (general-purpose, haiku, effort xhigh, perfil `claude-dev`). A parte da tarefa A que não depende de armazenamento (tipos e campos do bloco) foi feita antes da revisão 2 e é reaproveitada. A refatoração parcial dos arquivos de sessão da F2 é concluída dentro da A0;
   - maquete para você (https://claude.ai/artifact/JmzVwPosU3McRgH47NpxRD);
   - tarefa B.
   - Um dev por vez, com `OK_BOOTSTRAP` antes da autorização, e Git proibido.
   - Cada dev publica a própria entrega.
   - Faço de 2 a 3 passagens de revisão por tarefa.
   - Revisão integrada `revisao-integrada-f3a.md`, lida pelo context-mode, com veredito.
3. **Checkpoint com você** antes de detalhar a F3b. Encerramento da thread só com a sua autorização.

## Verificação (F3a)

- **Classificação:** mudança executável de núcleo, daemon, MCP, UI e contrato de parsing.
- **Checagens:** `pnpm validate` (conferir que só mexeu no escopo), `pnpm build` e `pnpm test` completo.
- **Testes sem ramificação**, como descritos nas tarefas, com um teste de regressão de que o engineer loop e o `marc wait` manual não mudam numa thread sem política.
- **Navegador:** Playwright CLI com daemon temporário. Ligar a política, editar estágios, pausar e retomar, e ver saldo e avisos.
- **Ao vivo:**
  - o `policy.json` gerado pela UI;
  - apagar o arquivo da thread com a política habilitada pausa a thread;
  - o bloco com `stage` e `pass` aparece na UI e na memória sem quebrar mensagens antigas;
  - a migração do `sessions.json` real, sobre uma cópia;
  - encerrar uma thread temporária grava a seção Activity e apaga o arquivo da thread.
