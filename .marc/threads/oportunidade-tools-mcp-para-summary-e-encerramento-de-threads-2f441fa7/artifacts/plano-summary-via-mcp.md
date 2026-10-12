# Plano de implementação: resumos e encerramento via MCP

## Objetivo e decisões aprovadas

Permitir criar e atualizar `SUMMARY.md` via `thread_write_summary`, mantendo Markdown como fonte de verdade. A criação encerra a thread pelo contrato existente; não existe outro estado autoritativo de fechamento. A tool persiste Markdown do chamador, sem síntese ou tradução automática.

O usuário aprovou o plano neste chat com “Implement the plan”. Durante o planejamento, confirmou H1 com o assunto da thread, `Thread`/`Closed` como sintaxe técnica do formato, uma tool com modos e exclusão da migração dos summaries antigos. Título e corpo seguem o idioma de comunicação definido pelo workspace; neste projeto, pt-BR. Código, schemas, descriptions e documentação técnica permanecem em en-US.

Nenhum encerramento da thread de trabalho foi autorizado. O exemplo temporário solicitado é uma demonstração separada, sem commit. A futura migração será registrada em outra oportunidade, com prévias e preservação do corpo, datas e identidade.

## Fontes e baseline

Fontes lidas por context-mode: README, docs/agent-workflows.md, docs/harness-engineering.md, docs/architecture.md, docs/mcp-tools.md, docs/memory.md, docs/mcp-migration-2026-07-28.md, ADRs 0001, 0003, 0004, 0007, 0008 e 0009, skill marc-ops e contrato completo de bootstrap.

Thread fonte: marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7. Anexo original: oportunidade-summary-e-encerramento-via-mcp.md. Exemplos de summaries indicados pelo usuário foram confrontados com os parsers reais. `memory_recall` precedeu a proposta; threads ce47939a, 3b4a8787, 834716ba, 94409c8c, 1d4c0daa e c147b8bb foram recuperadas.

O servidor usa MCP 2026-07-28 e tem 24 tools. Escritas exigem IDs completos. `SUMMARY.md` determina closed; o índice usa `Closed` ou mtime, enquanto a memory permite data ausente. A memory usa schema 6 e retrievalContract field-aware-hybrid-v2, que não serão alterados. Configuração real consultada: autoRebuild=false, embeddingBatchSize=4, searchRetryDepth=0.

Baseline: Node v24.3.0. Comando executado em Bash via context-mode: `pnpm exec tsx --test test/core-thread-index.test.ts test/core-write-coordination.test.ts test/mcp-tool-registration.test.ts`; 14/14 passaram, sem falhas ou skips. Isso valida mecanismos existentes, não a feature ainda inexistente.

## Formato e interface

O core renderiza, nesta ordem: `# <título canônico de CHAT.md>`, linha em branco, `Thread: marc://$<ID completo>`, linha em branco, `Closed: \`<UTC ISO 8601>\``, linha em branco, `---`, linha em branco, corpo Markdown e newline final. Nenhuma lista de seções é obrigatória. Cabeçalho e corpo têm responsabilidades separadas; o campo body contém somente a parte descritiva.

Inputs de thread_write_summary: threadId completo, body não vazio, mode=create|update com default create, expectedSummaryRevision obrigatório no modo update, bootstrapConfirmed padrão. Não aceitar caminhos arbitrários, metadados de fechamento ou título alternativo do chamador. A revisão é SHA-256 dos bytes UTF-8 persistidos, com representação hexadecimal minúscula.

Resultado: threadId, reference raw, summaryPath relativo a .marc, status=closed, closedAt, summaryRevision, outcome=created|updated|unchanged e estado das projeções. Adicionar summaryRevision opcional a thread_info e a thread_read quando includeSummary=true; o conteúdo e a revisão vêm da mesma leitura. Leituras sem summary não recebem sua revisão. Nenhuma summary_read redundante.

Criar writeThreadSummaryInWorkspace no core e writeThreadSummary na fachada. Registrar a tool pelo coordenador vigente. Erros de domínio distinguem entrada inválida, thread inexistente/inválida, resumo existente/ausente, revisão conflitante, metadados inválidos e falha de escrita; usar mensagens en-US sanitizadas, sem stacks ou dados sensíveis.

