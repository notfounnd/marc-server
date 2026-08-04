# Revisao integral de qualidade e pendencias

## Decisao do arquiteto

A aprovacao anterior cobriu somente as duas tarefas de encerramento, scripts e documentacao. Ela nao deve ser interpretada como aprovacao integral da funcionalidade desenvolvida na thread. A auditoria mARC verifica conformidade dos registros e nao substitui revisao tecnica nem avaliacao do comportamento do produto.

A entrega integral ainda nao esta aprovada. Foram encontrados tres problemas concretos de implementacao e verificacao. A thread deve permanecer aberta.

## Delimitacao confirmada pelo usuario

O usuario complementou que a versao atual do motor de busca deve ser mantida. Esta revisao nao reabre calibragem, escolha de modelos, retrieval, reranking, pesos ou arquitetura de busca. Os erros historicos de relevancia sao limitacoes conhecidas a distinguir de defeitos de implementacao.

Nao e necessario obter perfeicao semantica em todas as consultas para manter a decisao tomada. E necessario que a implementacao respeite seus contratos e que as evidencias de validacao nao produzam uma aprovacao enganosa.

## Fontes e abrangencia

- Releitura da thread completa, com 17 mensagens, ate msg_db65f9d2ddd341b3b6.
- Confronto dos planos estrutural, interpretacao e recuperacao hibrida com os contratos atuais. Contratos substituidos nao foram cobrados como se continuassem vigentes.
- Revisao por context-mode da recuperacao e consolidacao por thread, elegibilidade semantica, apoio lexical, interpretacao conservadora, indexacao de summaries, geracoes de rebuild, locks, lifecycle dos workers, sanitizacao e estado de busca da UI.
- Revisao dos testes relacionados a esses contratos e do script de avaliacao com modelos reais.
- Releitura da avaliacao historica de 30 consultas, distinguindo suas limitacoes da aprovacao tecnica da implementacao.
- Consulta de status atual confirmou memoria ready, 38 summaries indexados, tres modelos preparados e zero bytes recuperaveis informados pelo inventario.

Nao foram alterados codigo, modelos, configuracoes nem indice de memoria durante esta revisao. As reproducoes abaixo usaram leitura do codigo compilado, simulacao em memoria ou um comando de avaliacao sem casos selecionados.

## Achados

### P1. Purge decide a geracao protegida antes de adquirir o lock

Local principal: src/core/memory/operations.ts, linha 141. Remocao das geracoes: src/core/memory/lancedb-store.ts, linhas 180 a 188.

purgeMemoryInWorkspace le o manifesto e captura manifest.generation antes de tentar adquirir memory-operation. A callback protegida reutiliza esse snapshot, sem reler o manifesto.

Intercalacao valida:

1. Purge le a geracao A.
2. Um rebuild concorrente termina de publicar B e libera o lock.
3. Purge adquire o lock e continua considerando A como ativa.
4. LanceDB remove as tabelas gerenciadas diferentes de A, incluindo B, que agora e a geracao realmente ativa.

Foi executada reproducao isolada contra purgeMemoryInWorkspace do build atual. As chamadas de filesystem foram substituidas em memoria, sem escrita em disco. A promocao concorrente foi simulada no intervalo entre leitura do manifesto e aquisicao do lock. Resultado observado: generation-new era a geracao corrente, mas o purge recebeu generation-old como protegida e selecionou generation-new para remocao.

Impacto: a base ativa derivada pode ser apagada, deixando um manifesto que aponta para uma tabela inexistente. O Markdown fonte permanece intacto, mas a funcionalidade exige recuperacao por rebuild. Nao foi reproduzido apagamento na base real do usuario.

Correcao atomica proposta: ler o manifesto dentro da callback que detem memory-operation e acrescentar teste deterministico da intercalacao. Nao muda o motor nem o contrato publico de purge.

### P2. Deep considera profundidade configurada como profundidade executada

Locais: src/ui/memory-search-depth.ts, linha 22, e src/ui/use-memory-search.ts, linhas 163, 194 a 210 e 230 a 235.

A busca automatica para ao primeiro resultado. Entretanto, o estado salvo mantem configuredDepth, e nextMemorySearchDepth calcula configuredDepth + manualDeepRetries + 1. O estado nao registra o ultimo depth realmente executado.

Caso observado por confronto do fluxo e reproducao com as funcoes atuais:

