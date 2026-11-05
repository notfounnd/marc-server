# Ativação por menção - F4 Automático limitado

Thread: `ativacao-por-mencao-f4-automatico-limitado-944287aa`
Created: `2026-10-31T20:02:09.790Z`

<!-- marc-message
id: msg_70093dc973fe458bb8
threadId: ativacao-por-mencao-f4-automatico-limitado-944287aa
timestamp: 2026-10-31T20:04:05.627Z
agentId: claude-software-architect
role: architect
-->

## Abertura da F4

Etapa do programa de ativação por menção. Fontes: marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc, com a v3 e o adendo de decisões.

**Escopo:** permitir criação e retomada sem confirmação individual, dentro do orçamento autorizado.

**Fora de escopo:** ampliar limites por agente.

**Dependência:** marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598 concluída, com dados de custo e ausência de laço. A célula G1 da F0 precisa de ao menos um par quente e frio por cliente.

**Critério de entrada:** plano detalhado e autorização humana. O risco de restauração antiga já foi aceito pelo humano, com criticidade baixa.

**Estado:** não autorizada a começar.

<!-- /marc-message -->

<!-- marc-message
id: msg_b3b1fe9d6bad430888
threadId: ativacao-por-mencao-f4-automatico-limitado-944287aa
timestamp: 2026-11-11T00:27:13.561Z
agentId: claude-software-architect
role: architect
-->

**Escopo acrescentado pela decisão do humano no plano da F3c (10/11/2026)**

Na F3c, o card de confirmação aparece a cada início de um arquiteto sem sessão aberta (marc://#msg_3e6344d232cc41b696). Para manter o commit da F3 menor, o humano mandou para a F4 a regra:

- **aprovar só na primeira vez de cada agente em cada thread.** Depois do primeiro "Approve", os inícios seguintes desse agente na mesma thread acontecem sem card, dentro do saldo de ciclos. A aprovação cai quando o interruptor é desligado ou a política é salva de novo.

Estado da F4: continua não autorizada a começar.

<!-- /marc-message -->

<!-- marc-message
id: msg_cb6e8235502e4cf693
threadId: ativacao-por-mencao-f4-automatico-limitado-944287aa
timestamp: 2026-11-12T16:25:07.519Z
agentId: claude-software-architect
role: architect
-->

**Proposta do humano para o escopo da F4 (12/11/2026): perguntar sobre a escuta**

No aceite da F3c, o humano mencionou o principal na thread com a sessão do principal aberta, e nada aconteceu. O comportamento está correto: uma sessão aberta só recebe menções quando arma o `marc wait`, e hoje a regra manda armar só quando o humano pede (docs/agent-workflows.md, "Listening for mentions"). O humano quer que essa escolha deixe de ficar implícita.

O que foi proposto:
- **Pergunta ao começar:** o principal pergunta uma vez por sessão, quando começa a trabalhar numa thread, se o humano quer que ele escute a thread. Se o padrão virar "escuta ligada", a pergunta passa a ser se o humano quer desligar.
- **Pergunta de novo no vencimento:** quando a escuta vence sem menção (exit 7, `timeout`), o principal pergunta de novo antes de armar. Ele não rearma sozinho. Isso já segue a doc atual, que pede para rearmar só se o humano ainda quiser escutar.
- **Reinício e compactação:** depois de reiniciar a sessão, a escuta morreu, então a pergunta volta. Depois de uma compactação, a escuta continua viva, e a pergunta não se repete.
- **Quem pergunta:** só o principal, e só em clientes em que uma tarefa em segundo plano acorda o agente, como o Claude Code. No Codex, só depois da F5.

Pontos que o plano da F4 decide:
- se isso vira padrão do produto, nas instruções gerenciadas (com uma decisão pela ADR 0007), ou fica como Custom Rule por workspace;
- o prazo padrão da escuta, hoje de 120 minutos. Cada vencimento custa um turno para perguntar, e uma sessão longa sem cache paga a releitura do contexto.

Estado da F4: continua não autorizada a começar.

<!-- /marc-message -->

<!-- marc-message
id: msg_f5c0762395354ae8bd
threadId: ativacao-por-mencao-f4-automatico-limitado-944287aa
timestamp: 2026-11-12T16:32:27.941Z
agentId: claude-software-architect
role: architect
-->

**Backlog para a F4, com aval do humano (12/11/2026): caminho da workspace nos comandos do helper**

Ao armar a escuta na thread da F3, o comando que o `marc_helper` (tópico `listening`) entregou terminou com "Thread not found". O comando levava `--workspace /Projetos/marc`, sem a letra do drive. O Git Bash resolve esse caminho para outra pasta.

- **Causa:** o servidor MCP desta workspace foi iniciado com o caminho sem drive. O Node no Windows aceita esse formato, então o MCP funciona. Mas `src/mcp/listening-command.ts` (linhas 66 e 100) copia o caminho sem mudar nada para os comandos `marc wait` e `marc open`.
- **Correção:** normalizar o caminho da workspace para absoluto (`path.resolve`) antes de montar os comandos, com um teste que use um caminho sem drive.
- **Contorno até lá:** passar `--workspace C:/Projetos/marc` explicitamente.

<!-- /marc-message -->

<!-- marc-message
id: msg_061d600300cc40e3a0
threadId: ativacao-por-mencao-f4-automatico-limitado-944287aa
timestamp: 2026-11-12T17:02:19.942Z
agentId: claude-software-architect
role: architect
-->

**Backlog para a F4, com aval do humano (12/11/2026): retenção por identidade e rota de diagnóstico**

Caso real, na thread da F3 com a política ligada. O principal estava com a sessão aberta e armou o `marc wait`, e o humano o mencionou. O ⚡ mostrou "claude-software-architect is waiting · the open one is unverified", e o 👤 mostrou o slot online e busy. A menção ficou retida por `identity_unverified` (`src/core/waiter-identity.ts`).

- **O que conferi por fora:** a sessão confere (`CLAUDE_CODE_SESSION_ID` igual ao registro do Claude), e o claude.exe atual é ancestral da escuta. Ficou sem conferir o vínculo gravado no daemon: a sessão nativa, o PID e o início do dono. Uma dessas três coisas não batia. O processo do Claude tinha sido reiniciado mais cedo, com a sessão retomada.
- **Contorno usado:** a política foi desligada, a thread voltou ao modo manual e a escuta entregou a menção (msg_bb59a1be474e4cf0b8).

O que propor no plano da F4:
- **Investigar a causa:** se o vínculo não acompanha a troca de processo de uma sessão retomada, a escuta em sessão aberta falha justamente no caso típico da F4.
- **Rota de diagnóstico, só de leitura, separada das visões de status da UI:**
  - por slot: o vínculo gravado (origem, geração, sessão, PID e início do dono, `boundAt`, `observedAt`) e a presença vista agora;
  - por escuta retida: qual verificação falhou (sem vínculo, sessão diferente, PID fora da cadeia, início diferente, tabela ilegível).
  - Ela fica fora das visões de status porque essas visões evitam de propósito ID nativo, PID e host.
- **Motivo no ⚡:** o aviso pode nomear a verificação que falhou, em vez do genérico "unverified".

<!-- /marc-message -->
