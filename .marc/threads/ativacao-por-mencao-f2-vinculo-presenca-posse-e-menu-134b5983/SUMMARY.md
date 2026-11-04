# Ativação por menção - F2 Vínculo, presença, posse e menu

Thread: marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983

Closed: `2026-11-04T17:28:13.667Z`

---

A F2 do programa de ativação por menção entregou o vínculo entre uma sessão de agente e o par thread mais perfil (o slot). Também entregou a presença e a posse que o daemon registra, a adoção pelo primeiro post, o comando `marc open` e o menu de sessões na UI. A F2 só detecta e não ativa ninguém automaticamente. Ela foi aprovada tecnicamente pelo arquiteto Claude, revisada pelo Codex sem pendências (marc://#msg_6ff9bbbd0ab54091b6) e aceita pelo humano (marc://#msg_3727d046cb0b42c1b9). A thread foi encerrada por autorização explícita do humano.

## Objetivo e contexto

Antes da F2, o mARC não sabia qual sessão do cliente falava por qual perfil, e retomar a conversa às cegas a bifurcava em silêncio, como a F0 mostrou. O plano está em `plano-f2-vinculo-presenca-posse-menu.md` (marc://#msg_630815db01c6420986). Ele tem três tarefas sequenciais e incorporou os requisitos de marc://#msg_5368bb9f9797430e84 e a seção "Revisão do Codex" (marc://#msg_2ec35734cf4a4fdfa5). O `SESSIONS.md` ficou para a F3.

## Decisões e entrega

- **Autoridade local:** `sessions.json` no dataDir do daemon, fora do repositório. As escritas passam por uma fila e por gravação atômica. O marcador `sessions.meta.json` faz a perda do registro falhar fechada (`registry_lost`).
- **Estados derivados:**
  - `unbound`, `online` (com `busy` e `listening`), `reserved`, `ended`, `unknown` e `conflict`.
  - `ended` exige prova negativa: inventário completo do `claude agents`, mesmo host e nenhuma lease viva.
  - `/clear` é reconciliado.
- **Adoção:** só com identidade verificada (pid e `startedAt` do `claude agents`). Perfis de papel `developer` e `user` nunca adotam.
- **Retomada legítima:**
  - Com o dono comprovadamente ausente e um único processo verificado com a mesma sessão, o slot fica `online/session_resumed`. O primeiro post desse processo assume a posse com nova geração.
  - Conflitos gravados contra a própria sessão viram histórico (`liveConflictOf`).
  - Dois processos na mesma sessão continuam sendo conflito.
- **`marc open`:**
  - Faz reserva, heartbeat e release.
  - Descobre o daemon pela flag, depois pelo `daemon.json`, depois pela URL padrão.
  - Remove `CLAUDE*` e `MARC_TOKEN` do ambiente do filho e usa bash por padrão.
  - Códigos de saída: 0, 4, 5, 6, 8 e 9.
- **Menu:** desenhado pelo humano sobre uma maquete visual (marc://#msg_fe95622e887e4446be):
  - selo Pending;
  - grupos Active, Ended e Other;
  - uma linha por perfil;
  - pendências em duas linhas truncadas, cada uma com uma seta "ir para".
- **Copiar:** entrega o comando nativo, `claude --resume <id>` para sessão encerrada ou `claude '<prompt>'` para perfil sem sessão. Nos demais estados fica desativado. Nesse caminho, a posse detecta mas não previne, e a F3 não pode tratá-lo como posse adquirida.
- **Ir para:** o fechamento do menu não devolve mais o foco ao gatilho, porque esse foco puxava a rolagem de volta. Uma faixa de chegada esmaece em 3 s, tanto na seta quanto nos links `marc://`.
- **Cliente:** deduzido pelo campo `Model:` do perfil. Só `claude-*` é suportado na F2. Os perfis do Codex não têm Copiar nem `marc open`.
- **Play:** o botão que abriria o cliente pela UI foi para marc://$oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799 (marc://#msg_b2d0e722bcaa438091).

## Validação e aceite

- **Revisão integrada:** `revisao-integrada-f2.md`, seções 1 a 11, com veredito aprovado em cada reavaliação.
- **Achados do Codex, todos corrigidos e confirmados:**
  - inventário incompleto e lease viva;
  - perda do registro;
  - retomada vista como conflito;
  - conflito gravado contra a própria sessão.
- **Suíte final do dev:** 1573 de 1573, com `pnpm validate` e `pnpm build`.
- **Navegador:** checagens ad hoc pelo Playwright CLI em daemons temporários.
- **Prova ao vivo:**
  - adoção real;
  - recusas do `marc open`;
  - persistência depois de reiniciar o daemon;
  - retomada desta sessão em processo novo, que mudou de `session_resumed` para `owner_listed` sem conflito (marc://#msg_00daf0f32d8149ad98).
- **Aceite do humano:** com a TUI real.

## Limites e pendências

- O cliente deduzido pelo modelo é uma heurística. Um campo de cliente explícito fica para a F5, junto com o suporte ao Codex.
- A lease do MCP não bloqueia a retomada, porque a lista do `claude agents` é a autoridade.
- Depois que o Claude fecha, o slot fica `unknown` por até 45 s antes de passar a `ended`.
- O freio de cadeia conta toda mensagem de arquiteto desde a última mensagem humana.
- **Desvio declarado:** o context-mode não foi usado em parte da revisão, primeiro por esquecimento e depois porque o servidor desconectou.

## Continuidade

- **Próximas fases:** a F3 trata política e `SESSIONS.md`; a F5 trata Codex e o campo de cliente.
- **Backlog:** cenários registrados em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a (marc://#msg_f2f6504587444fff81).
- **Git:** os arquivos ficam fora do stage até o OK de Git do humano.
