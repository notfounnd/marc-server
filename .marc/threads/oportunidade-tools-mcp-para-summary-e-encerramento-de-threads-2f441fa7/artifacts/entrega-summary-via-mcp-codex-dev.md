# Entrega do ciclo de SUMMARY via MCP — codex-dev

## Estado da entrega

Implementação concluída no workspace marc-dd422176e1, em C:\Projetos\marc. A fonte continua sendo o Markdown SUMMARY.md; índice, cache e demais projeções são derivados. A thread permanece aberta. A revisão integrada do principal está pendente, portanto este registro não declara aprovação técnica final.

Perfil de execução: codex-dev, papel developer. A configuração solicitada e efetiva registrada para esta execução foi gpt-6-luna/xhigh, confirmada por humano no perfil compartilhado e pelo principal. Não afirmo introspecção do processo/runtime para verificar esses valores. A autorização explícita do principal para edição e publicação de entrega veio pelo canal de colaboração.

## Resultado implementado

A nova tool thread_write_summary aceita create (padrão) e update. Create grava SUMMARY.md e fecha a thread somente após autorização humana de fechamento. O corpo é Markdown livre redigido pelo caller; o core controla o cabeçalho inicial com H1 derivado do título CHAT, referência Thread canônica, Closed em ISO UTC, separador --- e o corpo. A orientação editorial está no guia de fechamento, sem validações de seções obrigatórias.

Update requer expectedSummaryRevision, SHA-256 lowercase dos bytes do resumo atual. A repetição equivalente retorna unchanged antes de comparar a revisão e preserva bytes/mtime; uma alteração exige a revisão atual. A data de fechamento é preservada. Summaries legados podem ser atualizados intencionalmente sem Thread, sem Closed e sem separador, com títulos H1 históricos: identidade e título vêm da thread/CHAT. Metadados explícitos inválidos, vazios, duplicados ou contraditórios falham. Só uma escrita intencional normaliza o cabeçalho; o parser limita metadados ao cabeçalho e conserva texto parecido com metadados, separadores e blocos de código dentro do corpo.

O writer valida IDs e caminhos físicos antes de obter o lock e revalida sob lock, rejeita traversal e symlink/junction/reparse point, e faz commit atômico do SUMMARY sem tocar em CHAT.md ou artifacts. Writers usam lock de recurso da thread; a grafia não canônica de ID é rejeitada apenas na escrita para manter a chave do lock alinhada ao caminho físico. Leitores continuam aceitando IDs legados que o resolvedor existente já reconhecia. thread_info e thread_read(includeSummary: true) incluem a revisão obtida na mesma leitura.

A atualização de projeções ocorre após liberar o lock da thread. A reconciliação do thread index é serializada pelo lock existente, evitando que uma chamada retorne updated enquanto um snapshot antigo prevalece no cache. Falhas de índice/memória não revertem o source commit e são reportadas como estado pendente/erro derivado. Auto-rebuild desligado, inclusive durante preparação sem rebuild elegível, continua pendente; o caminho não prepara nem baixa modelos. O protocolo MCP fixado em 2026-07-28 foi mantido e o catálogo público passou a 25 tools, com erros sanitizados.

Não houve mudança no parser/corpus/ranking/embeddings da memória, na configuração ou em dados reais. Os 50 summaries reais e o hash de configuração permaneceram iguais segundo a comparação de baseline do principal. Não foram alterados src/ui nem a thread exemplo anexada à proposta.

## Paths do executor

A comparação final do principal identificou 31 paths da entrega do executor, abaixo. A separação estrutural de paths de resumo e testes foi autorizada para manter módulos e arquivos de teste coesos e dentro do limite local de 300 linhas.

Modificados:

