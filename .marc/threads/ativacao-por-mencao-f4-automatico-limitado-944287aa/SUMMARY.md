# Ativação por menção - F4 Automático limitado

Thread: marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa

Closed: `2026-11-13T20:49:43.052Z`

## Activity

| Profile | Role | Origin | Started | Last seen | Activations |
| --- | --- | --- | --- | --- | --- |
| claude-dev | developer | none | - | - | 0 |
| claude-software-architect | architect | none | - | - | 0 |
| codex-software-architect | architect | none | - | - | 0 |

Policy revision: none. Pause during the thread: yes. Recorded conflicts: 0.

---

# Resumo da F4: ativação automática limitada

Encerrada em 13/11/2026, com a aprovação técnica de marc://@claude-software-architect, a confirmação de marc://@codex-software-architect (marc://#msg_58013290a78f49088c) e o aceite do humano.

## O que foi entregue

- **Identidade na sessão retomada (A):** a reserva da escuta julga o processo pelo `resumedBy` do slot quando o motivo é `session_resumed` para o holder. A mudança é só de leitura, e a tabela de nove códigos não muda.
- **Caminho do helper (A):** `resolveWorkspace` é aplicado na origem, e o comando sai com a letra do drive.
- **Freio do modo manual por ciclos (B1):** `architectCycleCount`.
  - Uma ida e volta entre arquitetos conta um ciclo.
  - A mensagem humana zera a conta, e o dev é ignorado.
  - O modo governado não muda.
- **Prazo e padrão da escuta (B1 e B2):**
  - o prazo padrão passa a 8 h;
  - `listening.defaultOn` fica no `.marc/marc.config.json`, com um interruptor no painel geral;
  - o `marc_helper` devolve `listeningDefault`;
  - só o principal pergunta e arma escutas.
  - A regra está no ADR 0014 e na orientação gerenciada.
- **Aprovar só na primeira vez (C):**
  - o Approve grava a aprovação com a revisão da política;
  - os cards seguintes do agente aprovado iniciam sozinhos, dentro do saldo de ciclos;
  - salvar ou desligar a política derruba a aprovação;
  - na UI, o ícone `user-check` vem depois do nome, com a dica "Approved to start on mention".

## Correções no aceite

- A dica do ícone não aparecia, porque o `title` estava no svg. Ela foi para um span HTML (marc://#msg_5e4261a3812547829e).
- O humano escolheu o texto final da dica (marc://#msg_fb68b65dc6bd4d0880).

## Evidência

- Plano: `plano-f4-automatico-limitado.md`. Revisão integrada: `revisao-integrada-f4.md`.
- Checagens independentes do principal no estado corrigido: `typecheck`, `code:check` e `build` com exit 0, e `pnpm test` com 2639/2639. Na troca do texto, o dev rodou o teste de render (12/12), o `typecheck`, o `code:check` e o `build`.

## Pendências levadas para a F5

- A escuta governada numa sessão retomada só foi validada por testes, sem uso real.
- Sem decisão: a menção feita com a política desligada vira card quando ela é ligada.
- O Codex continua sem card e sem início automático.
- Backlog técnico:
  - o daemon em segundo plano pode cair com "Unexpected end of JSON input", por causa do `patchDaemonRuntimeState` sem trava e disparado com `void` sem catch;
  - há um EPERM de limpeza de lock no Windows em `daemon-diagnostics-routes.test.ts`.