## Orientação editorial para o corpo

Começar o corpo, logo após o separador do cabeçalho e antes das seções, com uma síntese executiva curta, em um parágrafo sem título próprio. Apresentar o propósito da thread, seu principal resultado ou decisão e seu estado final; incluir uma limitação ou pendência quando ela mudar a interpretação do resultado. A abertura deve permitir compreender rapidamente a thread antes de ler os detalhes. Não repetir os metadados do cabeçalho, enumerar comandos ou transformar a síntese em diário de execução. Não impor contagem rígida de frases ou caracteres.

Depois da síntese, organizar as informações pertinentes em áreas recomendadas: objetivo e contexto; decisões e entrega; validação e aceite; limitações e pendências; continuidade e referências. Essas áreas podem ser combinadas, desdobradas ou omitidas conforme o assunto e a necessidade real. Os títulos, a ordem e a quantidade de seções não são uma lista obrigatória. Uma investigação, uma correção pequena e uma evolução arquitetural podem exigir organizações diferentes. Distinguir aprovação técnica, aceite humano e autorização de fechamento quando essas situações forem relevantes.

Reutilizar obrigatoriamente a regra canônica de formatação em .marc/RULES.md, Custom Rules, Message Formatting, e seu detalhamento existente em docs/agent-workflows.md, Shared message format. Não criar uma política geral concorrente para summaries nem repetir uma enumeração de recursos Markdown em planos, descriptions, skills e documentos distintos. A liberdade de composição e formatação segue essa orientação compartilhada; o exemplo aprovado não restringe o corpo a parágrafos simples.

A implementação deverá complementar o ponto de orientação geral existente para explicitar que os recursos da sintaxe Markdown estão disponíveis aos autores em todo conteúdo Markdown escrito via mARC, incluindo mensagens, artifacts e summaries. O principal ajustará o alcance da regra canônica existente, que hoje fala de mensagens, mantendo o link para seu detalhamento compartilhado. O desenvolvedor atualizará esse detalhamento em docs/agent-workflows.md, preservando critérios próprios de cada canal; limites de mensagens não serão impostos aos arquivos de artifacts ou summaries. Não criar outra regra geral nem novos filtros de formatação. A renderização atual usa ReactMarkdown com remark-gfm; esta decisão não introduz extensões ou redesign do renderer.

Manter a orientação específica de composição de summaries na seção Closing threads de docs/agent-workflows.md: cabeçalho padronizado, síntese de abertura e áreas editoriais flexíveis. Harness, recomendações e outras documentações devem apontar para essa orientação, sem duplicar o texto completo. A síntese faz parte do body fornecido pelo chamador. A ferramenta não gera a abertura, não exige sua presença por parsing e não valida tópicos editoriais. O formato persistido fixo continua limitado ao cabeçalho; o texto livre segue o idioma de comunicação do workspace.

O usuário aprovou a apresentação e solicitou formalizá-la como anexo de mensagem. `artifacts/exemplo-summary-aprovado.md` preserva o documento demonstrativo aprovado, com síntese e áreas editoriais flexíveis. O exemplo documenta composição e não é evidência de implementação ou aprovação técnica da ferramenta.

## Persistência e integração

