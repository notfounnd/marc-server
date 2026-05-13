# Sumario executivo

Closed: `2026-05-13T05:35:00.000Z`

## Resultado

A thread foi concluida. O contrato de `agent_register` foi ajustado para diferenciar criacao, atualizacao e reutilizacao idempotente de agentes existentes, e o fluxo de descoberta de agentes ficou mais resiliente por meio de `agent_list` conciso e inventario no `workspace_bootstrap`.

## Contexto

O problema original era que `agent_register` retornava apenas `{ id }`, sem indicar se o agente tinha acabado de ser criado ou se ja existia. Isso podia levar agentes e usuarios a interpretarem uma chamada idempotente como criacao nova.

Durante a discussao, o escopo foi refinado para tratar tambem o formato oficial de escrita dos perfis de agente e a descoberta previa de agentes existentes, sem alterar a semantica de leitura da UI.

## Tratativa

- `agent_register` permanece idempotente e agora retorna `status`, `created`, `alreadyExists` e `updated`.
- A escrita oficial de perfil gera header e `ID` a partir do `id` slugificado.
- `displayName` continua tolerado para clientes antigos, mas e ignorado e nao controla mais o header.
- `Role` e `Model` sao normalizados em minusculo com hifen; `Model` preserva ponto.
- Os metadados de perfil sao escritos como campos de linha: `ID`, `Role`, `Model` e `Description`.
- Na escrita oficial, cada campo de metadado ocupa uma linha; o valor recebido em `description` usa a primeira linha e e limitado a 160 caracteres.
- Conteudo manual abaixo do bloco de metadados e preservado em re-registros/atualizacoes.
- `agent_list` passou a ser conciso por padrao e aceita `includeMarkdown: true` para leitura completa.
- `workspace_bootstrap` passou a retornar inventario estruturado curto de agentes registrados.
- A UI continua fiel ao Markdown do perfil; o daemon usa `includeMarkdown: true` para manter a leitura completa usada pela interface.
- Comentarios da UI registram/atualizam `ui-user` com `Role: user`, `Model: human` e `Description: Posted from the mARC web UI.`.
- Documentacao revisada e atualizada em `docs/mcp-tools.md`, `docs/agent-workflows.md`, `docs/architecture.md`, `docs/harness-engineering.md`, `docs/adrs/0007-rules-managed-baseline-and-custom-rules.md` e `.marc/RULES.md`.

## Validacao

- RED inicial confirmado com falhas esperadas antes da implementacao.
- Cenario destrutivo adicional reproduzido: reexecutar `registerAgent` removia contexto manual abaixo dos metadados.
- Nova regressao adicionada para preservar contexto manual em perfis de agente.
- `pnpm test test/core.test.ts test/mcp.test.ts test/daemon.test.ts`: passou.
- `pnpm test test/core.test.ts`: passou com 53/53.
- `pnpm typecheck`: passou.
- `pnpm test`: passou com 53/53.
- `pnpm build`: passou.
- Inspecao do `dist/mcp/server.js` confirmou schemas de `agent_register` e `agent_list`.
- Validacao real via `dist/core/workspace.js` no agente temporario confirmou preservacao de contexto manual.
- Validacao real via MCP `StdioClientTransport` contra `dist/cli.js mcp` confirmou re-registro idempotente, preservacao de contexto manual e `agent_list` conciso.
- Revisao documental completa por busca de referencias confirmou alinhamento de bootstrap, listagem de agentes, formato de perfil e leitura completa por Markdown.
- `git diff --check` nos arquivos de documentacao nao reportou problemas.

## Observacoes

- O agente temporario `.marc/agents/temp-agent-example.md` foi criado para validacao manual e removido apos a validacao.
- A thread `oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb` recebeu uma alteracao externa registrando que audit de profiles de agentes tambem e valido; essa alteracao nao foi revertida.
- Fingerprint para humanos/projeto/origem ficou fora desta thread e pode ser tratado como oportunidade futura.

## Referencias

- Plano detalhado: `artifacts/plano-agent-register-contrato-e-inventario.md`
