# Entrega e revisão integrada — rebuild incremental da memória

## Resultado

O plano aprovado foi implementado. A geração incremental usa schema Arrow explícito e normalização dos campos opcionais na fronteira do LanceDB, eliminando a dependência da inferência de tipos pela primeira linha. A documentação foi atualizada em docs/memory.md. A memória real recuperada pelo usuário não foi reconstruída nem purgada.

Thread: marc://$ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c. A proposta e o handoff estão em proposta-e-plano.md; a entrega do desenvolvedor e os hashes dos oito alvos estão em relatorio-desenvolvimento.md.

## Revisão final do principal

**Veredito: approved — aprovação técnica do estado integrado de 2026-10-10.** No momento da aprovação, aceite humano e autorização de fechamento permaneciam pendentes. O encerramento posteriormente autorizado está registrado abaixo e em SUMMARY.md.

### Escopo e fontes efetivamente revisados

O principal revisou integralmente os dois arquivos de armazenamento, os três arquivos de testes, package.json, a alteração do importer no pnpm-lock.yaml, a documentação de memória e a entrega consolidada do desenvolvedor. Também confrontou o resultado com o plano, o diagnóstico da thread, AGENTS.md, marc-ops, o contrato completo de bootstrap e Custom Rules, docs/agent-workflows.md e os ADRs aplicáveis. A inspeção e os resultados de comandos foram processados via context-mode; comandos do workspace usaram Bash.

A revisão incluiu a integração com o código inalterado de rebuild-operations.ts e operations.ts: registros preservados continuam precedendo os novos, vetores são validados antes da escrita, índices e contagem são validados antes de publicar o manifest, e o status admite manifest vazio sem tabela. O histórico recuperado por memory_recall mantém incremental, batches limitados, lock compartilhado e retrievalContract como decisões vigentes.

### Critérios confrontados com implementação e evidência

| Critério | Avaliação integrada e evidência verificada pelo principal |
| --- | --- |
| Round trip com opcionais ausentes e incremental batch 4 | lancedb-store-support.ts:81 e :97 normalizam a escrita e constroem a tabela tipada. lancedb-store.ts:72 usa esse helper na geração. O teste real :78 mantém uma thread estável, altera outra e acrescenta uma terceira. O principal reproduziu a falha original antes da correção e executou a regressão no estado final, que passou. |
| Schema físico estável e domínio sem null | Todas as 14 colunas textuais são Utf8 anuláveis; vector e seu item são anuláveis, com FixedSizeList da dimensão gerada e Float32. Essa anulabilidade coincide com a tabela anterior consultada pelo principal. Os testes conferem dimensões 2 e 3, todos os opcionais ausentes, closedAt presente e strings vazias. A leitura :144 converte somente null/undefined, preservando conteúdo vazio. |
| Preservar incremental e canais de busca | A comparação profunda das linhas estáveis preserva IDs, texto, referências, caminhos, ordem e vetores. Testes existentes mantêm ausência de delta, embeddings somente para alterações e batches limitados. Na geração incremental temporária criada pelos testes finais, o principal consultou diretamente title, summary e titlePrefix: os três localizaram thread-a. vectorSearch retornou 3 hits e nenhum opcional null no domínio; validateGeneration passou. |
| Corpus vazio e remoção | O guard :78 evita criação de tabela sem registros; a rota inicial :203 usa o mesmo mapper/schema. O teste real em reconciliation :174 publica corpus vazio, acrescenta uma summary e remove a última, sem novo embedding na remoção. O manifest vazio e a ausência da tabela são verificados. Isso corresponde ao contrato existente de status/recall, sem mudança de interface. |
| Publicação e background corretos | A ordem escrita, validação e publicação do manifest foi preservada. Falha injetada na validação mantém o manifest e as linhas da geração anterior. O teste real de background :108 observa rebuilding, depois ready, lastError nulo e summaryCount/indexedSummaryCount iguais a 1. O teste de falha existente mantém degraded e lastError observáveis. |

### Arquitetura, regras, documentação e escopo

A mudança permanece no adaptador de armazenamento. MemoryVectorRecord não foi ampliado com null; o tipo persistido concentra essa diferença. As duas rotas de criação reutilizam o helper, reduzindo divergência de schema. A dimensão vem dos vetores efetivos; a validação vigente da operação continua protegendo as gerações. Não há alteração em ranking, providers, corpus, locks, batches, schemaVersion 6 ou field-aware-hybrid-v2.

SUMMARY.md permanece fonte de verdade. Tabelas, índices e manifest continuam projeções derivadas; a correção não promove dados de cache a estado autoritativo. A dependência direta apache-arrow 18.1.0 corresponde ao peer já disponível de LanceDB e foi sincronizada offline, sem atualização de outras dependências.

