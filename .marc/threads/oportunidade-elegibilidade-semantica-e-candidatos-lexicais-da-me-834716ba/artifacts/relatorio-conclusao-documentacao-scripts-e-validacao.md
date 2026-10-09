# Relatório de conclusão da documentação, scripts e validação

## Objetivo e estado da entrega

Concluir os itens de manutenção aprovados para a thread 834716ba, preservando a implementação de busca existente. O desenvolvimento desta rodada foi concluído e revisado. A thread permanece aberta, aguardando avaliação do usuário. Nenhum SUMMARY.md foi criado.

O plano foi registrado antes do desenvolvimento no artefato `plano-conclusao-documentacao-scripts-e-validacao.md`, anexado pela mensagem `msg_e3b66cccce2e4226a2`, em 2026-10-08T16:00:23.014Z.

## Loop de desenvolvimento aplicado

- O agente principal atuou como arquiteto, responsável por planejamento, delegação, revisão e aprovação técnica.
- Duas atividades atômicas foram executadas sequencialmente, sem paralelismo entre os agentes de desenvolvimento.
- Ambos os subagentes foram configurados com `gpt-6-luna` e reasoning `xhigh`.
- Cada subagente realizou bootstrap independente, leu marc-ops, RULES.md, documentação, thread e plano, e retornou OK_BOOTSTRAP antes de receber autorização para editar.
- A investigação, a revisão dos resultados e a validação utilizaram context-mode. Não foram usados comandos git ou PowerShell. A remoção manual do script utilizou apply_patch.
- Os agentes foram encerrados somente depois da entrega e da aprovação técnica. Não foram encerrados por aparente espera de aprovação de comandos.

### Atividade 1. Scripts

Agente Confucius, identificador `01a11c3f-5ae5-7050-9c9a-22965d7e77ef`.

Removido somente `scripts/memory-quality.ts`. O arquivo não tinha consumidores ativos e importava a constante removida MEMORY_RELEVANCE_THRESHOLD.

Preservados, com conteúdo idêntico ao início da rodada:

- `scripts/memory-quality-v4.ts`
- `scripts/memory-model-benchmark.ts`
- `scripts/memory-model-benchmark-support.ts`
- `scripts/memory-model-benchmark-runner.ts`

Os comandos públicos `memory:quality` e `memory:benchmark` foram mantidos. Referências históricas nos registros mARC não foram alteradas.

O teste focado `node --test --import tsx test/memory-model-benchmark-runner.test.ts` passou, com 3 testes aprovados. A revisão do arquiteto confirmou a ausência do arquivo legado e a preservação dos quatro scripts mantidos. A aprovação foi registrada na mensagem `msg_ceca363290eb4852a6`.

### Atividade 2. Documentação

Agente Archimedes, identificador `01a11c48-ba19-7b30-8345-34041e421c37`.

Documentos atualizados em en-US:

- `docs/memory.md`
- `docs/architecture.md`
- `docs/mcp-tools.md`
- `docs/ui-and-daemon.md`
- `docs/development.md`

README.md, docs/harness-engineering.md, docs/agent-workflows.md e ADRs 0001 a 0009 foram revisados e mantidos, pois não precisavam de alteração para este escopo. A rodada não introduziu nova decisão arquitetural.

A revisão comparou as alterações com a implementação real e encontrou uma referência residual ao schema 4 em docs/memory.md. O achado foi devolvido ao mesmo subagente, que corrigiu o contrato para schema 6 e field-aware-hybrid-v2 e repetiu a verificação de formatação. A atividade foi aprovada depois dessa rodada de correção.

## Contratos documentados

