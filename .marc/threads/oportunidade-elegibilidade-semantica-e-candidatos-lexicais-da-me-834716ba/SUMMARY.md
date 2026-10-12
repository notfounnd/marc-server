# Oportunidade - Elegibilidade semântica e candidatos lexicais da memory

Thread: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba

Closed: `2026-10-08T22:39:53Z`

---

## Resultado

Concluída a evolução da busca contextual de summaries e o loop de encerramento. A versão atual do motor foi preservada por decisão explícita do usuário. As correções de implementação passaram pelo crivo independente do arquiteto, pela validação automatizada e pelo smoke test do usuário após restart.

O aceite não declara perfeição semântica em todas as consultas. As limitações empíricas continuam documentadas nos anexos, sem alterar julgamentos ou recalibrar o motor apenas para tornar testes verdes.

## Arquitetura consolidada

- Summaries Markdown de threads fechadas permanecem fonte de verdade. Índice LanceDB, manifesto e snapshots da UI são derivados.
- Interpretação conservadora local com onnx-community/LFM2.5-350M-ONNX, recuperação com Xenova/multilingual-e5-small e reranking com cross-encoder/mmarco-mMiniLMv2-L12-H384-v1.
- Recuperação por campos de identidade e passagens, com candidatos densos e lexicais consolidados por thread. Match literal ajuda a encontrar candidatos, mas não concede elegibilidade semântica sozinho.
- Contrato de recuperação field-aware-hybrid-v2 e schema de índice 6 mantidos na rodada final.
- Profundidades 0, 1, 2 e 3 ampliam os pools de candidatos por canal para 100, 200, 300 e 400. Não relaxam a elegibilidade; minScore não faz parte do contrato atual.
- UI solicita limit 50; MCP preserva seu default de 5.
- Workers de inferência, processamento limitado em batches, lock compartilhado de manutenção e caminhos incremental/full foram considerados na revisão integral. Não foram reabertos nesta rodada final.

## Interpretação e experiência de busca

- Correções selecionadas quando a grafia original está ausente do corpus podem se tornar query efetiva. Se a grafia original está presente, a alternativa é apresentada como sugestão, preservando a consulta literal.
- Alternativas de busca aparecem com apenas o termo sublinhado, sem botão em caixa e com tipografia auxiliar consistente.
- Selecionar uma alternativa inicia nova busca literal em depth 0.
- A primeira chamada interpreta a consulta; retries reutilizam a query efetiva em modo literal, sem alterar sua interpretação.
- Configuração de retries automáticos e progresso executado são estados distintos. O loop automático para no primeiro resultado.
- Deep permanece disponível enquanto houver nível não executado, avanca exatamente um nível e desaparece depois do último.
- Nova consulta reinicia em 0. Reload restaura o progresso concluído da última busca da workspace, sem executar uma chamada automaticamente.
- Snapshots localStorage do schema 5 preservam lastExecutedDepth. Dados legados sem essa evidência são descartados conservadoramente. Respostas obsoletas não substituem estado de outra consulta ou workspace.
- Textos de produto seguem o catálogo de localização en-US existente.

## Modelos e sanitização

- Preparação local dos três modelos e manutenção manual permanecem acessíveis em workspace settings.
- Purge preserva a geração ativa e os modelos selecionados, remove recursos gerenciados não utilizados e apresenta inventário/espaço liberado.
- A revisão identificou uma corrida em que purge capturava o manifesto antes do lock e poderia preservar a geração errada.
- A leitura do manifesto agora ocorre dentro de memory-operation. O teste determinístico simula publicação concorrente de A para B e confirma preservação de B. Busy não lê manifesto nem remove arquivos.
- Nenhum download, purge ou rebuild da base real foi executado para validar estas correções.

## Loop de revisão e desenvolvimento

O agente principal atuou como arquiteto, com tarefas atômicas delegadas sequencialmente a desenvolvedores gpt-6-luna/xhigh. Cada desenvolvedor confirmou OK_BOOTSTRAP antes da autorização para editar, leu marc-ops e RULES.md, utilizou context-mode e apply_patch e respeitou comandos Bash.

Foram resolvidos os três achados da revisão integral:

1. Snapshot do purge capturado sob o lock, com regressão de concorrência e guards de manutenção.
2. Deep baseado no último nível efetivamente executado, com cobertura de sucesso precoce, reset, persistência, legado e isolamento.
3. Harness rejeita seleção vazia antes de acessar workspace, manifesto ou modelos, incluindo interpret-only.