- Configuracao com tres retries automaticos.
- A primeira chamada, depth 0, retorna resultados e encerra o loop.
- O estado continua com configuredDepth igual a 3.
- nextMemorySearchDepth retorna undefined e o botao Deep fica indisponivel, embora depths 1 a 3 nao tenham sido executados.

Com configuredDepth igual a 1 e resultado no depth 0, a primeira acao manual pula diretamente para depth 2. Isso tambem diverge da progressao baseada na busca efetivamente realizada.

Impacto: o usuario perde acesso a niveis nao explorados, contrariando o requisito de manter Deep disponivel enquanto o ultimo nivel nao tiver sido executado.

Correcao atomica proposta: registrar ultimo depth executado como estado da busca, separado do limite configurado de retentativas automaticas. Cobrir early success, esgotamento automatico, nova consulta, busca alternativa, persistencia por workspace e acao manual. Preservar os pools de candidatos e o ranking do motor.

### P2. Harness pode aprovar uma rodada que nao executou consultas

Locais: scripts/memory-quality-v4.ts, linhas 241 a 246 e 224 a 238.

selectedCases filtra familia e consulta sem rejeitar selecao vazia. Sem casos, nao ha failures e o script termina com codigo zero.

Comando de reproducao executado via context-mode:

```bash
pnpm run memory:quality -- --workspace C:/Projetos/marc --family __review_nonexistent_family__
```

Resultado observado:

- exitCode igual a 0.
- caseCount igual a 0.
- failures vazio.
- meanNdcgAt10, meanReciprocalRank e meanRecallAt10 iguais a zero.
- eligibilityPrecision e eligibilityRecall iguais a 1.

Impacto: um erro de digitacao no filtro pode gerar falsa evidencia de aprovacao. Isso prejudica diretamente o loop de qualidade, mesmo sem alterar resultados da busca.

Correcao atomica proposta: rejeitar selecao vazia com erro explicito e teste, antes de qualquer inferencia. Manter as metricas existentes; distinguir ausencia de amostra de aprovacao.

## Bateria com modelos reais

Foi iniciada pnpm run memory:quality contra a geracao atual, sem benchmark de modelos alternativos, download ou rebuild. A chamada RPC de context-mode atingiu timeout de 300 segundos antes de entregar o relatorio.

O timeout nao foi tratado como falha de relevancia, SLA ou aprovacao. A rodada e inconclusiva. O processo pnpm ficou ativo sem canal de retorno do relatorio e foi identificado pelo comando exato. Sua arvore exclusiva de validacao foi encerrada. Daemon, MCP, UI e subagentes nao foram encerrados por esta acao. Foi verificada a ausencia do comando residual memory:quality.

Uma futura execucao deve usar um canal de acompanhamento que preserve o resultado de uma rodada longa, ou unidades sequenciais delimitadas por familia e depth. A duracao nao e gate de qualidade.

Os 185 testes, validate e build aprovados na rodada anterior permanecem evidencias validas de verificacao automatizada. Nao substituem a bateria real nem eliminam os achados acima.

## Limites conhecidos do motor preservado

A rodada historica teve 27 de 30 consultas no Top-1 e 28 de 30 no Top-10. Registrou uma consulta implicita vazia, uma thread esperada na posicao 7 e uma consulta alterada pelo interpretador sem recuperar a thread esperada.

Essas observacoes nao foram reclassificadas como novas regressoes nesta revisao. Nao foi obtido novo relatorio completo para comparar a relevancia atual. Elas permanecem contexto para estudos posteriores, sem reabertura automatica da arquitetura aceita.

## Crivo do loop

1. Avaliar a entrega acumulada contra objetivos e decisoes vigentes da thread, nao apenas a ultima tarefa.
2. Separar conformidade dos registros, verificacao automatizada, revisao de codigo e avaliacao empirica do produto.
3. Registrar achados com reproducao, impacto e escopo de correcao.
4. Delegar correcoes como atividades atomicas, com bootstrap confirmado antes das edicoes.
5. Revisar as correcoes e devolver ao mesmo desenvolvedor quando o criterio nao for atendido.
6. Repetir a validacao pertinente e apresentar a entrega ao usuario somente depois do aceite tecnico do arquiteto.
7. Aguardar a revisao do usuario antes do fechamento efetivo da thread.

O backlog desta revisao contem somente os tres achados descritos. Nao inclui nova versao do motor de busca. Nenhuma correcao foi implementada nesta rodada de revisao.
