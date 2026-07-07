# Oportunidade - Tuning de recall e ranking da memory

Thread: `oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb`
Created: `2026-07-07T00:38:55.886Z`

<!-- marc-message
id: msg_a302d5f4d0de4dd496
threadId: oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
timestamp: 2026-07-07T00:45:32.226Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-tuning-recall-ranking-memory.md
-->

Oportunidade registrada para investigar tuning de recall e ranking da memory.

Anexei um artifact detalhado com:

- o caso concreto `implementar rotacao de token da interface`;
- a expectativa de priorizar a decisão histórica de token;
- hipóteses de hybrid lexical + vector, boosts por seção e reranking local;
- métricas/fixtures iniciais de avaliação;
- critérios de aceite para melhorar ordenação sem perder recall.

Referências principais: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac e marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3

<!-- /marc-message -->

<!-- marc-message
id: msg_9663e48fdefe4b27ab
threadId: oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
timestamp: 2026-07-07T20:23:08.360Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-tuning-recall-ranking-memory.md
-->

Plano detalhado registrado antes do desenvolvimento.

Artifact: artifacts/plano-tuning-recall-ranking-memory.md

Vou seguir TDD: primeiro teste vermelho para o caso de ranking, depois ajuste local no recall, documentação e validação completa.

<!-- /marc-message -->

<!-- marc-message
id: msg_a29cdc25d9cc439991
threadId: oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
timestamp: 2026-07-07T21:56:38.627Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluído para o tuning de recall/ranking da memory.

O que foi realizado:

- Mantida a busca vetorial como fonte inicial de candidatos, com expansão de candidatos antes do limite final.
- Adicionado ranking híbrido local por score vetorial, termos exatos normalizados e boost de seção decisória.
- Mantido o contrato público de memory_recall: mesmos inputs e mesmos campos de saída; score agora representa relevância final ranqueada.
- Extraída a política de ranking para módulo próprio, preservando operations como orquestração do fluxo.
- Adicionados testes para o caso real em que uma thread genérica de UI tinha score vetorial maior que a decisão histórica de token.
- Atualizada docs/memory.md para explicar o ranking híbrido e deixar explícito que o corpus v1 e a snapshot .marc/memory continuam derivados dos SUMMARY.md.

Validação realizada via context-mode/Bash:

- pnpm run validate: passou.
- pnpm test: passou com 93/93.
- pnpm build: passou; permaneceu apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.
- CLI pós-build: memory recall para "implementar rotacao de token da interface" retornou marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3 em 1º lugar.
- Após restart dos recursos, a tool MCP memory_recall retornou a mesma thread em 1º lugar, com reason: Exact terms: implementar, rotacao, token. Section boost: Decisão.

Observações:

- Nenhum comando git foi executado.
- Não houve uso de Playwright/MCP de browser; esta evolução não exigia validação de UI.
- Markdown segue como fonte da verdade; ranking é projeção de leitura, sem alterar o formato da snapshot .marc/memory.

Aguardo feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_c04b65c4c2b642c6b5
threadId: oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
timestamp: 2026-07-07T22:11:43.638Z
agentId: codex-dev
role: developer
artifacts: artifacts/experiencia-uso-memory-pesquisa-ui.md
-->

Registrada a experiência prática de uso da memory como ferramenta de pesquisa de conhecimento histórico.

Artifact: artifacts/experiencia-uso-memory-pesquisa-ui.md

Resumo:

- A memory foi usada para pesquisar decisões históricas sobre estrutura da UI e organização das informações.
- As consultas recuperaram threads relevantes de colunas da UI, neo-brutalism, organização de CSS, autocomplete, referências internas, artifacts e Markdown SoT.
- A síntese mostrou que a UI organiza informação por dono semântico: Thread como eixo de navegação, Message como eixo da conversa, Artifact vinculado à Message e SUMMARY.md como síntese de encerramento.
- A experiência validou a memory como camada útil para reconstruir princípios históricos do projeto, não apenas para evitar repetição de decisões pontuais.

<!-- /marc-message -->