A verificação AST dos cinco arquivos TypeScript encontrou zero else e zero if aninhado. Os guards são simples e não introduzem variação que exija Strategy. O maior arquivo editado tem menos de 300 linhas não vazias. Código, testes e documentação técnica permanecem em en-US; comunicação e artefatos operacionais em pt-BR.

O principal verificou que remover apenas o novo bloco do importer reproduz exatamente o SHA-256 inicial do lockfile. Em package.json, remover a dependência e restaurar quatro finais de linha reproduz exatamente o hash inicial: scripts e demais propriedades não mudaram. Os oito hashes finais conferem com o relatório do desenvolvedor.

Os hashes do manifest real, .marc/marc.config.json e .codex/config.toml coincidem com o baseline. A única escrita recente encontrada fora dos alvos na inspeção de arquivos não gerados foi um log crescente preexistente em .playwright-output; o agregado externo inclui esse log e, por isso, não serve como prova global de igualdade. Não houve limpeza ou reversão desse arquivo nem das alterações anteriores de UI. A execução independente final de validate não formatou nenhum arquivo.

### Validação independente final

Comandos executados pelo principal no estado final, com stdout/stderr capturados e resumidos em JSON pelo context-mode; horários UTC de início:

- 06:46:48 — pnpm exec node --test --import tsx test/core-memory-lancedb-hybrid.test.ts test/core-memory-reconciliation.test.ts test/core-memory-background.test.ts: exit 0, 18/18.
- 06:47:02 — pnpm test: exit 0, 215/215; nenhuma falha ou teste ignorado.
- 06:47:28 — pnpm validate: exit 0; lint, formatação e tipos passaram; nenhum arquivo formatado.
- 06:48:01 — pnpm build: exit 0; aviso de chunk da UI maior que 500 KB, sem impedir o build.
- 06:49:16 — consultas somente-leitura nos três canais lexicais, busca vetorial e validação da geração incremental temporária: exit 0.

Saídas indexadas antigas apresentaram um erro de tipos em UI durante a investigação. A execução atual de typecheck e o validate final passaram; mtime e hash dos arquivos de UI já eram anteriores à tarefa. Esse erro antigo não é uma falha do estado final nem evidência de uma alteração concorrente.

### Achados resolvidos, limites e justificativa do veredito

A revisão corrigiu a posição da anulabilidade do Field externo de vector e confirmou seu valor físico contra a tabela anterior; corrigiu também a localização das assertions de contagem para o teste de background com LanceDB real. O principal releu essas mudanças e repetiu os checks no estado final. Não há achado técnico pendente que impeça o aceite dos critérios aprovados.

A aprovação se sustenta no round trip que reproduz a causa, no schema físico compatível, na preservação das linhas e consultas, no fluxo transacional inalterado e nas verificações independentes do estado integrado. Um audit estrutural limpo e o relatório do executor são evidências complementares; não substituem essa avaliação.

Os testes usam LanceDB real e providers fake em workspaces temporários. Não houve download ou inferência dos modelos reais, rebuild/purge da memória do usuário, restart do daemon, teste de UI em navegador, comando Git ou fechamento da thread. Não foi solicitada alteração de UI; o teste operacional na base real está fora do escopo aprovado. O aviso de tamanho do bundle permanece como limitação de build sem relação com o schema.

## Coordenação e registro

O principal reutilizou codex-software-architect e o desenvolvedor reutilizou codex-dev, runtime /root/memory_schema_fix. O spawn solicitou gpt-6-luna/xhigh conforme confirmação humana do perfil local; a configuração efetiva não foi introspectada. Houve um único desenvolvedor ativo. Seu bootstrap independente confirmou marc-dd422176e1 e C:\Projetos\marc, fontes, regras e escopo antes da autorização explícita de edição no canal interno.

A proposta foi anexada antes do desenvolvimento; o preflight retornou zero achados. O desenvolvedor publicou sua própria entrega. O principal registra aqui a revisão e a aprovação técnica, devolve o veredito ao executor e apresenta o resultado para revisão humana. Auditorias estruturais de artefatos, referências e mensagens são feitas após os arquivos e metadata estarem registrados.

## Encerramento autorizado

Em 2026-10-10, após a entrega e a discussão sobre uma futura tool MCP para sumários, o usuário pediu explicitamente “Encerre a thread”. O principal consolidou SUMMARY.md e registrou o fechamento, preservando a revisão e suas evidências. Esta atualização trata somente do registro de encerramento; não modifica a implementação ou o veredito técnico.
