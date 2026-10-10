# Proposta e plano — schema estável no rebuild incremental

## Objetivo e decisão aprovada

Corrigir a falha `Failed to infer data type for field sectionTitle at row 0` ao publicar uma geração incremental que reutiliza registros lidos do LanceDB. O usuário escolheu schema explícito com normalização e autorizou a execução do plano em 2026-10-10.

O rebuild completo feito pelo usuário recuperou a memória. Esta correção será desenvolvida e validada em workspaces temporários; não requer reconstruir, limpar ou reiniciar a base real.

## Fontes e diagnóstico verificado

- Thread atual: marc://$ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c, mensagens msg_c0301886e58e4cfa8b e msg_97649eb3b74e4a3da9 e artifact diagnostico-e-proposta.md.
- AGENTS.md, skill marc-ops, contrato completo de bootstrap, RULES.md e Custom Rules, README.md, docs/agent-workflows.md, docs/harness-engineering.md, docs/memory.md e ADRs 0001, 0003, 0004, 0007 e 0008.
- Histórico recuperado por memory_recall e resumos das threads de incremental/batches, lock compartilhado, lifecycle dos providers e contrato field-aware-hybrid-v2.
- Código e testes inspecionados via context-mode. Reprodução real isolada: rebuild inicial, leitura da primeira identity com sectionTitle null, alteração de outra summary, incremental com batch 4 falha exatamente como relatado; manifest da geração anterior permanece preservado.
- Baseline: Node 22.20.0, pnpm 10.10.0; 13 testes existentes de LanceDB, reconciliação e background passaram. A regressão nova deve cobrir o round trip ausente nesses testes.
- Contrato oficial de makeArrowTable conferido via Context7. Schema explícito determina os tipos; campos completamente undefined podem ser omitidos. O controle em memória com opcionais null e schema Utf8 anulável preservou as colunas e a ausência de conteúdo.

## Mudança técnica

1. Declarar apache-arrow 18.1.0 como dependência direta, compatível com o peer já instalado do LanceDB 0.31.0. Atualizar somente o importer necessário no lockfile, sem atualizar outras dependências.
2. Definir um helper de schema em lancedb-store-support.ts, carregando Apache Arrow sob demanda. Os campos textuais existentes são Utf8 anuláveis: recordId, threadId, title, closedAt, summaryPath, relativeSummaryPath, reference, kind, sectionTitle, text, embeddingText, lexicalSummary, lexicalTitle e lexicalTitlePrefix. vector é FixedSizeList com dimensão da primeira linha não vazia, item Float32 e anulabilidade compatível com a inferência vigente.
3. Tipar os opcionais do registro persistido como string ou null, sem ampliar MemoryVectorRecord. Na escrita, converter sectionTitle e closedAt ausentes para null; na leitura, converter somente null/undefined para undefined. Preservar strings vazias e conteúdo presente.
4. Aplicar o helper e o mapper compartilhados às duas rotas de criação de tabelas de LanceDbMemoryVectorStore. Manter índices lexicais e validação da geração. Quando não houver registros, retornar antes de criar tabela: o contrato atual de status/recall aceita manifest vazio sem tabela.
5. Preservar publicações transacionais: escrever e validar a geração antes de publicar manifest. Não alterar interfaces públicas, schemaVersion 6, retrievalContract field-aware-hybrid-v2, corpus, ranking, providers, dimensões do provider, batches ou locks.
6. Atualizar docs/memory.md em en-US com o contrato de opcionais na fronteira de armazenamento e seu efeito no incremental.

## Handoff delimitado — tarefa única de desenvolvimento

### Configuração e coordenação

Principal: perfil codex-software-architect, gpt-6.1-sol/high, configuração humana confirmada no perfil local; não é introspecção runtime. Desenvolvedor: perfil compartilhado codex-dev, gpt-6-luna/xhigh, configuração humana confirmada no perfil local. Spawn solicitado nesses parâmetros. Limite vigente: um desenvolvedor ativo, execução sequencial, conforme AGENTS.md e RULES.md. Não criar, renomear ou atualizar perfis.

Antes de qualquer edição, o desenvolvedor lê este plano, as fontes aplicáveis, executa workspace_bootstrap independentemente e retorna OK_BOOTSTRAP no canal interno. Informar identidade/path do workspace, fontes, regras críticas, configuração solicitada/efetiva quando verificável, fonte de confirmação, escopo e estado dos alvos. Aguardar autorização explícita do principal. Não delegar ou criar subagentes.

### Escopo autorizado

