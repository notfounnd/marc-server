# Resultado da F0, frente Claude interativa (ConPTY e terminais reais), revisão 3

Autor: claude-dev (perfil compartilhado de desenvolvedor, papel developer)
Principal: claude-software-architect
Estado: entrega de autoria do executor, com a correção do driver e as células refeitas. A revisão integrada do principal está pendente. Isto não é aprovação técnica.
Referência de custo da frente anterior: "conteúdo da sessão: TTL entre 6 e 65 minutos" (revisão aceita).
Evidência bruta: pasta temporária marc-f0 (PTY/<célula>/evidence, PTY/results.jsonl, PTY/gasto-pty.jsonl, PTY/lib). Fora do repositório.

## Resumo

- Achado do driver (bloqueante, corrigido): o texto e o Enter eram enviados na mesma escrita. A TUI tratava isso como colagem, e o Enter virava quebra de linha. O texto ficava na caixa de entrada até o próximo Enter. Esse bug explica a lista travada da A2 e as "latências" de 4 a 15 minutos da revisão 1. Detalhes em "Achado do driver".
- Correção aplicada: texto e Enter em escritas separadas (300 ms), submissão confirmada pelo transcript, fim de turno por turn_duration, diálogo pendente por tool_use sem tool_result, teclas de diálogo só 1 (aprovar) ou 4 (negar).
- Achado não declarado na revisão 1, agora declarado: aprovação acidental do Bash na D2 (execução 2). Detalhes em "Aprovação acidental".
- Achado do lançador (corrigido nesta revisão): na revisão 2 o prompt veio depois de `--allowedTools mcp__probe__probe_ping`. Essa flag é variádica, e o prompt foi lido como segundo nome de ferramenta. A conclusão "prompt posicional não é submetido" era falsa como achado de cliente. Com o prompt como primeiro argumento e `--allowedTools=...`, a C1P e a C1 (mintty e wt) passaram. Detalhes em "C1".
- Aprovação acidental do Write (D4, repetição isolada): o /exit do driver foi enviado com o diálogo de Write aberto e aprovou o Write por Enter. Desvio do driver, declarado em "Aprovação acidental do Write".
- Resultado por célula nesta revisão: B1 testado; A1, A4, A2, B3 testado com limite (A1, A4 e B3 não refeitas, conforme a decisão de validade; A2 refeita na revisão 2); D2 testado; D3 testado com limite; C1P testado (prompt posicional submetido com a montagem correta); C1 testado (mintty e wt); D4 limite declarado (amostra travada na primeira execução, isolada; a repetição isolada acordou e pediu Write, mas o driver não manteve o diálogo aberto para negar com 4); D5 limite declarado (não executado).
- Gasto total desta tarefa: US$ 0,066199, teto US$ 2. A revisão 3 acrescentou US$ 0,007334, dentro do adicional de US$ 0,50.

## Ambiente e método

- Claude Code 2.1.316; Node.js v22.20.0; node-pty 1.1.0 em PTY/node_modules (instalado pelo principal, binário win32-x64). ConPTY, TUI de 120x40, cwd em PTY/<célula>.
- Executável: claude.exe no diretório de instalação (o mesmo arquivo que o comando claude).
- Ambiente da TUI: variáveis CLAUDE* e CLAUDECODE herdadas do harness foram removidas. Só os nomes são citados.
- Flags da TUI: --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config kit/mcp.json --permission-mode manual --allowedTools mcp__probe__probe_ping. Sem bypass.
- Rodapé da TUI nas sessões: "◐ medium · /effort". Esforço que a TUI mostra. Não verifica o reasoning do executor, que segue configurado e não verificado por introspecção.
- Fonte de verdade desta revisão: o transcript JSONL da sessão (usuário, tool_use, tool_result, turn_duration). Os snapshots de tela são texto do fluxo sem ANSI, não a tela renderizada.
- Driver: PTY/lib/tui.mjs (TUI), PTY/lib/protocol.mjs (submissão e estado pelo transcript), PTY/lib/session.mjs (início, aprovação, negação e encerramento), PTY/lib/support.mjs, PTY/lib/probe-check.mjs e PTY/lib/pty-ledger.mjs. Roteiros desta revisão: PTY/run-a2-v2.mjs, PTY/run-d-v2.mjs, PTY/run-c1p.mjs (revisão 2, montagem errada), PTY/run-c1p-v2.mjs (revisão 3, prova), PTY/run-c1.mjs e PTY/C1/wrapper.mjs (revisão 3, mintty e wt) e PTY/run-d4-single.mjs (revisão 3, D4 isolada).
- Probe: só probe_ping foi permitido nesta frente.

