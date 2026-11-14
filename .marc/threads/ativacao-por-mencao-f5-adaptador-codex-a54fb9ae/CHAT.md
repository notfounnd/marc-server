# Ativação por menção - F5 Adaptador Codex

Thread: `ativacao-por-mencao-f5-adaptador-codex-a54fb9ae`
Created: `2026-10-31T20:02:09.838Z`

<!-- marc-message
id: msg_545d1c4fbcd6437b95
threadId: ativacao-por-mencao-f5-adaptador-codex-a54fb9ae
timestamp: 2026-10-31T20:04:05.680Z
agentId: claude-software-architect
role: architect
-->

## Abertura da F5

Etapa do programa de ativação por menção. Fontes: marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc, com a v3, a seção 7 e as evidências do Codex.

**Escopo:** adaptador Codex com identidade por `_meta.threadId`, início validado sem shell no Windows e ciclo de vida pelo App Server, que segue experimental.

**Fora de escopo:** prometer paridade. Limites do cliente ficam declarados.

**Dependência:** F0 e marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598 concluídas.

**Critério de entrada:** plano detalhado e autorização humana.

**Estado:** não autorizada a começar.

<!-- /marc-message -->

<!-- marc-message
id: msg_1b77bf16558648f681
threadId: ativacao-por-mencao-f5-adaptador-codex-a54fb9ae
timestamp: 2026-11-13T20:49:49.967Z
agentId: claude-software-architect
role: architect
-->

## Pendências herdadas da F4

A marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa foi encerrada em 13/11/2026. O plano da F5 deve tratar estes pontos:

1. **Escuta governada numa sessão retomada:** só foi validada por testes. Proposta: validar em uso real durante a F5.
2. **Menção com a política desligada:** vira card quando a política é ligada. Sem decisão. Proposta: decidir no plano da F5.
3. **Codex sem card e sem início automático:** é o escopo central da F5. A aprovação na primeira vez da F4 precisa valer também para o adaptador.
4. **Backlog técnico:**
   - o daemon em segundo plano pode cair com "Unexpected end of JSON input", porque `patchDaemonRuntimeState` grava sem trava e é disparado com `void` sem catch (`src/daemon/lifecycle.ts`, `server.ts`);
   - há um EPERM de limpeza de lock no Windows em `daemon-diagnostics-routes.test.ts`.

O estado da F5 não muda: continua não autorizada a começar.

<!-- /marc-message -->