- src/core/memory/lancedb-store.ts
- src/core/memory/lancedb-store-support.ts
- test/core-memory-lancedb-hybrid.test.ts
- test/core-memory-reconciliation.test.ts
- test/core-memory-background.test.ts
- docs/memory.md
- package.json
- pnpm-lock.yaml
- .marc/threads/ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c/artifacts/relatorio-desenvolvimento.md, apenas para a entrega consolidada do desenvolvedor.

O principal cria e registra os artifacts de proposta e entrega/revisão. Não editar CHAT.md manualmente; publicações relevantes são feitas pelas tools oficiais com metadata dos anexos. O desenvolvedor pode publicar a própria entrega no perfil codex-dev, na thread autorizada, após anexar o relatório.

### Exclusões e regras

Preservar a entrega anterior de criação de threads e todo trabalho alheio. Não executar Git, worktree, commit, purge, restart, rebuild da base real, migração, cleanup ou alteração de modelos/configuração. Não mudar o motor de busca, UI, HTTP/MCP/CLI ou o loop de background. Não criar hooks, ledger ou diário de execução; acknowledgements, autorizações e correções permanecem no canal interno. O repositório e o plano aprovado prevalecem sobre defaults de skills que peçam Git ou registros por iteração.

Usar context-mode para inspeção e revisão de comandos, Bash para comandos do workspace e apply_patch para edições manuais. Código, testes e documentação técnica em en-US; comunicação e relatório operacional em pt-BR. Sem else, sem if aninhado; guards com early return; Strategy/dispatch apenas para variação real de comportamento. SUMMARY.md é fonte de verdade; tabelas, manifest e índices são derivados.

### Critérios de aceite e testes

- Escrever e executar primeiro uma regressão real que falhe antes da correção: geração inicial com identity sem sectionTitle, round trip no LanceDB, alteração/inclusão de summary e incremental com batch 4; manter registros preservados antes dos novos.
- Testar metadados ausentes na primeira linha e em todas as linhas, closedAt ausente/presente, string vazia, tipos físicos de colunas e dimensões distintas dos vetores. Confirmar null persistido e undefined no domínio.
- Cobrir ausência de delta, alteração, inclusão e remoção; embeddings somente para summaries novas/alteradas, batch limitado e geração intacta sem delta. Cobrir remoção de todas as summaries, corpus vazio e inclusão após geração vazia.
- Preservar textos, referências, IDs, vetores e resultados dos três canais lexicais; índices necessários presentes na geração publicada.
- Injetar falha de publicação/validação após uma geração válida; manifest e dados anteriores continuam ativos. Background não declara ready falsamente: degraded e lastError observáveis.
- Validar background com LanceDB real e providers fake em workspace temporário: rebuilding para ready, sem lastError e contagens reconciliadas. Sem download/inferência de modelos reais ou intervenção no índice recuperado pelo usuário.

### Validação e entrega esperada

Executar testes focados e pnpm validate, pnpm build e pnpm test. pnpm validate inicia code:fix: inspecionar previamente os efeitos de lint/format e preservar arquivos fora do escopo. Se um comando exigir alteração fora do escopo, comunicar conflito ao principal antes de ampliar. Não reverter ou limpar amplamente. Informar checks não executados e seus motivos; não declarar sucesso sem evidência.

O relatório consolidado deve trazer caminhos/linhas, mudança, evidência red/green, comandos e resultados, documentação, verificação de escopo/regras, configuração/bootstrap/autorização mínimos e riscos/limites. Não atualizar o relatório a cada comando ou handshake. Qualquer mudança material de contrato ou expansão de escopo retorna ao principal antes da execução.

## Revisão integrada e encerramento

O principal revisará todo o estado autorizado após a última alteração, confrontando critérios, código, arquitetura, integração, regras, documentação, escopo e evidências verificadas. Retornará achados ao mesmo desenvolvedor pelo canal interno e repetirá a revisão e checks afetados após correções.

A avaliação final será consolidada em artifacts/entrega-e-revisao.md com veredito approved, pending ou rejected e justificativa substantiva. Auditoria estrutural preflight antes da implementação; metadata/artifacts/references no registro; messages antes da entrega final. Auditoria não substitui revisão técnica.

Apresentar resultado ao usuário após aprovação técnica. Não criar SUMMARY.md nem encerrar a thread: aceite humano e autorização de fechamento permanecem separados.

## Questões pendentes

Nenhuma decisão técnica pendente para iniciar a tarefa. Validação operacional na base real está fora deste escopo; a memória recuperada pelo usuário será preservada.
