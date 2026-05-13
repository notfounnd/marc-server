# Plano: registro explícito e inventário conciso de agentes

## Summary

Corrigir `agent_register` para manter idempotência, mas sinalizar claramente se criou, atualizou ou reutilizou um agente existente. Como complemento do mesmo contrato, padronizar a escrita oficial dos arquivos de agente e tornar bootstrap/listagem mais resilientes para evitar registros duplicados.

Antes da implementação, registrar este plano como artefato na thread `bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7`. Ao final, comentar na thread o que foi realizado e aguardar feedback.

## Key Changes

- `agent_register` retorna:
  - `id`
  - `status: "created" | "updated" | "unchanged"`
  - `created`
  - `alreadyExists`
  - `updated`

- Escrita oficial via `agent_register` gera perfil canônico:
  ```markdown
  # codex-dev

  ID: `codex-dev`
  Role: developer
  Model: gpt-5.5
  Description: Development agent working through Codex.
  ```

- Regras de escrita:
  - `id`: slug canônico atual.
  - Header: sempre derivado do `id` slugificado.
  - `ID`: igual ao header.
  - `role`: minúsculo, espaços viram hífen.
  - `model`: minúsculo, espaços viram hífen, preservando ponto.
  - `description`: obrigatório; na escrita oficial usa só a primeira linha e aplica limite de 160 caracteres.
  - `displayName`: se enviado por cliente antigo, é ignorado e não controla header.

- UI e leitura completa não mudam:
  - UI continua exibindo exatamente o header existente no Markdown.
  - `agent_read_profile` continua retornando o Markdown completo.
  - Arquivos editados manualmente fora do padrão não são corrigidos nesta thread.

## Bootstrap e Listagem

- `agent_list` fica conciso por padrão:
  ```json
  {
    "id": "codex-dev",
    "role": "developer",
    "model": "gpt-5.5",
    "description": "Development agent working through Codex."
  }
  ```

- `agent_list` aceita `includeMarkdown: true` para retornar também o Markdown completo.

- `workspace_bootstrap` inclui inventário estruturado curto:
  ```json
  {
    "agents": {
      "count": 1,
      "registered": [
        {
          "id": "codex-dev",
          "role": "developer",
          "model": "gpt-5.5",
          "description": "Development agent working through Codex."
        }
      ]
    }
  }
  ```

- Regras de leitura estruturada:
  - `Description:` é campo de linha única.
  - `agent_list` e bootstrap leem somente o texto na mesma linha de `Description:`.
  - Não há truncamento nem correção na leitura; se o arquivo manual tiver `Description:` maior que 160, a linha inteira é retornada.
  - Conteúdo livre abaixo dos metadados fica disponível apenas em `agent_read_profile` ou `agent_list({ includeMarkdown: true })`.

- `RULES.md` gerenciado orienta agentes a verificar agentes existentes via bootstrap/`agent_list` antes de escolher novo ID quando houver dúvida.

## Test Plan

- Core:
  - agente novo retorna `created`;
  - mesmo payload retorna `unchanged`;
  - mesmo ID com dados diferentes retorna `updated`;
  - `displayName` enviado não altera header;
  - arquivo escrito usa header e `ID` iguais ao slug;
  - `role` e `model` são normalizados;
  - `description` usa só primeira linha na escrita;
  - `description` acima de 160 caracteres via `agent_register` é limitada na escrita oficial;
  - `agent_list` retorna payload conciso por padrão;
  - `agent_list({ includeMarkdown: true })` inclui Markdown;
  - `agent_list` lê `Description:` manual longa até a quebra de linha, sem truncar.

- MCP:
  - schema de `agent_register` exige `id`, `role`, `model`, `description`;
  - schema tolera `displayName` sem efeito;
  - resposta de `agent_register` expõe `status`, `created`, `alreadyExists`, `updated`;
  - `agent_list` aceita `includeMarkdown`;
  - `workspace_bootstrap` retorna inventário de agentes.

- Daemon/UI:
  - comentário da UI registra/atualiza `ui-user` com `role: user`, `model: human`, `description: Posted from the mARC web UI.`;
  - comentário da UI continua sem alterar `RULES.md`;
  - UI continua exibindo o header literal do arquivo.

- Verificação final:
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
  - validar tools MCP a partir de `dist` após build.

## Assumptions

- `agent_register` permanece idempotente.
- A mudança de padrão vale para escrita oficial, não para leitura/renderização da UI.
- Arquivos manuais fora do padrão não serão migrados nesta thread.
- Auditoria futura tratará drift, descrições longas, headers manuais fora do padrão e contexto adicional em perfis.
- Fingerprint para humanos/projeto/origem fica fora desta correção e pode virar oportunidade futura.