## Achado do driver: texto e Enter na mesma escrita

- Evidência (D2, execução 2, D2/evidence/driver.log e transcript): o pedido de Bash foi escrito às 18:12:25 com o Enter na mesma escrita. O snapshot de 18:27 mostra o texto ainda na caixa de entrada, sem resposta. O transcript tem a mensagem do usuário com timestamp 18:42:25.992, que é exatamente o instante em que o driver enviou "/clear". O tool_use de Bash saiu às 18:42:27.795, dois segundos depois.
- Consequência: a "latência" de 4 a 15 minutos da revisão 1 foi o texto não submetido. O modelo estava ocioso, esperando o Enter. A lista da A2 (execução 2) ficou assim, e a mensagem "Responda somente com: A2-TUI" foi fundida à lista pendente.
- Nas células anteriores (A1, A4, B1, B3), o mesmo bug pode ter atrasado a lista da A1 (execução 3). Como o coordenador decidiu que esses resultados seguem válidos, não os refiz.
- Correção aplicada e verificada nas novas execuções: texto, pausa de 300 ms, Enter em escrita separada. Submissão confirmada por uma nova entrada user no transcript em até 10 s, com um reenvio único de Enter se não confirmar. Na A2 v2 e na D2/D3 v2, todas as submissões de texto foram confirmadas na primeira tentativa.
- Slash commands: o transcript grava /clear e /exit como entradas do tipo <command-name>. A checagem de texto puro não os reconhece. Na D2, o /clear ficou com confirmed false, mas o efeito foi verificado pela troca do arquivo de sessão (nova sessão dc043f52).

## Aprovação acidental do Bash (D2, execução 2, não declarada na revisão 1)

- O pedido de Bash (tool_use em 18:42:27.795) ficou pendente no diálogo "Do you want to proceed?". No transcript, o tool_result só aparece em 19:12:54.763, depois do /exit enviado em 19:12:48.
- O Enter do /exit foi recebido pelo diálogo aberto. A opção padrão, "1 Yes", foi escolhida e o Bash rodou. O waiter (PID 21516, D2/waiter.pid) foi iniciado por essa aprovação. Conferido: o PID não está mais vivo.
- Regra adotada no driver: nunca enviar texto livre nem Enter com diálogo aberto. Diálogo aberto só recebe a tecla exata do passo: 1 para aprovar, 4 para negar. Implementada em PTY/lib/session.mjs (approveOnce e denyOnce recusam se o nome da ferramenta pendente não bater) e exitTui (recusa /exit com diálogo pendente).

## Aprovação acidental do Write (D4, repetição isolada, revisão 3)

- Fatos, com horários UTC: o waiter foi iniciado com a tecla 1 às 20:04:16. O gatilho foi criado às 20:04:27.41. A notificação do waiter entrou no transcript às 20:04:27.78, e o modelo pediu Write às 20:04:29.16. A tela (D4/evidence-solo/session-stripped.txt) mostra o diálogo "Write(d4.txt)" com "Esc to cancel".
- O driver não viu essa pendência pelo transcript: o tool_use do Write não apareceu como pendente durante a espera de 5 minutos (20:04:29 a 20:09:28). A causa exata não foi determinada.
- Às 20:09:28.2 o driver, sem ver pendência no transcript, enviou /exit com Enter. O tool_result "File created successfully at ... d4.txt" saiu às 20:09:28.6, 0,4 s depois. O Enter aprovou o Write. d4.txt existe em PTY/D4/d4.txt com o conteúdo D4 e foi mantido como evidência.
- Violação da regra: Enter com diálogo aberto. Correção no driver (PTY/lib/session.mjs, exitTui): /exit não é enviado se a tela mostrar marcadores de diálogo ("requires approval", "Esc to cancel", "Do you want to pro", "Yes, and don't ask again") ou se o transcript tiver tool_use pendente. Nesse caso a sessão é encerrada só por PID, sem teclas.

