# Oportunidade - Reestruturar INSTRUCTIONS e RULES para bootstrap

Thread: `oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486`
Created: `2026-05-02T21:25:56.183Z`

<!-- marc-message
id: msg_a1a8cdc6bd8a42b588
threadId: oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
timestamp: 2026-05-02T21:26:30.651Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-reestruturacao-instructions-rules.md
-->

Contexto inicial:

- Nao encontrei thread especifica para reestruturar `INSTRUCTIONS.md` e `RULES.md`.
- Existem registros relacionados em bootstrap e em threads fechadas, mas a separacao dos arquivos e um pre-requisito proprio para implantar os guards.
- Objetivo: deixar `INSTRUCTIONS.md` como protocolo operacional estavel do mARC e `RULES.md` como contrato de comportamento do workspace.
- `INSTRUCTIONS.md` deve orientar bootstrap, `bootstrapConfirmed`, leitura de `RULES.md` e retomada quando contexto de bootstrap for perdido.
- `RULES.md` deve concentrar estilo de mensagens, comportamento do workspace e `## Custom Rules`, sem duplicar protocolo mecanico.

Proposta completa anexada em marc://#msg_a1a8cdc6bd8a42b588/!proposta-reestruturacao-instructions-rules.md.

<!-- /marc-message -->

<!-- marc-message
id: msg_2a3575081bfa409fb4
threadId: oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
timestamp: 2026-05-06T05:07:13.477Z
agentId: ui-user
role: user
-->

Essa thread é uma preparação para executar a marc://$oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686.

<!-- /marc-message -->

<!-- marc-message
id: msg_5b442440a58b4e52b6
threadId: oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
timestamp: 2026-05-06T05:23:11.607Z
agentId: codex-dev
role: developer
-->

Tratamento realizado:

- Reestruturei a geração de recomendações para deixar `.marc/INSTRUCTIONS.md` como protocolo curto de bootstrap.
- Mantive `.marc/RULES.md` como contrato de comportamento do workspace, com `Message Style`, `Context Reading`, `Workspace Maintenance` e `Custom Rules` preservado.
- Atualizei `marc_helper` no tópico `workspace` para explicar a separação entre `INSTRUCTIONS.md` e `RULES.md`, incluindo a preparação para `workspace_bootstrap` e `bootstrapConfirmed`.
- Adicionei testes cobrindo a migração de recomendações antigas para a nova estrutura e o conteúdo orientativo do helper.
- Apliquei `workspace_update_recommendations` no workspace real; apenas `INSTRUCTIONS.md` precisou ser atualizado.

Validação executada:

- `pnpm test` passou com 28 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.

A thread não foi encerrada; aguardando feedback para orientar a finalização.

<!-- /marc-message -->

<!-- marc-message
id: msg_4dcb2c166d5940ae95
threadId: oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
timestamp: 2026-05-06T05:37:32.817Z
agentId: codex-dev
role: developer
-->

Complemento aplicado:

- Adicionei um comentário logo abaixo de `# mARC Instructions` informando que o arquivo é gerenciado pelo mARC e não deve ser editado diretamente.
- Ajustei o texto do protocolo para deixar explícito que `workspace_bootstrap` atualiza recomendações, incluindo o próprio `INSTRUCTIONS.md`, e depois lê `RULES.md`.
- Mantive a alteração no template gerenciado em `src/core/workspace.ts`; `.marc/INSTRUCTIONS.md` foi atualizado via `workspace_update_recommendations`, não por edição manual direta.
- Atualizei os testes para cobrir o comentário de arquivo gerenciado e a menção explícita ao próprio `INSTRUCTIONS.md`.

Validação executada:

- `pnpm test` passou com 28 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- `workspace_update_recommendations` atualizou `INSTRUCTIONS.md` e manteve `RULES.md` atual.

<!-- /marc-message -->

<!-- marc-message
id: msg_a424c3e6fabe4783af
threadId: oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
timestamp: 2026-05-06T05:39:53.175Z
agentId: codex-dev
role: developer
-->

Complemento de formatação aplicado:

- Ajustei o template gerenciado de `INSTRUCTIONS.md` para manter uma linha em branco entre `# mARC Instructions` e o comentário `<!-- This file is managed by mARC... -->`.
- Atualizei os testes para exigir esse espaçamento, evitando regressão quando `workspace_update_recommendations` gerar o arquivo.
- Rodei `workspace_update_recommendations` com o build novo; o arquivo já estava no formato esperado e ficou como `alreadyCurrent`.

Validação executada:

- `pnpm test` passou com 28 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- A inspeção confirmou o início do arquivo como `# mARC Instructions`, linha vazia, comentário, linha vazia, `## Bootstrap Protocol`.

<!-- /marc-message -->

<!-- marc-message
id: msg_a75bd6d233a84c518a
threadId: oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
timestamp: 2026-05-06T05:43:04.025Z
agentId: codex-dev
role: developer
-->

Ajuste de frase aplicado:

- Troquei o comentário gerenciado para evitar sugerir que o usuário pode alterar ou estender `INSTRUCTIONS.md` por tools.
- Nova frase: `<!-- This file is generated and maintained by mARC. Do not edit or extend it. Put project-specific guidance in RULES.md under Custom Rules. -->`
- Atualizei os testes para fixar a nova frase e manter a linha em branco após o heading principal.
- Rodei `workspace_update_recommendations`; `INSTRUCTIONS.md` foi atualizado e `RULES.md` já estava atual.

Validação executada:

- `pnpm test` passou com 28 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.

<!-- /marc-message -->

<!-- marc-message
id: msg_c28d44ed9f104753b3
threadId: oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486
timestamp: 2026-05-06T05:51:27.150Z
agentId: codex-dev
role: developer
-->

Ajuste de `RULES.md` aplicado:

- Reordenei as seções gerenciadas para deixar `Workspace Maintenance` logo após `# mARC Rules`, antes de `Agents`.
- Padronizei as seções gerenciadas para sempre pularem uma linha depois do heading `## ...` antes do conteúdo.
- Apliquei o mesmo espaçamento em `Custom Rules`, mantendo o comentário e o conteúdo customizado preservados no final.
- Atualizei os testes para travar a ordem das seções e o espaçamento após os títulos.
- Rodei `workspace_update_recommendations`; `RULES.md` foi atualizado e `INSTRUCTIONS.md` já estava atual.

Validação executada:

- `pnpm test` passou com 28 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.

<!-- /marc-message -->
