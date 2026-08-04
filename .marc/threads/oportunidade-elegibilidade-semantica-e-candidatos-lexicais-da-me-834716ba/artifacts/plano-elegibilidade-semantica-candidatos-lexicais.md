# Plano - Elegibilidade semântica e candidatos lexicais da memory

## Objetivo

Corrigir falsos negativos em que um termo literal existente em summaries fechados não chega à avaliação porque ficou fora dos candidatos vetoriais iniciais. O termo literal pode ampliar o conjunto avaliado, mas não pode, sozinho, transformar um record em resultado.

## Diagnóstico confirmado

- A política atual deriva o limite de candidatos a partir de `resultLimit`. Assim, o MCP com `limit: 5` e a UI com `limit: 50` podem avaliar conjuntos vetoriais distintos.
- O ranking atual aplica `minScore` ao score híbrido. Como o score híbrido incorpora o bônus lexical, um match literal pode satisfazer o limiar sem demonstrar contexto semântico suficiente.
- O corpus atual tem 38 summaries e 241 records. A projeção LanceDB já permite consultar os records persistidos para complementar os candidatos sem alterar o Markdown fonte ou exigir um novo índice derivado.

## Decisões

1. Usar política interna explícita de até 100 candidatos vetoriais, independente de `resultLimit`.
2. Adicionar candidatos lexicais por varredura normalizada dos records já armazenados no LanceDB e no store em memória.
3. Preservar a normalização literal já existente para não alterar a interpretação de match atual.
4. Mesclar candidatos vetoriais e lexicais por `recordId`, conservando o score vetorial.
5. Aplicar elegibilidade por `vectorScore >= minScore` ativo antes do ranking híbrido.
6. Manter o score lexical e os motivos de termo exato apenas como sinais de ordenação e explicação dos candidatos já elegíveis.
7. Preservar Deep retry como a única forma de reduzir progressivamente a barreira semântica.
8. Não alterar os contratos públicos da UI ou MCP. O MCP mantém `limit: 5` por padrão e a UI continua solicitando até 50 resultados.

## Fluxo resultante

```text
vector candidates (fixed internal policy)
+ exact lexical candidates
-> dedupe by recordId
-> semantic eligibility using active vector minScore
-> hybrid ranking
-> dedupe by threadId
-> resultLimit
```

## Implementação

- Estender `MemoryVectorStore` com busca de candidatos lexicais que recebe o vetor da query e os termos normalizados, retornando `MemorySearchHit` com score vetorial.
- Implementar a mesma semântica no store em memória e no LanceDB. No LanceDB, a consulta lê records existentes e calcula score apenas para matches lexicais.
- Centralizar os helpers de termos normalizados para que coleta e ranking não divergam.
- Ajustar o recall para usar candidatos vetoriais fixos, unir as duas origens, filtrar elegibilidade semântica e só então ranquear e truncar.
- Atualizar a documentação de memory para descrever a política unificada e a distinção entre elegibilidade e ranking.

## Critérios de aceite e testes

- `brutalism` avalia o mesmo conjunto elegível com `resultLimit` 5 e 50. Apenas a resposta final é truncada.
- `toggle` fora dos candidatos vetoriais iniciais é avaliado por match literal.
- Um match literal com score vetorial abaixo do `minScore` não aparece até que um Deep retry reduza o limiar de modo compatível.
- `toogle`, sem match literal, continua puramente semântico.
- A ordenação continua determinística por score híbrido, score lexical, score vetorial e threadId.
- Validar com `pnpm run validate`, `pnpm test`, `pnpm build` e auditoria mARC de mensagens, artefatos e preflight.

## Limite desta evolução

A varredura lexical é linear no corpus e adequada ao volume atual. Um índice lexical derivado, migração da projeção ou recurso textual nativo do LanceDB ficam fora de escopo e só devem ser considerados após medição em corpus significativamente maior.