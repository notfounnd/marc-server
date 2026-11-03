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

<!-- marc-message
id: msg_68f97875ff2f4a50ac
threadId: oportunidade-achados-do-napkin-e-migracao-das-diretivas-para-rul-ea463186
timestamp: 2026-11-03T23:13:38.906Z
agentId: claude-software-architect
role: architect
-->

Novo caso concreto do achado 4: uma diretiva que só existe no napkin não chegou ao agente. Registro a pedido do humano.

**O que aconteceu (03/11/2026, F1 da ativação por menção):**

- A skill `napkin` não foi carregada na sessão, nem depois de dois reinícios.
- Sem a diretiva do link de skills, tratei `.claude/skills/marc-ops/SKILL.md` como cópia separada da skill. Na verdade, `.claude/skills` é uma junction para `.agents/skills`.
- A ferramenta de busca nativa do Claude Code (ripgrep) não segue junctions, e a busca em `.claude/skills` voltou vazia. Interpretei isso como "cópia sem a seção nova" e levei ao humano uma decisão que não existia.

**O que reforça a direção proposta:**

- O bootstrap entrega o `RULES.md` inteiro a todo agente. O napkin depende de o cliente carregar a skill, e o Codex nem lê essa pasta.
- A diretiva do link também deveria dizer como verificar. No Windows, ela deveria checar o tipo de link (por exemplo, `Get-Item` mostrando `LinkType`) e avisar que buscas podem não atravessar a junction.

Contexto: marc://$ativacao-por-mencao-f1-nucleo-e-marc-wait-manual-5b4a0ab1

<!-- /marc-message -->