- A memória indexa conteúdo de SUMMARY.md de threads fechadas. O título canônico pode ser obtido do CHAT.md, mas os corpos das mensagens não são indexados.
- O contrato atual utiliza schema 6 e field-aware-hybrid-v2, combinando retrieval denso de identidades e passagens com FTS de título e resumo. A evidência titlePrefix aplica-se a consultas de um termo.
- A elegibilidade semântica precede o apoio lexical no ranking. Um match literal isolado não torna um candidato elegível.
- Os níveis Edge e Deep expandem os candidatos por canal para 100, 200, 300 e 400. Não representam a antiga redução de minScore. O parâmetro minScore não faz parte dos contratos atuais de CLI, MCP e HTTP.
- Os modelos atuais são E5 small int8, mMARCO com model_O4.onnx e LFM2.5-350M Q4, incluindo o arquivo externo de dados exigido pelo interpretador.
- O TTL ocioso é de 30 segundos para embedding e reranking e de 300 segundos para interpretação.
- Prepare models valida os três caches e não reconstrói o índice. Rebuild depende de E5 e reranker. Busca depende adicionalmente do interpretador e de índice ready ou stale.
- Incremental requer schema e contrato compatíveis. Índice ausente ou incompatível exige full explícito. O automatizado permanece incremental e não tenta recuperar continuamente um estado degraded.
- O batch padrão é 4, com configuração de valores pares entre 2 e 16.
- Purge manual preserva a geração ativa e os modelos atuais de produção. Locks coordenam as operações. Purge e exposto por CLI e HTTP, não como ferramenta MCP.
- A UI apresenta alternativas de consulta como links no termo, com a mesma tipografia auxiliar da mensagem.
- O nome memory-quality-v4.ts foi mantido, embora a ferramenta avalie o schema 6. A documentação distingue a estratégia de produção hybrid-prefix da matriz experimental executada sobre baseline e armazenamento em memória sem o FTS de produção.

A revisão também removeu afirmações obsoletas sobre validações de invariância de batch O4 e TTL no script de qualidade. Os resultados da rodada histórica de 30 consultas foram mantidos como evidências históricas, não como garantia da precisão atual. A prosa foi mantida sem quebras manuais no meio das frases.

## Validação integrada

Executada pelo arquiteto via context-mode depois da revisão dos subagentes:

| Verificação | Resultado |
| --- | --- |
| pnpm run validate | Aprovado. Lint, formatação e TypeScript passaram. |
| pnpm test | 185 testes aprovados, zero falhas, cancelamentos ou testes ignorados. |
| pnpm build | Aprovado. Compilação TypeScript e bundle Vite concluídos. |
| pnpm exec prettier --check README.md docs/memory.md docs/architecture.md docs/mcp-tools.md docs/ui-and-daemon.md docs/development.md | Aprovado. |
| Revisão de links Markdown por AST | 33 links locais em 6 documentos, nenhum quebrado. |

Avisos observados, sem falha de validação:

- Vite manteve o aviso de bundle acima de 500 kB. O JavaScript principal ficou em 660,00 kB, ou 207,11 kB gzip. Otimização de bundle não foi incluída nesta rodada.
- Node apresentou ExperimentalWarning do SQLite nos testes existentes.
- LanceDB informou a criação de dataset temporário de teste inexistente, comportamento esperado nesse teste.

A auditoria do plano havia registrado zero achados críticos e três avisos preexistentes de Description ausente nos perfis claude-qa-engineer, claude-software-architect e copilot-dev. A auditoria final será executada depois do registro completo desta entrega.

## Preservação do escopo

A comparação SHA-256 entre início e fim da rodada confirmou conteúdo inalterado em 140 arquivos de src, 45 arquivos de test, README.md, package.json, pnpm-lock.yaml, tsconfig.json, tsconfig.build.json, eslint.config.js e no manifesto da memória ativa.

| Conjunto | Digest SHA-256 preservado |
| --- | --- |
| src | fde3d8985a65997d1773be73f10f8876593e8479faecffce959b3371b7407f6a |
| test | 5148d3e1d342cd57c13f93180f1535d9b93ac1faffd56fa6c2bd51462d2449d0 |
| .marc/memory/manifest.json | 335c54a34a5d4d1c15a8e3ab051e17fb7699bb6bba6ae89fa0b63fed76875bbc |

Não houve alteração de comportamento da busca, modelos, APIs públicas ou lógica de guards e branching. Não houve download de modelos, rebuild da base ativa ou nova bateria de inferência sobre o corpus. Esta entrega não reivindica melhoria adicional de relevância da busca.

Markdown continua sendo a fonte de verdade das threads. Nenhuma alteração de persistência ou projeção foi introduzida. Os índices continuam derivados reconstruíveis.

## Próxima etapa

A entrega está pronta para revisão do usuário. Para esta rodada de documentação e remoção de script sem consumidores, não é necessário restart ou rebuild.

Aguardar feedback para ajustes ou autorização de fechamento. A thread não será encerrada automaticamente.
