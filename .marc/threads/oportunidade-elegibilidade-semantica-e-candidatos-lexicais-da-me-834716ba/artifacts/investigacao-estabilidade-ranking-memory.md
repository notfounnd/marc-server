# Investigacao de estabilidade e ranking da memory

## Objetivo

Explicar por que consultas sem reindexacao passaram a retornar resultados incoerentes, especialmente nos casos `brutal` e `interface com brutalism`.

## Reproducao

O indice estava pronto, com 38 sumarios e 241 records vetoriais. A UI e a tool MCP reproduziram o mesmo comportamento.

| Consulta | Profundidade | Resultado observado |
| --- | ---: | --- |
| `brutal` | Edge | Nenhum resultado |
| `brutal` | Deep 1 | Documentacao do projeto e README encantador |
| `interface com brutalism` | Edge | Estilo neo-brutalism para a UI em primeiro |
| `interface com brutalism` | Deep 1 | Processamento em background para gerar memory acima de Estilo neo-brutalism para a UI |
| `brutalism` | Edge | Estilo neo-brutalism para a UI em primeiro |

## Evidencia de recuperacao vetorial

Para `interface com brutalism`, os seis melhores chunks densos pertencem a Estilo neo-brutalism para a UI, com scores entre 0.861859 e 0.842454. O resumo global da thread falsa Processamento em background para gerar memory aparece apenas na posicao 197, com 0.795378.

A recuperacao vetorial ja localiza o contexto correto. O falso positivo so entra quando a profundidade inclui o resumo global duplicado.

## Causa combinada

### Corpus inadequado ao reranker

O corpus atual inclui um chunk do sumario inteiro e outro chunk de cada secao do mesmo documento. O reranker mMARCO foi treinado para comparar consulta com passagens. Resumos inteiros excedem o contexto util de 512 tokens e disputam com secoes que repetem o mesmo conteudo.

### Reranker quint8 instavel por lote

A mesma consulta e os mesmos dois documentos receberam scores diferentes ao alterar apenas a composicao do lote:

| Execucao | Resumo neo-brutalism | Resumo processamento |
| --- | ---: | ---: |
| Cada documento isolado | 0.286995 | 0.297829 |
| Lote com dois documentos | 0.208619 | 0.248602 |
| Lote misto de quatro documentos | 0.289976 | 0.299690 |

A repeticao do mesmo lote foi deterministica. A variacao ocorre entre tamanhos e composicoes de lote. O teste com `padding: "max_length"` apresentou a mesma variacao, portanto padding dinamico nao e a causa isolada.

A variante `model_quint8_avx2.onnx` nao e adequada para ordenar resultados. O modelo O4 da mesma familia e a variante escolhida para a proxima iteracao.

## Latencia observada

Depois de aquecido, `brutalism` levou aproximadamente 10.8 segundos e `interface com brutalism` levou 15.7 segundos no Edge e 19.3 segundos no Deep 1.

Os workers sao reutilizados pelo singleton durante o TTL de 30 segundos. A latencia percebida nao prova novo carregamento do modelo. O custo vem do reranking atual, que processa ate 100 candidatos no Edge e 200 no Deep e reutiliza o batch de embedding configurado pelo usuario, atualmente 4, tambem como batch do reranker.

## Decisoes para a correcao

- Trocar o reranker ativo para `model_O4.onnx`, sem fallback para quint8.
- Reconstruir o corpus em passagens tokenizadas, sem chunk global de sumario.
- Reter no maximo tres passagens vetoriais por thread antes do reranking.
- Consolidar a pontuacao por thread com RRF entre rank denso e rank do reranker.
- Separar o batch interno do reranker do batch configuravel de embeddings.
- Calibrar a elegibilidade com benchmark deterministico e manter `brutal` conservador, sem falsos positivos.