## Classificação por célula

| Célula | Classificação | Achado principal |
| --- | --- | --- |
| A1 | testado com limite | -p com a TUI aberta funciona. A TUI não viu o turno externo. Não refeita. |
| A4 | testado com limite | --bg contra TUI aberta cria cópia com ID novo e aviso em stderr. Turno da cópia não executado. Não refeita. |
| B1 | testado | O MCP da TUI recebe CLAUDE_CODE_SESSION_ID igual ao ID da sessão. |
| A2 | testado | Refeita com o driver corrigido: lista e A2-TUI respondidos; -p e TUI se leem nos dois sentidos. |
| B3 | testado com limite | Um único processo MCP em abertura, 3 minutos parada, /clear e /compact. Reconexão em sessão separada. Não refeita. |
| D2 | testado | Waiter iniciado por aprovação "1"; /clear troca a sessão; o gatilho acorda a sessão pós-/clear sem prompt humano. |
| D3 | testado com limite | Mesma TUI, após o /clear: waiter iniciado com "1"; /exit mostrou o banner, mas o evento de saída não veio; a TUI foi encerrada por PID e o waiter sobreviveu. |
| D4 | limite declarado | Amostra 1 (revisão 2, em paralelo com D2 e C1P): submissão confirmada e nenhum tool_use em 5 minutos, observação isolada. Amostra 2 (revisão 3, isolada): Bash aprovado com 1; a sessão acordou com o gatilho e pediu Write 1,5 s depois, com o diálogo na tela; o driver não viu a pendência e o /exit aprovou o Write por engano. A espera de 2 minutos e a negação com 4 não foram executadas. |
| C1P | testado | Prompt posicional submetido com a montagem correta: registro user com o prompt em 20:02:43 e chamada probe_ping registrada. |
| C1 | testado | Mintty e wt (revisão 3, montagem corrigida): prompt submetido, chamada probe_ping registrada nos dois, claude e wrapper encerrados por PID, wrapper saiu com código 0. Renderização no wt vista apenas no print enviado pelo humano. |
| D5 | limite declarado | Não executado: exige suspender a máquina. |

## Células

### A1: sessão aberta contra -p (bloco 1, execução 3)

- Sessão da96b9bf-cc26-466e-95ae-e209543a0b42 (cwd PTY/A1). Versão 2.1.316.
- Comando da TUI: `claude --session-id <id> <TUI_FLAGS>`.
- Comando -p com a TUI aberta: `claude -p --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config kit/mcp.json --output-format json --max-budget-usd 0.50 --resume <id> "Responda somente com: A1-PRINT"`, cwd PTY/A1.
- TUI: respondeu "A1-BASE"; depois, a chamada de probe_ping foi registrada.
- -p com a TUI aberta: subtype success, result "A1-PRINT", exit 0, stderr vazio, sem aviso.
- Lista pedida à TUI depois (texto completo em A1/evidence/session-stripped.txt): não aparecem "A1-PRINT" nem "A4-BG". A resposta chegou depois do timeout do driver, com a mensagem pendente (ver o achado do driver).
- "Tool loaded." é o resultado da busca de ferramenta diferida do probe, não uma mensagem do usuário.
- Classificação: testado com limite.

### A4: --bg --resume contra TUI aberta (bloco 1, execução 3)

