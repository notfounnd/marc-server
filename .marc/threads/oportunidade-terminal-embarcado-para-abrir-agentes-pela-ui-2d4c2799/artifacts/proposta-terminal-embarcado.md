# Proposta: terminal embarcado para abrir agentes pela UI

Autor: marc://@claude-software-architect
Data: 02/11/2026, complementada em 03/11/2026 com o retorno da frente Codex da F0 e com a decisão do humano sobre o shell
Estado: oportunidade evolutiva, sem priorização. Entra depois do sistema de eventos.

## 1. Resumo

O mARC passaria a abrir a sessão do agente dentro da própria interface, no modelo do terminal integrado do VS Code:

- **Emulador:** xterm.js na UI, ligado ao daemon por WebSocket.
- **Pseudo-terminal:** node-pty no daemon (ConPTY no Windows, forkpty no Linux e no macOS).
- **Programa:** o shell configurado do workspace, executando um comando fixo que o mARC monta para abrir o agente.

O botão ao lado do título da thread passaria a ter duas saídas: abrir no terminal embarcado (padrão) e copiar o comando (alternativa, já prevista na v3). As duas usam o mesmo comando.

Ganhos esperados:

- **Mesmo caminho em todo sistema operacional.** Não é preciso saber se existe mintty, Windows Terminal, Terminal.app ou gnome-terminal, nem como cada um recebe argumentos.
- **Ambiente do usuário na sessão.** Abrindo dentro do shell configurado, a sessão herda o PATH e as variáveis que o shell monta, igual a uma abertura manual.
- **Ambiente do agente controlado.** O lançador define as variáveis da sessão, inclusive para o agente usar só bash (seção 4).
- **Presença como fato.** Para as sessões que o daemon lança, ele é o dono da árvore de processos.
- **Sessão independente do navegador.** Fechar a aba não encerra o agente, e a UI pode se reconectar.

## 2. Origem

- Ideia do humano, na sessão de execução da F0: usar node-pty para lançar os agentes, igualar recursos entre sistemas operacionais e permitir abrir a ferramenta de um agente pela UI, além de copiar o comando.
- Decisão do humano em 03/11: seguir o modelo do VS Code, com configuração do caminho do shell ou detecção automática com preferência por bash. Hoje o problema existe só no Windows; Linux e macOS já usam um shell do tipo bash.
- A F0 conduziu as TUIs do Claude e do Codex por node-pty no Windows. É a evidência prática da proposta (seção 5).
- A decisão da v3 em marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc põe o supervisor no daemon, e esta proposta é coerente com ela.

## 3. Três modos de abrir

O shell configurado executa um comando fixo, por exemplo `bash -lc "<comando do agente>"`, que termina junto com o agente.

| Modo | Comando do agente (Claude) | Observação |
| --- | --- | --- |
| Thread com arquiteto registrado | `claude --resume <sessionId da thread>` | Consultar a presença antes. Se a sessão estiver aberta em outro processo, o Claude cria uma cópia com ID novo (F0, A4) |
| Thread nova | `claude "<prompt da thread>" --session-id <uuid novo> <flags>` | O vínculo entre thread e sessão nasce no lançamento. O MCP recebe `CLAUDE_CODE_SESSION_ID` igual ao ID (F0, B1). O prompt vem antes das flags que aceitam vários valores (F0, C1) |
| Sem thread | `claude` na pasta do workspace | Só o harness original do agente, sem vínculo com thread |

**No Codex**, a F0 indica um arranjo próprio (matriz consolidada, F5):

- a conversa fica hospedada num App Server supervisionado pelo daemon;
- o terminal embarcado abre a TUI remota com `codex --remote ws://127.0.0.1:<porta> resume <id>`;
- o despertar usa `codex queue`, e não digitação no terminal.

**Sem shell livre.** A UI abre só comandos que o mARC monta. Uma aba de shell livre seria decisão separada, pelo risco de segurança.

## 4. Shell e ambiente do agente

São dois "shells" diferentes, e cada um precisa da sua solução.

### 4.1 Shell que hospeda a sessão

É o programa que roda no pty e abre o agente.

- **Linux e macOS:** usa o `$SHELL` do usuário.
- **Windows:** detecção automática com preferência por bash, no modelo de perfis do VS Code, e um campo para informar o caminho:
  1. Git Bash nos caminhos de instalação do Git for Windows, como `C:\Program Files\Git\bin\bash.exe`.
  2. PowerShell como alternativa.
- **Armadilha:** ignorar `C:\Windows\System32\bash.exe`. Esse arquivo abre o WSL, não o Git Bash, e é o primeiro resultado de um `where bash`. O agente rodaria noutro sistema de arquivos e com outro PATH.
- Preferir bash também deixa uniforme o escape de aspas do comando nos três sistemas.

### 4.2 Shell das ferramentas do agente

É o shell que o agente usa para rodar comandos. Ele não depende do terminal: a ferramenta Bash do Claude Code inicia o próprio `bash` a cada comando, mesmo com o `claude` aberto direto no pty. Na F0, o agente usou a ferramenta Bash nas células D2 e D4 com o `claude.exe` sem shell no meio.

**Claude Code, segundo a documentação oficial** (code.claude.com/docs/en/setup e /env-vars):

- No Windows, a ferramenta Bash usa o Git Bash. Sem Git for Windows, só existe a ferramenta PowerShell.
- Com o Git Bash instalado, a ferramenta PowerShell existe ao lado da Bash e vem ligada por padrão em contas claude.ai e Console. É por isso que o agente "parte para o PowerShell" mesmo aberto dentro de um bash.
- `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` desliga a ferramenta PowerShell.
- `CLAUDE_CODE_GIT_BASH_PATH` aponta o `bash.exe` e evita cair no WSL.

