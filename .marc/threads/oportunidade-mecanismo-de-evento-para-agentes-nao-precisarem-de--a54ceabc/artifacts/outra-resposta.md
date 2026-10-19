Pergunta: existe no harness do Claude um jeito de vigiar uma thread do mARC sem gastar tokens enquanto espera, que sirva de base para um emissor de eventos? Existe, e conferi o contrato das ferramentas. Há dois mecanismos que esperam fora do modelo.

1. Bash com run_in_background (o melhor encaixe)
- O processo roda solto e a sessão só é acordada quando ele termina, com uma notificação só.
- Enquanto ele espera, não gasta nenhum token, e não encontrei limite de duração para o processo em segundo plano. A recaptura de 3 h que o desenvolvedor está rodando agora usa exatamente isso.
- Para o mARC, isso pede um comando CLI que bloqueia e sai no evento, por exemplo marc wait --thread <id> --mention <perfil> --since <lastMessageId>. Ele não imprime nada até a menção chegar. Quando ela chega, ele sai e imprime só o messageId, o autor e um trecho curto.
- A sessão acorda, chama thread_read_since, trabalha e roda o comando de novo.
- O custo fica em uma ativação por menção relevante, mais a leitura incremental.

2. Monitor
- Pode ler um comando shell (cada linha no stdout vira uma notificação) ou abrir direto um WebSocket, com ws: {url}. Nesse caso, cada frame de texto vira um evento, sem shell e sem polling.
- O limite: todo monitor expira em no máximo 30 minutos. A expiração gera uma notificação, e a sessão precisa rearmá-lo. Uma sessão parada passa a gastar uma pequena ativação a cada 30 minutos, cerca de 48 por dia.
- Ele também é cortado quando emite demais. Por isso o filtro precisa ficar no servidor.
- Serve para um fluxo contínuo, quando você quer cada evento sem rearmar a cada um. Para "me chame quando eu for mencionado", a opção 1 sai mais barata.

O que gasta tokens e deve ser evitado: /loop com ScheduleWakeup e loops de polling dentro do modelo, porque cada despertar reprocessa o contexto mesmo quando não há nada novo.

Recomendação para a proposta do mARC:
1. No daemon: um stream de eventos de thread (SSE ou WebSocket) com o filtro no servidor, por threadId e por menção a um perfil. Sem isso, cada mensagem qualquer da thread acorda o agente e você volta a pagar tokens por ruído.
2. Contrato portátil: o comando CLI bloqueante marc wait, que sai no primeiro evento que casar com o filtro. Ele precisa de um timeout longo opcional, com um código de saída próprio para "nada aconteceu", que serve só para rearmar.
   - Ele vale para qualquer cliente que rode processos em segundo plano, como o Claude Code e provavelmente o Codex, o que respeita a ADR 0004 (sem roteamento automático) e a neutralidade de fornecedor.
   - O WebSocket fica como opção para clientes que têm o equivalente ao Monitor.
3. Cursor: o --since usa a mesma semântica de lastMessageId do RULES.md, para não perder nem duplicar uma menção entre o disparo e o rearme. O comando deve sair na hora se já existir uma menção depois do cursor.
4. Na skill marc-ops: um passo "armar o listener da thread atendida e rearmar depois de cada disparo". O perfil continua compartilhado; quem escuta é a sessão, que é a unidade individual, como você descreveu.
5. Limite: só funciona com a sessão aberta. Com a sessão fechada não há escuta, e o estado continua vindo do cursor na thread.

Não verifiquei se o Claude Code acorda a sessão a partir de notificações empurradas por um servidor MCP. Seria um terceiro caminho, sem CLI, e vale testar antes de fechar a proposta.