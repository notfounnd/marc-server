# Revisão integral de qualidade e pendências

## Decisão do arquiteto

A aprovação anterior cobriu somente as duas tarefas de encerramento, scripts e documentação. Ela não deve ser interpretada como aprovação integral da funcionalidade desenvolvida na thread. A auditoria mARC verifica conformidade dos registros e não substitui revisão técnica nem avaliação do comportamento do produto.

A entrega integral ainda não está aprovada. Foram encontrados três problemas concretos de implementação e verificação. A thread deve permanecer aberta.

## Delimitação confirmada pelo usuário

O usuário complementou que a versão atual do motor de busca deve ser mantida. Esta revisão não reabre calibragem, escolha de modelos, retrieval, reranking, pesos ou arquitetura de busca. Os erros históricos de relevância são limitações conhecidas a distinguir de defeitos de implementação.

Não é necessário obter perfeição semântica em todas as consultas para manter a decisão tomada. É necessário que a implementação respeite seus contratos e que as evidências de validação não produzam uma aprovação enganosa.

## Fontes e abrangência

- Releitura da thread completa, com 17 mensagens, até msg_db65f9d2ddd341b3b6.
- Confronto dos planos estrutural, interpretação e recuperação híbrida com os contratos atuais. Contratos substituídos não foram cobrados como se continuassem vigentes.
- Revisão por context-mode da recuperação e consolidação por thread, elegibilidade semântica, apoio lexical, interpretação conservadora, indexação de summaries, gerações de rebuild, locks, lifecycle dos workers, sanitização e estado de busca da UI.
- Revisão dos testes relacionados a esses contratos e do script de avaliação com modelos reais.
- Releitura da avaliação histórica de 30 consultas, distinguindo suas limitações da aprovação técnica da implementação.
- Consulta de status atual confirmou memória ready, 38 summaries indexados, três modelos preparados e zero bytes recuperáveis informados pelo inventário.

Não foram alterados código, modelos, configurações nem índice de memória durante esta revisão. As reproduções abaixo usaram leitura do código compilado, simulação em memória ou um comando de avaliação sem casos selecionados.

## Achados

### P1. Purge decide a geração protegida antes de adquirir o lock

Local principal: src/core/memory/operations.ts, linha 141. Remoção das gerações: src/core/memory/lancedb-store.ts, linhas 180 a 188.

purgeMemoryInWorkspace lê o manifesto e captura manifest.generation antes de tentar adquirir memory-operation. A callback protegida reutiliza esse snapshot, sem reler o manifesto.

Intercalação válida:

1. Purge lê a geração A.
2. Um rebuild concorrente termina de publicar B e libera o lock.
3. Purge adquire o lock e continua considerando A como ativa.
4. LanceDB remove as tabelas gerenciadas diferentes de A, incluindo B, que agora é a geração realmente ativa.

Foi executada reprodução isolada contra purgeMemoryInWorkspace do build atual. As chamadas de filesystem foram substituídas em memória, sem escrita em disco. A promoção concorrente foi simulada no intervalo entre leitura do manifesto e aquisição do lock. Resultado observado: generation-new era a geração corrente, mas o purge recebeu generation-old como protegida e selecionou generation-new para remoção.

Impacto: a base ativa derivada pode ser apagada, deixando um manifesto que aponta para uma tabela inexistente. O Markdown fonte permanece intacto, mas a funcionalidade exige recuperação por rebuild. Não foi reproduzido apagamento na base real do usuário.

Correção atômica proposta: ler o manifesto dentro da callback que detém memory-operation e acrescentar teste determinístico da intercalação. Não muda o motor nem o contrato público de purge.

### P2. Deep considera profundidade configurada como profundidade executada

Locais: src/ui/memory-search-depth.ts, linha 22, e src/ui/use-memory-search.ts, linhas 163, 194 a 210 e 230 a 235.

A busca automática para ao primeiro resultado. Entretanto, o estado salvo mantém configuredDepth, e nextMemorySearchDepth calcula configuredDepth + manualDeepRetries + 1. O estado não registra o último depth realmente executado.

Caso observado por confronto do fluxo e reprodução com as funções atuais:

- Configuração com três retries automáticos.
- A primeira chamada, depth 0, retorna resultados e encerra o loop.
- O estado continua com configuredDepth igual a 3.
- nextMemorySearchDepth retorna undefined e o botão Deep fica indisponível, embora depths 1 a 3 não tenham sido executados.

Com configuredDepth igual a 1 e resultado no depth 0, a primeira ação manual pula diretamente para depth 2. Isso também diverge da progressão baseada na busca efetivamente realizada.

Impacto: o usuário perde acesso a níveis não explorados, contrariando o requisito de manter Deep disponível enquanto o último nível não tiver sido executado.

Correção atômica proposta: registrar último depth executado como estado da busca, separado do limite configurado de retentativas automáticas. Cobrir early success, esgotamento automático, nova consulta, busca alternativa, persistência por workspace e ação manual. Preservar os pools de candidatos e o ranking do motor.

### P2. Harness pode aprovar uma rodada que não executou consultas

Locais: scripts/memory-quality-v4.ts, linhas 241 a 246 e 224 a 238.

selectedCases filtra família e consulta sem rejeitar seleção vazia. Sem casos, não há failures e o script termina com código zero.

Comando de reprodução executado via context-mode:

```bash
pnpm run memory:quality -- --workspace C:/Projetos/marc --family __review_nonexistent_family__
```

Resultado observado:

- exitCode igual a 0.
- caseCount igual a 0.
- failures vazio.
- meanNdcgAt10, meanReciprocalRank e meanRecallAt10 iguais a zero.
- eligibilityPrecision e eligibilityRecall iguais a 1.

Impacto: um erro de digitação no filtro pode gerar falsa evidência de aprovação. Isso prejudica diretamente o loop de qualidade, mesmo sem alterar resultados da busca.

Correção atômica proposta: rejeitar seleção vazia com erro explícito e teste, antes de qualquer inferência. Manter as métricas existentes; distinguir ausência de amostra de aprovação.

## Bateria com modelos reais

Foi iniciada pnpm run memory:quality contra a geração atual, sem benchmark de modelos alternativos, download ou rebuild. A chamada RPC de context-mode atingiu timeout de 300 segundos antes de entregar o relatório.

O timeout não foi tratado como falha de relevância, SLA ou aprovação. A rodada e inconclusiva. O processo pnpm ficou ativo sem canal de retorno do relatório e foi identificado pelo comando exato. Sua árvore exclusiva de validação foi encerrada. Daemon, MCP, UI e subagentes não foram encerrados por esta ação. Foi verificada a ausência do comando residual memory:quality.

Uma futura execução deve usar um canal de acompanhamento que preserve o resultado de uma rodada longa, ou unidades sequenciais delimitadas por família e depth. A duração não é gate de qualidade.

Os 185 testes, validate e build aprovados na rodada anterior permanecem evidências válidas de verificação automatizada. Não substituem a bateria real nem eliminam os achados acima.

## Limites conhecidos do motor preservado

A rodada histórica teve 27 de 30 consultas no Top-1 e 28 de 30 no Top-10. Registrou uma consulta implícita vazia, uma thread esperada na posição 7 e uma consulta alterada pelo interpretador sem recuperar a thread esperada.

Essas observações não foram reclassificadas como novas regressões nesta revisão. Não foi obtido novo relatório completo para comparar a relevância atual. Elas permanecem contexto para estudos posteriores, sem reabertura automática da arquitetura aceita.

## Crivo do loop

1. Avaliar a entrega acumulada contra objetivos e decisões vigentes da thread, não apenas a última tarefa.
2. Separar conformidade dos registros, verificação automatizada, revisão de código e avaliação empírica do produto.
3. Registrar achados com reprodução, impacto e escopo de correção.
4. Delegar correções como atividades atômicas, com bootstrap confirmado antes das edições.
5. Revisar as correções e devolver ao mesmo desenvolvedor quando o critério não for atendido.
6. Repetir a validação pertinente e apresentar a entrega ao usuário somente depois do aceite técnico do arquiteto.
7. Aguardar a revisão do usuário antes do fechamento efetivo da thread.

O backlog desta revisão contém somente os três achados descritos. Não inclui nova versão do motor de busca. Nenhuma correção foi implementada nesta rodada de revisão.
