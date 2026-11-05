# Revisão integrada da F3c: supervisor em modo confirmar e adaptador Claude

Autor: marc://@claude-software-architect. Data: 11/11/2026.

## Veredito

**Aprovado tecnicamente.** O estado integrado das tarefas K, L1, L2, L3, M e N atende ao plano da F3c (revisão 6, com a 6.1 e as decisões do humano), e um turno real com `claude -p` passou de ponta a ponta.

A confirmação do Codex (marc://#msg_6a975d3ec0644e34a7) apontou uma pendência: um pedido de permissão criado depois do prazo. A correção mudou o código, então este veredito foi refeito sobre o estado novo (seção "Pendência da confirmação do Codex").

O Codex confirmou a aprovação técnica. O humano aceitou em 12/11/2026, depois das correções de layout e de uma simulação com turnos reais na workspace (seção "Aceite do humano").

## Escopo e fontes revisados

- **Plano:** artefato `plano-f3-politica-orcamento-reserva-supervisor.md`, seção F3c, com "Revisão 6.1" e "Decisões do humano".
- **Decisão de UI:** a variante C, o contador numérico e o campo global (marc://#msg_bc5cc58969b7475bb4).
- **Entregas de marc://@claude-dev:**
  - K: marc://#msg_b801d84f4b9b47dcb2;
  - L1: marc://#msg_7a4e354ae84947a5ab;
  - L2: marc://#msg_0fcdbedb0e004a8398;
  - L3: marc://#msg_ca4b5ed52a4845a791;
  - M: marc://#msg_930517fd1640420ea5;
  - N: marc://#msg_371ede9582b54966b1.
- **Aprovações por tarefa:** a da M em marc://#msg_2585ac2e3dbf483188 e a da N em marc://#msg_2d2b324ca1044869ae. As anteriores ficaram no canal entre agentes.
- **Código:**
  - o núcleo (`activation-supervision*`, `client-adapters`, `activation-turn-timeout*`, `process-*`, `supervision-*`);
  - o daemon (passada, início, segunda passada, executor, recuperação, permissões, views e `thread-store`);
  - o MCP (`permission-tool`, `deadline-notice`);
  - a UI (seção "Waiting for you", contador e campo do prazo).
- **Docs:** ADR 0014, `docs/ui-and-daemon.md`, `docs/mcp-tools.md` e `docs/agent-workflows.md`.

## Critérios do plano e evidência

1. **Card a cada início, sem nada começar antes do clique.**
   - A passada só cria cards e não debita ciclo.
   - "Approve" julga de novo na fila da thread e, numa única gravação, adquire a posse com a origem `supervisor`, reserva com o detentor estável e grava `starting`.
   - A segunda passada antes do processo leva o card a `failed: revoked` se a revisão, a geração ou o card mudaram.
   - Testes de integração da L1 e da L3 cobrem isso, incluindo a corrida entre approve e `marc open`.
2. **Precedência.**
   - `judgeSupervision` é uma tabela de despacho de cima para baixo: settled, refused, listening, held, barred, busy, notListening e free.
   - Os testes em tabela da K cobrem as linhas.
   - Na revisão, foram corrigidos: o card duplicado com o dono escutando, a reserva de outro host tratada como livre e o card pendente que não ficava `superseded` na recusa.
3. **Card sem clique.** O card vence no TTL da política (24 h) e conta no Activity só como número. Cards em `starting` e `running` nunca vencem, e a poda mantém o piso por destinatário.
4. **Prazo do turno.**
   - O padrão é 60 minutos, numa faixa de 15 a 480, gravado pela UI com impressão digital, no mesmo padrão dos ciclos.
   - O aviso nos últimos 10 minutos e o "stop now" chegam pelas respostas das ferramentas do mARC.
   - A carência é de 2 minutos, e o encerramento forçado é feito por sistema operacional.
   - "Continue" retoma a mesma sessão sem novo débito.
   - Testes da L2 com cliente falso:
     - um cliente obediente termina sozinho na carência;
     - um cliente que ignora o aviso é encerrado com o neto, sem órfão, no Windows.
5. **Recuperação após reinício.**
   - Nada que dependa de presença é decidido antes de 45 s.
   - A reconciliação usa o pid e o instante de início, ou o pid e o sessionId.
   - Um processo vivo mantém a posse e tem o prazo rearmado. Um processo morto vira `failed: crashed`, com uma gravação só (L3).
   - A identidade do waiter é lida dentro da fila, sem cache no caminho de autorização.
6. **Permissões.**
   - O turno usa `--permission-mode auto` e `--permission-prompt-tool mcp__mcp-marc__permission_prompt`.
   - O pedido só é aceito com o run vivo e com o ppid igual ao processo do turno (pid e instante de início), no slot e na geração ativos. O alvo é relido logo antes da criação, sem espera entre os dois passos.
   - A decisão vem só do painel.
   - O pedido é negado se vencer em 10 minutos, no prazo do turno ou no fim do turno.
   - A resposta segue o contrato do Claude: um único bloco de texto com o JSON `behavior`.
   - A M provou o callback com um `claude -p` real em modo `default`.
7. **Campo `Client:`.** O campo explícito tem precedência, e o prefixo do modelo é a reserva. Os 4 perfis da workspace foram preenchidos, e o `agent_register` aceita `client` como opcional.
8. **Custo.**
   - É o delta de `total_cost_usd` contra o último valor da sessão, mostrado como estimativa no valor da API.
   - Na revisão da N:
     - um turno sem saída lida passou a ficar sem custo próprio, em vez de $0.000;
     - o gasto desse turno entra no delta do turno seguinte da mesma sessão.
9. **UI (variante C).**
   - A seção "Waiting for you" fica entre Stage e Participants.
   - As holds da F3b passaram para essa seção.
   - O contador numérico no ⚡ conta só o que pede ação.
   - O campo do prazo fica no painel global.
   - Toda a i18n passa pelo `t()`.
   - Validação com o Playwright CLI num daemon temporário, nos quatro quadros e numa largura de 390 px.
10. **Activity.** São registradas as ativações, as falhas, os cards vencidos e a soma do custo estimado. Sem id nativo, pid ou host.

## Achados da revisão integrada, já resolvidos

- **O painel ficava defasado (N, achado 1).**
  - Nenhuma transição em segundo plano emitia `workspace-changed`. Pedidos de permissão, fim de turno e expirações ficavam invisíveis até um refresh manual, e o contador do ⚡ não acendia.
  - Correção: um ponto único no `ThreadStore`, que emite só quando o conteúdo muda, e emissões no store de permissões, com timer próprio de expiração.
- **Tempestade de eventos (N, achado 3).**
  - Com o ponto único, cada heartbeat de sessão forçava um refresh da UI.
  - Correção: o passo `quiet` no heartbeat e no refresh de observação.
  - A varredura das 25 chamadas de `threads.update` está no relatório do dev, e as gravações que mudam card, slot, estágio, política ou orçamento continuam anunciando.
- **Custo falso (N, achado 2).** Descrito no critério 8.

## Pendência da confirmação do Codex, resolvida

- **Achado:** em `createPermission`, o alvo do run era lido antes da leitura do corpo e das checagens assíncronas (tabela de processos, fonte de agentes e fila da thread). Se o prazo vencesse nesse intervalo, a negação do fim do prazo alcançava só os pedidos já abertos, e o pedido criado em seguida nascia aberto e aprovável no painel.
- **Correção (marc://@claude-dev, marc://#msg_dd6d1450c48f48dabd):**
  - depois das checagens, a rota relê o alvo e só abre o pedido se ele for o mesmo: mesmo pid, geração, slot e dono, este comparado em tempo constante;
  - a releitura e a criação são síncronas, sem `await` entre elas, então nenhuma negação cabe entre as duas;
  - um alvo ausente ou trocado responde 404 `run_not_found` e não grava nada.
- **Regressão:** uma tabela de duas linhas segura a checagem da tabela de processos com um portão. Na primeira linha, o turno vence e a negação roda durante a espera: a resposta é 404 e nenhum pedido fica aberto. Antes da correção, essa linha respondia 201. A segunda linha é o controle sem vencimento, que continua com 201.
- **Run adotado após reinício:** o alvo dele confere só o prazo, sem o dono perdido. Isso não abre brecha, porque a última checagem, `checkSlotHeld`, lê a posse dentro da fila da thread. Um dono perdido recusa o pedido ali, e o run sai do mapa quando a vigilância termina.

## Verificação final com um turno real

- **Ambiente:**
  - daemon temporário criado a partir do código do repositório, numa porta efêmera, com workspace temporária no scratchpad;
  - perfil arquiteto com `claude-haiku-5-5` e `Client: claude-code`;
  - MCP do mARC do build, configurado só nessa workspace;
  - o daemon real não foi tocado.
- **Roteiro:** uma menção pela rota de mensagens da UI levou o card a `awaiting_confirmation`. A rota "Approve" respondeu 200 com `started`, `mode: new` e `attempt: 1`.
- **Resultado:**
  - o card passou por `running` e terminou em `done`;
  - o agente fez o bootstrap pelo MCP e postou "F3c real turn ok" na thread, com o estágio carimbado;
  - o turno levou cerca de 30 s, com custo estimado de US$ 0,0136;
  - o slot terminou com a origem `supervisor`, `endedAt` gravado e sem token de dono, e o `lastCostUsd` ficou guardado para a retomada.
- **O que não ocorreu:** o modo auto não precisou perguntar nada, então `permission_prompt` não foi acionado nesse turno. O callback real já tinha sido provado na M. A menção vinda da UI não debitou ciclo, como manda a regra do ADR para as concessões de origem UI.
- **Transcrição local:** `~/.claude/projects/C--Users-junior-AppData-Local-Temp-claude-16769ecf785bb7f2-0e8bcfec-b2e2-430d-b3fb-05858e8b61db-scratchpad-v-real-ws`. Não foi apagada.

## Aceite do humano (11 e 12/11/2026)

O aceite pediu só ajustes de UI, sem mudança de comportamento. Cada ajuste foi feito pelo claude-dev e revisado pelo principal. As entregas do dev estão em marc://#msg_0a79329dcb694f9d87 e marc://#msg_09ea2ce25d554832ac. As rodadas seguintes não tiveram post próprio e estão consolidadas aqui.

- **Tipografia e componentes comuns:**
  - o campo do prazo do turno mostra a unidade no rótulo, "(minutes)";
  - "Go to the message" virou o botão de ícone comum, `GoToButton` (`src/ui/go-to-button.tsx`);
  - os cabeçalhos das popovers usam um só `MenuHead` (`src/ui/menu-head.tsx`), sem repetir a contagem do botão;
  - os blocos de CSS repetidos entre `sessions.css` e `activation.css` foram para `src/ui/styles/popover-panel.css`.
- **Popovers do cabeçalho (📎 ⚡ 👤):**
  - **contêiner comum `.popover-menu`:** a rolagem é da popover inteira, com `scrollbar-gutter: stable`, a mesma técnica das colunas, e o conteúdo não se desloca quando a barra aparece;
  - no ⚡, a linha dupla no topo saiu (a linha fica só entre seções) e o Save fica preso embaixo (`position: sticky`);
  - **largura:** 420 px nas três, por decisão do humano;
  - as primitivas `.popover-body` e `.popover-section` substituem as classes de corpo e de seção de cada domínio.
- **Um componente para os três botões:** `HeaderMenu` (`src/ui/header-menu.tsx`) monta o botão, o estado pressionado, o selo de contagem, a popover e o cabeçalho. Artifacts, ativação e sessões passam só o ícone, os textos, a contagem e o corpo. O humano apontou que antes os três montavam tudo à mão e que o certo era um componente. Um teste garante que nenhum dos três monta o gatilho por conta própria.
- **Selo e espaçamento, com os valores que o humano validou na tela:**
  - 8 px entre os botões, no cabeçalho da thread e na linha do topo da coluna do meio, pela classe comum `.action-row`;
  - o selo `.count-badge` fica a −4 px no topo e na direita, e não encosta no botão vizinho quando o botão está pressionado;
  - o invólucro dos botões passou a se chamar `.header-action` em todos eles, inclusive o da pausa (antes `.header-artifacts`).
- **Simulação real pelo humano, numa thread de teste da workspace** (Opus 5.5, daemon real):
  - cada menção ao claude-software-architect gerou um card, que o humano aprovou;
  - **retomada provada:** o segundo turno continuou do cursor do primeiro com `thread_read_since`, na mesma sessão. Antes isso só tinha sido testado com o cliente falso;
  - o arquiteto delegou ao claude-dev como subagente, e o dev comentou na thread;
  - menções ao Codex e ao claude-dev não geraram card, como previsto: o Codex ainda não tem adaptador (F5), e devs nunca são acordados;
  - a thread de teste foi fechada pelo caminho oficial, o que removeu o estado dela no daemon e a política, e depois apagada a pedido do humano. O índice de memória não chegou a incluí-la.
- **Ainda sem prova com o cliente real:** o fim do prazo do turno e um pedido de permissão no modo auto. Os dois são cobertos pelos testes com o cliente falso.

## Checagens do estado final

- **Principal:** `pnpm typecheck`, `pnpm code:check`, `pnpm build` e `pnpm test` completo, todos com exit 0.
- **Dev:** 2491 testes aprovados, 0 falhas, e `pnpm validate` sem alterar arquivos (hash antes e depois, sem `.marc/cache`).
- **Depois da correção da pendência do Codex:**
  - principal: `pnpm typecheck`, `pnpm code:check` e `pnpm test` completo, todos com exit 0;
  - dev: 2493 testes aprovados, 0 falhas (16 no arquivo das rotas de permissão, 33 nos de permissão), `pnpm build` com exit 0. O `pnpm validate` não rodou, porque grava no repositório inteiro; `code:check` e `typecheck` cobrem a verificação.
- **Depois do aceite, antes do stage (principal, 12/11/2026):**
  - `pnpm typecheck`, `pnpm code:check` e `pnpm build` com exit 0;
  - a primeira execução de `pnpm test` teve 3 falhas de tempo, em `mcp-protocol.test.ts` e `mcp-version-pin.test.ts`, enquanto a máquina rodava outras sessões. Esses dois arquivos passaram sozinhos duas vezes (12/12), e a segunda execução completa passou com 2494/2494;
  - o `pnpm validate` não rodou, pelo mesmo motivo de antes.

## Limites declarados (na ADR 0014)

- As rotas de decisão usam o bearer do daemon. Um agente que lê o token poderia se autoaprovar, o que é o limite das interfaces cooperativas.
- O aviso de prazo é cooperativo: um turno que não chama o mARC não o vê. O encerramento forçado não depende do turno.
- O encerramento forçado foi provado só no Windows. O caminho POSIX tem só o teste da tabela.
- O nome do servidor MCP é fixo, `mcp-marc`.
- A identidade do Codex fica para a F5.

## Pendências e riscos para o humano

- **Token do daemon real:** apareceu no índice local do context-mode durante a M. Decidir sobre a rotação e, opcionalmente, sobre a limpeza do índice.
- **Transcrições** dos turnos reais em `~/.claude/projects`, das provas da K, da M e desta verificação. Decidir se ficam.
- **Diretórios `marc-supervision-*` no %TEMP%,** deixados pelas fixtures dos testes (padrão anterior à F3c). Candidato a backlog.
- **Registro, fora do escopo:**
  - com a workspace registrada por outro id, o estado da política e as mensagens ficaram em pastas diferentes;
  - o SSE da UI envia o token na query, o que já acontecia antes.
- **Backlog já conhecido:**
  - extrair o `governedOf` duplicado;
  - incluir `.tsx` no typecheck;
  - a thread do Playwright f742659a;
  - o estado do daemon que sobra quando a pasta de uma thread aberta é apagada.
- **Backlog novo, do aceite:**
  - em 390 px, linhas longas de markdown na lista de mensagens fazem a página rolar na horizontal (447 px), o que já acontecia antes;
  - a classe `.action-row` divide o bloco de CSS com as linhas das configurações da workspace;
  - o prompt do turno não diz que o humano aprovou o início. Na simulação, o agente escreveu "sem aceite seu" depois de um Approve. Basta uma linha no prompt.
