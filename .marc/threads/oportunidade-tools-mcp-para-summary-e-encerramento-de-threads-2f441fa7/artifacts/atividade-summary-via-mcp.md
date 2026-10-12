# Entrega integrada e revisão técnica — SUMMARY via MCP

A implementação permite criar e revisar sumários por `thread_write_summary`, com cabeçalho gerenciado pelo core e corpo Markdown escrito pelo agente. A composição reutiliza a orientação compartilhada do harness, incluindo síntese inicial e áreas flexíveis. Após o feedback sobre testes, a entrega usa fixtures declarativas e a suíte completa executa 281 testes sem falhas ou skips. O estado integrado está tecnicamente aprovado; aceitação humana e autorização de encerramento permanecem separadas. Esta thread continua aberta.

## Escopo, fontes e responsabilidade

Workspace `marc-dd422176e1`, em `C:\Projetos\marc`. Thread fonte:
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7

Foram considerados o pedido original, as decisões e o exemplo aprovados, `plano-summary-via-mcp.md`, `plano-correcao-fixtures-summary.md`, `AGENTS.md`, bootstrap e Custom Rules completos, README, documentação de workflows, arquitetura, MCP, memória e UI, e ADRs de fonte Markdown, bootstrap, roteamento, regras gerenciadas e localização. A inspeção e a revisão de saídas utilizaram context-mode; comandos em Bash, sem Git.

Para a correção, `memory_recall` identificou a decisão histórica abaixo. O principal leu a thread completa, seu comentário `msg_6673c675ec544e70b5`, o plano de testabilidade, o parecer final e as fontes aplicáveis. Foi reutilizado o padrão de dependência interna mínima com Node como padrão e metadados declarativos, preservando a implementação anterior.
marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa

O principal reutilizou `codex-software-architect`; o executor `/root/summary_lifecycle` reutilizou `codex-dev`. As configurações gpt-6.1-sol/high e gpt-6-luna/xhigh foram confirmadas pelo humano; não houve alegação de introspecção do runtime. O trial continuou sequencial com um developer. Seu bootstrap independente e `OK_BOOTSTRAP` foram conferidos antes da autorização explícita de edição. As ampliações de escopo ficaram limitadas ao rename interno, remoção do skip condicional de dist e dois arquivos de teste para respeitar `max-lines`.

O principal conferiu a autoria, a metadata e a consistência das entregas do executor com os arquivos e checks. A entrega original corresponde à implementação; a segunda registra a correção e mantém a revisão principal separada:
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7/#msg_ffac6f4c475e4d5e9f
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7/#msg_6b8298dfcfc544ddb2

## Resultado e documentação

`create`, o modo padrão, grava `SUMMARY.md` e produz o estado fechado. `update` exige uma revisão SHA-256 válida e preserva a data de fechamento. Conteúdo equivalente retorna `unchanged` antes da comparação com a revisão corrente. Conteúdo diferente exige a revisão dos bytes atuais. A criação para encerrar uma thread depende da autorização humana no fluxo do agente; a ferramenta não acrescenta gate editorial ou de aprovação.

O core deriva o título de `CHAT.md` e escreve `Thread`, `Closed` e o separador. O corpo conserva sua formatação intencional, com normalização de finais de linha e remoção apenas de linhas vazias externas. A síntese e as áreas flexíveis são orientadas em `docs/agent-workflows.md#closing-threads`; a gama de recursos Markdown permanece em `#shared-message-format`. As demais orientações referenciam essa fonte comum. Não há títulos ou número obrigatório de seções, geração por LLM ou tradução automática.

README, contrato MCP, arquitetura, documentação de memória e nota de migração foram atualizados para o comportamento implementado. Helper, descrição da ferramenta, regras e recomendações gerenciadas apontam para a composição canônica. O catálogo público tem 25 ferramentas, preservando protocolo `2026-07-28`, bootstrap, coordenação, limites, cancelamento e encerramento do processo.

Na correção, os cenários de links passaram a fornecer somente `lstat` e `realpath` por uma fixture tipada. A implementação Node continua sendo o padrão. Dependências por chamada delimitam metadados, rename e projeções; não foram expostas no MCP ou na fachada pública. A falha de rename mantém escrita e limpeza reais do temporário. A corrida de projeção usa um store controlado por instância, sem patches globais ou polling. O scheduler de memória continua real, com store e provider controlados nos testes.

A regra geral de testes foi registrada somente em `.marc/RULES.md:169`, sob Custom Rules. A revisão do harness confirmou essa autoridade. A geração oficial pelo MCP dist preservou o bloco inteiro de Custom Rules; uma segunda atualização não modificou arquivos. Nenhuma regra concorrente foi criada em outros documentos.

## Validação e limites

Classificação: entrega mista com código executável, testes e contrato de parsing/persistência, além de documentação e harness. Foram exigidos os três checks completos, checks focados e revisão independente. Resultados finais substituem os antigos 269/267/0/2.

