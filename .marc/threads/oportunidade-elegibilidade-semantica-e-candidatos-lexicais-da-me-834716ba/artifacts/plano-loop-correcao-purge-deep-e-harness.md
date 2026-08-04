# Plano de correcao e aceite no loop

## Objetivo e limites

Resolver os tres achados da revisao integral da thread 834716ba e concluir o aceite tecnico pelo arquiteto. Preservar a versao atual do motor, modelos, calibragem, canais de retrieval, pesos, elegibilidade e schema. As tarefas corrigem concorrencia de manutencao, progressao da UI e confiabilidade da verificacao.

A aprovacao do usuario para seguir o loop inclui devolver achados aos desenvolvedores ate o aceite tecnico. Nao sera solicitada nova aprovacao entre as tarefas. O fechamento efetivo da thread continua dependendo do feedback do usuario.

## Forma de execucao

- Agente principal responsavel por planejamento, revisao independente, integracao e aceite.
- Desenvolvedores gpt-6-luna com reasoning xhigh.
- Um desenvolvedor ativo por vez, sem paralelismo nesta rodada.
- Cada desenvolvedor le marc-ops, faz workspace_bootstrap, le integralmente RULES.md, docs pertinentes, thread e artefatos desta iteracao.
- Antes de editar, retorna OK_BOOTSTRAP com workspace confirmado, regras compreendidas, fontes lidas e escopo de escrita.
- O arquiteto confere a evidencia e autoriza a edicao. Esperas por aprovacao na TUI nao provocam encerramento do agente.
- Edicoes de codigo e testes via apply_patch. Investigacao e verificacao via context-mode, comandos Bash, sem git ou PowerShell.
- Registros de plano, relatorios e mensagens na thread por ferramentas MCP do mARC, com newlines reais e artefatos nos metadados.
- Cada tarefa termina com testes focados, lista dos arquivos alterados e evidencia. O arquiteto revisa o codigo e o comportamento, devolvendo problemas ao mesmo agente.
- Nenhum agente encerra a thread nem cria SUMMARY.md.

## Tarefa 1. Snapshot do purge sob o lock

Escopo inicial de escrita: src/core/memory/operations.ts e teste de regressao em test/core-memory-maintenance.test.ts, ou arquivo de teste dedicado se a separacao for mais adequada.

Ler o manifesto dentro da callback de memory-operation e usar a geracao obtida sob exclusao mutua. Nao mudar a implementacao lexical, os modelos, o contrato publico do purge ou as regras de remocao de arquivos.

Aceite:

1. Reproducao deterministica falha antes da correcao.
2. Se rebuild publicar B entre inicio do purge e aquisicao do lock, purge preserva B, nao A.
3. Busy continua sem entrar na callback nem fazer remocoes.
4. Ausencia de manifesto mantem o comportamento documentado.
5. O teste usa workspace temporario e nao faz purge na base real.
6. Testes focados de manutencao e coordenacao passam.

## Tarefa 2. Profundidade executada separada da configurada

Escopo inicial: src/ui/use-memory-search.ts, src/ui/memory-search-depth.ts, src/ui/memory-search.ts, tipos pertinentes e testes UI de busca. Alterar somente dependencias diretamente necessarias.

Registrar o ultimo depth realmente executado na busca ativa. A configuracao define o limite da retentativa automatica, nao a profundidade atingida. O proximo Deep manual deve ser o nivel seguinte ao ultimo efetivamente executado. O loop automatico continua parando ao obter resultados.

Aceite:

1. Configuracao 3 com sucesso em 0 mantem Deep disponivel e proxima chamada em 1.
2. Configuracao 1 com sucesso em 0 nao pula diretamente para 2.
3. Esgotamento automatico ate 3 desabilita Deep.
4. Resultado e consulta efetiva permanecem vinculados a busca ativa; nova consulta reinicia em 0.
5. Busca alternativa reinicia em 0 e mantem selecao literal explicita.
6. Estado persistido e isolado por workspace e preserva ultimo depth.
7. Dados legados sem ultimo depth recebem tratamento conservador e testado, sem atribuir arbitrariamente um nivel nao observado.
8. Requisicoes obsoletas nao substituem resultado de outra busca ou workspace.
9. Ranks, pools de candidatos e contrato do backend nao mudam.

## Tarefa 3. Selecao vazia nao aprova o harness

Escopo inicial: scripts/memory-quality-v4.ts e teste focado do comando ou extracao minima de um helper testavel, se indispensavel.

Rejeitar filtro sem casos antes de preparar modelos ou inferir. Informar claramente filtro invalido ou ausencia de casos. Preservar os casos de qualidade, metricas e logica de ranking existentes.

Aceite:

1. Familia desconhecida e consulta sem correspondencia retornam codigo nao zero e erro explicito.
2. Familias e consultas validas selecionam casos.
3. Execucao padrao nao perde casos.
4. Interpret-only tambem rejeita selecao vazia.
5. Nenhum modelo e carregado por uma selecao rejeitada.
6. Teste de regressao reproduz codigo zero antes da correcao e passa depois.
7. Evitar abstrair apenas para satisfazer tamanho de arquivo.

## Revisao e verificacao integrada

Depois de cada tarefa, conferir diferencas e testes do agente por context-mode. Aceite nao se limita a auditoria de registros. Avaliar requisitos, comportamento, isolamento, manutencao, compatibilidade, testes e escopo.

Depois das tres tarefas aprovadas:

- Revisar docs pertinentes e delegar adequacao diretamente ligada as correcoes se necessario.
- Executar pnpm run validate, pnpm test e pnpm build.
- Reexecutar os cenarios do purge, progressao e filtros vazios.
- Acompanhar a bateria existente com modelos reais em unidades sequenciais delimitadas por familia e depth, preservando os resultados entre chamadas para evitar timeout RPC. Nao usar duracao como gate.
- Distinguir falhas atuais do motor aceito de defeitos introduzidos nas correcoes. Limitacoes preexistentes do motor nao autorizam recalibragem.
- Nao baixar modelos, refazer indice, executar purge real ou promover modelo experimental.
- Verificar que manifesto e artefatos ativos de modelos permanecem preservados.
- Registrar relatorio final pelo MCP, depois comentario com metadados, e executar auditoria apos os registros completos.
- Informar se e necessario restart para carregar mudancas de UI e operacoes no daemon/CLI.
- Dar aceite tecnico somente com evidencias suficientes. Entao avisar o usuario e aguardar revisao para fechamento.
