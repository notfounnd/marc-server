# Oportunidade - Revisão en-US do projeto

Thread: `oportunidade-revisao-en-us-do-projeto-c14150b8`
Created: `2026-05-02T21:58:40.279Z`

<!-- marc-message
id: msg_1f12cccd84f8480cba
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-02T21:58:48.891Z
agentId: codex-dev
role: developer
-->

Contexto inicial:

- O projeto deve estar desenvolvido em `en-US`.
- Objetivo: revisar codigo, documentacao, mensagens de erro, descricoes de tools, comentarios, testes, README, arquivos base do mARC e UI para identificar textos fora de ingles americano.
- Escopo inicial: textos visiveis para usuario/agente e textos persistidos pelo projeto; preservar historico de threads antigas quando fizer sentido, mas evitar que novos templates/recommendations nascam em pt-BR.
- Risco a observar: algumas threads e summaries existentes estao em portugues por contexto de trabalho; a revisao deve distinguir historico mARC de produto/codigo/template atual.
- Criterio de aceite: registrar achados, propor correcoes e padronizar novos textos do projeto em `en-US` sem quebrar compatibilidade ou contexto historico.

<!-- /marc-message -->

<!-- marc-message
id: msg_202277d9ac404f219f
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T04:55:07.404Z
agentId: ui-user
role: user
-->

Esse é uma boa atividade para iniciar i18n no projeto.

Migrar textos para tokens reutilizáveis em arquivos de idiomas.

Algo como:

- `src/i18n/locales/en_US/translation.json`

Avaliar qual a melhor prática para manter essa estrutura.

Apenas en-US será desenvolvido nesse momento.

<!-- /marc-message -->

<!-- marc-message
id: msg_94f498037544439a89
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T04:56:06.555Z
agentId: ui-user
role: user
-->

A reestruturação solicitada para atender i18n tem fit com a thread marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2.

<!-- /marc-message -->

<!-- marc-message
id: msg_ded4162051544d04b1
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T05:29:30.325Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-i18n-en-us-produto.md
-->

Plano detalhado registrado como artifact antes do desenvolvimento. Vou implementar a base i18n em `en-US` para textos de produto, preservando conteúdo autoral do workspace no idioma em que for escrito.

<!-- /marc-message -->

<!-- marc-message
id: msg_2d2ab274881d4e96b5
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T16:47:32.021Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-i18n-en-us-flat-json-http-backend.md
-->

Plano atualizado registrado antes do desenvolvimento.

- Modelo: `i18next` + `react-i18next` + `i18next-http-backend`.
- Traduções: JSON plano chave/valor, sem arrays.
- Escopo: textos de produto em `en_US`; conteúdo autoral do workspace segue livre.

Artifact: `artifacts/plano-i18n-en-us-flat-json-http-backend.md`

<!-- /marc-message -->

<!-- marc-message
id: msg_0ec6e6b32bd84914b7
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T17:50:46.314Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-i18n-interface-e-auditoria-en-us.md
-->

Plano atualizado registrado antes do desenvolvimento.

Escopo corrigido:

- i18n apenas para textos visíveis na interface web.
- Auditoria en-US para código/produto/documentação.
- MCP/backend/core/CLI não usam i18n; permanecem em inglês literal.

Artifact: `artifacts/plano-i18n-interface-e-auditoria-en-us.md`

<!-- /marc-message -->

<!-- marc-message
id: msg_52a41f80d2f14fa492
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T18:34:28.050Z
agentId: codex-dev
role: developer
-->

Desenvolvimento realizado com o escopo corrigido.

- i18n ficou restrito ao que o usuário vê na interface web.
- MCP, backend, core e CLI continuam com strings literais em en-US, sem integração com i18n.
- Adicionei `i18next`, `react-i18next` e `i18next-http-backend`.
- Criei o catálogo plano `public/locales/en_US/translation.json`.
- Criei o bootstrap da UI em `src/ui/i18n.ts` e helper de catálogo em `src/i18n/index.ts` apenas para suporte/testes.
- Migrei textos fixos visíveis de `src/ui/main.tsx` para `useTranslation()`.
- Mantive conteúdo autoral do workspace fora da localização: mensagens, threads, artifacts, summaries, RULES renderizado e IDs permanecem como dados do usuário/projeto.
- Documentei a regra em `docs/development.md`.
- Adicionei testes para garantir catálogo plano, fallback, interpolação, escopo de i18n apenas na UI/test helper e ausência de strings de MCP/backend/CLI no catálogo da UI.

Validação executada:

- `pnpm test test/i18n.test.ts` passou. Observação: pelo script atual, esse comando executa a suíte completa e passou com 46 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- Auditoria de acentos em `src`, `test`, `docs`, `README.md`, `.marc/RULES.md`, `.marc/INSTRUCTIONS.md` e `package.json` não encontrou texto pt-BR de produto; encontrou apenas o nome do autor em `package.json`.

Aguardando feedback do usuário para orientar a finalização da thread.

<!-- /marc-message -->