O seletor puro do harness isola efeitos colaterais para os testes. Análise AST confirmou os 14 casos originais byte-identicos. Família/query exata, combinação de filtros e seleção padrão foram preservadas.

A atribuição de uma entrega a perfil inadequado foi devolvida ao desenvolvedor e corrigida por registro complementar. Artefatos foram registrados pelo MCP. A auditoria enumera anexos Markdown; evidências JSON foram preservadas dentro de anexos .md e os metadados corrigidos, sem alterar seus resultados.

## Documentação e ferramentas

- Revisadas docs/memory.md, docs/architecture.md, docs/mcp-tools.md, docs/ui-and-daemon.md e docs/development.md.
- Removido scripts/memory-quality.ts, obsoleto e sem referência.
- Preservados os três arquivos de benchmark de modelos e scripts/memory-quality-v4.ts. Acrescentado scripts/memory-quality-selection.ts por testabilidade, não por meta de tamanho.
- Backlog de Playwright conferido e atualizado em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a.
- Corrigido o contrato antigo baseado em minScore e acrescentados cenários de progresso, legado, isolamento, links de alternativas e manutenção.
- Cenários de regressão E2E durável continuam pendentes no backlog. Verificações ad hoc e validação do usuário não foram apresentadas como suite automatizada implementada.

## Validação

- pnpm run validate passou, incluindo lint, formato e typecheck.
- pnpm test passou: 198/198 testes, sem falhas ou skips.
- pnpm build passou.
- Verificação independente do purge e coordenação: 15 testes focados passaram.
- Verificação independente da UI: 17 testes focados passaram.
- Verificação independente do harness: 5 testes focados passaram. Quatro chamadas reais em Node com família/query inválidas, com e sem interpret-only, retornaram erro explícito antes de criar workspace.
- Playwright CLI validou desktop 1280x900 e mobile 390x844: sucesso em 0 com limite 3, Deep em 1, reload seguido de 2, esgotamento em 3 e reset em 0 para nova consulta.
- Após restart, MCP e HTTP responderam; JS/CSS servidos coincidiram com o build aprovado. Memória ready com 38 summaries indexados e três modelos preparados antes do fechamento.
- Usuário confirmou busca inicial e três Deep, ocultação no último nível, persistência após reload e novo ciclo ao submeter outra busca.
- Durante a validação do loop, os 35 arquivos protegidos do motor, o manifesto, dependências e configurações permaneceram idênticos.
- Auditoria final dos registros após correção de anexos: zero críticos. Três avisos preexistentes de descrição ausente em perfis antigos permaneceram fora do escopo.
- Validação executada em Windows via Bash. Não foi executada bateria nativa em Linux nesta rodada; as correções usam APIs Node portáveis.

## Avaliação empírica e limites

A bateria real terminou em 32 unidades delimitadas, com 14 consultas em quatro profundidades: 56 casos, 28 aprovados e 28 reprovados nos gates existentes.

- Família brutalism e os dois casos negativos passaram em todos os níveis.
- toggle/toogle ficaram sem o resultado esperado pelos fixtures.
- Security/settings e variantes receberam candidatos adicionais classificados como incidentais pelos julgamentos existentes.
- O timeout de uma tentativa agregada anterior foi tratado como inconclusivo, não como aprovação, e substituido pela bateria completa em unidades delimitadas.
- A avaliação histórica de 30 consultas e esta bateria possuem amostras/critérios diferentes; não devem ser tratadas como medidas diretamente comparáveis de regressão.

Não existe pendência corretiva de implementação neste loop. As limitações do motor preservado e o backlog E2E durável não foram ocultados nem apresentados como resolvidos.

## Evidências

- [Plano do loop](artifacts/plano-loop-correcao-purge-deep-e-harness.md)
- [Revisao integral](artifacts/revisao-integral-qualidade-e-pendencias.md)
- [Aceite tecnico final](artifacts/revisao-final-e-aceite-tecnico-loop.md)
- [Validacao integrada](artifacts/validacao-integrada-final-loop.md)
- [Avaliacao dos 56 casos](artifacts/avaliacao-motor-preservado-56-casos.md)
- [Dados da avaliacao](artifacts/evidencia-motor-preservado-56-casos.md)

## Encerramento e continuidade

Encerramento autorizado pelo usuário após confirmar os testes visíveis no sistema reiniciado. Nenhum código de produto foi alterado no fechamento.

memory.autoRebuild estava false. A criação deste SUMMARY.md acrescenta uma nova fonte ao corpus e pode deixar a memory stale até um rebuild incremental explícito. Não é necessário full rebuild por causa deste fechamento.
