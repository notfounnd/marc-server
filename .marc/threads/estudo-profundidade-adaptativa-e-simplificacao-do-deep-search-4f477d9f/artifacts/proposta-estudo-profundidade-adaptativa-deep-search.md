# Estudo sobre profundidade adaptativa e Deep Search

## Contexto

A busca atual expoe quatro niveis progressivos de profundidade. A interface permite executar uma consulta inicial no Edge e solicitar novas rodadas de Deep Search. O mecanismo amplia a coleta interna de candidatos, mas a elegibilidade semantica continua sendo uma responsabilidade separada.

A rodada reproduzivel de trinta consultas registrada em marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba apresentou:

- Top-1 geral de 27/30, ou 90%.
- Presenca no Top-10 de 28/30, ou 93,3%.
- Consultas diretas com 10/10 no Top-1.
- Consultas indiretas com 9/10 no Top-1.
- Consultas implicitas com 8/10 no Top-1.
- Um caso correto apenas na posicao 7.
- Uma busca vazia.
- Uma busca que retornou somente threads incorretas.

Esses dados indicam que o Edge ja resolve a maioria das consultas. Tambem indicam que os erros restantes nao podem ser atribuidos automaticamente a falta de candidatos. Parte deles envolve elegibilidade, ranking, proveniencia e interpretacao da consulta.

## Pergunta do estudo

O Deep Search deve continuar exposto como interacao progressiva na UI ou a busca deve oferecer uma experiencia unica com profundidade interna moderada ou adaptativa?

## Distincoes necessarias

O estudo deve separar quatro controles que produzem efeitos diferentes:

1. Profundidade da coleta de candidatos.
2. Barreira de elegibilidade semantica.
3. Pesos usados para ordenar candidatos elegiveis.
4. Quantidade de resultados exibidos.

Aumentar candidatos pode melhorar recall. Reduzir elegibilidade pode expor falsos positivos. Aumentar o limite de saida apenas mostra mais resultados e nao melhora a recuperacao.

## Alternativas

### Manter o fluxo atual

- Edge como busca inicial.
- Ate tres Deep retries explicitos.
- Controle visivel pelo usuario.
- Maior complexidade de estado e interacao na UI.

### Remover apenas o Deep da UI

- Preservar depth no core, MCP e contratos internos.
- A UI executa uma unica busca.
- Agentes e diagnosticos continuam podendo escolher profundidade.
- Evita eliminar uma capacidade que pode ganhar valor quando o corpus crescer.

### Adotar profundidade fixa intermediaria

- A UI sempre coleta mais candidatos que o Edge atual.
- Mantem a mesma barreira de elegibilidade.
- Simplifica a experiencia.
- Pode aumentar custo e candidatos incidentais em todas as buscas, inclusive nas que o Edge ja resolve.

### Adotar profundidade adaptativa

- Iniciar com uma coleta moderada.
- Encerrar quando houver resultado com confianca e separacao suficientes.
- Ampliar internamente uma vez quando nao houver resultado ou o ranking estiver ambiguo.
- Manter a mesma barreira semantica.
- Permitir abstencao quando a ampliacao encontrar somente evidencias fracas.
- Expor uma unica acao de busca ao usuario.

## Hipotese principal

A alternativa adaptativa pode simplificar a UI sem confundir expansao de candidatos com relaxamento semantico. O depth deve permanecer como capacidade do motor mesmo que deixe de ser uma decisao manual da interface.

Esta e uma hipotese de estudo, nao uma decisao de implementacao.

## Experimentos necessarios

1. Reexecutar a matriz de trinta consultas em todos os niveis atuais.
2. Registrar Top-1, Top-3, Top-10, buscas vazias e quantidade de resultados.
3. Verificar se os dois casos ausentes entram no conjunto de candidatos em profundidades maiores.
4. Verificar se o caso atualmente na posicao 7 melhora ou apenas recebe mais concorrentes.
5. Rotular candidatos incidentais para medir precision, nao apenas recall da thread esperada.
6. Medir quantas consultas realmente necessitam de expansao.
7. Comparar Edge, profundidade intermediaria fixa e expansao adaptativa.
8. Incluir consultas negativas para provar que a expansao preserva abstencao.
9. Medir latencia apenas depois de comprovar qualidade funcional.

## Criterios para remover o Deep da UI

- A busca unica preserva ou melhora o Top-1 do baseline.
- Consultas implicitas nao perdem recall.
- A quantidade de falsos positivos nao aumenta.
- A expansao interna e deterministica e observavel em diagnosticos.
- O usuario nao precisa conhecer thresholds ou etapas internas.
- MCP e core preservam profundidade para agentes, testes e evolucao do corpus.

## Riscos

- Uma profundidade fixa maior pode mascarar problemas de ranking.
- Expandir automaticamente toda consulta pode aumentar custo sem ganho.
- Relaxar elegibilidade junto com profundidade pode transformar ausencia de evidencia em resultado incorreto.
- Remover o contrato de profundidade do core pode ser prematuro para um corpus futuro maior.
- Confianca absoluta saturada nao deve ser usada sozinha para decidir expansao.

## Nao objetivos

- Nao recalibrar modelos nesta thread.
- Nao substituir o mecanismo de embedding ou reranking.
- Nao alterar o limite visual de resultados antes de medir precision.
- Nao implementar a mudanca sem uma comparacao reproduzivel.

## Evidencia de origem

A rodada completa esta registrada em:

marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
