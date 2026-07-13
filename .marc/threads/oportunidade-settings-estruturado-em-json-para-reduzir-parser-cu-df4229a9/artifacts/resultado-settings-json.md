# Resultado - Settings estruturado em JSON

## Entrega

Implementada a substituição direta de settings de workspace em Markdown por JSON estruturado.

## O que mudou

- `src/core/memory/settings.ts` passou a usar `.marc/marc.config.json` como arquivo autoritativo de settings.
- O parser customizado de `SETTINGS.md` foi removido do core.
- A leitura agora usa JSON:
  - arquivo ausente retorna default em memória;
  - `memory.autoRebuild` ausente ou inválido volta para default `true`;
  - JSON inválido falha como configuração inválida.
- A escrita agora usa `JSON.stringify(settings, null, 2)` com newline final.
- O lock lógico `workspace-settings` foi mantido para preservar a coordenação de escrita.
- Não existe fallback para `SETTINGS.md`, conforme decisão da thread.
- `.marc/marc.config.json` foi criado no workspace atual preservando `memory.autoRebuild: false`.

## Testes

- `test/core-memory-background.test.ts` agora verifica:
  - persistência em `.marc/marc.config.json`;
  - conteúdo JSON válido com `memory.autoRebuild`;
  - ausência de escrita de `SETTINGS.md` no fluxo novo;
  - `SETTINGS.md` legado é ignorado e não controla mais settings.

## Documentação

Atualizados:

- `docs/memory.md`
- `docs/ui-and-daemon.md`

A documentação agora registra `.marc/marc.config.json` como configuração operacional estruturada e preserva a fronteira arquitetural: Markdown segue como source of truth para conhecimento, threads, summaries, regras, mensagens e artefatos.

## Validação executada

Via context-mode:

- `pnpm test test/core-memory-background.test.ts`: passou, 115/115 no runner atual.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 115/115.
- `pnpm build`: passou; manteve apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.

## Observações

- `SETTINGS.md` não foi encontrado no disco antes da migração local.
- Como o usuário havia informado que desabilitou o auto rebuild, o novo `.marc/marc.config.json` foi criado com `memory.autoRebuild: false`.
- Para validar o comportamento em UI/daemon já em execução, será necessário reiniciar os recursos que ainda estiverem carregando o código antigo.
