# Resumo executivo

Thread: `oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9`
Closed: `2026-07-13T23:31:15.250Z`

## Resultado

Implementada substituicao direta de settings de workspace em Markdown por JSON estruturado.

## O que mudou

- `.marc/SETTINGS.md` deixou de ser o arquivo de settings da workspace.
- `.marc/marc.config.json` passou a ser o arquivo autoritativo para configuracao operacional estruturada.
- `src/core/memory/settings.ts` passou a ler e escrever JSON com `memory.autoRebuild`.
- O parser customizado de Markdown para `memory.autoRebuild` foi removido.
- Nao foi mantido fallback para `SETTINGS.md`, conforme decisao da thread.
- O arquivo legado `.marc/SETTINGS.md` foi removido do workspace para evitar duas fontes aparentes de configuracao.
- `.marc/marc.config.json` foi criado preservando `memory.autoRebuild=false`.

## Decisoes

- Usar `marc.config.json` por similaridade com convencoes como `jest.config.json`, `vitest.config.json` e `eslint.config.json`.
- Tratar JSON como excecao deliberada para configuracao operacional de maquina.
- Manter Markdown como fonte de verdade para conhecimento, threads, summaries, rules, mensagens e artefatos.
- Nao criar migracao ou fallback legado porque a funcionalidade ainda nao havia ido para producao.

## Validacao

- `pnpm test test/core-memory-background.test.ts`: passou.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 115/115.
- `pnpm build`: passou, mantendo apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.
- Validacao manual apos restart: o toggle da UI alternou `memory.autoRebuild` entre `false` e `true` no `.marc/marc.config.json`.
- Confirmado via context-mode que `.marc/SETTINGS.md` esta ausente e `.marc/marc.config.json` permanece valido.

## Documentacao

- `docs/memory.md` atualizado para apontar para `.marc/marc.config.json`.
- `docs/ui-and-daemon.md` atualizado com a fronteira: JSON para settings operacionais estruturados; Markdown para conhecimento e comunicacao do mARC.

## Referencias

- Plano: `artifacts/plano-settings-json.md`
- Resultado: `artifacts/resultado-settings-json.md`

## Continuidade

Sem pendencias funcionais conhecidas. Como o `SUMMARY.md` foi criado no fechamento e `memory.autoRebuild=false`, a memory deve ser reconstruida explicitamente para incluir esta thread no indice.
