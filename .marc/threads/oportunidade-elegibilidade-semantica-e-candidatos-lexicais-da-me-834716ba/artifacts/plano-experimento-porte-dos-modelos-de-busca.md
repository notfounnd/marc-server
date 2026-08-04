# Plano experimental - impacto do porte dos modelos na qualidade da busca

## Hipótese

Os modelos atuais podem estar limitando a discriminação entre assunto principal, contexto relacionado e menção incidental. A hipótese será testada separando o efeito do retriever e do reranker.

## Matriz de comparação

| Perfil | Retriever | Reranker |
| --- | --- | --- |
| baseline | Xenova/multilingual-e5-small int8 | cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 O4 |
| retriever-base | Xenova/multilingual-e5-base int8 | mMARCO atual |
| reranker-bge | E5 small atual | onnx-community/bge-reranker-v2-m3-ONNX int8 |
| base-bge | E5 base int8 | BGE reranker v2 M3 int8 |

O E5 base possui embeddings de 768 dimensões e artefato ONNX int8 de aproximadamente 278 MB. O BGE reranker v2 M3 possui suporte multilíngue, licença Apache-2.0 e artefato ONNX int8 de aproximadamente 571 MB.

## Isolamento

- Não alterar o índice LanceDB usado pelo daemon.
- Ler os registros atuais apenas como texto e metadados.
- Regenerar todos os vetores em uma store isolada para cada perfil.
- Executar cada perfil em um processo Node separado.
- Encerrar o processo depois do relatório para liberar integralmente as sessões ONNX.
- Manter os caches experimentais separados e identificáveis.
- Não promover automaticamente nenhum modelo para produção.
- Não alterar corpus, chunking, consultas, profundidades, fusão ou elegibilidade durante a comparação.

## Harness

O harness deve reutilizar a mesma fonte de casos e julgamentos da bateria atual. Não haverá duplicação de consultas ou expectativas.

Cada perfil deverá registrar:

- nDCG@10;
- MRR;
- recall@10;
- precisão e recall de elegibilidade;
- violações de abstenção;
- resultados incidentais elegíveis;
- ranking por consulta;
- tempo de preparação a frio;
- tempo de embedding do corpus;
- tempo por consulta;
- tempo de consulta com modelo quente;
- pico de RSS;
- bytes ocupados pelo cache do perfil.

## Desenvolvimento

1. Extrair casos, julgamentos e cálculo de métricas do script atual para um módulo reutilizável.
2. Preservar a execução atual de `memory:quality` sem mudança de comportamento.
3. Criar contratos de configuração somente para o benchmark.
4. Criar connector experimental de embedding com modelo, variante, dimensões e cache próprios.
5. Criar connector experimental de reranking com modelo, variante e cache próprios.
6. Criar runner de um único perfil com store em memória.
7. Criar orquestrador que execute cada perfil em processo independente.
8. Produzir relatório comparativo estruturado.
9. Adicionar testes para seleção de perfil, isolamento de cache, dimensões e agregação dos relatórios.
10. Executar primeiro baseline, retriever-base e reranker-bge.
11. Executar base-bge para confirmar interação entre os componentes.
12. Comparar resultados e decidir se algum perfil merece uma proposta de promoção.

## Critérios de aceite

Um perfil candidato precisa:

- não regredir nenhuma invariante das famílias existentes;
- superar o baseline nas métricas agregadas;
- reduzir ou preservar o número de resultados incidentais elegíveis;
- preservar abstenções negativas;
- carregar e executar sem falha de alocação;
- apresentar pico de memória compatível com uma máquina de 8 GB;
- justificar o custo adicional de disco e latência com ganho mensurável de qualidade.

Se nenhum perfil cumprir os critérios, os modelos atuais permanecem e a próxima investigação volta para recuperação híbrida, chunking ou arquitetura de consolidação.

## Limpeza e promoção

Caches experimentais não serão tratados como modelos ativos pela manutenção de produção. Ao fim da comparação, o relatório indicará o espaço utilizado e a limpeza será executada antes da conclusão, salvo se um perfil precisar ser preservado para uma promoção aprovada.

A troca de modelo de produção será uma decisão posterior, baseada nos resultados. Ela deverá atualizar contrato, status, preparo, purge, testes, documentação e exigir rebuild completo da memory.
