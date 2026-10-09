# Investigação de estabilidade e ranking da memory

## Objetivo

Explicar por que consultas sem reindexação passaram a retornar resultados incoerentes, especialmente nos casos `brutal` e `interface com brutalism`.

## Reprodução

O índice estava pronto, com 38 sumários e 241 records vetoriais. A UI e a tool MCP reproduziram o mesmo comportamento.

| Consulta | Profundidade | Resultado observado |
| --- | ---: | --- |
| `brutal` | Edge | Nenhum resultado |
| `brutal` | Deep 1 | Documentação do projeto e README encantador |
| `interface com brutalism` | Edge | Estilo neo-brutalism para a UI em primeiro |
| `interface com brutalism` | Deep 1 | Processamento em background para gerar memory acima de Estilo neo-brutalism para a UI |
| `brutalism` | Edge | Estilo neo-brutalism para a UI em primeiro |

## Evidência de recuperação vetorial

Para `interface com brutalism`, os seis melhores chunks densos pertencem a Estilo neo-brutalism para a UI, com scores entre 0.861859 e 0.842454. O resumo global da thread falsa Processamento em background para gerar memory aparece apenas na posição 197, com 0.795378.

A recuperação vetorial já localiza o contexto correto. O falso positivo só entra quando a profundidade inclui o resumo global duplicado.

## Causa combinada

### Corpus inadequado ao reranker

O corpus atual inclui um chunk do sumário inteiro e outro chunk de cada seção do mesmo documento. O reranker mMARCO foi treinado para comparar consulta com passagens. Resumos inteiros excedem o contexto útil de 512 tokens e disputam com seções que repetem o mesmo conteúdo.

### Reranker quint8 instável por lote

A mesma consulta e os mesmos dois documentos receberam scores diferentes ao alterar apenas a composição do lote:

| Execução | Resumo neo-brutalism | Resumo processamento |
| --- | ---: | ---: |
| Cada documento isolado | 0.286995 | 0.297829 |
| Lote com dois documentos | 0.208619 | 0.248602 |
| Lote misto de quatro documentos | 0.289976 | 0.299690 |

A repetição do mesmo lote foi determinística. A variação ocorre entre tamanhos e composições de lote. O teste com `padding: "max_length"` apresentou a mesma variação, portanto padding dinâmico não é a causa isolada.

A variante `model_quint8_avx2.onnx` não é adequada para ordenar resultados. O modelo O4 da mesma família e a variante escolhida para a próxima iteração.

## Latência observada

Depois de aquecido, `brutalism` levou aproximadamente 10.8 segundos e `interface com brutalism` levou 15.7 segundos no Edge e 19.3 segundos no Deep 1.

Os workers são reutilizados pelo singleton durante o TTL de 30 segundos. A latência percebida não prova novo carregamento do modelo. O custo vem do reranking atual, que processa até 100 candidatos no Edge e 200 no Deep e reutiliza o batch de embedding configurado pelo usuário, atualmente 4, também como batch do reranker.

## Decisões para a correção

- Trocar o reranker ativo para `model_O4.onnx`, sem fallback para quint8.
- Reconstruir o corpus em passagens tokenizadas, sem chunk global de sumário.
- Reter no máximo três passagens vetoriais por thread antes do reranking.
- Consolidar a pontuação por thread com RRF entre rank denso e rank do reranker.
- Separar o batch interno do reranker do batch configurável de embeddings.
- Calibrar a elegibilidade com benchmark determinístico e manter `brutal` conservador, sem falsos positivos.
