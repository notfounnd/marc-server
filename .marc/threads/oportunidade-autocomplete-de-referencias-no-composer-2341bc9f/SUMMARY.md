# Resumo executivo

Thread: `oportunidade-autocomplete-de-referencias-no-composer-2341bc9f`
Closed: `2026-05-11T00:43:20.102Z`

## Objetivo

Implementar autocomplete de referências internas no composer da UI do mARC, ajudando o usuário a inserir referências canônicas `marc://` sem criar uma linguagem paralela.

## Resultado

A oportunidade foi tratada com implementação completa da primeira versão do autocomplete:

- Autocomplete manual acionado por `Ctrl+Space`.
- Suporte a `@` para agentes registrados.
- Suporte a `$` para threads do workspace.
- Suporte a `#` para mensagens e artifacts da thread atual.
- Suporte a `marc://$thread-id/#` para mensagens e artifacts de uma thread explicitamente referenciada.
- Inserção sempre em formato canônico `marc://...`.
- Cache em memória para payloads remotos consultados pelo autocomplete.
- Dropdown com navegação por `ArrowUp`, `ArrowDown`, `Enter`, `Tab` e `Escape`.
- Estado visual único de seleção, compartilhado entre mouse, foco e navegação por teclado.
- Threads fechadas diferenciadas visualmente no autocomplete.
- Artifacts indentados abaixo da mensagem pai.
- Footer global da terceira coluna com link de ícone para modal de atalhos de teclado.
- Modal de atalhos centralizado na tela inteira.

## Decisões

- O autocomplete abre apenas por atalho manual, reduzindo conflito com Markdown comum.
- `$` busca threads do workspace, incluindo abertas e fechadas.
- `#` não busca mensagens globalmente; usa apenas a thread atual.
- Busca cross-thread de mensagens e artifacts só ocorre após o usuário digitar uma referência explícita para outra thread.
- A ordem praticada foi mantida:
  - threads abertas por `createdAt` descendente;
  - threads fechadas por `closedAt` descendente;
  - mensagens na ordem do `CHAT.md`, da mais antiga para a mais nova;
  - artifacts imediatamente abaixo da mensagem à qual pertencem.
- O footer de atalhos pertence à terceira coluna de conteúdo, não ao composer.
- O acionador de atalhos é um link de ícone, não um botão visual.

## Testes e validação

Foi adicionada cobertura pura em `test/ui-composer-autocomplete.test.ts`, com a lógica principal extraída para `src/ui/composer-autocomplete.ts`.

Cobertura adicionada:

- Detecção de gatilhos `@`, `$`, `#` e referências parciais `marc://...`.
- Geração de sugestões para agentes, threads, mensagens e artifacts.
- Diferenciação de threads abertas e fechadas.
- Associação de artifacts à mensagem pai.
- Sugestões cross-thread apenas para referência explícita.
- Substituição correta do trecho ativo pela referência canônica.

Validações registradas durante a thread:

- `pnpm test`: 37 testes, 37 pass.
- `pnpm typecheck`: OK.
- `pnpm build`: OK.

## Documentação e continuidade

Antes do encerramento, a documentação e o backlog Playwright foram revisados.

- `docs/ui-and-daemon.md` foi atualizado com a seção de autocomplete, atalhos e ordem das sugestões.
- `README.md`, `docs/agent-workflows.md` e `docs/harness-engineering.md` não exigiram atualização neste momento.
- A thread `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` foi complementada no artifact `artifacts/playwright-test-scenarios.md` com cenários E2E para autocomplete e modal de atalhos.
- A oportunidade `oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b` foi aberta para discutir esquemas futuros de visualização das colunas da UI.

## Estado final

A oportunidade foi concluída e encerrada. Novos refinamentos de layout, comportamento visual ou cobertura Playwright devem seguir em threads próprias ou na thread de backlog Playwright.
