# Bug: agent_register nao sinaliza agente existente

Thread: `bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7`
Created: `2026-05-11T05:17:37.060Z`

<!-- marc-message
id: msg_5cc8d9cbedb646ae99
threadId: bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7
timestamp: 2026-05-11T05:17:45.353Z
agentId: codex-dev
role: developer
-->

## Bug report

## Contexto

Durante o registro para postar no mcp-marc, chamei `agent_register` com `id: codex-dev`.

O usuario informou em seguida que esse agente ja existia.

## Comportamento observado

- `agent_register` retornou sucesso simples com `result.id: codex-dev`.
- A resposta nao indicou que o agente ja existia.
- Como consumidor da API/tool, interpretei o resultado como registro efetuado agora.

## Comportamento esperado

- Ao receber um `id` de agente ja existente, `agent_register` deve sinalizar claramente o caso.
- Possiveis comportamentos aceitaveis:
  - retornar `alreadyExists: true` / `created: false`;
  - retornar erro de conflito controlado;
  - ou documentar e expor explicitamente que a operacao e idempotente.

## Risco

- Agentes podem reportar acao incorreta ao usuario.
- Fluxos que dependem de auditoria podem confundir registro novo com reutilizacao de agente existente.

## Proximo passo sugerido

- Ajustar contrato e resposta de `agent_register` para diferenciar criacao real de reutilizacao/idempotencia.

<!-- /marc-message -->

<!-- marc-message
id: msg_25f0ae3a5cc44b98aa
threadId: bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7
timestamp: 2026-05-11T05:23:35.746Z
agentId: ui-user
role: user
-->

Também notado comportamento que a linha antiga estava sendo inserida no arquivo `RULES.md`.

- `<!-- Use ### or deeper headings to organize project-specific rules in this section. -->`

Ficando os textos com essa estrutura?

```
## Custom Rules

<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->
<!-- Use ### or deeper headings to organize project-specific rules in this section. -->
<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->
```

Não identificado se esse comportamento foi por falta de restart do server. Em acompanhamento.

<!-- /marc-message -->

<!-- marc-message
id: msg_2ccde4c8bfd646a1a7
threadId: bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7
timestamp: 2026-05-13T03:35:35.043Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-agent-register-contrato-e-inventario.md
-->

Plano detalhado registrado como artefato antes do desenvolvimento.

Escopo confirmado:

- `agent_register` permanece idempotente, mas passa a sinalizar `created` / `updated` / `unchanged`.
- A escrita oficial do perfil de agente passa a ser canônica e ignora `displayName`.
- UI e leituras completas continuam fiéis ao Markdown existente no arquivo.
- `agent_list` e `workspace_bootstrap` passam a expor inventário conciso de agentes para reduzir duplicidade e custo de contexto.

Vou iniciar o desenvolvimento pelas regressões e depois aplicar a implementação mínima.

<!-- /marc-message -->

<!-- marc-message
id: msg_3d2a90f01ff74a37a9
threadId: bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7
timestamp: 2026-05-13T04:32:31.965Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluido e validado. A thread permanece aberta aguardando feedback do usuario.

O que foi realizado:

- `agent_register` permanece idempotente e agora retorna `status`, `created`, `alreadyExists` e `updated`.
- A escrita oficial de perfis de agente agora gera header e `ID` a partir do `id` slugificado.
- `displayName` continua tolerado para clientes antigos, mas e ignorado e nao controla mais o header.
- `Role` e `Model` sao normalizados em minusculo com hifen; `Model` preserva ponto.
- `Description:` e escrita como campo de linha unica; a escrita oficial usa a primeira linha e limita a 160 caracteres.
- `agent_list` agora e conciso por padrao e aceita `includeMarkdown: true` para leitura completa.
- `workspace_bootstrap` retorna inventario estruturado curto de agentes registrados.
- A UI continua lendo e exibindo o Markdown do perfil como fonte da verdade; para a API da UI, o daemon segue usando `includeMarkdown: true`.
- Comentarios da UI registram/atualizam `ui-user` com `Role: user`, `Model: human` e `Description: Posted from the mARC web UI.`.
- Documentacao atualizada em `docs/mcp-tools.md` e `docs/agent-workflows.md`.

Validacoes executadas:

- RED inicial confirmado: 6 falhas esperadas antes da implementacao.
- `pnpm test test/core.test.ts test/mcp.test.ts test/daemon.test.ts`: passou, 52/52, 0 falhas.
- `pnpm typecheck`: passou, exit 0.
- `pnpm test`: passou, 52/52, 0 falhas.
- `pnpm build`: passou, exit 0.
- Inspecao do `dist/mcp/server.js`: tools canonicas preservadas; `agent_register` expoe `id`, `role`, `model`, `description`, `displayName`, `bootstrapConfirmed`; `agent_list` expoe `includeMarkdown`, `bootstrapConfirmed`.

Observacao de worktree:

- A thread atual recebeu este plano/relatorio em `.marc/threads/bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7/`.
- Ha uma alteracao preexistente/externa em `.marc/threads/oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb/CHAT.md` registrando que audit de profiles de agentes tambem e valido; eu nao reverti essa alteracao.

Aguardando feedback para orientar a finalizacao da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_d329b060765e4acdb2
threadId: bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7
timestamp: 2026-05-13T05:22:10.388Z
agentId: codex-dev
role: developer
-->

Validacao destrutiva adicional executada antes de orientar o encerramento.

Cenario testado:

- Editei o agente temporario `temp-agent-example` com contexto manual abaixo dos metadados.
- Reexecutei `registerAgent` no mesmo ID.
- Antes da correcao, esse fluxo removia o conteudo manual; reproduzi esse comportamento destrutivo com o `dist` anterior.

Ajuste realizado:

- `agent_register` agora substitui apenas o bloco de metadados canônico ate `Description:`.
- Conteudo manual abaixo de `Description:` e preservado em re-registros/atualizacoes.
- A leitura concisa de `agent_list` e `workspace_bootstrap` continua usando somente a linha `Description:`.

Validacoes adicionais:

- Nova regressao em `test/core.test.ts` cobrindo preservacao de contexto manual.
- `pnpm test test/core.test.ts`: passou, 53/53, 0 falhas.
- `pnpm typecheck`: passou, exit 0.
- `pnpm test`: passou, 53/53, 0 falhas.
- `pnpm build`: passou, exit 0.
- Validacao real via `dist/core/workspace.js` no agente temporario: contexto manual preservado e `agent_list` continuou conciso.
- Validacao real via MCP `StdioClientTransport` contra `dist/cli.js mcp`: re-registro retornou `unchanged`, o perfil manteve contexto manual e `agent_list` retornou apenas campos estruturados.

Esse era o unico cenario destrutivo adicional identificado ate agora. Aguardando feedback para encerramento.

<!-- /marc-message -->
