# Oportunidade - Tuning de recall e ranking da memory

## Origem

Esta oportunidade nasceu durante a validação da evolução de memory registrada em marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac.

A v1 validou o objetivo mínimo: `memory_recall` consegue encontrar decisões históricas relevantes a partir dos `SUMMARY.md` indexados em LanceDB.

No entanto, a ordenação dos resultados mostrou um ponto de melhoria.

## Caso concreto observado

Query usada na validação:

`implementar rotacao de token da interface`

Resultado esperado de maior relevância:

marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3

Motivo:

- A thread documenta a decisão histórica de não implementar rotação automática de token.
- A decisão diz explicitamente para manter token único, estável e reutilizado pela instância local do daemon.
- A decisão também diz para não alterar persistência do token na UI como resultado daquela oportunidade.

Resultado observado após correção de métrica cosine:

- A thread correta apareceu nos resultados e o `nextActions` orientou `thread_read` antes de reabrir/contradizer a decisão.
- Porém, uma thread genérica de UI apareceu acima da thread de token em alguns recalls porque a query contém a palavra `interface`.

Isso significa que o recall funcional está correto, mas o ranking semântico puro ainda pode priorizar uma correspondência genérica de UI acima de uma decisão crítica de arquitetura/segurança.

## Problema

A busca atual é puramente vetorial sobre chunks de summaries. Isso tem vantagens, mas também limitações:

- Termos críticos exatos como `token`, `rotação`, `segurança` podem não receber peso suficiente.
- Termos genéricos de domínio como `interface` e `UI` podem puxar resultados visualmente próximos, mas menos decisivos.
- O score semântico não distingue automaticamente uma decisão arquitetural crítica de uma menção operacional genérica.
- A explicação atual (`reason`) diz qual seção bateu, mas não explica por que um hit deveria ser priorizado.

## Objetivo

Melhorar a ordenação e explicabilidade do `memory_recall`, para que decisões históricas críticas sejam priorizadas quando a query contém termos fortes que aparecem em summaries relevantes.

## Não objetivo

- Não substituir a busca vetorial.
- Não transformar mARC em apenas um RAG.
- Não exigir LLM externo para reranking na v1.
- Não esconder resultados secundários úteis.

## Hipóteses de solução

### 1. Hybrid lexical + vector

Combinar score vetorial com score lexical simples.

Exemplos de sinais lexicais:

- frequência de termos exatos da query no chunk.
- presença de termos normalizados sem acento (`rotacao` vs `rotação`).
- match em título da thread.
- match em título da seção (`Decisão`, `Riscos`, `Validação`).
- match em termos críticos definidos por domínio.

### 2. Boost por seção decisória

Dar peso maior para chunks de seções como:

- `Decisão`
- `Decisões`
- `Resultado`
- `Riscos`
- `Arquitetura`
- `Validação`

No caso do token, o hit veio da seção `Decisão`, que deveria ter peso forte quando a query pede uma mudança de comportamento.

### 3. Termos críticos e query intent

Criar uma camada pequena de heurística para termos críticos:

- `token`
- `segurança`
- `daemon`
- `autorização`
- `persistência`
- `workspace`
- `Markdown`
- `source of truth`
- `rebuild`
- `index`
- `memory`

Esses termos não devem virar regra rígida demais, mas podem evitar que uma palavra genérica como `interface` domine o ranking.

### 4. Reranking local simples

Após receber top N vetorial do LanceDB, aplicar reranking local:

- manter `vectorScore` original.
- calcular `lexicalScore`.
- calcular `sectionWeight`.
- calcular `titleWeight`.
- combinar em `score` final.
- retornar breakdown mínimo em `reason` ou em campo separado.

### 5. Busca com overfetch

Buscar mais resultados vetoriais do que o `limit` final.

Exemplo:

- usuário pede `limit: 5`.
- store busca top 20 vetoriais.
- reranker local reordena e devolve top 5.

Isso reduz risco de o hit correto ficar fora do conjunto candidato.

## Métricas e fixtures sugeridos

Criar uma suíte pequena de avaliação com queries esperadas.

Casos iniciais:

1. Query: `implementar rotacao de token da interface`
   - Esperado top 1 ou top 2 obrigatório: marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3
   - Preferência: top 1.

2. Query: `mudar markdown source of truth para banco`
   - Esperado: threads/regras relacionadas a Markdown como fonte da verdade.

3. Query: `rebuild de indice travando interface`
   - Esperado: marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186

4. Query: `autocomplete de referencias no composer`
   - Esperado: marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f

5. Query: `auditoria referencia marc inline code`
   - Esperado: marc://$bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180

## Critérios de aceite iniciais

- A query de token retorna a thread de token em posição superior à thread genérica de UI, idealmente top 1.
- O recall continua retornando resultados úteis para queries amplas.
- O sistema preserva `nextActions` com `thread_read` para hits relevantes.
- O ranking continua determinístico e testável sem LLM externo.
- A implementação mantém provider/store como boundary claro.
- O custo de recall continua aceitável para uso em início de sessão ou antes de mudanças de comportamento.

## Pontos de cuidado

- Boost lexical excessivo pode degradar busca semântica real.
- Termos críticos hardcoded podem virar manutenção manual ruim se crescerem sem critério.
- Score final precisa ser explicável o bastante para o agente confiar no resultado.
- Queries em pt-BR e en-US devem funcionar de forma aceitável, pois summaries podem variar historicamente.
- Normalização de acentos precisa ser consistente entre query e chunk.

## Relação com memory v1

A v1 já corrigiu dois problemas encontrados durante validação real:

- passou a usar `vectorSearch(...).distanceType("cosine")` no LanceDB, alinhado ao contrato do provider.
- normalizou `Thread: marc://$...` em summaries legados para evitar referência duplicada `marc://$marc://$...`.

Mesmo com essas correções, o tuning continua necessário porque a ordenação semântica pura ainda pode não refletir criticidade de decisões históricas.

## Relação com outras oportunidades

- O processamento em background pode fornecer infraestrutura de métricas/benchmarks para rodar avaliações maiores: marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
- O indicador visual pode eventualmente mostrar qualidade/estado do índice, mas não deve tentar explicar ranking: marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6

## Referências

- Evolução base da memory: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- Decisão histórica de token: marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3
- Background rebuild de índice: marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
- Oportunidade de background memory: marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
- Oportunidade de indicador visual: marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6