| Check | Resultado verificado |
| --- | --- |
| `pnpm validate`, executor | Exit 0; lint, Prettier e typecheck. A primeira execução apontou dois arquivos acima de `max-lines`; os dois splits autorizados resolveram a falha, sem relaxar lint. |
| `pnpm build`, executor | Exit 0; dist construído. Permanece o aviso de chunk grande do Vite. |
| `pnpm test`, executor | Exit 0; 281 testes, 281 aprovados, 0 falhas, 0 skips. |
| `pnpm test`, principal | Exit 0; repetição independente no estado final: 281/281/0/0, em 31,6 segundos, stderr vazio. |
| Core SUMMARY focado, executor | Exit 0; 31 aprovados, 0 falhas, 0 skips. |
| MCP lifecycle/version-pin/protocol focado, executor | Exit 0; 16 aprovados, 0 falhas, 0 skips. |
| AST dos testes e fixtures, principal | 16 arquivos e 2 scripts embutidos: nenhum `if`, `switch`, ternário, CatchClause, skip/todo ou patch global. Nenhuma seleção de cenário foi transferida ao transport compartilhado. |
| AST dos módulos de implementação, principal | Nenhum `else` ou `if` aninhado nos seis módulos revisados; guards e dispatch preservados. |
| Driver independente de metadados e IO | Exit 0; revalidação sob lock real, falha de rename após escrita real, limpeza do temporário, bytes/mtime originais preservados e lock liberado. |
| Driver independente de corrida do índice | Exit 0; segundo commit ocorre enquanto o primeiro snapshot está bloqueado; cache final e ambos os resultados de projeção são coerentes. Sem patches globais ou polling. |
| Driver independente do core | Exit 0; 12 critérios de Markdown, hash, datas, retries, concorrência, isolamento e legado. |
| MCP stdio source e dist, principal | Exit 0 em ambos; 25 ferramentas, bootstrap, create, leitura com revisão, update e conflito de revisão. |
| Recomendações oficiais dist, principal | Exit 0; orientação atual, Custom Rules preservadas byte a byte e segunda atualização idempotente. |
| Escopo e preservação, principal | Hash conjunto dos 248 arquivos protegidos, dos 50 summaries históricos e da configuração real idênticos ao baseline da correção. Exemplo aprovado com hash original. |
| Auditoria estrutural, principal | Escopos rules, artifacts, references e messages: zero findings após consolidar os arquivos e conferir a metadata já anexada. Não substitui a revisão técnica abaixo. |

O RED de metadados foi comportamental: antes da dependência, a fixture esperava rejeições em uma workspace física válida, mas o core aceitava os caminhos. Após a integração, os mesmos cenários passaram. A matriz inclui links e escapes em `.marc`, `threads`, diretório da thread, `CHAT.md` e `SUMMARY.md`, ausência válida de SUMMARY e erros de acesso pertinentes.

Uma falha do teste MCP foi corrigida sem mudar o servidor: `send()` observa a escrita em stdin, portanto destruir stdout não implica rejeição desse método. O cenário verifica a requisição, saída limpa e remoção de heartbeat, preservando PUT/DELETE, autorização e caminho da lease. O caso isolado, a suíte focada e as duas suítes completas finais passaram. O `.catch()` preexistente de recebimento no teste de protocolo foi preservado; ele não seleciona cenário nem pula suas assertions de encerramento.

Ambiente: Windows, Node.js `22.20.0` e pnpm `10.10.0`. Os cenários declarativos não exigem privilégios de symlink. Junções físicas, arquivos, escrita atômica, locks e processos separados permanecem exercitados. Não se alega criação física de symlink de arquivo, execução em outro sistema operacional ou LanceDB real nos dois cenários controlados de memória. Neles, reconciliador, scheduler, rebuild incremental, corpus e manifesto são reais; store e vetores são fixtures, sem download ou inferência.

A verificação visual anterior por Playwright CLI permanece aplicável: título, separador, síntese, listas, destaque, citação, tabela, código, referências e navegação funcionaram. A correção não alterou UI ou renderer. Captura: `C:\Users\junior\AppData\Local\Temp\marc-summary-ui-review-20261012\summary-format.png`. Browser e daemon temporários foram encerrados; o daemon real não foi reiniciado.

## Revisão final integrada do principal

O parecer abrange todo o estado autorizado após a última edição de implementação: lifecycle, parsing/rendering, validação física, IO/locks, projeções, facade/MCP, testes, documentação, harness e registros. Os arquivos protegidos foram comparados ao estado anteriormente revisado; os novos pontos de dependência e testes foram inspecionados diretamente. A aprovação decorre da avaliação abaixo, complementada pelos checks, e substitui o parecer anterior para este novo estado.

