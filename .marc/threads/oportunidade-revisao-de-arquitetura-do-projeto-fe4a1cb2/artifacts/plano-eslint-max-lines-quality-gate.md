# Plano - ESLint max-lines como quality gate incremental

Thread: `marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`

## Contexto lido

- `README.md`: projeto `@notfounnd/marc-server`, mARC como camada local de coordenacao agentica baseada em Markdown, MCP, daemon local, UI e workspace audit.
- `docs/architecture.md`: Markdown e source of truth, cache/indices/daemon/UI como derivados rebuildable, fronteiras entre core, MCP, daemon e UI.
- `docs/development.md`: scripts atuais `pnpm typecheck`, `pnpm test`, `pnpm build`; ainda nao ha script de lint documentado.
- Thread alvo: oportunidade nasceu de revisao de arquitetura e foi refinada para arquivos grandes e uso de ESLint como quality gate, especialmente `max-lines`.
- Inspecao por context-mode: nao existe configuracao ESLint no repositorio e `pnpm-lock.yaml` nao contem ESLint atualmente.

## Diagnostico inicial

Arquivos TypeScript/TSX mais longos encontrados:

- `src/ui/main.tsx`: 1543 linhas.
- `src/core/workspace.ts`: 787 linhas.
- `src/mcp/server.ts`: 631 linhas.
- `src/daemon/server.ts`: 604 linhas.
- `src/core/audit.ts`: 566 linhas.
- `src/daemon/ui.ts`: 405 linhas.
- `src/daemon/lifecycle.ts`: 298 linhas.
- `src/core/thread-index.ts`: 268 linhas.
- `src/core/types.ts`: 238 linhas.

A introducao de `max-lines` estrito no repositorio inteiro quebraria o projeto imediatamente. A abordagem correta e incremental: instalar ESLint, configurar a regra com limites reais por tipo de arquivo e permitir uma lista explicita de arquivos legados que ja excedem o limite. Assim, novos arquivos grandes e crescimento fora do combinado passam a ser bloqueados sem exigir refatoracao ampla na mesma entrega.

## Proposta

1. Adicionar ESLint ao projeto como quality gate oficial.
2. Criar `eslint.config.js` em flat config, aderente ao ecossistema atual de ESM.
3. Adicionar script `pnpm lint` ao `package.json`.
4. Configurar `max-lines` para `src`, `test` e arquivos de configuracao relevantes.
5. Preservar compatibilidade inicial com arquivos grandes existentes por overrides documentados no config.
6. Documentar o novo quality gate em `docs/development.md`.
7. Validar com `pnpm lint`, `pnpm typecheck`, `pnpm test` e, se viavel no tempo, `pnpm build`.

## Design do quality gate

### Limite padrao

- Aplicar `max-lines` com `skipBlankLines: true` e `skipComments: true`.
- Usar limite padrao conservador para arquivos novos e arquivos pequenos.
- A primeira proposta de limite padrao sera em torno de 300 linhas para `src/**/*.{ts,tsx}`.
- Para testes, permitir um limite um pouco maior, pois fixtures e cenarios podem ocupar mais espaco, sem liberar crescimento irrestrito.

### Arquivos legados

- Arquivos que ja excedem o limite entram em override explicito.
- O override deve ser tratado como backlog tecnico, nao como padrao desejado.
- Os comentarios do config devem ser objetivos e explicar que os limites legados existem para permitir adocao incremental do lint.

### Escopo inicial

- Lintar `src/**/*.{ts,tsx}`, `test/**/*.ts`, `eslint.config.js` e configs JS quando aplicavel.
- Evitar introduzir regras amplas de estilo nesta entrega. O foco e o quality gate de tamanho de arquivo.

## Riscos e mitigacoes

- Risco: ESLint exigir dependencias novas e lockfile atualizado.
  - Mitigacao: adicionar dependencias de desenvolvimento explicitamente e atualizar lockfile com pnpm.
- Risco: regra bloquear arquivos legados ja conhecidos.
  - Mitigacao: overrides pontuais para os arquivos que ja excedem o limite.
- Risco: virar refatoracao ampla de arquitetura.
  - Mitigacao: esta entrega nao divide arquivos grandes; ela cria o gate para impedir piora e orientar refatoracoes futuras.
- Risco: qualidade gate ficar invisivel no fluxo do projeto.
  - Mitigacao: documentar `pnpm lint` em `docs/development.md` e incluir no checklist de validacao.

## Plano de desenvolvimento

1. Criar configuracao ESLint flat config.
2. Adicionar devDependencies necessarias para lint TypeScript.
3. Adicionar script `lint` no `package.json`.
4. Ajustar `pnpm-lock.yaml` via `pnpm install` ou comando equivalente, se necessario.
5. Rodar `pnpm lint` e ajustar somente problemas dentro do escopo da configuracao.
6. Atualizar `docs/development.md` com o novo script e checklist.
7. Rodar validacoes finais.
8. Postar na thread o que foi realizado, arquivos alterados, validacoes executadas e pendencias.

## Regras do projeto aplicadas

- Markdown continua source of truth: a mudanca e de tooling/configuracao e docs, sem alterar o modelo de persistencia.
- Context-mode usado para investigar README, docs, package, lockfile, configuracoes e tamanho dos arquivos.
- Controle de fluxo de codigo, se houver edicao TypeScript, deve respeitar sem `else`, sem `if` aninhado, early returns e strategy/dispatch table quando houver variacao real.
- Artifact criado antes de iniciar desenvolvimento e deve ser anexado na mensagem de plano.
