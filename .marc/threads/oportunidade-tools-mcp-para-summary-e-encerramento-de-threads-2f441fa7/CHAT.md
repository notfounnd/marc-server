# Oportunidade - Tools MCP para summary e encerramento de threads

Thread: `oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7`
Created: `2026-10-08T22:47:00.957Z`

<!-- marc-message
id: msg_9f397070ac1d415b95
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-08T22:48:33.104Z
agentId: codex-dev
role: architect
artifacts: artifacts/oportunidade-summary-e-encerramento-via-mcp.md
-->

Oportunidade registrada para completar o lifecycle de threads pelo MCP.

- Hoje existe suporte a criacao/leitura de threads, mensagens e anexos, mas nao a gravacao/atualizacao de SUMMARY.md.
- Objetivo: criar e atualizar o resumo via MCP, encerrando a thread pelo contrato existente, sem exigir edicao direta de arquivos ou ferramental proprietario.
- Markdown permanece fonte de verdade. A tool deve reutilizar locks/escrita atomica e integrar reconciliacao, UI e memory, sem modificar o motor de busca.
- O anexo detalha contrato a decidir, seguranca, concorrencia, idempotencia, metadados, auto rebuild, documentacao e testes.

Contexto recente: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba.
Decisao historica de fechamento a preservar: marc://$oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a.

Apenas registro da oportunidade. Nenhuma implementacao iniciada; aguarda planejamento futuro.

<!-- /marc-message -->

<!-- marc-message
id: msg_48b7e8af07234cd98c
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:45:23.989Z
agentId: ui-user
role: user
-->

Eu reparei que cada summary tem sido criado com uma formatação distinta. Alguns blocos, por exemplo, como cabeçalhos do summary, deverão ser padronizados, para manter consistência no formato dos documentos.

<!-- /marc-message -->

<!-- marc-message
id: msg_87561bbe7d35453bb5
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:46:33.106Z
agentId: ui-user
role: user
-->

Talvez uma reformatação dos headers das summaries de threads já encerradas seja desejado aplicar.

<!-- /marc-message -->

<!-- marc-message
id: msg_25554e843020416cbf
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:47:10.427Z
agentId: ui-user
role: user
-->

Use a fase de planejamento para debater um formato de cabeçalho das threads.

<!-- /marc-message -->

<!-- marc-message
id: msg_6827805437f147449c
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-09T03:48:49.656Z
agentId: ui-user
role: user
-->

Complementando, ter um formato não significa que o conteúdo descritivo da summary deve ser rígido. A ideia é normalizar o bloco de cabeçalho que vem antes do conteúdo informativo do resumo.

<!-- /marc-message -->

<!-- marc-message
id: msg_45b53b6eb39a49c9a0
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-11T19:32:13.995Z
agentId: ui-user
role: user
-->

Destaco atenção e sinergia dessa thread com marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787

<!-- /marc-message -->

<!-- marc-message
id: msg_7a8f36649370412296
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T01:35:31.714Z
agentId: ui-user
role: user
-->

Threads recentes com bons exemplos de sumário executivo de encerramento:

- marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa
- marc://$oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b
- marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
- marc://$ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c
- marc://$corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898

<!-- /marc-message -->

<!-- marc-message
id: msg_d2d1a2b16de74d4ebc
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T01:37:39.293Z
agentId: ui-user
role: user
-->

Threads mais antigas que também tem um bom sumário executivo de encerramento:

- marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682
- marc://$oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99
- marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

<!-- /marc-message -->

<!-- marc-message
id: msg_d0a4116ee31b467dba
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T01:46:25.452Z
agentId: ui-user
role: user
-->

Lendo as threads para pesquisar referências ficou bastante evidente algumas coisas do encerramento (distinções entre os sumários).

- Idioma dos blocos as vezes aparece em inglês, as vezes aparece em pt-br (que deveria ser o padrão definido nas rules e no harness customizado pelo usuário).
- Blocos distintos (sempre o que foi feito é mostrado de uma maneira diferente).
- O bloco de cabeçalho sempre fica com formato diferente (as vezes tem data, as vezes não, as vezes tem a thread - não sei se faz sentido ter, uma vez q o sumário fica na pasta da thread ou se é importante ter para ajudar mecanismo de busca).
- Header principal as vezes começa com resumo/sumário executivo, as vezes é o nome da thread que ta la (o próprio documento já é apresentado na interface como "Executive Summary").

Apesar de tudo, vale complementar que não quero enrijecer o texto de encerramento. As vezes uma thread pode precisar de um bloco que outra thread não precisou. Essa é uma linha tênue, que deve ser tratada com cuidado.

<!-- /marc-message -->

<!-- marc-message
id: msg_d8d99f1fea8c43f1b7
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T01:47:35.929Z
agentId: ui-user
role: user
-->

Uma ideia para ver um padrão é abrir uma thread de exemplo e excluirmos depois. Nessa thread de exemplo, na fase de plan, pode ser criado um summary.md para eu analisar o formato (principalmente o formato do cabeçalho).

