# Oportunidade - Referências internas e menções direcionadas

Thread: `oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4`
Created: `2026-05-01T01:50:01.846Z`

<!-- marc-message
id: msg_88e9401a87ae47d488
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-01T01:50:57.116Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-referencias-internas-e-mencoes-direcionadas.md
-->

Oportunidade registrada:

- Tema: referências internas e menções direcionadas.
- Objetivo: transformar threads, mensagens e agentes em links navegáveis.
- Semântica: `@agent-id` indica atenção/colaboração, sem criar workflow formal.
- Inclui: links `marc://...`, autolink, IDs visíveis nas mensagens e navegação no painel.
- Detalhes completos: `artifacts/oportunidade-referencias-internas-e-mencoes-direcionadas.md`.

<!-- /marc-message -->

<!-- marc-message
id: msg_d8d44b0250e842ffa2
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-01T02:02:56.223Z
agentId: codex-dev
role: developer
artifacts: artifacts/complemento-artifacts-referencias.md
-->

Complemento registrado:

- Incluir artifacts como referência interna navegável.
- Clicar em artifact deve abrir modal renderizando Markdown quando aplicável.
- A thread deve ter uma lista/menu de artifacts acessível no painel.
- Isso evita depender apenas dos links dentro das mensagens.
- Detalhes completos: `artifacts/complemento-artifacts-referencias.md`.

<!-- /marc-message -->

<!-- marc-message
id: msg_3a93d371aa804318a4
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T02:10:18.658Z
agentId: codex-dev
role: developer
-->

Tratamento realizado:

- Estruturei a gramática canônica de referências `marc://` no core.
- Adicionei parser para agentes, threads, mensagens e artifacts vinculados a mensagens.
- Implementei rota HTTP para ler artifact de uma mensagem: thread + message + artifact file.
- Atualizei a UI para autolinkar referências `marc://...` em Markdown.
- Mensagens agora exibem o ID como ação navegável.
- Artifacts vinculados a mensagens viram links clicáveis e também aparecem em um índice da thread.
- Clicar em artifact abre modal renderizando Markdown.
- Registrei o mesmo formato na thread de autocomplete `oportunidade-autocomplete-de-referencias-no-composer-2341bc9f`.

Validação via context-mode:

- `pnpm typecheck`: exit 0.
- `pnpm test`: 23 testes, 23 pass, exit 0.
- `pnpm build`: exit 0.

Aguardando seu feedback antes de orientar encerramento da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_8f6442a3f92341d8bd
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T02:18:56.440Z
agentId: codex-dev
role: developer
-->

Ajuste complementar realizado:

- O ID da mensagem agora aparece no topo do card, dentro da linha de metadados.
- A posição ficou à esquerda da data, após agente/role.
- O ID continua clicável e navega pela referência `marc://#message-id`.
- Removi o ID da área de ações à direita, deixando ali apenas ações como anexar artifact.

Validação via context-mode:

- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

<!-- /marc-message -->

<!-- marc-message
id: msg_fa9acc8e5f0f4f91a9
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T02:34:29.867Z
agentId: codex-dev
role: developer
-->

Refinamento de UI realizado:

- Removi a lista fixa de artifacts do topo da thread.
- Adicionei um botão de paperclip no canto superior direito do cabeçalho da thread.
- O botão abre uma lista flutuante com todos os artifacts da thread.
- A lista respeita a ordem das mensagens: artifacts mais antigos no topo e mais novos na base.
- Clicar em um artifact continua abrindo a modal Markdown.
- O ID da mensagem deixou de navegar diretamente; agora copia `marc://#message-id` para a área de transferência.
- O ID do agente no card da mensagem agora copia `marc://@agent-id`.
- O ID da thread ganhou ação de copiar `marc://$thread-id` no cabeçalho.

Validação via context-mode:

- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

<!-- /marc-message -->

<!-- marc-message
id: msg_3937368093ec46fead
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T02:43:45.326Z
agentId: codex-dev
role: developer
-->

Refinamento de feedback realizado:

- A confirmação de cópia de referência agora aparece como toast transitório.
- No desktop, o toast fica no canto inferior direito, seguindo o padrão esperado para feedback rápido de ação.
- O status global do daemon não é mais usado para mensagens de cópia.
- Em telas estreitas, o toast usa `left: 16px; right: 16px; bottom: 16px`, evitando estouro horizontal.
- O toast desaparece automaticamente após curto intervalo.

Validação via context-mode:

- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

<!-- /marc-message -->

<!-- marc-message
id: msg_368274b89abb448bae
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T02:54:11.498Z
agentId: ui-user
role: user
-->

Teste de mensagens:

- marc://@codex-dev
- marc://#msg_3937368093ec46fead
- marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
- marc://#msg_d8d44b0250e842ffa2/!complemento-artifacts-referencias.md

Em outra thread:

- marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095/!oportunidade-autocomplete-referencias-composer.md

Nada tem que renderizar:

```
Teste de mensagens:

- marc://@codex-dev
- marc://#msg_3937368093ec46fead
- marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
- marc://#msg_d8d44b0250e842ffa2/!complemento-artifacts-referencias.md

Outra thread:

- marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095/!oportunidade-autocomplete-referencias-composer.md
```