- Validar ID e caminho fixo, diretório existente e CHAT.md regular. Rejeitar traversal, links/junctions e escape físico da raiz, inclusive em ancestrais relevantes. Não criar uma thread fantasma. Revalidar sob o lock antes de gravar. Não reformar toda a camada de paths ou resolvedor de leitores.
- Usar threadWriteResource, withWorkspaceWriteLock e writeFileAtomically existentes. Threads distintas não compartilham o lock de escrita do resumo. Reconciliar projeções depois de liberar o lock da thread.
- create: ausência cria; equivalência com o arquivo existente retorna unchanged; conteúdo diferente gera conflito. O timestamp para equivalência de retry é o original já persistido.
- update: ausência gera erro; equivalência retorna unchanged mesmo após retry com revisão antiga; mudança exige revisão esperada igual à atual. A comparação e a publicação acontecem sob o mesmo lock. Nunca usar last-write-wins silencioso.
- Preservar identidade e closedAt. Em atualização intencional de legacy sem Closed, usar seu mtime anterior, conforme a projeção histórica; não deduzir uma data histórica diferente. Reconhecer o cabeçalho inicial legado com H1 descritivo, Thread ausente ou escrito como ID completo ou referência marc://, inclusive em backticks, e corpo iniciado com ou sem separador. O título canônico vem de CHAT.md e a identidade da thread resolvida; um H1 legado com prefixo não é contradição de identidade. Metadados explícitos inválidos, vazios, duplicados ou contraditórios geram erro. Não interpretar linhas ou separadores dentro do corpo como metadados. Somente uma escrita intencional com alteração de conteúdo normaliza o cabeçalho; um retry equivalente preserva os bytes e mtime originais. Não atualizar summaries históricos reais nesta entrega.
- Normalizar CRLF/CR para LF e remover apenas linhas em branco dos limites externos do corpo; preservar espaços internos e espaços de hard break. Validar body.trim() não vazio. A repetição equivalente não altera conteúdo, mtime, data ou revisão.
- Manter CHAT.md, mensagens e artifacts intactos. Falhas antes da substituição preservam o resumo anterior. Locks cooperativos não garantem serialização de edições manuais externas.
- Reutilizar reconciliação do índice e fluxo de status/auto rebuild existente. Auto off mantém pendência/stale até rebuild explícito; auto on solicita somente incremental quando eligible/prepared, respeitando locks, coalescência, batch e estados de erro. Não baixar/preparar modelos nem esperar inferência para confirmar a fonte.
- Distinguir persistência concluída e projeção pendente. Falha de projeção não transforma o resultado em falsa falha de persistência nem simula rollback entre arquivos independentes. Retry unchanged pode reparar projeção pendente, mas não reprocessa conteúdo já atualizado.
- Manter protocolo 2026-07-28, cache hints, bootstrap, cancelamento, rate limit e drain. Atualizar catálogo e asserts de 24 para 25 no source e dist. Não adicionar alias, hooks, geração por LLM, reopen/remove implícito ou mudança no motor da memory.

## Handoff atômico ao desenvolvedor

Uma tarefa coesa: implementar o lifecycle de summaries, sua superfície MCP, documentação e validação. Principal: codex-software-architect, runtime /root. Executor: perfil compartilhado codex-dev, modelo solicitado gpt-6-luna, reasoning xhigh. O perfil foi lido e registra seleção/reasoning humano-confirmados para este modo; não alegar introspecção de runtime. O perfil do principal registra gpt-6.1-sol/high humano-confirmado. Modelo econômico é adequado à implementação delimitada; arquitetura e revisão integrada ficam com o principal. Limite: um desenvolvedor ativo, sequencial; não criar outros agentes ou perfis.

Antes de editar, retornar OK_BOOTSTRAP com identidade marc-dd422176e1, raiz C:\Projetos\marc, fontes lidas, regras críticas, configuração e fonte da confirmação, write scope e estado inicial dos alvos. Aguardar autorização explícita do principal pelo canal agent-to-agent.

Caminhos autorizados: src/core/thread-summary.ts (novo), src/core/threads.ts, src/core/types.ts, src/core/workspace.ts, src/core/thread-index.ts, src/core/memory/summaries.ts, src/core/workspace-status.ts, src/core/marc-ops-skill.ts, src/core/recommendations.ts, src/mcp/thread-tools.ts, src/mcp/helper.ts; test/core-thread-summary.test.ts e test/mcp-thread-summary.test.ts (novos); test/core-thread-index.test.ts, test/core-memory.test.ts, test/core-memory-background.test.ts, test/mcp.test.ts, test/mcp-protocol.test.ts, test/mcp-lifecycle.test.ts, test/mcp-version-pin.test.ts, test/mcp-threads.test.ts, test/core-recommendations.test.ts; README.md, docs/mcp-tools.md, docs/architecture.md, docs/memory.md, docs/mcp-migration-2026-07-28.md, docs/agent-workflows.md e docs/ui-and-daemon.md. Se algum arquivo listado não existir, informar antes de criar um substituto. Um helper de teste novo pode ser proposto ao principal, sem expansão unilateral.

