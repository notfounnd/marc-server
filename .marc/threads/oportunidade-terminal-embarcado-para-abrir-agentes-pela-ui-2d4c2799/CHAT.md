# Oportunidade - Terminal embarcado para abrir agentes pela UI

Thread: `oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799`
Created: `2026-11-02T22:35:04.924Z`

<!-- marc-message
id: msg_ddf33cb5ae64436295
threadId: oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799
timestamp: 2026-11-02T22:35:50.958Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/proposta-terminal-embarcado.md
-->

## Oportunidade

O daemon abriria a sessão do agente num pseudo-terminal (node-pty), e a UI mostraria essa sessão num painel xterm.js. O botão ao lado do título teria dois caminhos: abrir no terminal embarcado ou copiar o comando.

**Modos:** thread com arquiteto registrado (retomada), thread nova (sessão criada com `--session-id`) e sem thread (só o harness do agente). Sem shell genérico.

**Ambiente bash no Windows:** o lançador passa `CLAUDE_CODE_USE_POWERSHELL_TOOL=0` no ambiente da sessão, e o Claude fica só com a ferramenta Bash, que usa o Git Bash. Isso vem da documentação e ainda não foi testado. No Codex, sem seletor documentado.

**Evidência:** a F0 conduziu a TUI do Claude por node-pty no Windows, e o wrapper abriu a TUI no mintty e no Windows Terminal.

**Estado:** evolutiva, depois do sistema de eventos. A F2 recebe três precauções para não haver retrabalho. Será complementada quando a frente Codex da F0 terminar.

<!-- /marc-message -->

<!-- marc-message
id: msg_73fc046bbaf449eb97
threadId: oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799
timestamp: 2026-11-03T11:58:00.517Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/proposta-terminal-embarcado.md
-->

## Complemento

A proposta anexa foi atualizada no lugar com a decisão do humano e o retorno da frente Codex da F0.

- **Modelo do VS Code:** o pty roda o shell configurado, que executa o comando do agente. No Windows: detecção com preferência pelo Git Bash, campo de caminho e cuidado para não cair no `System32\bash.exe`, que abre o WSL. Linux e macOS usam o `$SHELL`.
- **Dois shells:** o shell hospedeiro dá o ambiente do usuário. O bash das ferramentas do agente vem de `CLAUDE_CODE_USE_POWERSHELL_TOOL=0`, ainda sem teste.
- **Codex:** a TUI remota funcionou em ConPTY. O arranjo indicado é a conversa no App Server, a TUI com `--remote` e o despertar por `codex queue`.

Base: marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf.

<!-- /marc-message -->

<!-- marc-message
id: msg_b2d0e722bcaa438091
threadId: oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799
timestamp: 2026-11-04T05:23:06.273Z
agentId: claude-software-architect
role: architect
-->

## Botão Play do menu de sessões

Decisão do humano na F2 (marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983): cada perfil do menu de sessões teria um ícone Play, que abre a sessão pelo `marc open`, com posse. Ele saiu da F2 e fica para esta oportunidade, porque precisa funcionar igual em Windows, Linux e macOS.

- **Destino natural:** o Play abre a sessão no terminal embarcado (node-pty + xterm.js), com o mesmo `marc open` curto montado pelo daemon.
- **Alternativa levantada pelo humano:** abrir um terminal externo configurado pelo usuário ou detectado automaticamente.
  - **Matriz:** os terminais que aceitam comando têm sintaxes diferentes (Windows Terminal, iTerm, kitty, GNOME Terminal, Konsole). No Linux não há padrão, e o Terminal do macOS só aceita comando por AppleScript.
  - **Segurança:** um modelo de comando configurável executa o que estiver nele a cada clique. Ele teria de ficar só na pasta local do daemon, nunca nas configurações da workspace, que vão para o repositório.
  - Pode servir de passo intermediário antes do terminal embarcado.
- **Na F2:** o menu fica só com Copiar, que entrega o comando nativo do Claude e fica desativado com a sessão aberta, e com o ícone de ir para a mensagem.

<!-- /marc-message -->
