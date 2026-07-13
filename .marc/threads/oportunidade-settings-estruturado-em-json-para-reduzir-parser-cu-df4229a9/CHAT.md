# Oportunidade - Settings estruturado em JSON para reduzir parser customizado

Thread: `oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9`
Created: `2026-07-10T18:31:54.199Z`

<!-- marc-message
id: msg_bb4de1ebd59f4d3793
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:33:17.560Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-settings-json.md
-->

Oportunidade registrada: avaliar troca do armazenamento de settings de Markdown para JSON estruturado.

Motivação:

- A UI é o caminho humano normal para alterar settings.
- `SETTINGS.md` exigiu parser customizado para ler configuração de máquina.
- Com JSON, leitura, escrita, validação e testes ficam mais simples.
- A complexidade atual tende a crescer se novos settings forem adicionados.

Ponto arquitetural:

- Isso não deve ser tratado como abandono do Markdown no mARC.
- A proposta é refinar a fronteira: Markdown para conhecimento, histórico, comunicação e artefatos; JSON para configuração operacional estruturada.

Anexei a proposta detalhada com problema, hipótese, benefícios, riscos, relação com decisões anteriores e critérios de aceite futuros.

Artifact: artifacts/proposta-settings-json.md

<!-- /marc-message -->

<!-- marc-message
id: msg_2c81af455422444d9a
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:35:47.884Z
agentId: ui-user
role: user
-->

Nomes possíveis:

- marc.json
- marc.config.json (gosto mais desse, mas não sei se é o padrão médio)

<!-- /marc-message -->

<!-- marc-message
id: msg_4763d78d407e44bf89
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:37:32.767Z
agentId: ui-user
role: user
-->

Confirmado padrão possível por similaridade de outras ferramentas (oráculo):

- jest.config.json
- vitest.config.json
- eslint.config.json

<!-- /marc-message -->

<!-- marc-message
id: msg_8ccb6d096d8a4195a9
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:38:58.314Z
agentId: ui-user
role: user
-->

Substituição será direta (no lugar do arquivo atual).

Não manter fallback para SETTINGS.md . Isso ainda não foi para produção, então sem prejuízo remover (não gera breaking change).

<!-- /marc-message -->

<!-- marc-message
id: msg_96ea340651e54fd3ad
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-13T22:48:02.846Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-settings-json.md
-->

Plano de desenvolvimento registrado antes da implementação.

Escopo aprovado pela leitura da thread:

- Trocar `SETTINGS.md` por `.marc/marc.config.json`.
- Não manter fallback para `SETTINGS.md`.
- Preservar o estado atual de `memory.autoRebuild` ao criar o JSON novo.
- Atualizar core, testes e documentação.
- Validar com teste focado e fluxo completo do projeto.

Artifact: artifacts/plano-settings-json.md

<!-- /marc-message -->

<!-- marc-message
id: msg_c475630e8bc04b90b9
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-13T23:18:40.925Z
agentId: codex-dev
role: developer
artifacts: artifacts/resultado-settings-json.md
-->

Desenvolvimento concluído para avaliação.

Realizado:

- Troquei o storage de settings da workspace para `.marc/marc.config.json`.
- Removi o parser customizado de `SETTINGS.md` do core.
- Mantive default `memory.autoRebuild=true` quando o JSON ainda não existe.
- Não mantive fallback para `SETTINGS.md`, conforme decisão da thread.
- Criei `.marc/marc.config.json` no workspace atual com `memory.autoRebuild=false`, preservando a escolha informada pelo usuário.
- Atualizei testes para provar JSON, ausência de escrita de `SETTINGS.md` e ignorar Markdown legado.
- Atualizei docs mantendo a fronteira: JSON para configuração operacional estruturada; Markdown como source of truth para conhecimento, threads, summaries, regras, mensagens e artefatos.

Validação via context-mode:

- `pnpm test test/core-memory-background.test.ts`: passou.
- `pnpm run typecheck`: passou.
- `pnpm run validate`: passou.
- `pnpm test`: passou, 115/115.
- `pnpm build`: passou, apenas com o aviso conhecido do Vite sobre chunk maior que 500 kB.

Observação:

- Para validar na UI/daemon em execução, será necessário reiniciar os recursos que ainda estejam carregando o código antigo.

Artifact: artifacts/resultado-settings-json.md

Aguardando feedback do usuário para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_cbc2d04bd4b24bfb8e
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-13T23:26:39.346Z
agentId: codex-dev
role: developer
-->

Ajuste pós-feedback realizado.

Validação manual do usuário:

- Restart realizado.
- Toggle da UI alternou `memory.autoRebuild` entre `false` e `true` no `.marc/marc.config.json`.

Correção adicional:

- `.marc/SETTINGS.md` legado ainda existia no workspace.
- Removi o arquivo para não deixar duas fontes aparentes de configuração.
- Confirmei via context-mode que `.marc/SETTINGS.md` está ausente e `.marc/marc.config.json` permanece com `memory.autoRebuild=false`.

Aguardando orientação do usuário para encerramento da thread.

<!-- /marc-message -->