Para cumprir o limite de 300 linhas do ESLint, o principal autorizou também src/core/thread-summary-paths.ts para validação física, IO e snapshot; src/core/thread-summary-error.ts, se necessário para compartilhar erros sem dependência circular; src/core/thread-summary-markdown.ts para parsing, rendering, normalização e datas puros; test/core-thread-summary-*.test.ts e test/core-thread-summary-fixtures.ts para dividir a suíte. Essa ampliação é somente estrutural: preservar os exports públicos, o contrato funcional e a separação entre persistência e projeções, sem novas funcionalidades.

Também autorizar artifacts de entrega sob a thread 2f441fa7 e a própria postagem MCP sob codex-dev. Excluir outros arquivos de .marc, perfil/catalogo de agentes, configuração do usuário, memória real, UI source, dependências, lockfiles, hooks e Git. O principal é responsável pelo ajuste mínimo previsto na Custom Rule existente de Message Formatting em .marc/RULES.md; isso não amplia o write scope do desenvolvedor. dist é saída gerada de build, não edição manual. Não editar .marc/INSTRUCTIONS.md ou a skill gerada .agents diretamente.

Usar apply_patch para edições manuais e context-mode para investigação/saída de comandos; Bash. Não usar else, if aninhado ou Strategy em guards simples. Usar dispatch table para modos. Preservar trabalho existente e registrar snapshots em memória para identificar mudanças; sem Git.

## Aceite e checks

Usar TDD para comportamento significativo. Testar criação/leitura/fechamento, update e revisão obsoleta, retries equivalentes, body livre e formatação preservada, metadata/date em legacy temporário, concorrência entre processos e com mensagens, isolamento entre threads, conteúdo vazio, thread inválida, traversal/links, falhas de escrita e projeções, restart/reconciliação e memória off/on.

Fixtures devem usar workspaces temporárias, stores/providers controlados e dependências mínimas para falhas/links quando necessário. Sem downloads, rebuild ou purge da base real. Não usar skips para fingir cobertura de plataforma. Distinguir fixtures de validação real.

Checks focados primeiro; depois pnpm validate, pnpm build e pnpm test. validate inicia lint/Prettier com writes: conferir alcance antes e mudanças depois. Se formatter atingir trabalho fora do escopo, não reverter amplamente: informar o principal. Verificar tool descoberta e fluxo real no CLI compilado. Principal executa revisão/checagens independentes e valida renderização/navegação por Playwright CLI em ambiente temporário.

Atualizar docs e recomendações somente para o contrato implementado. Manter bootstrap, fonte canônica de Custom Rules, autorização humana de fechamento, formato compartilhado de mensagens e artifacts. Verificar que as orientações gerais e específicas sejam reutilizadas por referência, sem criar políticas duplicadas de composição ou formatação. Não converter recomendação editorial em gate rígido nem ampliar o corpus/schema/ranking da memory.

## Entrega e revisão final

O desenvolvedor entregará relatório detalhado interno com caminhos/linhas, mudanças, checks realmente executados e resultados, documentação, riscos e limites. Publicará sua própria entrega consolidada na thread pelo MCP sob codex-dev, com relatório anexado e revisão do principal pendente. Retornará messageId. Não reservar a publicação ao principal, não ghostwrite e não publicar por comando/status de rotina.

O principal verificará autoria e consistência da entrega e fará revisão independente do estado integrado completo: comportamento, concorrência, segurança de paths, arquitetura/manutenibilidade, regras, fontes/documentação e evidências. Registrará seção substantiva no relatório consolidado, ligando critérios a implementação e checks, com findings, limitações e veredito approved/pending/rejected. Correções seguem com o mesmo desenvolvedor; alterações invalidam veredito anterior e exigem reavaliação.

Auditorias de artifacts/references e messages após metadados corretos são estruturais, não aprovação técnica. Resultado final será apresentado para avaliação humana. A thread continua aberta até autorização explícita de encerramento.

## Questões pendentes

Nenhuma decisão de contrato pendente. O exemplo temporário permite crítica visual ao formato aprovado; qualquer mudança material resultante será incorporada antes de alterar a implementação. Migração histórica permanece fora do escopo.
