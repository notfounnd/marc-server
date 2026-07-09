# Diagnostico - calibragem de recall lexical e candidatos da memory

## Contexto

Durante a validacao da busca de memory na UI, surgiu a duvida se a UI usa a mesma calibragem da tool MCP `memory_recall`.

Conclusao inicial:
- UI e MCP usam a mesma base operacional quando a MCP e chamada com parametros default.
- A UI envia `{ query, limit: 5 }` para `POST /api/workspaces/:workspaceId/memory/recall`.
- O daemon repassa para `recallMemory(...)`.
- A MCP `memory_recall` tambem chama `recallMemory(...)`.
- A UI nao envia `minScore`, entao usa `DEFAULT_MIN_SCORE = 0.15`, igual a MCP default.

## Evidencia do problema

Consulta testada:
- Query: `brutalism`

Fato no corpus:
- Existem summaries fechados com o termo `brutalism` / `neobrutalism`.
- Exemplo: marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1.
- O manifest da memory contem essa thread e seus records.

Comportamento observado:
- `memory_recall({ query: "brutalism", limit: 5 })` retornou `results: []`.
- `memory_recall({ query: "brutalism", limit: 10, minScore: 0 })` retornou resultados relevantes.
- Com `minScore: 0`, o primeiro resultado foi marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb, com score 0.293597 e reason com `Exact terms: brutalism`.
- O segundo resultado foi marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1, com score 0.293031 e reason com `Exact terms: brutalism`.

## Interpretacao tecnica

O problema nao parece ser divergencia UI vs MCP.

O problema provavel esta na etapa de selecao de candidatos antes do reranking:
- O core usa `DEFAULT_MIN_SCORE = 0.15`.
- A selecao de candidatos usa `memoryRecallCandidateOptions(limit, minScore)`.
- Essa funcao reduz o threshold de candidatos para algo como `min(minScore, CANDIDATE_MIN_SCORE)`.
- Mesmo assim, se o score vetorial bruto do registro com match lexical ficar abaixo do threshold de candidatos, o registro nao chega ao reranker.
- Quando `minScore: 0`, o threshold de candidatos cai e os registros lexicalmente relevantes entram; o reranker entao sobe esses resultados por exact term/section boost.

Ou seja: existe risco de falso negativo para termos exatos quando a busca vetorial inicial filtra candidatos antes do reranking lexical.

## Risco do `limit: 5`

O `limit: 5` nao parece ser a causa direta do caso `brutalism`, porque com default nao voltou nenhum resultado.

Riscos reais do `limit: 5`:
- Em queries amplas, pode esconder resultados relevantes abaixo do top 5.
- Para uso humano na UI, pode passar a impressao de ausencia de conhecimento quando existem resultados rankeados logo abaixo.
- Para termos de exploracao, talvez seja util permitir `show more`, `limit` configuravel ou uma segunda chamada ampliada.

Riscos que nao sao exatamente do `limit: 5`:
- Falso negativo por candidate threshold antes do rerank lexical.
- Falta de fallback textual/lexical quando a query contem termo exato presente em summaries.

## Possiveis caminhos

1. Ajustar candidate retrieval:
- reduzir `CANDIDATE_MIN_SCORE`;
- ou nao aplicar threshold vetorial na etapa de candidatos;
- ou buscar mais candidatos antes do rerank.

2. Adicionar fallback lexical:
- quando query tem termos exatos e a busca vetorial nao retorna resultados suficientes, varrer records de summary/section por match lexical simples;
- mesclar com candidatos vetoriais antes do reranking;
- preservar dedupe e ranking final.

3. Melhorar UI para exploracao:
- mostrar `show more` para ampliar `limit`;
- indicar quando a memory esta stale;
- talvez permitir uma nova busca ampliada automaticamente quando `results.length === 0`.

4. Criar diagnostico/teste de regressao:
- fixture com termo exato presente no summary;
- garantir que query exata retorna o summary mesmo se o score vetorial bruto for baixo;
- cobrir caso `brutalism` como comportamento esperado em teste de ranking/candidatos.

## Criterio de sucesso

- Uma query com termo exato presente em um SUMMARY.md fechado nao deve retornar vazio por causa do filtro vetorial de candidatos.
- UI e MCP devem continuar compartilhando a mesma calibragem por default.
- O ranking final deve continuar priorizando score combinado, exact terms, section boost e dedupe.
