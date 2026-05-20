# Plano - Revisao arquitetural organizacional do projeto mARC

Thread: `marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`

## Correção de escopo

Este plano substitui o artifact anterior `artifacts/plano-eslint-max-lines-quality-gate.md`.

O plano anterior focava demais em ESLint e documentacao. A primeira mensagem da thread define um escopo mais amplo: revisar organizacao de arquivos, fronteiras entre `core`, `daemon`, `MCP` e `UI`, acoplamentos, duplicacoes, padroes para novas tools e criterios de divisao. O ESLint com `max-lines` entra como quality gate para sustentar essa revisao, nao como objetivo isolado.

## Contexto considerado

Fontes lidas antes do plano:

- `README.md`.
- `docs/architecture.md`.
- `docs/development.md`.
- Thread completa `marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`.
- `package.json`.
- Estrutura atual de `src` e `test`.
- Outlines e contagem de linhas dos maiores arquivos via context-mode.

Estado atual observado:

- Nao existe configuracao ESLint no projeto.
- Arquivos mais criticos por tamanho:
  - `src/ui/main.tsx`: 1543 linhas.
  - `test/core.test.ts`: 1092 linhas.
  - `src/core/workspace.ts`: 787 linhas.
  - `src/mcp/server.ts`: 631 linhas.
  - `src/daemon/server.ts`: 604 linhas.
  - `src/core/audit.ts`: 566 linhas.
  - `src/daemon/ui.ts`: 405 linhas.
- Ha concentracao de responsabilidades em arquivos-fachada que hoje tambem carregam detalhes internos demais.

## Objetivo da entrega

Reorganizar o projeto de forma pragmatica para melhorar fronteiras e reduzir arquivos grandes, preservando comportamento publico. Depois, adicionar ESLint com `max-lines` estrito para impedir regressao.

## Mudancas planejadas

1. Adicionar quality gate executavel

- Criar `eslint.config.js` em flat config.
- Adicionar `eslint` e `typescript-eslint` em `devDependencies`.
- Adicionar `pnpm lint` ao `package.json`.
- Configurar `max-lines` como erro para `src/**/*.{ts,tsx}` e `test/**/*.ts`.
- Usar limite inicial de 300 linhas, com `skipBlankLines: true` e `skipComments: true`.
- Nao criar excecoes para arquivos legados grandes.

2. Reorganizar UI

- Manter `src/ui/main.tsx` como bootstrap/render principal.
- Extrair tipos compartilhados da UI para modulo proprio.
- Extrair componentes primitivos pequenos, como `Button`, `Badge`, `EmptyState` e navegação.
- Extrair `Composer` para modulo proprio.
- Extrair views/modais de thread e artifact para modulos proprios.
- Preservar comportamento visual e interacoes existentes.

3. Reorganizar core workspace

- Manter `src/core/workspace.ts` como fachada publica.
- Extrair responsabilidades internas para modulos menores:
  - agentes e profiles;
  - rules/recommendations/skill gerenciada;
  - threads e mensagens;
  - artifacts;
  - status/index.
- Preservar nomes e contratos exportados usados por MCP, daemon e testes.

4. Reorganizar MCP

- Manter `src/mcp/server.ts` como entrypoint publico.
- Extrair helpers de resposta e bootstrap gating.
- Extrair helper guide (`marc_helper`) para modulo proprio.
- Extrair conexao/lease/heartbeat do daemon para modulo proprio.
- Extrair registro de tools por dominio quando necessario para manter arquivos abaixo do limite.
- Preservar nome, schema e retorno das tools MCP.

5. Reorganizar daemon

- Manter `src/daemon/server.ts` como entrypoint publico.
- Extrair helpers HTTP/static/auth/body.
- Extrair event bus.
- Organizar rotas por dispatch table de metodo/path.
- Preservar endpoints, auth, eventos, rebuild de indice e lifecycle.

6. Reorganizar audit

- Manter `src/core/audit.ts` como API publica.
- Extrair loaders e helpers de findings.
- Extrair auditorias por escopo: rules, artifacts, references, agents e preflight.
- Manter strategy/dispatch table para escopos.
- Preservar saida de `workspace_audit`.

7. Reorganizar testes

- Dividir `test/core.test.ts` por comportamento.
- Criar helper compartilhado somente quando reduzir duplicacao real.
- Preservar cobertura dos cenarios atuais.

## Regras de implementacao

- Markdown continua source of truth. Nao alterar formatos de persistencia.
- Nao alterar contratos MCP, `marc://`, estrutura de thread, artifacts ou cache.
- Nao usar `else` em codigo novo ou modificado.
- Nao aninhar `if` em codigo novo ou modificado.
- Usar early return para guards.
- Usar strategy/dispatch table para variacoes reais, especialmente audit scopes, MCP tools e daemon routes.
- Evitar documentacao como entrega central. A regra deve existir no codigo/configuracao executavel.

## Validacao planejada

- `pnpm install` para atualizar lockfile.
- `pnpm lint` para validar `max-lines` e o novo gate.
- `pnpm typecheck` para validar imports/exports apos extracoes.
- `pnpm test` para validar comportamento.
- `pnpm build` para validar build Node e UI.
- `workspace_audit` na thread para artifacts e references antes do comentario final.

## Comentario final esperado na thread

Ao final, postar mensagem na thread com:

- artifact de plano usado;
- plano anterior superseded;
- resumo das reorganizacoes;
- quality gate adicionado;
- validacoes executadas;
- pendencias ou riscos, se houver;
- pedido de feedback antes de orientar o fechamento.
