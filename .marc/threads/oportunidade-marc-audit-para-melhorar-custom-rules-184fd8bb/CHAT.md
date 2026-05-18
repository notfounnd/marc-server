# Oportunidade - marc_audit para melhorar Custom Rules

Thread: `oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb`
Created: `2026-05-06T05:55:29.016Z`

<!-- marc-message
id: msg_6d2cc0da197a40549a
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-06T05:56:51.221Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-marc-audit-custom-rules.md
-->

Contexto inicial:

- Registrar oportunidade para criar `marc_audit`.
- Objetivo: auditar `RULES.md`, principalmente `## Custom Rules`, e sugerir melhorias sem alterar arquivos automaticamente.
- A proposta detalhada está anexada em `artifacts/proposta-marc-audit-custom-rules.md`.
- Esta oportunidade deriva da conclusão de marc://$oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486.

<!-- /marc-message -->

<!-- marc-message
id: msg_19d63e429a98441a86
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-06T05:59:07.774Z
agentId: ui-user
role: user
-->

Audit de mensagens também é bacana. As vezes eu tenho que pedir para corrigir uma ou outra referência de artefato.

<!-- /marc-message -->

<!-- marc-message
id: msg_c604c3154b52484ba5
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-13T02:38:15.159Z
agentId: ui-user
role: user
-->

Audit de profiles de agentes registrados também é válido.

<!-- /marc-message -->

<!-- marc-message
id: msg_9cd586067e384068a5
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-18T01:49:40.376Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-01-custom-rules-deterministicas.md, artifacts/plano-02-skill-local-marc-bootstrap.md, artifacts/plano-03-workspace-audit-preflight.md
-->

Plano detalhado registrado antes do desenvolvimento.

- Item 1: `Custom Rules` deterministicas em `artifacts/plano-01-custom-rules-deterministicas.md`.
- Item 2: skill local mARC em conjunto com `RULES.md` em `artifacts/plano-02-skill-local-marc-bootstrap.md`.
- Item 3: `workspace_audit` e preflight em `artifacts/plano-03-workspace-audit-preflight.md`.

Vou iniciar o desenvolvimento seguindo esses tres artifacts.

<!-- /marc-message -->

<!-- marc-message
id: msg_a0193dcd40b6478f80
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-18T03:00:07.856Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-01-custom-rules-deterministicas.md, artifacts/plano-02-skill-local-marc-bootstrap.md, artifacts/plano-03-workspace-audit-preflight.md
-->

Desenvolvimento concluido para os 3 itens planejados.

- `Custom Rules`: adicionei orientacao gerenciada para regras operacionais com `Trigger`, `Do instead`, `Evidence` e `Severity`, preservando regras livres existentes.
- Skill local: implementei a geracao idempotente da skill mARC Ops em `.agents/skills/marc-ops/SKILL.md`, trabalhando em conjunto com `RULES.md` e mantendo a premissa local/plug and play do repo.
- Audit/preflight: adicionei `workspace_audit` como tool MCP gated por `bootstrapConfirmed`, com scopes para `rules`, `messages`, `agents`, `references`, `artifacts` e `preflight`.

Documentacao atualizada em README, MCP tools, agent workflows, architecture e ADR de `RULES.md`.

Validacao executada:

- `pnpm typecheck`
- `pnpm test` -> 66 testes, 0 falhas
- `pnpm build`
- `git diff --check` -> sem erro de whitespace, apenas avisos CRLF do Git no Windows

A thread deve permanecer aberta para seu feedback antes de orientar encerramento.

<!-- /marc-message -->

<!-- marc-message
id: msg_5cdd83ba549f43118d
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-18T03:13:56.542Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-02-skill-local-marc-bootstrap.md
-->

Ajuste complementar aplicado na skill mARC Ops.

- Corrigi o `SKILL.md` gerado para seguir o formato esperado de skills.
- A skill agora tem frontmatter YAML com `name: marc-ops` e `description` de disparo.
- Atualizei o artifact `artifacts/plano-02-skill-local-marc-bootstrap.md` para registrar esse requisito.
- Mantive a instalacao em `.agents/skills/marc-ops/SKILL.md`.

Validacao executada:

- `pnpm test test/core.test.ts test/mcp.test.ts` -> 66 testes, 0 falhas
- `pnpm typecheck`

<!-- /marc-message -->

<!-- marc-message
id: msg_65ddaf9fc127478d90
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-18T04:36:41.083Z
agentId: codex-dev
role: developer
-->

Ajuste de direcao aplicado na auditoria.

O `workspace_audit` foi corrigido para atuar como auditoria de compliance estrutural/pratico, sem julgamento semantico por heuristica textual.

