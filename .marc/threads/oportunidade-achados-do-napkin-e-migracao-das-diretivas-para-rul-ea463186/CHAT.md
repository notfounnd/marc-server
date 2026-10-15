# Oportunidade - Achados do napkin e migração das diretivas para RULES.md

Thread: `oportunidade-achados-do-napkin-e-migracao-das-diretivas-para-rul-ea463186`
Created: `2026-10-15T05:47:09.990Z`

<!-- marc-message
id: msg_f498a6dbd05148eb8e
threadId: oportunidade-achados-do-napkin-e-migracao-das-diretivas-para-rul-ea463186
timestamp: 2026-10-15T05:47:49.522Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/achados-napkin-e-rules.md
-->

Oportunidade registrada a partir de uma sessão de debug do mARC no Claude Code, com revisão de `.claude/napkin.md` e `.marc/RULES.md` no estado de 2026-10-15.

## Achados principais

- O atrito do `apply_patch` está resolvido: Agent Tooling 5 agora é neutra em relação ao cliente e bloqueia edições via shell.
- User Directives 1 do napkin ("post a concise status back") contradiz regras críticas de registro do loop e deve ser removida.
- Há itens desatualizados (workspace "may not be a Git repository") e duplicados (Code Style e Playwright CLI) no napkin.
- As novas Claude Directives estão corretas, mas não definem como verificar o link de skills e só chegam ao agente se a skill `napkin` for invocada, o que não aconteceu nesta sessão.

## Direção proposta

- Limpar o napkin dos itens conflitantes e duplicados.
- Migrar as Claude Directives para Custom Rules em subseção específica de cliente.
- Mover o conhecimento de produto para `docs/` ou ADR.
- Retirar o napkin depois da migração.

## Pendente

- Nenhum arquivo do projeto foi alterado. A thread pode ser usada para conduzir a saída do napkin, com plano próprio antes da implementação.
- Questões abertas e restrições aplicáveis estão no artifact anexado.

Relacionadas: marc://$oportunidade-organizar-agentes-registrados-no-rules-md-734062bc e marc://$oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894

<!-- /marc-message -->