PS: essa thread não será commitada.

<!-- /marc-message -->

<!-- marc-message
id: msg_5afade8d61b7402d9b
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T02:22:19.595Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-summary-via-mcp.md
-->

Proposta estruturada e execução autorizada pelo usuário no chat. O plano detalhado está anexado.

Decisões: uma thread_write_summary com modos create/update; H1 com o assunto; Thread/Closed como sintaxe técnica; corpo livre no idioma de comunicação. Atualizações terão revisão esperada para evitar sobrescrita de conteúdo concorrente. Markdown permanece fonte de verdade.

A migração dos summaries antigos fica fora desta entrega e será registrada em uma oportunidade separada com prévias. Será preparado o exemplo temporário solicitado.

Análise por context-mode e histórico consultado por memory_recall/thread_read. Baseline: 14/14 testes focados passaram, sem falhas ou skips. Desenvolvimento sequencial com um executor e revisão integrada independente do principal. A thread permanece aberta; não há autorização de encerramento.

<!-- /marc-message -->

<!-- marc-message
id: msg_95b70a4189c6485bb0
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T02:37:20.681Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-summary-via-mcp.md
-->

Orientação editorial incorporada à proposta após a avaliação do exemplo pelo usuário.

O corpo deve abrir com uma síntese executiva curta, logo após o separador, que apresente propósito, principal resultado ou decisão e estado final. Depois, o autor organiza as informações pertinentes em áreas recomendadas: contexto, decisões/entrega, validação/aceite, limitações/pendências e continuidade. Títulos, ordem e quantidade de seções permanecem flexíveis.

A síntese pertence ao body fornecido pelo autor; não será gerada pela tool nem transformada em gate de parsing. O cabeçalho técnico aprovado permanece igual. O exemplo temporário foi atualizado para representar essas áreas com conteúdo da proposta real.

O desenvolvimento de código permanece aguardando a conclusão da discussão solicitada pelo usuário.

<!-- /marc-message -->

<!-- marc-message
id: msg_aa0425767a7d404593
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T02:48:49.768Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/exemplo-summary-aprovado.md, artifacts/plano-summary-via-mcp.md
-->

Exemplo aprovado pelo usuário formalizado no anexo, preservando o documento demonstrativo. A proposta foi complementada com a orientação de composição.

O corpo abre com uma síntese executiva curta e segue com as informações pertinentes em áreas flexíveis. O autor pode usar bullets, listas numeradas, negrito, citações, tabelas, links e trechos de código conforme ajudem a leitura. O exemplo não restringe a formatação nem impõe seus títulos ou a quantidade de seções.

O cabeçalho técnico permanece padronizado. A síntese e a formatação pertencem ao conteúdo produzido pelo autor; a tool não gera texto nem impõe gates editoriais.

Esta aprovação é do formato e da orientação. O desenvolvimento de código continua aguardando a conclusão da conversa solicitada pelo usuário.

<!-- /marc-message -->

<!-- marc-message
id: msg_2ddf63c769144b2f94
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T03:00:23.536Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-summary-via-mcp.md
-->

Reutilização da orientação existente tornada obrigatória na proposta, conforme determinação do usuário. A enumeração duplicada de recursos Markdown foi removida do plano.

A regra canônica de formatação continua em RULES.md, com detalhamento no guia compartilhado existente. A implementação deverá explicitar nesse ponto o uso da sintaxe Markdown em mensagens, artifacts e summaries. Outras instruções e documentos deverão reutilizar a orientação por referência.

A composição específica de summaries ficará na seção de encerramento do guia: cabeçalho, síntese de abertura e áreas flexíveis. A ferramenta preservará o Markdown do autor, sem impor novos filtros editoriais ou estender limites de mensagens aos arquivos.

Nesta etapa foi corrigida a proposta; o harness e o código ainda não foram alterados.

<!-- /marc-message -->

<!-- marc-message
id: msg_ffac6f4c475e4d5e9f
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T04:35:06.908Z
agentId: codex-dev
role: developer
artifacts: artifacts/entrega-summary-via-mcp-codex-dev.md
-->

## Entrega codex-dev

Implementei o ciclo de SUMMARY via MCP: create fecha a thread somente com autorização humana; update exige revisão SHA-256 e preserva a data de fechamento. O core mantém o cabeçalho, aceita atualização intencional de formatos legados, grava atomicamente a fonte e atualiza projeções sem esconder um commit já realizado. A orientação de composição está concentrada em Closing threads, e o catálogo MCP agora contém 25 tools.

## Validação

pnpm validate, pnpm build, a suíte completa (269 testes: 267 pass, 0 fail, 2 skips reais por restrição do SO ao criar symlink de arquivo) e o teste MCP focado passaram, todos com exit 0. A rodada independente do principal repetiu a suíte, verificou 12 critérios do core, a corrida de projeção e os smokes MCP stdio em source e dist.

O artefato anexo traz contrato, lista dos 31 paths, referências e limites. A revisão integrada do principal continua pendente; a thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_212f485824844745af
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T04:42:02.513Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-summary-via-mcp.md, artifacts/exemplo-summary-aprovado.md, artifacts/plano-summary-via-mcp.md
-->

