# Oportunidade - Autocomplete de referências no composer

Thread: `oportunidade-autocomplete-de-referencias-no-composer-2341bc9f`
Created: `2026-05-01T01:51:02.960Z`

<!-- marc-message
id: msg_3333ea5fc93f4dc095
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-01T01:57:46.442Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-autocomplete-referencias-composer.md
-->

Oportunidade futura registrada:

- Tema: autocomplete de referências internas no composer.
- Gatilhos: `@` para agentes, `#` para mensagens da thread atual, `$` para threads.
- Inserção esperada: links internos `marc://...` ou menções `@agent-id`.
- Cuidado: `#` pode conflitar com heading Markdown.
- Prioridade: deixar para fase posterior; começar pelo pacote principal de links/menções.
- Detalhes completos: `artifacts/oportunidade-autocomplete-referencias-composer.md`.

<!-- /marc-message -->

<!-- marc-message
id: msg_018e70e88ffa4463bd
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-06T02:10:18.184Z
agentId: codex-dev
role: developer
-->

Complemento de formato para a oportunidade de autocomplete:

- Referências internas devem inserir links canônicos `marc://...`.
- Agente: `marc://@agent-id`.
- Mensagem da thread atual: `marc://#message-id`.
- Thread: `marc://$thread-id`.
- Mensagem em outra thread: `marc://$thread-id/#message-id`.
- Artifact de mensagem atual: `marc://#message-id/!artifact-file.md`.
- Artifact de mensagem em outra thread: `marc://$thread-id/#message-id/!artifact-file.md`.
- O autocomplete futuro deve apenas ajudar o usuário a inserir essa gramática, sem criar outra linguagem paralela.

<!-- /marc-message -->

<!-- marc-message
id: msg_90752d09f93b44e6a2
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-10T20:34:37.380Z
agentId: ui-user
role: user
-->

Thread marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4 pode ser considerada a preparação para essa thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_0f639f6a618649d5bf
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-10T21:31:23.643Z
agentId: codex-dev
role: developer
-->

Desenvolvimento realizado; aguardando feedback para orientar o encerramento.

- Implementei autocomplete manual no composer via `Ctrl+Space`.
- Adicionei suporte a `@` para agentes, `$` para threads do workspace, `#` para mensagens/artifacts da thread atual e `marc://$thread-id/#` para mensagens/artifacts da thread referenciada.
- Mantive a inserção sempre em formato canônico `marc://...`, sem criar linguagem paralela.
- A busca cross-thread fica limitada ao caso em que o usuário já digitou uma referência explícita para outra thread.
- Adicionei cache em memória para payloads remotos consultados pelo autocomplete, sem trocar a thread selecionada na UI.
- Adicionei testes puros para detecção de gatilhos, geração de opções e substituição do trecho ativo.

Validação executada:

- `pnpm test`: 37 testes, 37 pass.
- `pnpm typecheck`: OK.
- `pnpm build`: OK.

<!-- /marc-message -->

<!-- marc-message
id: msg_696b84577199480ca6
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-10T22:32:14.662Z
agentId: codex-dev
role: developer
-->

Complemento de desenvolvimento realizado; aguardando feedback para orientar o encerramento.

- Mantive a ordem já praticada pelo autocomplete e registrei o comportamento esperado:
  - `$`: threads abertas primeiro, seguindo `createdAt` desc; depois threads fechadas, seguindo `closedAt` desc.
  - `#`: mensagens na ordem do `CHAT.md`, da mais antiga para a mais nova.
  - Artifacts aparecem imediatamente abaixo da mensagem à qual pertencem.
- Melhorei a visualização das sugestões:
  - threads fechadas aparecem tachadas e com detail `Closed thread`.
  - threads abertas aparecem com detail `Open thread`.
  - artifacts aparecem indentados em relação à mensagem pai.
- Ajustei a navegação por teclado para manter o item ativo visível durante `ArrowUp`/`ArrowDown`.
- Adicionei footer no composer com ícone de teclado e modal de atalhos.
- Registrei a oportunidade separada para esquemas de visualização das colunas da UI.

Antes de encerrar esta thread, ainda deve ser verificado se algum documento do projeto precisa ser atualizado ou incluído.

Validação executada:

- `pnpm test`: 37 testes, 37 pass.
- `pnpm typecheck`: OK.
- `pnpm build`: OK.

<!-- /marc-message -->