- src/core/marc-ops-skill.ts
- src/core/recommendations.ts
- src/core/threads.ts
- src/core/types.ts
- src/core/workspace-status.ts
- src/core/workspace.ts
- src/mcp/helper.ts
- src/mcp/thread-tools.ts
- test/mcp-lifecycle.test.ts
- test/mcp-protocol.test.ts
- test/mcp-version-pin.test.ts
- test/mcp.test.ts
- docs/agent-workflows.md
- docs/architecture.md
- docs/mcp-migration-2026-07-28.md
- docs/mcp-tools.md
- docs/memory.md
- README.md

Novos:

- src/core/thread-summary-error.ts
- src/core/thread-summary-markdown.ts
- src/core/thread-summary-paths.ts
- src/core/thread-summary.ts
- test/core-thread-summary-fixtures.ts
- test/core-thread-summary-legacy.test.ts
- test/core-thread-summary-locks.test.ts
- test/core-thread-summary-paths.test.ts
- test/core-thread-summary-persistence.test.ts
- test/core-thread-summary-projections.test.ts
- test/core-thread-summary-restart.test.ts
- test/core-thread-summary.test.ts
- test/mcp-thread-summary.test.ts

Referências centrais: API e source commit em src/core/thread-summary.ts:60 e :231; parsing/normalização em src/core/thread-summary-markdown.ts; validação física e snapshot em src/core/thread-summary-paths.ts; estado da projeção em src/core/workspace-status.ts:43; revisão exposta pelos tipos em src/core/types.ts:129 e :169; inclusão em leituras em src/core/threads.ts:114 e :171; registro MCP em src/mcp/thread-tools.ts:36 e :56. Orientações para autoria e composição estão em docs/agent-workflows.md, especialmente os anchors shared-message-format e closing-threads. Contrato MCP e política de revisão estão em docs/mcp-tools.md:142 e :146; fluxo também está no README.md:184.

O plano aprovado recebeu atualização do principal para registrar os módulos de caminho/erro/Markdown e a divisão dos testes. A atualização do principal em .marc/RULES.md, plano e registros da proposta são autoria do principal, fora destes 31 paths. O principal ainda fará a atualização oficial das recomendações gerenciadas pela dist validada.

## Verificação

Checagens executadas pelo executor após a última correção:

- pnpm exec tsx --test test/mcp.test.ts: exit 0; 5/5 testes passaram.
- pnpm validate: exit 0; formatter reportou nenhum path alterado; ESLint, Prettier e typecheck concluíram.
- pnpm build: exit 0; build completou. O Vite emitiu apenas o aviso conhecido de chunk acima de 500 kB.
- pnpm test: exit 0; 269 testes, 267 passaram, 0 falharam e 2 foram skipped. Os dois skips são os testes condicionais de symlink de arquivo, pois o sistema operacional não permitiu criar esses links; testes de rejeição de junction/reparse point passaram.

A lista pública esperada em test/mcp.test.ts foi atualizada para incluir thread_write_summary e sua cobertura verifica campos/schema e o gate de bootstrap. A falha única da rodada completa anterior era essa expectativa antiga de 24 tools; foi corrigida antes da rodada final verde.

Validação independente do principal, no estado final estável: pnpm test exit 0, 269/267/0/2; driver core exit 0 com 12 critérios; regressão de corrida das projeções exit 0, cache final refletindo a escrita B e ambas as chamadas atualizadas; smoke MCP stdio source e dist exit 0, catálogo com 25 tools, bootstrap, create, leitura, update e conflito de revisão. A validação visual do principal em ambiente temporário também conferiu conteúdo Markdown rico e navegação, sem alterar a UI ou workspace real.

## Ajustes de escopo e pendências

Durante a execução, criei indevidamente test/core-marc-ops-skill.test.ts, fora do wildcard de testes autorizado e redundante por verificar strings sem comportamento. Confirmei autoria e removi o arquivo por apply_patch; ele não consta na lista final de 31 paths. Os testes existentes de recomendações gerenciadas foram preservados. Nenhuma outra mudança fora do scope permaneceu, conforme a comparação final do principal.

Não há bloqueio conhecido para a revisão. Próximo passo: revisão técnica independente e integrada do principal, que permanece pendente. A thread não foi encerrada.