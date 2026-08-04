# Resumo executivo

Thread: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
Closed: `2026-10-08T22:39:53Z`

## Resultado

Concluida a evolucao da busca contextual de summaries e o loop de encerramento. A versao atual do motor foi preservada por decisao explicita do usuario. As correcoes de implementacao passaram pelo crivo independente do arquiteto, pela validacao automatizada e pelo smoke test do usuario apos restart.

O aceite nao declara perfeicao semantica em todas as consultas. As limitacoes empiricas continuam documentadas nos anexos, sem alterar julgamentos ou recalibrar o motor apenas para tornar testes verdes.

## Arquitetura consolidada

- Summaries Markdown de threads fechadas permanecem fonte de verdade. Indice LanceDB, manifesto e snapshots da UI sao derivados.
- Interpretacao conservadora local com onnx-community/LFM2.5-350M-ONNX, recuperacao com Xenova/multilingual-e5-small e reranking com cross-encoder/mmarco-mMiniLMv2-L12-H384-v1.
- Recuperacao por campos de identidade e passagens, com candidatos densos e lexicais consolidados por thread. Match literal ajuda a encontrar candidatos, mas nao concede elegibilidade semantica sozinho.
- Contrato de recuperacao field-aware-hybrid-v2 e schema de indice 6 mantidos na rodada final.
- Profundidades 0, 1, 2 e 3 ampliam os pools de candidatos por canal para 100, 200, 300 e 400. Nao relaxam a elegibilidade; minScore nao faz parte do contrato atual.
- UI solicita limit 50; MCP preserva seu default de 5.
- Workers de inferencia, processamento limitado em batches, lock compartilhado de manutencao e caminhos incremental/full foram considerados na revisao integral. Nao foram reabertos nesta rodada final.

## Interpretacao e experiencia de busca

- Correcoes selecionadas quando a grafia original esta ausente do corpus podem se tornar query efetiva. Se a grafia original esta presente, a alternativa e apresentada como sugestao, preservando a consulta literal.
- Alternativas de busca aparecem com apenas o termo sublinhado, sem botao em caixa e com tipografia auxiliar consistente.
- Selecionar uma alternativa inicia nova busca literal em depth 0.
- A primeira chamada interpreta a consulta; retries reutilizam a query efetiva em modo literal, sem alterar sua interpretacao.
- Configuracao de retries automaticos e progresso executado sao estados distintos. O loop automatico para no primeiro resultado.
- Deep permanece disponivel enquanto houver nivel nao executado, avanca exatamente um nivel e desaparece depois do ultimo.
- Nova consulta reinicia em 0. Reload restaura o progresso concluido da ultima busca da workspace, sem executar uma chamada automaticamente.
- Snapshots localStorage do schema 5 preservam lastExecutedDepth. Dados legados sem essa evidencia sao descartados conservadoramente. Respostas obsoletas nao substituem estado de outra consulta ou workspace.
- Textos de produto seguem o catalogo de localizacao en-US existente.

## Modelos e sanitizacao

- Preparacao local dos tres modelos e manutencao manual permanecem acessiveis em workspace settings.
- Purge preserva a geracao ativa e os modelos selecionados, remove recursos gerenciados nao utilizados e apresenta inventario/espaco liberado.
- A revisao identificou uma corrida em que purge capturava o manifesto antes do lock e poderia preservar a geracao errada.
- A leitura do manifesto agora ocorre dentro de memory-operation. O teste deterministico simula publicacao concorrente de A para B e confirma preservacao de B. Busy nao le manifesto nem remove arquivos.
- Nenhum download, purge ou rebuild da base real foi executado para validar estas correcoes.

## Loop de revisao e desenvolvimento

O agente principal atuou como arquiteto, com tarefas atomicas delegadas sequencialmente a desenvolvedores gpt-6-luna/xhigh. Cada desenvolvedor confirmou OK_BOOTSTRAP antes da autorizacao para editar, leu marc-ops e RULES.md, utilizou context-mode e apply_patch e respeitou comandos Bash.

Foram resolvidos os tres achados da revisao integral:

1. Snapshot do purge capturado sob o lock, com regressao de concorrencia e guards de manutencao.
2. Deep baseado no ultimo nivel efetivamente executado, com cobertura de sucesso precoce, reset, persistencia, legado e isolamento.
3. Harness rejeita selecao vazia antes de acessar workspace, manifesto ou modelos, incluindo interpret-only.

O seletor puro do harness isola efeitos colaterais para os testes. Analise AST confirmou os 14 casos originais byte-identicos. Familia/query exata, combinacao de filtros e selecao padrao foram preservadas.