<!-- marc-message
id: msg_312866b90cb34f3eb7
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-10T22:43:05.693Z
agentId: codex-dev
role: developer
-->

Ajuste de UI complementar realizado após feedback.

- Movi o botão de atalhos para fora do card do composer, mantendo-o como footer geral da área de mensagens.
- Atualizei o modal de atalhos para usar o tamanho padrão dos demais modais, mantendo consistência com a visualização de artifacts.
- Reforcei o estado visual de item ativo/hover no autocomplete com borda e marcador lateral, para deixar claro qual opção será inserida ao usar as setas.
- Mantive o texto do modal aberto para atalhos globais futuros, não apenas atalhos do composer.

Validação executada:

- `pnpm test`: 37 testes, 37 pass.
- `pnpm typecheck`: OK.
- `pnpm build`: OK.

<!-- /marc-message -->

<!-- marc-message
id: msg_6497c3cd718a4f60b8
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-10T22:50:27.291Z
agentId: codex-dev
role: developer
-->

Ajuste de footer corrigido após novo feedback.

- O acionador de atalhos deixou de ser parte do composer.
- O footer agora pertence à terceira coluna (`content`) e aparece também em workspace, agente, RULES/workspace overview e thread.
- O acionador é um link apenas com ícone, sem texto.
- O footer fica empurrado para a base inferior direita da coluna de conteúdo.
- O modal foi renomeado conceitualmente para atalhos de teclado, permitindo atalhos globais futuros.

Validação executada:

- `pnpm test`: 37 testes, 37 pass.
- `pnpm typecheck`: OK.
- `pnpm build`: OK.

<!-- /marc-message -->

<!-- marc-message
id: msg_926dc6cba3424c5689
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-10T22:53:53.629Z
agentId: codex-dev
role: developer
-->

Ajuste visual complementar do footer.

- Removi fundo, borda, raio e dimensão fixa do acionador de atalhos.
- O acionador agora se comporta visualmente como link de ícone, não como botão.
- Hover/foco mudam apenas a cor do ícone.

Validação executada:

- `pnpm typecheck`: OK.

<!-- /marc-message -->

<!-- marc-message
id: msg_d7983270038b493485
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-10T23:51:10.072Z
agentId: codex-dev
role: developer
-->

Ajuste do modal de atalhos realizado.

- Removi o texto explicativo `Reference autocomplete is only opened manually...`.
- Removi o eyebrow `Composer`, pois a área é de atalhos da aplicação.
- Coloquei o ícone de teclado no título do modal, junto de `Keyboard shortcuts`.
- Centralizei o modal considerando a tela inteira, não apenas a coluna de conteúdo.
- Mantive o mesmo tamanho base dos modais existentes.

Validação executada:

- `pnpm typecheck`: OK.
- `pnpm build`: OK.

<!-- /marc-message -->

<!-- marc-message
id: msg_3a722d16abfd42b0a0
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-11T00:12:22.419Z
agentId: codex-dev
role: developer
-->

Ajuste de seleção do autocomplete realizado.

- Removi o destaque visual separado de `:hover`.
- `hover` e `focus` agora atualizam o mesmo `activeIndex` usado pelas setas.
- A lista passa a ter apenas um item destacado por vez.
- Quando o mouse sai do item, ele permanece selecionado, permitindo continuar a navegação pelas setas ou inserir com Enter/Tab.

Validação executada:

- `pnpm typecheck`: OK.
- `pnpm build`: OK.

<!-- /marc-message -->

<!-- marc-message
id: msg_3acdc133645c4fcca3
threadId: oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
timestamp: 2026-05-11T00:44:18.428Z
agentId: codex-dev
role: developer
-->

Verificação pré-encerramento concluída.

- Documentação revisada: `docs/ui-and-daemon.md` precisava atualização e foi complementado com a seção de autocomplete do composer, atalhos e ordem das sugestões.
- Documentos que não exigiram alteração neste momento: `README.md`, `docs/agent-workflows.md` e `docs/harness-engineering.md`, pois já cobrem a gramática `marc://` ou o conceito de referências em nível adequado.
- Backlog Playwright revisado: a thread `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` foi complementada no artifact `artifacts/playwright-test-scenarios.md` com cenários E2E para autocomplete e modal de atalhos.

Validação final executada:

- `pnpm typecheck`: OK.
- `pnpm build`: OK.

Próximo passo: criar `SUMMARY.md` para encerrar esta thread.

<!-- /marc-message -->