<!-- /marc-message -->

<!-- marc-message
id: msg_43e13b28fa7d46f9ae
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T03:17:56.820Z
agentId: codex-dev
role: developer
-->

Refinamento de renderização de links realizado:

- O autolink de `marc://...` agora mantém o `href` canônico completo.
- O texto exibido fica curto e legível:
  - `marc://@codex-dev` renderiza como `@codex-dev`.
  - `marc://#message-id` renderiza como `#message-id`.
  - `marc://$thread-id` renderiza como `$thread-id`.
  - Artifacts exibem a forma curta com `!artifact-file.md`.
- A geração do label foi refatorada para um strategy map tipado por `MarcReference["type"]`, evitando condicionais crescentes e forçando cobertura quando novos tipos forem adicionados.

Validação via context-mode:

- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

<!-- /marc-message -->

<!-- marc-message
id: msg_cad862d1dae5413196
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T04:25:50.702Z
agentId: codex-dev
role: developer
-->

Refinamento aplicado após validação visual:

- Ajustei o cabeçalho para separar topo e base da coluna direita.
- O badge de sync permanece no topo direito.
- O botão de artifacts agora fica ancorado na parte inferior direita do header, alinhado à borda inferior interna.
- Ajustei os labels canônicos de `marc://`:
  - `marc://@agent-id` exibe `@agent-id`.
  - `marc://#message-id` exibe `#message-id`.
  - `marc://$thread-id` exibe `$thread-id`.
  - `marc://#message-id/!artifact-file.md` exibe `!artifact-file.md`.
  - Referências cross-thread para mensagem/artifact também exibem apenas o alvo curto (`#message-id` ou `!artifact-file.md`).
- O renderer de Markdown agora força o label canônico para qualquer link com `href` `marc://...`, mesmo quando o Markdown usa texto customizado como `[texto](marc://@agent-id)`.

Validação via context-mode:

- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

<!-- /marc-message -->

<!-- marc-message
id: msg_0b0638fa188b41efbe
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T04:28:34.055Z
agentId: ui-user
role: user
-->

Teste de mensagens:

- marc://@codex-dev
- marc://#msg_3937368093ec46fead
- marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
- marc://#msg_d8d44b0250e842ffa2/!complemento-artifacts-referencias.md
- [codex-dev](marc://@codex-dev)
- [3937368093ec46fead](marc://#msg_3937368093ec46fead)
- [oportunidade-referencias-internas-e-mencoes-direcionadas](marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4)
- [complemento-artifacts-referencias](marc://#msg_d8d44b0250e842ffa2/!complemento-artifacts-referencias.md)

Outra thread:

- marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095
- marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095/!oportunidade-autocomplete-referencias-composer.md
- [3333ea5fc93f4dc095](marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095)
- [oportunidade-autocomplete-referencias-composer](marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f/#msg_3333ea5fc93f4dc095/!oportunidade-autocomplete-referencias-composer.md)

<!-- /marc-message -->

<!-- marc-message
id: msg_a2d344fd02c8471fa3
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T04:32:16.358Z
agentId: codex-dev
role: developer
-->

Correção aplicada para label canônico em links Markdown manuais:

- Identifiquei que `react-markdown` filtra protocolos desconhecidos pelo `defaultUrlTransform`.
- Isso fazia links como `[texto](marc://@codex-dev)` chegarem ao renderer sem o `href` `marc://`, impedindo a troca para label canônico.
- Ajustei o `MarkdownPanel` para preservar explicitamente URLs `marc://...` via `urlTransform`.
- Demais URLs continuam passando pelo `defaultUrlTransform` do pacote.
- Com isso, links manuais com texto customizado devem renderizar o label canônico, como `@codex-dev`.

Validação via context-mode:

- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

<!-- /marc-message -->

<!-- marc-message
id: msg_bc427883a7de4bb6aa
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T04:50:46.085Z
agentId: codex-dev
role: developer
-->

Complemento de testes realizado:

- Abri a oportunidade `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` para os cenários Playwright desta thread e da thread `c04986bd`.
- Anexei à oportunidade a lista completa de cenários em `artifacts/playwright-test-scenarios.md`.
- Adicionei testes possíveis com o runner atual em `test/ui-marc-links.test.ts`.
- Extraí contratos puros de links mARC para `src/ui/marc-links.ts`.
- Cobri labels canônicos, autolink, preservação de `marc://` no transform Markdown e casos que não devem virar link.
- O teste novo encontrou e permitiu corrigir um bug de pontuação final em autolink.

Validação via context-mode:

- `pnpm test`: 27 testes, 27 pass, exit 0.
- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

<!-- /marc-message -->

<!-- marc-message
id: msg_5d012e174de54bcdab
threadId: oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
timestamp: 2026-05-06T06:02:50.327Z
agentId: ui-user
role: user
-->

Revisitar marc://#msg_d8d44b0250e842ffa2. Faltou a parte para ler o artefato anexado na mensagem (e também abrir a partir do menu).

<!-- /marc-message -->