- Comando: `claude --bg --resume <id> --model claude-haiku-5-5 --setting-sources "" --strict-mcp-config --mcp-config kit/mcp.json "Responda somente com: A4-BG"`, cwd PTY/A1, com a TUI aberta.
- Stdout literal: `backgrounded · <id-bg-1> (idle — send a prompt to start)`, com as sugestões claude agents, attach, logs e stop.
- Stderr literal: `Starting background service…` e `note: session <id-sessão> is open in another Claude Code process, so this started a copy as <id-bg-1>. The original conversation is unchanged.`
- Listagem `claude agents --json --all` com a TUI aberta, só entradas de marc-f0, IDs sanitizados (A4/agents-sanitized.jsonl): uma entrada interactive, cwd PTY/A1, status idle, pid da TUI, sem name; uma entrada background, state failed, cwd PTY/A1.
- Depois da TUI fechada, a cópia continuava failed. Stop e rm da cópia: exit 0.
- Entradas failed não trazem campo de motivo (chaves: id, cwd, kind, startedAt, sessionId, state). Não investigado, conforme a decisão do principal.
- Classificação: testado com limite. O aviso e o ID novo são confirmados. O turno da cópia não foi executado.

### B1: ID visto pelo MCP da TUI (bloco 1, execução 3)

- O processo MCP iniciado pela TUI tem CLAUDE_CODE_SESSION_ID igual ao ID da sessão (registro "equal-to-session-id").
- A chamada probe_ping veio desse processo (ppid igual ao pid da TUI, verificado).
- Classificação: testado. Limite: uma sessão.

### A2: alternar -p e interativo (v2, cwd PTY/A2, sessão b70d4565-b9ad-4a6a-bcc5-072ae1e11f01)

- A sessão de bloco 1 foi limpa antes desta revisão. Por isso a A2 v2 cria a própria sessão com um turno de setup (A2-BASE) na TUI, em PTY/A2.
- Setup: "Responda somente com: A2-BASE" submetido e confirmado na 1ª tentativa; turno concluído em 1,7 s (turn_duration). /exit: exit-event, banner "Resume this session with".
- -p antes da TUI: "Responda somente com: A2-PRINT" → resultado "A2-PRINT", exit 0.
- TUI retomada, "Liste todas as mensagens que eu te enviei nesta conversa, na ordem.": submetida e confirmada; turno concluído em 1,7 s. Resposta (texto do transcript): "Aqui estão as mensagens que você me enviou, na ordem: 1. Responda somente com: A2-BASE; 2. (Um comando /exit executado diretamente no Claude Code, com a saída "Goodbye!". Não foi uma mensagem sua para mim.); 3. Responda somente com: A2-PRINT; 4. Liste todas as mensagens que eu te enviei nesta conversa, na ordem." A lista contém o turno do -p.
- "Responda somente com: A2-TUI": submetido e confirmado; turno concluído em 1,7 s; resposta "A2-TUI".
- /exit com nenhum diálogo pendente: exit-event, banner.
- -p depois da TUI, "Qual foi a ultima mensagem que eu te enviei antes desta?": resultado "A última mensagem sua antes desta foi: Responda somente com: A2-TUI", exit 0.
- Continuidade comprovada nos dois sentidos: a TUI carrega o turno do -p; o -p lê a mensagem da TUI.
- Classificação: testado. Limite: uma execução; a sessão foi criada nesta revisão, não é a sessão do bloco 1.

### B3: vida do MCP na mesma TUI (sessão 5105bcf5, cwd PTY/B3, execução anterior, não refeita)

- Um único processo MCP: pid 15760, ppid 18828 (a TUI). Serviu as quatro chamadas probe_ping: após abertura, após 3 minutos parada, após /clear e após /compact.
- /clear: a TUI abre nova sessão (transcript 445dc301), mas o processo MCP não mudou.
- /compact: concluído. O processo MCP não mudou.
- /mcp, sessão original: menu com "Probe MCP Server · Status ✔ connected · Tools: 3 tools" e as opções "1. View tools, 2. Reconnect, 3. Disable". O driver pressionou Enter na primeira opção (View tools). Erro de navegação do driver; não houve reconexão nessa sessão.
- Reconexão em sessão separada (run-b3-reconnect.mjs, sessão 389bc363, cwd PTY/B3R): pid 28896 (ppid 1936, a TUI) encerrou em 17:44:10 (stop stdin-end), e surgiu o pid 34092 com o mesmo ppid. O ping seguinte mostrou pid 34092.
- Classificação: testado com limite.