| Critério | Avaliação da implementação e evidência |
| --- | --- |
| Cabeçalho e corpo aprovados | `thread-summary-markdown.ts:12` mantém título de CHAT, referência e data, com corpo livre. A orientação compartilhada define composição sem impor um template. Driver com Markdown rico e verificação visual confirmam a separação. |
| Revisão e idempotência | `thread-summary.ts:196` reconhece conteúdo equivalente antes do conflito, conserva bytes/mtime e exige revisão corrente para mudança. `thread-summary-paths.ts:128` calcula SHA-256 dos bytes lidos. Driver e processos concorrentes confirmam retry equivalente e uma única atualização vencedora. |
| Leitura e legado | A leitura expõe corpo e revisão do mesmo snapshot e omite revisão sem summary. O parser delimita o cabeçalho inicial, rejeita metadados inválidos e usa mtime anterior quando Closed falta. Equivalência preserva o arquivo legado; somente mudança intencional canonicaliza. Os 12 critérios independentes incluem código com metadados aparentes no corpo. |
| Segurança de caminhos | `thread-summary-paths.ts:40` preserva validação dos componentes, arquivos regulares e containment. `thread-summary.ts:72` propaga o mesmo reader no preflight, dentro do lock, nas leituras e antes de persistir. A fixture fornece metadados, não a decisão de validação. O driver confirmou rejeição sob lock real, sem fonte ou lock residual. |
| Persistência e concorrência | `thread-summary.ts:250` usa a escrita atômica e `write-coordination.ts:98` injeta somente rename. mkdir, temporário, escrita e limpeza permanecem reais. Falha preserva o arquivo anterior e libera o lock. Os testes mantêm mensagens/artifacts concorrentes e processos com PIDs distintos, resultado e hash explícitos. |
| Projeções coerentes | `workspace-status.ts:49` reconcilia diretamente sob o lock do índice após liberar o da thread. O store por chamada não muda caches globais. Corridas de uma e duas threads e falha real de projeção confirmam resultado verdadeiro e fonte preservada, evitando resultado otimista de snapshot coalescido. |
| Memória e integração | `workspace-status.ts:82` aceita uma instância real por chamada e conserva o reconciliador padrão. Auto-off durante preparação não inicia outro job; auto-on elegível realiza exatamente um rebuild incremental, com manifesto atualizado e nenhuma preparação/query adicional. Engine, corpus, schema, ranking e identidade de embeddings permanecem fora da correção. |
| Testes sem adaptação de cenário | Os 16 arquivos e 2 scripts não contêm as construções condicionais proibidas. Metadados e erros são declarados; métodos de providers evitam branches herdados para escolher resultados. Nenhum privilégio ausente causa skip. A suíte inteira executou 281 casos nas duas verificações finais. |
| MCP e documentação | O schema/facade público não recebeu dependências de teste. Processos oficiais novos source/dist confirmam a ferramenta e 25 entradas, com bootstrap e erros públicos. O protocolo e o transport compartilhado foram preservados. Docs e exemplos permanecem coerentes com o comportamento e a orientação comum. |
| Autoridade e manutenção | A composição comum é obrigatoriamente reutilizada, e a regra de testes reside em Custom Rules. Módulos pequenos e splits coesos atendem ao limite de linhas sem exceções. As dependências são locais e tipadas, sem framework de filesystem, patches globais ou configuração adicional. |

Achados materiais foram resolvidos: skips por privilégios, condicionais nos cenários e scripts, patches globais de IO, propagação incompleta do reader, target de containment inadequado na fixture, branches herdados do provider, arquivos de teste acima do limite e expectativa incorreta de rejeição de stdin. A revisão não encontrou mudança necessária adicional de implementação. Os limites de integração física e plataforma estão declarados, sem serem apresentados como cobertura executada.

O escopo executável final corresponde a 35 caminhos da entrega: os 31 originais, a alteração autorizada em `write-coordination.ts` e três novos arquivos de teste/fixture. As atualizações canônicas do harness e os artefatos foram conferidos separadamente. Não houve mudança em dependências, lockfile, UI, scripts, engine de memória, configuração real ou summaries históricos. Os efeitos de lint/formatter ficaram no escopo autorizado.

**Veredito: aprovado tecnicamente.** O resultado atende ao plano original e à correção exigida, preserva as fronteiras de persistência e autoridade e possui evidência independente para comportamento e falhas relevantes. A entrega autoral do executor foi conferida; correções editoriais de idioma, contagem da análise estática e descrição do bootstrap não alteram esse estado executável. Não há correção de implementação pendente. Auditoria estrutural continua sendo uma verificação complementar, não a origem deste parecer.

## Continuidade e estado humano

O exemplo aprovado permanece anexado e preservado, com SHA-256 `0b8b44fa64b2f3ae44498ec1309361a5226219e6b36f358528ae423295f2a8f3`. O protótipo temporário foi removido depois da comparação. A migração em lote de cabeçalhos históricos foi registrada separadamente:
marc://$oportunidade-migracao-de-cabecalhos-de-summaries-com-previas-3c4dda95

Os processos novos source/dist foram validados. A conexão MCP anterior da sessão necessita reconexão para carregar a ferramenta nova; nenhum serviço do usuário foi reiniciado automaticamente.

A implementação está pronta para avaliação humana. Aprovação técnica não equivale à aceitação nem à autorização de encerramento. Não foi criado `SUMMARY.md` nesta thread.
