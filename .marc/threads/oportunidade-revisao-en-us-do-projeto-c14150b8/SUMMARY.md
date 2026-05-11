# Resumo executivo

Thread: `oportunidade-revisao-en-us-do-projeto-c14150b8`
Closed: `2026-05-11T22:35:27.000Z`

## Objetivo

Revisar o projeto para garantir que código, textos de produto e documentação estejam em `en-US`, aproveitando a oportunidade para iniciar a estrutura de i18n da interface web.

## Resultado

A implementação foi concluída com o escopo corrigido: i18n ficou restrito aos textos visíveis da UI. MCP, core, daemon, CLI, contratos de arquivo, schemas, guards e erros operacionais permanecem com strings literais em en-US.

O conteúdo autoral do workspace não é afetado pela decisão. Mensagens, títulos de threads, artifacts, summaries e custom rules podem ser escritos no idioma preferido do usuário.

## Entregas

- Adicionadas as dependências `i18next`, `react-i18next` e `i18next-http-backend`.
- Criado o catálogo plano `public/locales/en_US/translation.json`.
- Criado o bootstrap de i18n da UI em `src/ui/i18n.ts`.
- Criado helper de catálogo em `src/i18n/index.ts` para testes e inspeção do catálogo.
- Migrados textos fixos visíveis de `src/ui/main.tsx` para `useTranslation()`.
- Criados testes em `test/i18n.test.ts` para proteger catálogo plano, fallback, interpolação, escopo de imports e ausência de strings MCP/backend/CLI no catálogo da UI.
- Atualizado `docs/development.md` com as regras de localização.
- Criada a ADR `docs/adrs/0008-ui-only-localization-boundary.md` e atualizado o índice de ADRs.

## Decisões

- A localização é uma capacidade da interface web, não dos contratos técnicos do sistema.
- O catálogo de tradução deve continuar plano, com chave/valor string.
- Textos técnicos de MCP/backend/core/CLI continuam literais em en-US para manter previsibilidade para agentes, testes, logs e integrações.
- Conteúdo autoral do workspace segue flexível quanto ao idioma.

## Validação

- `pnpm test test/i18n.test.ts` passou. Pelo script atual, a suíte completa foi executada e passou com 46 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- Auditoria de acentos em arquivos de produto não encontrou texto pt-BR fora do nome do autor em `package.json`.

## Documentação e continuidade

Antes do encerramento, a documentação foi revisada e incrementada com a ADR de boundary de localização.

A thread `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` também foi revisada conforme `RULES.md`. O artifact `artifacts/playwright-test-scenarios.md` recebeu a seção `UI Localization` com cenários E2E pendentes para catálogo `en_US`, labels da UI, modais/composer, fallback e preservação de conteúdo autoral.

## Estado final

Thread encerrada. A base de i18n da UI está implementada, documentada e validada, mantendo o limite arquitetural explícito entre experiência de produto localizada e contratos técnicos em en-US literal.

