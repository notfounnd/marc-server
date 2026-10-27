# Handoff da T4: retirada do Deep da UI e snapshot v7

## Contexto

O humano decidiu seguir a regra pré-registrada (ver marc://msg_e55e07f2ab4e49dfb5 e `decisao-e3.md`): a UI fica com uma busca única em depth 0, igual ao M0. A retirada do Deep da UI vale em qualquer resultado da E3 (D3, seção 6 do plano), por isso a T4 começa enquanto a decisão recebe a coaprovação do Codex. A T4 não depende da T3.

## Fontes obrigatórias

- O plano (revisão 8): seção 6 ("Retirada do Deep da UI"), linha T4 da tabela de tarefas e escopo de escrita.
- `decisao-e3.md`.
- RULES.md completo, incluindo Custom Rules (Playwright CLI e en-US no produto), AGENTS.md, a skill marc-ops, `docs/ui-and-daemon.md` e o backlog marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a.

## Escopo funcional

1. **Remoções na UI:** `src/ui/memory-search-depth.ts`, o botão `Deep retry`, o estilo `.memory-search-deep-retry`, a cadeia de props (`deepRetryAvailable`, `onDeepRetry`, `memorySearchDeepRetryAvailable` e `onMemorySearchDeepRetry`) e o laço de profundidades do cliente (`recallMemorySearchDepths`). A UI faz uma única busca, sem `depth` (depth 0).
2. **Settings:** sai a seção `Search depth` de `workspace-settings-panel.tsx`, com a sua cadeia (`workspace-settings-modal.tsx`, `app-modals.tsx` e `use-workspace-memory-actions.ts`), e saem as chaves de tradução sem uso.
3. **`memory.searchRetryDepth`:** sai de `WorkspaceSettings`, de `WorkspaceSettingsInput`, da saúde da memória, de `settings.ts`, de `background.ts` e da rota de settings. Um JSON antigo com a chave continua válido: a leitura ignora a chave e a próxima escrita a remove, com teste.
4. **Snapshot:** `MEMORY_SEARCH_SCHEMA_VERSION` passa de 6 para 7 e o snapshot deixa de guardar profundidades. Um snapshot v6 guardado é descartado sem erro.
5. **Grupos sem thread:** a UI mostra hits de `rules` e `document` com o caminho e sem link de thread; a validação do estado guardado aceita hits sem `threadId`; selecionar um desses hits não mostra "Thread not found". Com a depth 0 isso é raro, mas o contrato do hit já permite esses grupos.

## Escopo de escrita

- **Autorizado:**
  - os arquivos de UI da seção 6 do plano e `src/ui/styles/shell-navigation.css`;
  - `public/locales/en_US/translation.json`;
  - `src/core/memory/settings.ts`, `background.ts` e `types.ts`, só para a saída de `searchRetryDepth`;
  - `src/daemon/memory-routes.ts` e a rota de settings, também só para a saída de `searchRetryDepth`;
  - `test/**` e `docs/ui-and-daemon.md`.
- **Excluídos:**
  - `scripts/memory-eval/**`, datasets e capturas;
  - os demais arquivos de `src/core/memory/**`, como ranking, funil e camadas;
  - `src/mcp/**`, `.marc/memory/**` e `pnpm-lock.yaml`;
  - Git.

## Testes e validação

- Testes de UI atualizados, com `ui-memory-search-depth.test.ts` removido.
- Testes novos:
  - settings antigo com `searchRetryDepth` lido e regravado sem a chave;
  - snapshot v6 descartado;
  - hit sem `threadId` aceito e exibido com o caminho.
- Testes sem `if`, `else`, `switch`, ternário nem skip.
- Playwright CLI (não o MCP):
  - busca única com resultados;
  - ausência do botão Deep;
  - ausência da seção Search depth nas settings;
  - um hit sem thread exibido com o caminho, via fixture HTTP mock se necessário;
  - viewports 1440×900 e 390×844.
- `pnpm validate`, `pnpm build` e `pnpm test`.
- Busca no repositório sem `Deep retry`, `searchRetryDepth` ou `recallMemorySearchDepths` em `src/**` e `public/**`. A documentação fica para a T5, salvo `docs/ui-and-daemon.md`.
- Revisar o backlog Playwright f742659a e registrar se ele precisa de atualização.

## Loop

- **Configuração:** claude-dev, com Haiku 5.5 em xhigh, sequencial.
- **Antes de editar:** OK_BOOTSTRAP, seguido de autorização.
- **Ao terminar:** a entrega consolidada publicada pelo desenvolvedor na thread e o relatório interno com caminhos, linhas, checks, evidências do Playwright CLI e riscos.