### D2: /clear com waiter ativo (bloco 4, v2, cwd PTY/D2, sessão 66a21043-7a8b-471e-b138-9486af02740a)

- Pedido de Bash em background (`node D1/waiter.mjs`): submetido e confirmado em 19:51:07.55. Diálogo pendente em 19:51:09.98. Tecla "1" enviada em 19:51:11.09. tool_result em 19:51:17.97: "Command running in background with ID: bymh34zqa". Turno concluído em 12,3 s. waiter PID 3348.
- /clear: enviado; confirmação por texto não reconheceu o comando (ver achado do driver). Efeito verificado: nova sessão dc043f52.
- Gatilho em 19:51:47.09 (trigger.flag). A notificação do waiter entrou no transcript da sessão pós-/clear às 19:51:47.51. O modelo respondeu sozinho em 19:51:52.74, sem prompt humano: "The conversation is cleared and I have no prior context in this session. A background command, "Run waiter.mjs script in background," finished with exit code 0. I haven't read its output. Tell me if you want me to, or what you'd like to work on next."
- O waiter (PID 3348) não estava mais vivo 15 s depois do gatilho.
- Classificação: testado. Limite: uma execução. A sessão pós-/clear não tinha memória do waiter; ela soube do término pela notificação, não leu a saída.

### D3: sair com waiter ativo (bloco 4, v2, mesma TUI, sessão dc043f52)

- Pedido de Bash em background (waiter novo): confirmado em 19:52:02.43. Diálogo pendente em 19:52:03.61. Tecla "1" em 19:52:03.95. tool_result em 19:52:04.03. Turno concluído em 2,7 s. waiter PID 28856.
- /exit: a TUI imprimiu o banner "Resume this session with", mas o evento de saída do node-pty não veio em 10 s. O driver encerrou a TUI pelo PID que abriu (19:52:27.58).
- O waiter 28856 continuava vivo 2 s depois do encerramento da TUI. Gatilho em seguida: o waiter saiu em até 3 s.
- Classificação: testado com limite. Limite: o encerramento foi confirmado pelo banner, e não pelo evento de saída; a TUI foi finalizada por PID.

### D4: despertar com aprovação pendente (bloco 4)

- Amostra 1 (revisão 2, sessão 7c844f43-149c-4e71-af02-146128a23be6, TUI pid 2500, em paralelo com a D2 e a C1P): submissão do pedido de Bash e Write confirmada em 19:52:38.07 (1ª tentativa). Nenhum tool_use apareceu no transcript em 5 minutos; o transcript tinha só a mensagem do usuário. Observação isolada, não reproduzida na amostra 2, que teve primeira resposta em 3 s. Driver e TUI encerrados por PID verificado (driver PID 29532, TUI PID 2500). d4.txt não existia.
- Amostra 2 (revisão 3, isolada, sem outra sessão aberta; sessão cb365e5a-4b05-4071-b1e3-f0f9fcd03c62; TUI pid 32116). Submissão confirmada 20:04:13.8. Bash pendente às 20:04:15.7. Tecla 1 às 20:04:16.3. tool_result do Bash às 20:04:25.5 ("Command running in background with ID bdcseg7sa"). Turno concluído em 12,3 s. Waiter PID 13548. Gatilho às 20:04:27.4. A sessão acordou sozinha: a notificação do waiter entrou às 20:04:27.8 e o modelo pediu Write às 20:04:29.2, com o diálogo aberto na tela.
- O driver não manteve o diálogo de Write aberto para negar: não viu a pendência pelo transcript e enviou /exit às 20:09:28.2, o que aprovou o Write (ver "Aprovação acidental do Write"). Os 2 minutos com o diálogo aberto e a negação com 4 não foram executados.
- Classificação: limite declarado. O despertar com aprovação pendente foi observado (a sessão acordou e chegou ao pedido de Write), mas a espera e a negação não foram executadas, porque a aprovação acidental ocorreu antes. Amostra 1 registrada como observação isolada.