Realizado:
- removi o check semantico `preflight_sources_missing` de `messages`/`preflight`;
- corrigi referencias para considerar threads abertas e fechadas ao validar `marc://$thread-id`;
- mantive `rules:custom_rule_freeform` como `warning`, pois o formato operacional e desejavel mas regras livres continuam compativeis;
- rebaixei `agent_metadata_missing` para `warning`;
- adicionei deduplicacao de findings antes de aplicar filtro de severidade e limite;
- atualizei a documentacao para descrever `workspace_audit` como compliance estrutural, nao review semantico.

Validacao executada via context-mode:
- `pnpm test test/core.test.ts` -> 71 testes, 0 falhas;
- `pnpm test test/mcp.test.ts` -> 71 testes, 0 falhas;
- `pnpm typecheck` -> OK;
- `pnpm build` -> OK.

Validacao comportamental via codigo fonte:
- `scope: messages` na thread atual retorna 0 findings;
- `scope: references` na thread atual retorna 0 findings, incluindo a referencia para thread closed existente;
- `scope: all` na thread atual retorna apenas warnings globais: `rules:custom_rule_freeform` e `agents:agent_metadata_missing`.

Observacao operacional: como houve build novo, o MCP/daemon em execucao precisa ser reiniciado para a tool exposta refletir o comportamento corrigido.

<!-- /marc-message -->

<!-- marc-message
id: msg_d90671892c784b5b89
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-18T12:11:27.606Z
agentId: codex-dev
role: developer
-->

Ajuste adicional identificado apos validar a tool MCP reiniciada.

A auditoria passou a remover os falsos positivos semanticos, mas ainda reportou uma referencia invalida porque estava validando um exemplo escrito dentro de inline code na mensagem anterior. Isso tambem e falso positivo estrutural: texto dentro de markdown code span ou fenced code deve ser tratado como exemplo literal, nao como referencia mARC ativa.

Correção aplicada no codigo fonte:
- `workspace_audit` agora ignora referencias mARC dentro de inline code e fenced code ao executar o scope `references`;
- adicionei teste especifico para placeholders de referencia em markdown code;
- mantive a validacao de referencias reais fora de blocos de codigo.

Validacao executada via context-mode:
- `pnpm test test/core.test.ts` -> 72 testes, 0 falhas;
- `pnpm typecheck` -> OK;
- `pnpm build` -> OK;
- validacao por codigo fonte na thread atual com `scope: references` -> 0 findings.

Observacao operacional: como esse ajuste gerou novo build depois do ultimo restart, sera necessario reiniciar o MCP/daemon novamente para a ferramenta exposta refletir essa ultima correcao.

<!-- /marc-message -->

<!-- marc-message
id: msg_874a045043d34b1e80
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-18T15:45:10.315Z
agentId: codex-dev
role: developer
artifacts: artifacts/audit-attached-missing.md
-->

Teste intencional de auditoria estrutural.

Esta mensagem deve gerar findings para validar `workspace_audit`:

- artifact citado no corpo sem metadata: artifacts/audit-body-missing.md
- referencia invalida fora de code span: marc://not-valid-audit-test
- agente inexistente: marc://@missing-audit-agent
- thread inexistente: marc://$missing-audit-thread

Nao tratar esta mensagem como conteudo funcional da thread. Ela foi criada para validar a auditoria.

<!-- /marc-message -->

<!-- marc-message
id: msg_b0d6508cb8bc4fb0b1
threadId: oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb
timestamp: 2026-05-18T17:36:42.167Z
agentId: codex-dev
role: developer
-->

Encerramento da thread.

A evolucao foi concluida nos tres itens planejados:

- Custom Rules operacionais com formato recomendado baseado em `Trigger`, `Do instead`, `Evidence` e `Severity`.
- Skill local gerenciada `.agents/skills/marc-ops/SKILL.md`, instalada pelo bootstrap, trabalhando junto com `RULES.md` e declarada como ativa em toda sessao do workspace.
- Tool `workspace_audit` para auditoria estrutural sob demanda de rules, agents, references, artifacts, messages e preflight.

Validacoes realizadas:

- testes core e MCP durante a implementacao;
- `pnpm typecheck`;
- `pnpm build`;
- recriacao da skill apos apagar `.agents` e rodar `workspace_bootstrap`;
- chamada idempotente de `workspace_bootstrap` confirmando `.agents/skills/marc-ops/SKILL.md` como `alreadyCurrent`.

Observacao de encerramento: a mensagem `msg_874a045043d34b1e80` permanece na thread como teste intencional de auditoria estrutural, conforme decisao do usuario. Os findings gerados por ela nao representam pendencia funcional da entrega.

Vou criar o `SUMMARY.md` para marcar a thread como encerrada.

<!-- /marc-message -->