**Uso no lançador:** o daemon passa essas variáveis no ambiente da sessão, e o mesmo prefixo entra no "copiar comando". Nada é gravado em `.claude`, settings ou configuração do usuário. Deve ser opção do workspace, com bash como padrão, porque desligar o PowerShell pode atrapalhar tarefas que dependem dele. A regra "Assume Bash for workspace commands" hoje é só instrução; com o lançador, vira ambiente de fato.

**Codex:** a documentação consultada não mostra seletor de shell no Windows nativo. O caminho bash documentado é rodar o Codex dentro do WSL2, que é outra instalação.

**Limite:** o efeito de `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` vem da documentação e não foi testado.

## 5. Evidência da F0

Fonte: `matriz-f0-consolidada.md` em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf.

- **Dependência nativa:** node-pty 1.1.0 instalou no Windows x64 com binário pronto, sem compilar.
- **Claude:** a TUI 2.1.316 foi conduzida em ConPTY nas células A1, A2, B1, B3, D2, D3 e D4. O wrapper com stdio herdado abriu a TUI no mintty e no Windows Terminal, com o prompt inicial executado (C1).
- **Codex:** a TUI remota 0.166.0 foi conduzida em ConPTY ligada a um App Server privado (A1, A2, B3, D3, D6). O wrapper funcionou no mintty, no Windows Terminal e no PowerShell (C1). A conversa sobrevive ao reinício do App Server (B3, E4).
- **Lições que valem para o produto:**
  - Remover as variáveis `CLAUDE*` herdadas de uma sessão pai, ou a TUI se comporta como sessão filha ("Transcript saving is off").
  - No Claude, pôr o prompt antes de `--allowedTools` e `--mcp-config`, que aceitam vários valores e engolem o que vem depois.
  - Escrever no pty é frágil nos dois clientes: texto e Enter na mesma escrita viram colagem, e Enter ou tecla errada com diálogo aberto aprova a ação. Houve aprovações acidentais nas duas frentes, em sessões descartáveis.
- **Sessões abertas fora do mARC:** `claude agents --json --all` lista as TUIs do Claude com PID, pasta e `sessionId` (A4). No Codex, o processo MCP vive com o host, não com a TUI, e não prova presença (B3).

## 6. Relação com a v3

| Autoridade | Efeito |
| --- | --- |
| Presença | Ganha a fonte "processo do daemon" para as sessões que ele lança. O shell vira o filho direto, e o agente, neto. As outras fontes continuam necessárias |
| Posse | Continua necessária no Claude, onde abrir a mesma sessão em dois lugares cria cópia ou roda em paralelo (A1, A4). No Codex, o "active writer" já recusa o segundo escritor |
| Reserva e orçamento | Sem mudança direta |
| Despertar | Nunca por digitação no pty. Os canais oficiais são o processo em segundo plano no Claude (D1, D2) e o `codex queue` no Codex (D7) |

**Registro do workspace e reinício do daemon.** Hoje o workspace sai do registro quando o daemon fica sem sinal de vida. Com terminal embarcado, as sessões passam a depender da vida do daemon. Se ele reiniciar, as sessões filhas morrem. O transcript fica em disco e a sessão é retomável, mas um turno em andamento se perde. O desenho precisa de aviso na UI e de retomada assistida. No Codex, hospedar a conversa num App Server separado do daemon pode reduzir esse impacto.

## 7. Precauções para o plano da F2

Registradas em marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983:

1. **Montador único de comando:** ordem dos argumentos, `--session-id` na sessão nova, ambiente sem `CLAUDE*`, variáveis de shell da seção 4.2 e o shell hospedeiro da seção 4.1. O botão de copiar mostra esse comando, e o pty executa o mesmo.
2. **Presença com fonte declarada:** sinal do MCP, `claude agents --json` e, depois, o processo do daemon.
3. **Vínculo no lançamento:** pelo `--session-id`, e não só pela primeira chamada ao MCP.

## 8. Riscos e perguntas abertas

**Riscos:**

- **Segurança:** um terminal web é execução de código pela interface. Exige ouvir só em localhost, token por sessão de UI e nunca expor a porta. É o risco mais sério.
- **Dependência nativa:** em outras plataformas ou versões do Node, o node-pty pode exigir compilação. Deve ser dependência opcional, voltando ao "copiar comando" quando não carregar.
- **Memória:** várias sessões abertas ao mesmo tempo. A F0 não mediu o consumo por sessão.
- **Rolagem e reconexão:** buffer de saída no daemon para a UI se reconectar sem perder contexto visual.

**Perguntas a testar antes do plano:**

- Memória por sessão `claude` e `codex` aberta.
- Efeito real de `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` e de `CLAUDE_CODE_GIT_BASH_PATH` numa sessão lançada pelo pty.
- Detecção de shells no Windows, sem cair no WSL.
- Seletor de shell do Codex no Windows nativo, ou se o único caminho bash é o WSL.
- O que acontece com os filhos do ConPTY quando o daemon termina de forma abrupta no Windows.

## 9. Relação com outras threads

- marc://$oportunidade-acompanhar-run-ao-vivo-na-ui-e-suporte-a-outras-cli-d04d2f9b trata de acompanhar o run ao vivo na UI. O painel xterm.js pode servir aos dois casos: lá, a sessão é iniciada pelo supervisor; aqui, pelo humano.
- marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983 recebe as precauções da seção 7.
- marc://$ativacao-por-mencao-f5-adaptador-codex-a54fb9ae recebe o arranjo do Codex com App Server, TUI remota e `codex queue`.
