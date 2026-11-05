# Ativação por menção - F3 ADR, política, orçamento, reserva e supervisor

Thread: marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598

Closed: `2026-11-12T17:07:11.966Z`

## Activity

| Profile | Role | Origin | Started | Last seen | Activations |
| --- | --- | --- | --- | --- | --- |
| claude-dev | developer | none | - | - | 0 |
| claude-software-architect | architect | adopted | 2026-11-04T22:47:54.344Z | 2026-11-05T18:14:23.798Z | 0 |
| codex-software-architect | architect | none | - | - | 0 |

| Stage | Cycles used | Max cycles | Outcome |
| --- | --- | --- | --- |
| Planning | 0 | 5 | advanced |
| Execution | 0 | 5 | open |
| Review | 0 | 5 | not reached |

| At | From | To | By | Dropped holds |
| --- | --- | --- | --- | --- |
| 2026-11-12T16:07:20.345Z | Planning | Execution | human | 0 |

Policy revision: `7b05136f-3458-4be1-9128-c37514f2ef01`. Pause during the thread: yes. Recorded conflicts: 0.

---

A F3 do programa de ativação por menção entregou três partes:
- **a política por thread:** interruptor, modo, estágios e ciclos;
- **a reserva atômica,** que o `marc wait` governado e o supervisor disputam;
- **o supervisor em modo confirmar,** que inicia um arquiteto Claude sem sessão aberta depois do clique do humano.

Cada parte foi aprovada tecnicamente pelo arquiteto Claude, confirmada pelo Codex e aceita pelo humano. A thread foi encerrada a pedido explícito do humano (marc://#msg_0b235a994c014f72ad). O pedido chegou pela escuta (`marc wait`) da sessão do principal.

## Objetivo e contexto

A F2 deu ao mARC o vínculo entre uma sessão e o slot (thread mais perfil), mas não ativava ninguém. A F3 transformou a menção num gatilho com orçamento e freios: nada é debitado fora da reserva, nada começa sem política ligada, e o humano decide no limite.

O plano está em `plano-f3-politica-orcamento-reserva-supervisor.md`. Ele passou por seis revisões; a 6 e a 6.1 detalham a F3c (marc://#msg_3e6344d232cc41b696 e marc://#msg_c1af7aac264c46d18b).

## Decisões e entrega

**F3a, base de política, sem ativação.** Revisão em `revisao-integrada-f3a.md`.
- A `policy.json` (versão 2) fica na pasta da thread e tem interruptor, modo, revisão e limites. O estado local fica no daemon, fora do repositório.
- A pausa é por workspace, com migração durável das sessões legadas.

**F3b, reserva, waiter, ciclos, lead e painel.** Revisão em `revisao-integrada-f3b.md`.
- **Débito só na reserva:** o juízo tem sete passos, dentro da fila da thread. A política, a pausa, os ciclos, o piso e os arquitetos são lidos no mesmo passo que grava (tarefa H, depois do achado do Codex em marc://#msg_306a9112f8f54043ac).
- **Ciclos:** um ciclo por ida e volta, correlacionado por destinatário. No limite, a menção fica retida, e o humano decide com "More N cycles" ou "Advance stage".
- **Estágio e lead:** o estágio é um selo único. O lead é editável, e o agente pode avançar o estágio ao postar.
- **Thread encerrada:** perde o ⚡ e o 👤, e o daemon remove o estado e a `policy.json` dela (tarefas I e J).

**F3c, supervisor em modo confirmar e adaptador Claude.** Revisão em `revisao-integrada-f3c.md`.
- **Card a cada início:** um arquiteto mencionado sem sessão aberta gera um card no ⚡ com "Approve" e "Decline". O card sem clique vence em 24 h.
- **Turno:** cada aprovação roda `claude -p --permission-mode auto`, retoma a sessão anterior e tem prazo configurável (60 min por padrão).
  - Antes do prazo vencer, o turno recebe avisos pelas ferramentas do mARC e o pedido "stop now".
  - Depois da carência, o mARC encerra a árvore de processos à força.
  - Um turno parado por tempo pode ser retomado com "Continue".
- **Permissões:** o que o modo auto ainda perguntar chega ao painel como Allow ou Deny. Sem resposta em 10 minutos, o pedido é negado.
- **Campo `Client:` nos perfis:** cliente explícito, com o prefixo do modelo como reserva.
- **Ajustes do aceite, só de UI:**
  - o componente `HeaderMenu` monta os três botões do cabeçalho;
  - as popovers usam um contêiner comum com 420 px e `scrollbar-gutter: stable`;
  - 8 px entre os botões, e o selo de contagem a −4 px.

## Validação e aceite

- **Checagens antes do stage:** typecheck, code:check e build sem erro, e 2494 de 2494 testes na segunda execução completa. A primeira teve 3 falhas de tempo em testes de MCP, que passaram sozinhos.
- **Turno real num daemon temporário:** com haiku, de ponta a ponta.
- **Simulação real do humano no daemon real:** com Opus, um card por menção, e a retomada da mesma sessão provada.
- **Confirmações do Codex:**
  - marc://#msg_0e0ff05aabb3423a86 e marc://#msg_880725648dd3410ea9 para a F3b;
  - marc://#msg_ce1eabb6e37a4a1aa3 para a F3c.
- **Aceite do humano da F3c:** marc://#msg_2dbc5c150a5e446d92.

## Limites e pendências

- **Limites declarados na ADR 0014:**
  - as rotas de decisão usam o bearer do daemon;
  - o aviso de prazo é cooperativo;
  - o encerramento forçado foi provado só no Windows;
  - a identidade do Codex fica para a F5.
- **Sem prova com o cliente real:** o fim do prazo do turno e um pedido de permissão no modo auto. Os dois estão cobertos pelos testes.
- **Retenção por identidade:** numa sessão aberta, com a política ligada, a escuta ficou retida por `identity_unverified`. Desligar a política fez a menção chegar. A causa ficou para a F4.
- **Decisões do humano ainda abertas:** rotacionar o token do daemon real, que apareceu no índice do context-mode; e o destino das transcrições dos turnos reais e dos diretórios `marc-supervision-*` no %TEMP%.

## Continuidade

- **F4** (marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa):
  - aprovar só na primeira vez por agente e thread;
  - perguntar sobre a escuta ao começar e no vencimento;
  - o caminho da workspace no comando do helper;
  - a causa da retenção por identidade.
- **Rota de diagnóstico:** marc://$oportunidade-rota-de-diagnostico-de-sessoes-e-ativacao-264e0ebf.
- **Backlog:**
  - a rolagem horizontal da lista de mensagens em 390 px;
  - o bloco de CSS que a `.action-row` divide com as configurações da workspace;
  - uma linha no prompt do turno dizendo que o humano aprovou;
  - o `governedOf` duplicado;
  - `.tsx` no typecheck;
  - o estado que sobra quando a pasta de uma thread aberta é apagada.
- **Git:** o stage está pronto para o amend do humano no commit da F3.