### C1: TUI em mintty e no Windows Terminal (revisão 3, montagem corrigida)

- Comandos: mintty `C:/Program Files/Git/usr/bin/mintty.exe -e <node> C1/wrapper.mjs`, cwd PTY/C1; wt `wt.exe powershell.exe -NoProfile -Command "& '<node>' '<wrapper>'"`, cwd PTY/C1. O wrapper inicia claude.exe com stdio herdado e este lançamento: `[prompt, --model, ..., --allowedTools=mcp__probe__probe_ping]`.
- Desvio do driver (montagem errada, revisão 2): o prompt estava depois de `--allowedTools mcp__probe__probe_ping`. Essa flag é variádica (`--allowedTools, --allowed-tools <tools...>` no `claude --help`), então o prompt foi lido como segundo nome de ferramenta, e a caixa de entrada ficou vazia. A conclusão anterior "prompt posicional não é submetido" era falsa como achado de cliente. Por isso a C1P e a C1 da revisão 2 foram refeitas.
- Aviso para a F2: o lançador não pode pôr o prompt depois de flag variádica. `--allowedTools` e `--mcp-config` aceitam vários valores. Usar prompt como primeiro argumento ou a forma `--flag=valor`.
- Prova na C1P (ConPTY, cwd PTY/C1P, montagem corrigida): registro user com o prompt em 20:02:43.017, e chamada probe_ping registrada. Critério combinado atendido.
- Repetição mintty (20:03:14): wrapper PID 16932 (stdin e stdout como TTY), claude PID 30016, probe PID 31940 com ppid 30016. Chamada probe_ping registrada às 20:03:24. Encerramento por PID: claude 30016 e mintty 25276 (aberto pelo driver). Ao final, claude e wrapper não estavam vivos.
- Repetição wt (20:03:29): wrapper PID 20176 (WT_SESSION definido), claude PID 22108, probe PID 5552 com ppid 22108. Chamada probe_ping registrada às 20:03:33. Encerramento por PID: claude 22108. O wrapper saiu sozinho com código 0. Ao final, claude e wrapper não estavam vivos.
- Código de saída: o wrapper registra o código real do claude no log (`claude exit code=...`) e sai sempre com 0, para a aba do wt fechar sem deixar janela aberta. No encerramento por PID a linha registra `exit code=1`, que é o efeito do kill, não um erro da TUI.
- Print do humano (wt, revisão 2): mostra o banner e as cores renderizados, a caixa de entrada vazia com o placeholder 'Try "refactor <filepath>"' e nenhum diálogo de confiança. Enviado pelo humano; não observado pelo executor. Não houve print novo nesta revisão.
- Limites: cores, teclado e aparência da janela não observados pelo executor. As duas sessões da C1 não têm registro de cost-state (encerradas por PID antes de gravar), então o custo delas não foi medido; o total desta frente não inclui esse custo.
- Classificação: testado.

### D5: suspensão durante a espera

- Não executado. Exige suspender a máquina. Limite declarado, conforme o escopo.

## Gasto desta tarefa (PTY/gasto-pty.jsonl, valor cumulativo final por sessão)

| Sessão | Célula | Valor (US$) | Observação |
| --- | --- | --- | --- |
| 2a3b14b9 | A1 execução 1 | 0,00500673 | inválida |
| c4f849ee | A1 execução 2 | 0,00542217 | incompleta |
| da96b9bf | A1 execução 3 | 0,01068270 | válida; copiada antes da A2 v2 |
| 445dc301 | B3 (após /clear) | 0,00766196 | |
| 5105bcf5 | B3 | 0,00525667 | |
| 389bc363 | B3R | 0,00526979 | reconexão |
| fbe3df63 | D2 execução 1 | 0,00296788 | inválida |
| bf22002c | D2 execução 2 | 0,00286837 | inválida (aprovação acidental) |
| 627e9eb2 | D4 execução 1 | 0,00244874 | inválida |
| b70d4565 | A2 v2 | 0,00546361 | nova |
| 66a21043 | D2 v2 (antes do /clear) | 0,00230162 | nova |
| dc043f52 | D2/D3 v2 (após /clear) | 0,00351401 | nova |
| 7c844f43 | D4 v2 (revisão 2) | 0 | sem turno respondido |
| 188adc9c | C1P (montagem errada) | 0 | só o /exit |
| 0da49ec4 | C1P (montagem corrigida, revisão 3) | 0,00285469 | prova do prompt posicional |
| 2646435c | C1 mintty (revisão 3) | 0 | sem cost-state gravado |
| edfef730 | C1 wt (revisão 3) | 0 | sem cost-state gravado |
| cb365e5a | D4 isolada (revisão 3) | 0,00447967 | aprovação acidental do Write |
| Total | | 0,06619861 | teto US$ 2; revisão 3: +0,00733436, dentro do adicional de US$ 0,50 |

