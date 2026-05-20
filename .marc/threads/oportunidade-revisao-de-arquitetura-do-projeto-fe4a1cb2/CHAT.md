# Oportunidade - Revisao de arquitetura do projeto

Thread: `oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`
Created: `2026-05-01T23:47:10.126Z`

<!-- marc-message
id: msg_c8b9c6d21b0846fab8
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-01T23:47:40.613Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para revisao de arquitetura do projeto.

Objetivo inicial:
- Avaliar organizacao de arquivos, fronteiras entre core/daemon/MCP/UI e padroes de desenvolvimento.
- Identificar pontos de acoplamento, arquivos grandes, duplicacoes e convencoes que precisam virar regra do projeto.
- Propor melhorias pragmáticas sem refatoracao ampla desnecessaria.

Possiveis temas:
- Separacao entre dominio, transporte MCP, daemon HTTP e UI.
- Organizacao de tipos e contratos compartilhados.
- Padroes para novas tools MCP e testes associados.
- Estrategia para evoluir cache/indice, artifacts, referencias e encerramento de threads.
- Criterios para quando dividir arquivos ou criar adapters.

Status: oportunidade aberta para refinamento antes de implementacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_6424ab3c720c494793
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-06T05:03:36.106Z
agentId: ui-user
role: user
-->

Notei alguns arquivos muito grandes. Seria interessante manter arquivos menores.

<!-- /marc-message -->

<!-- marc-message
id: msg_0d5574c4fa3b4b218f
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-19T01:57:52.860Z
agentId: ui-user
role: user
-->

Tem algumas coisas que da para colocar o eslint como ferramenta para quality gate, uma delas seria max-lines (para ajudar a não ter tanto arquivo gigante no projeto).

<!-- /marc-message -->

<!-- marc-message
id: msg_e6ac72b4c85a4b9386
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-19T02:04:28.998Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-eslint-max-lines-quality-gate.md
-->

Plano detalhado registrado antes do desenvolvimento.

Artifact:
- `artifacts/plano-eslint-max-lines-quality-gate.md`

Referência da thread:
- `marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`

Fontes usadas para o plano:
- `README.md`
- `docs/architecture.md`
- `docs/development.md`
- `package.json`
- inspeção de configuração/lockfile ESLint
- contagem de linhas em `src` e `test` via context-mode

Resumo:
- Introduzir ESLint como quality gate incremental.
- Adicionar `max-lines` sem quebrar imediatamente arquivos legados grandes.
- Documentar `pnpm lint` no fluxo de desenvolvimento.
- Validar com lint, typecheck, test e build quando viável.

<!-- /marc-message -->

<!-- marc-message
id: msg_39267f8f8edb4ce0a6
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-19T02:26:08.163Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-revisao-arquitetural-organizacional.md
-->

Plano revisado registrado antes do desenvolvimento.

Artifact:
- `artifacts/plano-revisao-arquitetural-organizacional.md`

Referência:
- `marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`

Observação importante:
- Este plano substitui o plano inicial de max-lines registrado anteriormente nesta thread.
- O escopo agora parte da primeira mensagem da thread: revisão arquitetural organizacional do projeto, com ESLint/`max-lines` como quality gate para sustentar a reorganização.

<!-- /marc-message -->

<!-- marc-message
id: msg_b597b158606d47a9b9
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-19T04:59:18.123Z
agentId: codex-dev
role: developer
-->

Desenvolvimento realizado para [$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2](marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2).

Resumo:
- Adicionado quality gate `pnpm lint` com ESLint 9 e `max-lines` em 300 para arquivos TypeScript, TSX, JavaScript e testes.
- Reorganizados módulos grandes por responsabilidade: core workspace/audit, daemon server/UI, MCP server e UI React.
- Reorganizados testes grandes em arquivos por domínio: agentes, artifacts, audit, recommendations/rules, thread index, daemon runtime e MCP agent.
- Corrigidos `else` remanescentes em `src/cli.ts`, `src/daemon/config.ts` e `src/daemon/store.ts` com early return/guards.
- Ajustado fluxo de referência mARC da UI para dispatch table por tipo de referência.
- Atualizado `docs/development.md` para incluir `pnpm lint` no fluxo de scripts e validação.

Validação executada:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` com 72 testes passando
- `pnpm build`
- scan `rg "\\belse\\b" src test eslint.config.js` sem ocorrências
- contagem final: nenhum arquivo `.ts`, `.tsx` ou `.js` em `src`, `test` ou `eslint.config.js` acima de 300 linhas
- `workspace_audit` da thread sem achados críticos. Restam apenas warnings de metadata faltante em perfis de outros agentes: [@claude-qa-engineer](marc://@claude-qa-engineer), [@claude-software-architect](marc://@claude-software-architect) e [@copilot-dev](marc://@copilot-dev).

Aguardo feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_cfcd55e363ef43cc8e
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-20T03:35:31.715Z
agentId: codex-dev
role: developer
-->

Atualizacao incremental realizada.

Escopo ajustado:
- `validate` agora executa `code:fix`, `code:check` e `typecheck`.
- README e `docs/development.md` agora apresentam o fluxo final como `pnpm run validate`, `pnpm test`, `pnpm build`.
- `.marc/RULES.md` recebeu regra operacional para exigir esse fluxo antes de reportar conclusao de mudancas de codigo, tooling, testes, build, lint, formatacao ou documentacao.

Validacao executada:
- `pnpm run validate`: passou, incluindo `typecheck`.
- `pnpm test`: passou com 72 testes.
- `pnpm build`: passou.
- `workspace_audit` na thread: sem criticos. Permanecem apenas warnings de metadata ausente em `marc://@claude-qa-engineer`, `marc://@claude-software-architect` e `marc://@copilot-dev`.

<!-- /marc-message -->

<!-- marc-message
id: msg_03b6173847a748889f
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-20T03:59:22.155Z
agentId: ui-user
role: user
artifacts: artifacts/ignorar-mensagem.md
-->

Teste de autocomplete:

- marc://@codex-dev
- marc://#msg_cfcd55e363ef43cc8e
- marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
- marc://$oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb/#msg_6d2cc0da197a40549a/!proposta-marc-audit-custom-rules.md

<!-- /marc-message -->

<!-- marc-message
id: msg_b843ff5b63e44ea68b
threadId: oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2
timestamp: 2026-05-20T04:00:58.496Z
agentId: ui-user
role: user
-->

Smoke manual ok.

<!-- /marc-message -->
