# Ativação por menção - F0 Provas de cliente

Thread: marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf

Closed: `2026-11-03T16:01:50.846Z`

---

A F0 trocou por teste as hipóteses de que a ativação por menção depende, no Claude Code e no Codex. Todas as células da matriz ficaram testadas ou com limite declarado, e o impacto foi declarado por fase e por cliente. A revisão integrada do principal aprovou a consolidação. Os critérios de saída da F2 e da F4 foram atendidos, e o humano autorizou o encerramento em 03/11/2026. Nenhuma fase seguinte foi autorizada por isso.

**Registro principal:** `matriz-f0-consolidada.md`, com matriz completa, impacto por fase, lições de automação, gasto e revisão integrada (marc://#msg_d35644a4791345fc8c, complemento em marc://#msg_a84d2da186d94a9aa8).

**Execução**

- Plano em `plano-f0-provas-de-cliente.md`. Protocolo por célula e as células novas A4 e D7 em `proposta-execucao-f0.md`.
- Frente Claude sem TUI: `resultado-f0-claude.md`, por marc://@claude-dev, incluindo a G1 com sessão grande.
- Frente Claude interativa: `resultado-f0-interativo-claude.md`, por marc://@claude-dev. As células com TUI rodaram por node-pty em pasta temporária, com autorização do humano, no lugar do roteiro manual em `roteiro-humano-f0.md`.
- Frente Codex: `despacho-f0-codex.md`, `resultado-f0-codex.md`, por marc://@codex-dev, e `revisao-final-f0-codex.md`, por marc://@codex-software-architect.

**Achados que orientam as fases**

- **Claude:** o término de um processo em segundo plano acorda a sessão, inclusive depois de `/compact` e `/clear`. Não há proteção contra um segundo escritor na mesma sessão. `claude agents --json` serve de fonte de presença.
- **Codex:** o término de processo não gerou turno novo em 15 s. A entrega a uma conversa existente é o `codex queue`, por um App Server. O Codex recusa um segundo escritor.
- **Custo:** o conteúdo da sessão sai do cache entre 6 e 65 minutos sem uso. Numa sessão de cerca de 80 mil tokens no Haiku, o despertar quente custou US$ 0,0016 e o frio US$ 0,0132. `total_cost_usd` e `duration_api_ms` do Claude são acumulados por sessão.
- **Automação:** nenhuma fase deve acordar ou conduzir um agente digitando na TUI.

**Limites**

- D5, suspensão da máquina, não foi executada.
- A negação de aprovação depois do despertar (D4) não foi testada no Claude.
- O ID antigo no MCP depois de `/clear` é inferência, a testar na F2.
- A D6 do Codex observou só 15 s.
- O Codex interativo foi testado com host App Server.
- A sessão grande da G1 foi medida só no Claude, com versão 2.1.317.

**Gasto medido:** US$ 0,223717, sem contar as sessões principais e a orquestração.

**Continuidade**

- A F1 e as fases seguintes dependem de plano e de autorização humana.
- A F2 recebeu requisitos de plano em marc://#msg_5368bb9f9797430e84.
- Oportunidades abertas a partir desta thread:
  - marc://$oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799
  - marc://$oportunidade-custo-estimado-de-agentes-por-thread-e-workspace-ce4af389
- A pasta temporária `marc-f0` foi removida. Os artefatos desta thread são o registro permanente.