A atribuicao de uma entrega a perfil inadequado foi devolvida ao desenvolvedor e corrigida por registro complementar. Artefatos foram registrados pelo MCP. A auditoria enumera anexos Markdown; evidencias JSON foram preservadas dentro de anexos .md e os metadados corrigidos, sem alterar seus resultados.

## Documentacao e ferramentas

- Revisadas docs/memory.md, docs/architecture.md, docs/mcp-tools.md, docs/ui-and-daemon.md e docs/development.md.
- Removido scripts/memory-quality.ts, obsoleto e sem referencia.
- Preservados os tres arquivos de benchmark de modelos e scripts/memory-quality-v4.ts. Acrescentado scripts/memory-quality-selection.ts por testabilidade, nao por meta de tamanho.
- Backlog de Playwright conferido e atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a.
- Corrigido o contrato antigo baseado em minScore e acrescentados cenarios de progresso, legado, isolamento, links de alternativas e manutencao.
- Cenarios de regressao E2E duravel continuam pendentes no backlog. Verificacoes ad hoc e validacao do usuario nao foram apresentadas como suite automatizada implementada.

## Validacao

- pnpm run validate passou, incluindo lint, formato e typecheck.
- pnpm test passou: 198/198 testes, sem falhas ou skips.
- pnpm build passou.
- Verificacao independente do purge e coordenacao: 15 testes focados passaram.
- Verificacao independente da UI: 17 testes focados passaram.
- Verificacao independente do harness: 5 testes focados passaram. Quatro chamadas reais em Node com familia/query invalidas, com e sem interpret-only, retornaram erro explicito antes de criar workspace.
- Playwright CLI validou desktop 1280x900 e mobile 390x844: sucesso em 0 com limite 3, Deep em 1, reload seguido de 2, esgotamento em 3 e reset em 0 para nova consulta.
- Apos restart, MCP e HTTP responderam; JS/CSS servidos coincidiram com o build aprovado. Memoria ready com 38 summaries indexados e tres modelos preparados antes do fechamento.
- Usuario confirmou busca inicial e tres Deep, ocultacao no ultimo nivel, persistencia apos reload e novo ciclo ao submeter outra busca.
- Durante a validacao do loop, os 35 arquivos protegidos do motor, o manifesto, dependencias e configuracoes permaneceram identicos.
- Auditoria final dos registros apos correcao de anexos: zero criticos. Tres avisos preexistentes de descricao ausente em perfis antigos permaneceram fora do escopo.
- Validacao executada em Windows via Bash. Nao foi executada bateria nativa em Linux nesta rodada; as correcoes usam APIs Node portaveis.

## Avaliacao empirica e limites

A bateria real terminou em 32 unidades delimitadas, com 14 consultas em quatro profundidades: 56 casos, 28 aprovados e 28 reprovados nos gates existentes.

- Familia brutalism e os dois casos negativos passaram em todos os niveis.
- toggle/toogle ficaram sem o resultado esperado pelos fixtures.
- Security/settings e variantes receberam candidatos adicionais classificados como incidentais pelos julgamentos existentes.
- O timeout de uma tentativa agregada anterior foi tratado como inconclusivo, nao como aprovacao, e substituido pela bateria completa em unidades delimitadas.
- A avaliacao historica de 30 consultas e esta bateria possuem amostras/criterios diferentes; nao devem ser tratadas como medidas diretamente comparaveis de regressao.

Nao existe pendencia corretiva de implementacao neste loop. As limitacoes do motor preservado e o backlog E2E duravel nao foram ocultados nem apresentados como resolvidos.

## Evidencias

- [Plano do loop](artifacts/plano-loop-correcao-purge-deep-e-harness.md)
- [Revisao integral](artifacts/revisao-integral-qualidade-e-pendencias.md)
- [Aceite tecnico final](artifacts/revisao-final-e-aceite-tecnico-loop.md)
- [Validacao integrada](artifacts/validacao-integrada-final-loop.md)
- [Avaliacao dos 56 casos](artifacts/avaliacao-motor-preservado-56-casos.md)
- [Dados da avaliacao](artifacts/evidencia-motor-preservado-56-casos.md)

## Encerramento e continuidade

Encerramento autorizado pelo usuario apos confirmar os testes visiveis no sistema reiniciado. Nenhum codigo de produto foi alterado no fechamento.

memory.autoRebuild estava false. A criacao deste SUMMARY.md acrescenta uma nova fonte ao corpus e pode deixar a memory stale ate um rebuild incremental explicito. Nao e necessario full rebuild por causa deste fechamento.

