# Achados do napkin e do RULES.md

Status: discovery
Data: 2026-10-15
Autor: claude-software-architect (Claude Code, claude-opus-5-5)

## Resumo

Durante uma sessão de debug do mARC no Claude Code, foram revisados `.claude/napkin.md` e `.marc/RULES.md` no estado de 2026-10-15. A revisão encontrou um atrito já corrigido no RULES.md, fragilidades na entrega das novas Claude Directives e itens antigos do napkin que estão desatualizados, duplicados ou em conflito com regras críticas.

Esta thread registra os achados e pode servir como ponto de partida para retirar o napkin do harness, migrando o conteúdo que ainda tem valor para `RULES.md` (Custom Rules), `docs/` ou ADRs.

Nenhum arquivo do projeto foi alterado nesta etapa.

## Contexto da sessão

- A skill `napkin` não foi invocada no início da sessão. No Claude Code, skills não executam automaticamente: apenas nome e descrição entram no contexto, e o modelo precisa chamar a ferramenta `Skill`. A descrição "Activates EVERY session" é apenas texto.
- A skill `marc-ops` foi invocada porque o `AGENTS.md`, carregado automaticamente, determina isso explicitamente.
- São carregados automaticamente no contexto: `CLAUDE.md`/`AGENTS.md`, a saída de hooks `SessionStart` e o índice de memória persistente do cliente. O `RULES.md` chega integralmente pelo retorno de `workspace_bootstrap`, independentemente do cliente.

## Achados

1. **Achado:** RULES.md, Agent Tooling 5 - "Use the client's native edit tool for manual edits"
   **Problema:** nenhum. A regra deixou de citar apenas `apply_patch`, ficou neutra em relação ao cliente e bloqueia explicitamente edições via shell (`sed`, heredoc, redirecionamento). Isso também cobre a sugestão do auto mode do Claude Code de editar arquivos via Bash. Atrito resolvido.

2. **Achado:** napkin, Claude Directives 1 - "verify that `.claude/skills` exposes the mARC skills from `.agents/skills`"
   **Problema:** a diretiva não diz como verificar. Na sessão, `ls -la` e `diff -q` mostraram conteúdo idêntico, mas não distinguem link, junction e cópia. Sem um método definido, cada sessão improvisa uma checagem diferente e pode concluir errado. Sugestão: indicar a checagem esperada, por exemplo `cmd //c dir .claude` exibindo `<JUNCTION>` ou `<SYMLINKD>` para `skills`.

3. **Achado:** napkin, Claude Directives 1-3 (bloco completo)
   **Problema:** o conteúdo está correto, mas só chega ao agente se a skill `napkin` for invocada, e nesta sessão ela não foi. A entrega continua frágil, o que reforça a migração para uma fonte carregada de forma garantida.

4. **Achado:** napkin, User Directives 1 - "after treating a thread task, post a concise status back to the relevant mARC thread"
   **Problema:** contradiz o RULES.md. As Conversation Rules e a regra "Keep loop records bounded and avoid execution diaries" (Development Loop 8, critical) proíbem acknowledgments de rotina e status por iteração. Um Claude que seguisse o napkin violaria uma regra crítica. Recomendação: remover.

5. **Achado:** napkin, Shell & Command Reliability 1 - "This workspace may not be a Git repository"
   **Problema:** desatualizado. O workspace é um repositório Git. O "Do instead" (listar arquivos tocados em vez de depender de `git status`) continua válido, mas o motivo atual é que Git exige autorização explícita (Agent Tooling 3). Recomendação: reescrever apontando para essa regra ou remover.

6. **Achado:** napkin, Execution & Validation 1 - "Prefer early return and strategy pattern"
   **Problema:** duplica as regras críticas de Code Style 1-5 com força menor ("prefer" contra "never" e "required pattern"). Cria duas fontes com intensidades diferentes para a mesma regra. Recomendação: remover.

7. **Achado:** napkin, User Directives 2 - "Run Playwright through the CLI"
   **Problema:** duplica Agent Tooling 4 do RULES.md sem acrescentar informação. Recomendação: remover.

8. **Achado:** napkin, Execution & Validation 2-4 e Domain Behavior Guardrails 1-2 (validação do `dist`, separação INSTRUCTIONS/RULES, atualização idempotente, nomes `{prefix}_{action}`, cache de schema MCP)
   **Problema:** nenhum conflito. É conhecimento de desenvolvimento do mARC ainda útil. Na migração, o destino natural é `docs/` (por exemplo `docs/development.md`) ou ADR, não Custom Rules, porque descreve o produto e não o comportamento do agente.

9. **Achado:** napkin, seção Claude Directives (na migração futura)
   **Problema:** se for movida para o RULES.md sem adaptação, vira contrato para todos os clientes, inclusive Codex. Precisa de uma subseção específica de cliente dentro de Custom Rules ou de um `Trigger` condicionado ao cliente (por exemplo, "starting a Claude Code session in this workspace").

## Proposta de direção para a migração

- **Limpeza imediata do napkin:** remover os achados 4, 6 e 7 e corrigir o achado 5. Isso elimina o conflito com regra crítica mesmo antes da migração.
- **Diretivas de agente:** migrar as Claude Directives para Custom Rules em subseção específica de cliente, com `Trigger`, `Do instead`, `Evidence` e `Severity`, incluindo o método de verificação do achado 2.
- **Conhecimento de produto:** mover os itens do achado 8 para `docs/` ou ADR.
- **Retirada do napkin:** depois da migração, remover `.claude/napkin.md` e a dependência da skill `napkin` neste workspace.

## Restrições aplicáveis

- Novas regras de projeto ficam abaixo do marcador de Custom Rules, preservado por `workspace_update_recommendations`, conforme a decisão de marc://$oportunidade-organizar-agentes-registrados-no-rules-md-734062bc e a ADR 0007.
- A migração de restrições do AGENTS.md para Custom Rules em marc://$oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894 é o precedente para manter o RULES.md como fonte canônica e o AGENTS.md como índice.
- Conteúdo de regras e docs em en-US; comunicação mARC em pt-BR.
- Hooks ou configuração específica de cliente (por exemplo, `SessionStart` para injetar conteúdo) exigem pedido explícito e separado do humano.

## Questões abertas

- As Claude Directives devem virar Custom Rules específicas de cliente, ou parte delas deve ir para uma instrução carregada apenas pelo Claude Code?
- O napkin deve ser removido por completo ou mantido apenas como runbook local, não versionado?
- Os itens de conhecimento de produto (achado 8) já estão cobertos em `docs/development.md` ou exigem nova seção?
