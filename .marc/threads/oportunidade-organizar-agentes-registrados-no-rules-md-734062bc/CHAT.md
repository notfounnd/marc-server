# Oportunidade - Organizar agentes registrados no RULES.md

Thread: `oportunidade-organizar-agentes-registrados-no-rules-md-734062bc`
Created: `2026-05-11T01:23:20.839Z`

<!-- marc-message
id: msg_2cb758b72681445682
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T01:23:35.310Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para corrigir a organização de agentes no `RULES.md`.

- Problema: `agent_register` atualmente adiciona links de agentes no fim do arquivo, o que pode cair dentro de `## Custom Rules` e misturar inventário de agentes com regras operacionais do projeto.
- Estado atual aceitável: o projeto organizou manualmente os agentes em `## Custom Rules` > `### Registered Agents (Marckers)` e as regras em `### Flow Rules`.
- Melhor arquitetura desejada: agentes registrados devem ser gerenciados dentro da seção `## Agents`, provavelmente em uma subseção própria, sem poluir `## Custom Rules`.
- Requisito: `workspace_update_recommendations` deve preservar regras customizadas e manter uma organização previsível para agentes registrados.
- Critério de aceite: setup de projeto novo continua sem criar agentes padrão; agentes só aparecem após `agent_register`; novos registros são inseridos/atualizados no bloco correto.
- Validação esperada: testes cobrindo workspace novo sem agentes padrão, registro de agente em bloco correto e preservação de `Custom Rules`.

<!-- /marc-message -->

<!-- marc-message
id: msg_ef0eb6acf209489280
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T02:56:00.411Z
agentId: ui-user
role: user
-->

Além disso, revisar bootstrap de setup para garantir que o arquivo rules não está sendo criado com conteúdo que seja referente à esse projeto. Acima da linha de comentário de custon deve existir apenas os itens gerais.

Minha preocupação é todo projeto que faz setup do mARC acabar tendo os agentes inclusos no projeto.

<!-- /marc-message -->

<!-- marc-message
id: msg_a624a544bc9a4fc287
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T03:01:04.171Z
agentId: ui-user
role: user
artifacts: artifacts/sample-rules.md
-->

Complementando marc://#msg_ef0eb6acf209489280...

No estado atual do projeto, compreendo que quando `RULES.md` é criado, ele deveria ter apenas o conteúdo exemplificado no artefato.

<!-- /marc-message -->

<!-- marc-message
id: msg_52442d85727c42acb0
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T03:32:12.671Z
agentId: codex-dev
role: developer
-->

Plano de implementação aprovado para esta thread.

- Remover inventário de agentes do `RULES.md`; `.marc/agents/*.md` será a fonte de verdade.
- Atualizar `## Agents` para orientar:
  - Agents should register through `agent_register` before posting.
  - Use `agent_list` to discover registered agents.
  - Use `agent_read_profile` to inspect a specific agent profile.
- Alterar `agent_register` para não escrever no `RULES.md`.
- Adicionar tool MCP `agent_list`, baseada em `listAgentProfiles`.
- Fazer `workspace_update_recommendations` remover o bloco legado `### Registered Agents (Marckers)` e linhas legadas de inventário, preservando regras customizadas reais.
- Garantir que setup novo não crie agentes padrão nem conteúdo específico deste projeto.
- Validar com testes focados, suite/typecheck/build e inspeção das tools em `dist` após build.

<!-- /marc-message -->

<!-- marc-message
id: msg_28908b8fa79042b6a7
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T03:51:59.762Z
agentId: codex-dev
role: developer
-->

Implementação concluída para validação do usuário.

- `RULES.md` deixou de manter inventário de agentes.
- `.marc/agents/*.md` ficou como fonte de verdade dos agentes registrados.
- `agent_register` agora apenas cria/atualiza o profile do agente em `.marc/agents/<agent-id>.md`.
- Adicionei a tool MCP `agent_list` para descobrir agentes registrados via ferramental.
- Atualizei `## Agents` em `RULES.md` para orientar:
  - Agents should register through `agent_register` before posting.
  - Use `agent_list` to discover registered agents.
  - Use `agent_read_profile` to inspect a specific agent profile.
- Corrigi `workspace_update_recommendations` para remover o bloco legado `### Registered Agents (Marckers)` e preservar `### Flow Rules` abaixo de `## Custom Rules`.
- Apliquei o update pelo código compilado e corrigi o `RULES.md` real do projeto.

Validações executadas:

- `pnpm test test/core.test.ts` passou: 39 testes, 0 falhas.
- `pnpm test test/mcp.test.ts` passou: 39 testes, 0 falhas.
- `pnpm test` passou: 39 testes, 0 falhas.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- Validei `dist/mcp/server.js`: `agent_list` aparece na lista de tools registradas.

Observação: como foi adicionada uma tool MCP nova, o servidor/cliente MCP precisa ser reiniciado para o schema novo aparecer na sessão do agente.

<!-- /marc-message -->

<!-- marc-message
id: msg_25796cf0c3d7405fb5
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T04:08:58.952Z
agentId: codex-dev
role: developer
-->

Complemento aplicado após revisão do fluxo de `RULES.md`.

- O update não tenta mais ser resiliente com regras customizadas em lugar errado.
- Headings `##` desconhecidos acima de `## Custom Rules` são descartados quando `workspace_update_recommendations` reconstrói o baseline gerenciado.
- Mantive apenas o fallback para subtítulos `###` ou mais profundos deslocados antes de `## Custom Rules`, para recuperar casos legados como `### Flow Rules`.
- Adicionei comentário fixo em `## Custom Rules`:
  - `<!-- Use ### or deeper headings to organize project-specific rules in this section. -->`
- Atualizei o `RULES.md` real do projeto via código compilado.

Validações adicionais:

- `pnpm test test/core.test.ts` passou: 39 testes, 0 falhas.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- `pnpm test` passou: 39 testes, 0 falhas.

<!-- /marc-message -->

<!-- marc-message
id: msg_05908d3516be4c688d
threadId: oportunidade-organizar-agentes-registrados-no-rules-md-734062bc
timestamp: 2026-05-11T04:32:13.910Z
agentId: codex-dev
role: developer
-->

Complemento de documentação aplicado.

- Avaliei a thread `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a`: não há complemento necessário, porque esta mudança é de core/MCP/documentação e não altera comportamento UI/browser.
- Adicionei a ADR `docs/adrs/0007-rules-managed-baseline-and-custom-rules.md` para registrar o contrato de `RULES.md`:
  - baseline gerenciado acima de `## Custom Rules`;
  - regras de projeto somente abaixo da fronteira preservada;
  - `###` ou headings mais profundos para organizar regras customizadas;
  - headings `##` fora da fronteira não são tratados como custom rules;
  - agentes ficam em `.marc/agents/*.md` e são descobertos por `agent_list`/`agent_read_profile`.
- Atualizei `docs/adrs/README.md` e `docs/architecture.md` para linkar a ADR 0007.

Validação executada:

- Conferi existência dos arquivos e links para a ADR 0007 no índice e na página de arquitetura.

<!-- /marc-message -->
