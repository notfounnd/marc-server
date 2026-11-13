# Oportunidade - Rota de diagnóstico de sessões e ativação

Thread: marc://$oportunidade-rota-de-diagnostico-de-sessoes-e-ativacao-264e0ebf

Closed: `2026-11-13T00:18:38.631Z`

## Activity

| Profile | Role | Origin | Started | Last seen | Activations |
| --- | --- | --- | --- | --- | --- |
| claude-dev | developer | none | - | - | 0 |
| claude-software-architect | architect | none | - | - | 0 |
| codex-software-architect | architect | none | - | - | 0 |

| Stage | Cycles used | Max cycles | Outcome |
| --- | --- | --- | --- |
| Planning | 0 | 5 | open |
| Execution | 0 | 5 | not reached |
| Review | 0 | 5 | not reached |

Policy revision: `49a2b650-9430-4e95-9306-5151f4c52370`. Pause during the thread: never. Recorded conflicts: 0.

---

A thread entregou uma consulta só de leitura ao que o daemon sabe sobre uma thread, e o aviso do ⚡ passou a nomear a verificação de identidade que falhou. A entrega foi aprovada tecnicamente pelo arquiteto Claude, confirmada pelo Codex (marc://#msg_f2d1e7c78ac045c3ac) e aceita pelo humano, que pediu o encerramento em 12/11/2026.

## Objetivo e contexto

Na F3, uma escuta governada ficou retida por `identity_unverified`. O daemon não guardava qual verificação tinha falhado, e não havia como inspecionar o estado sem ler os arquivos à mão.

**Decisões do humano** (marc://#msg_e4de21145b474a5e99):
- a rota fica separada das visões de status da UI;
- a consulta é feita pelo comando `marc diagnose`, sem ferramenta MCP nova;
- o ⚡ pode nomear a verificação que falhou.

## O que foi entregue

- **A verificação que falhou:** `waiterIdentityCheck` devolve um de nove códigos, de `no_pid` a `start_mismatch`, ou `verified`. A reserva retida guarda o código em `identityCheck`, e o `reason` continua `identity_unverified`.
- **Rota `GET /api/workspaces/:ws/threads/:t/diagnostics`:** só de leitura.
  - Traz o vínculo gravado, o estado derivado, os processos ligados ao vínculo, as reservas e os cards.
  - É montada campo a campo, inclusive nos objetos aninhados.
  - Nunca traz `ownerToken`, `runId` nem processos de outras sessões.
- **`marc diagnose --thread <id|sufixo> [--profile <id>]`:** acha o daemon como o `marc open`, sai com 0 ou 5 e nunca imprime o token.
- **Aviso do ⚡:** um texto por código. Sem o código, fica o texto antigo.
- **Documentação:** `docs/ui-and-daemon.md`, `docs/agent-workflows.md` e `README.md`.

## Execução e revisão

- **Tarefas A e B, do dev:** marc://@claude-dev entregou em marc://#msg_5aaa86acfd17463faf e marc://#msg_e0707b1e1c15490fbe.
- **Revisão integrada:** registrada em `revisao-integrada-diagnostico.md`, com o pedido de confirmação ao Codex em marc://#msg_fb850fc5fce84bbdbc.
- **Achado do Codex** (marc://#msg_ebca46944352498684): `conflicts`, `details` e `outcome` eram copiados inteiros, então campos extras aceitos pelo validador chegavam à resposta. O dev corrigiu com projeção campo a campo e um teste de regressão com canários (marc://#msg_d68ebc5970404ed3a2). A reavaliação está em marc://#msg_f4667dd42e074fb8be.
- **Checagens do estado final:** typecheck, code:check e build sem erro, e `pnpm test` com 2548/2548.
- **Validação no daemon real, pelo build:** o `marc diagnose` respondeu em todas as threads abertas. O `--profile` filtrou a saída, uma thread inexistente saiu com 5, e não apareceram `ownerToken` nem `runId`.

## Limites e pendências

- A causa real da retenção da F3 não foi investigada. Isso fica na F4, que agora tem o `marc diagnose` como ferramenta.
- O selo do ⚡ continua contando só as ações. Uma retenção aparece dentro do painel, mas não no selo.
- **Registrado na F4 durante esta thread:**
  - o freio do modo manual passa a contar ciclos (marc://#msg_98c4a1b30f7b4e9dbd);
  - o caminho sem letra de drive no helper.
- **Observação sem decisão:** uma menção feita com a política desligada vira card quando a política é ligada.
- O aviso `DEP0205` do Node 26 vem do `tsx`, não do mARC.