## Entrega integrada

A revisão final do principal aprovou tecnicamente a implementação de `thread_write_summary`: criação e atualização com cabeçalho gerenciado, corpo Markdown livre, revisão SHA-256, retries idempotentes e persistência atômica. O relatório anexo relaciona os critérios do plano ao código e à evidência independente.

A orientação de composição reutiliza obrigatoriamente o guia compartilhado do harness. A síntese inicial e as áreas flexíveis do sumário ficam na orientação de encerramento. O exemplo aprovado está anexado e preservado; os sumários históricos permanecem intactos.

## Validação e estado

- `pnpm validate` e `pnpm build` passaram. A suíte completa passou no executor e no principal: 267 aprovados, nenhuma falha e dois skips por restrição do Windows à criação de symlinks de arquivo.
- As verificações independentes do core, concorrência de projeções, MCP source/dist e renderização com Playwright CLI passaram. Processos MCP novos anunciam 25 ferramentas.
- As recomendações foram atualizadas pela versão compilada, preservando as Custom Rules. A conexão MCP já iniciada precisa carregar a versão nova para expor a ferramenta.

A implementação está pronta para avaliação humana. Esta aprovação técnica não encerra a thread; ela continua aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_02141d138445473989
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T05:05:20.317Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-correcao-fixtures-summary.md
-->

## Correção de testabilidade

O feedback do usuário apontou uma decisão anterior que deveria ter sido reutilizada: fixtures TypeScript e dependência mínima de filesystem para testar links sem privilégios do Windows.
marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa

O plano anexo corrige os testes de SUMMARY e os cenários MCP alterados nesta entrega, sem condicionais de cenário ou skips, preservando a integração real. A regra geral de testes foi registrada nas Custom Rules, sem duplicar a política no harness.

A correção exige nova validação completa e revisão integrada. A aprovação anterior descreve o estado anterior; o parecer da correção está pendente. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_6b8298dfcfc544ddb2
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T06:17:24.002Z
agentId: codex-dev
role: developer
artifacts: artifacts/summary-fixture-correction-delivery.md
-->

# Correção de fixtures e testes de ciclo de vida

A correção autorizada tornou determinísticos os testes de path, concorrência, projeções e ciclo MCP source/dist. Validação e build completos passaram, a suíte terminou com 281 testes aprovados e a revisão integrada do principal segue pendente.

## Mudanças

- Separei a matriz de metadados e os cenários auto-off/auto-on nos dois arquivos autorizados para manter o limite de 300 linhas; os testes de junction, falha de projeção e corrida continuam cobertos.
- A fixture de memória usa vetores fixos para evitar ramificações herdadas, preservando o reconciliador, scheduler, rebuild e manifesto reais.
- Os updates em processos separados agora verificam PIDs, resultados explícitos e hash dos bytes SUMMARY persistidos.
- Os testes MCP source/dist usam cenários explícitos sem skip condicional. O caso de stdout destruído envia discovery e confirma saída limpa, mantendo os asserts PUT/DELETE, token e caminho da lease.

## Verificação

- `pnpm validate`: exit 0.
- `pnpm build`: exit 0.
- `pnpm test`: exit 0; 281 pass, 0 fail, 0 skipped.
- Testes focados de summary: 31 pass; MCP lifecycle/version-pin/protocol: 16 pass.
- Drivers independentes do principal passaram para revalidação sob lock, falha e limpeza de rename, corrida de projeção, cenários de legado/retry e Client público source/dist.

Relatório detalhado: marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7/!summary-fixture-correction-delivery.md

A revisão integrada do principal está pendente. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_b4aa099d2c924dd491
threadId: oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7
timestamp: 2026-10-12T06:21:32.051Z
agentId: codex-software-architect
role: principal
artifacts: artifacts/atividade-summary-via-mcp.md, artifacts/plano-correcao-fixtures-summary.md
-->

A correção está tecnicamente aprovada após revisão independente do estado integrado. Reutilizamos a decisão da thread 1d4c0daa: fixtures declarativas para metadados de links e erros, Node como padrão e integração real para persistência, locks e processos.

- Os testes afetados e seus scripts não contêm condicionais de cenário, skips ou patches globais. A regra geral permanece na fonte canônica, RULES.md.
- `pnpm validate` e `pnpm build` passaram. Executor e principal executaram a suíte completa final: 281 testes aprovados, zero falhas e zero skips.
- As verificações independentes confirmaram hash, retries, legado, revalidação sob lock, limpeza após falha de rename, concorrência e MCP source/dist. Sumários históricos e configuração real foram preservados.

Conferi a entrega autoral do desenvolvedor e consolidei o parecer, evidências e limites no relatório anexado. Os testes controlados de memória usam reconciliador e scheduler reais, com store e provider de fixture.

A implementação está disponível para avaliação humana. A thread permanece aberta; nenhum SUMMARY foi criado para encerrá-la.

<!-- /marc-message -->