- Cada valor é o cost-state final da sessão, cumulativo da sessão (inclui -p e os turnos da TUI). Não há soma de chamadas separadas.
- A4: as chamadas --bg não geraram turno, sem custo reportado. C1: sem transcript de sessão antes do /exit.

## Desvios do brief e desta revisão

- Bug de envio (texto e Enter na mesma escrita) corrigido. A1, A4, B1 e B3 não foram refeitas, conforme a decisão de validade do coordenador.
- A2 v2 cria uma sessão nova em PTY/A2, porque a sessão do bloco 1 foi limpa antes da revisão.
- Aprovação acidental do Bash na D2 execução 2, declarada aqui. Regra de diálogo implementada.
- D2 v2: /clear confirmado pelo efeito (troca de sessão), não pelo texto.
- D3 v2: a TUI foi encerrada por PID depois do banner, sem evento de saída.
- D4 v2: parada no teto de 5 minutos, sem diálogo. Não houve Bash, gatilho, Write nem negação nesta execução.
- C1: montagem errada do lançador na revisão 2 (prompt depois de flag variádica). Desvio do driver, declarado. Corrigido e refeitos C1P e C1 (mintty e wt), com o aviso para a F2 sobre flags variádicas.
- D4 repetida isolada: o /exit do driver aprovou o Write com Enter, porque o driver não viu a pendência pelo transcript. Desvio do driver, declarado. A guarda do /exit passa a checar a tela e o transcript.
- B3: espera ociosa de 3 minutos, como no brief (o roteiro pede 5).
- Acréscimo: --permission-mode manual. Não é bypass.
- Execuções inválidas e parciais estão nas pastas run1-invalid-evidence, run2-list-incomplete-evidence e run-v1-invalid.

## Sobras e limpeza

- Processos: nenhum processo com marc-f0 ao final, verificado por Win32_Process. Encerrados por PID verificado nesta revisão: driver da D4 (PID 29532) e TUI da D4 (PID 2500). Waiters da D2 (3348) e da D3 (28856) terminaram.
- Agentes de background: claude agents --json --all sem entradas com marc-f0.
- Pastas de projeto em ~/.claude/projects: removidas as nove pastas desta frente (PTY-A1, PTY-B3, PTY-B3R, PTY-D2, PTY-D4 da revisão 1; PTY-A2, PTY-C1P, PTY-D2 e PTY-D4 desta revisão), depois de copiar os transcripts para as evidências de cada célula. Nenhuma pasta marc-f0 restante.
- trigger.flag de PTY/D4 removido (sobra da revisão 1).
- Revisão 3: removidas as pastas de projeto PTY-C1, PTY-C1P e PTY-D4, depois de copiar os transcripts para PTY/C1/evidence-v2, PTY/C1P/evidence-v2 e PTY/D4/evidence-solo. Processos: nenhum com marc-f0 (Win32_Process). Agentes: nenhuma entrada com marc-f0. Nenhuma pasta marc-f0 restante em ~/.claude/projects.
- Mantidos de propósito: PTY/D4/d4.txt (evidência da aprovação acidental do Write), PTY/C1/evidence-v2, PTY/C1P/evidence-v2, PTY/D4/evidence-solo.
- Não tocados: marc-f0/H e marc-f0/PTY/node_modules.
