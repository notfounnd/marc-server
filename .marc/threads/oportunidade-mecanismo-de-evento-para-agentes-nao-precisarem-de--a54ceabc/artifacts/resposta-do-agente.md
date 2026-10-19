Sim, e sem gastar token enquanto espera. O que conta é **quem acorda o modelo**, não quem escuta.

**O que o harness do Claude Code oferece:**

- **Comando em segundo plano (`run_in_background`):** o processo roda solto, e o modelo só é reinvocado quando ele **termina**. Enquanto o processo está bloqueado esperando, nenhum token é consumido. É o mecanismo que o desenvolvedor da E1 está usando agora na recaptura de 3 h.
- **Monitor:** espera uma condição com um loop do tipo "until" e acorda a sessão quando ela é satisfeita. Também não gasta token durante a espera.
- **`/loop` com ScheduleWakeup:** é polling. Cada despertar relê o contexto e consome tokens, mesmo quando não há nada novo. É o que você quer evitar.
- **Mensagens entre sessões (SendMessage/ListAgents):** entregam mensagem a uma sessão local viva. Mas quem envia é outro agente, não um evento do mARC.

**Como isso encaixa no emissor de eventos do mARC:**

1. **No daemon:** o mARC publica eventos de thread, por exemplo um endpoint SSE ou de long-poll, filtrável por `threadId` e por menção a um perfil.
2. **No CLI:** um comando bloqueante, algo como `marc wait --thread <id> --mention <perfil> --since <lastMessageId>`. Ele não imprime nada enquanto espera e **sai** quando chega um evento que casa com o filtro, devolvendo só o mínimo: messageId, autor e um trecho curto.
3. **Na sessão:** o agente roda esse comando com `run_in_background`. Quando ele sai, a sessão acorda, chama `thread_read_since` com o cursor, trabalha e **rearma** o listener.

O custo fica restrito aos eventos que importam: uma chamada por menção mais a leitura incremental. A espera fica fora do modelo.

**Cuidados de desenho:**
- **O evento é de uma vez só:** cada disparo exige rearmar o listener. Vale pôr isso na skill marc-ops como passo do fluxo.
- **Cursor:** o `--since` precisa usar a mesma semântica de `lastMessageId` que o RULES.md já define, para não perder nem duplicar menções entre um disparo e o rearme.
- **O filtro tem de ficar no daemon,** não no agente. Se o comando sair a cada mensagem da thread, você volta a pagar tokens por ruído.
- **Timeout de segurança:** o comando deve ter um timeout longo e sair com um código distinto, para a sessão saber que nada aconteceu e simplesmente rearmar.
- **Só funciona com a sessão aberta.** Isso combina com o seu modelo de "uma sessão atende um chat", já que o perfil é compartilhado e a sessão é a unidade que escuta. Uma sessão fechada não recebe nada, então o estado continua vindo do cursor na thread.
- **Outros clientes:** o Codex e outros clientes têm mecanismos próprios de processo em segundo plano. Como o mARC é agnóstico de fornecedor, o contrato portátil é o comando CLI bloqueante. Como cada cliente o executa fica com ele.

Não consigo conferir agora os detalhes exatos do Monitor, nem se o Claude Code acorda a sessão com notificações de servidor MCP (um caminho alternativo, sem CLI). Isso dá para verificar na conversa principal, antes de escrever a proposta.