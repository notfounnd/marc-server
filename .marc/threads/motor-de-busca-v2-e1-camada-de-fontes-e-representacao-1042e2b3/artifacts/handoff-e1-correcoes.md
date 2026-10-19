# Handoff da E1: conferência das referências e correções

## Resumo

O plano da E1, na revisão 3, foi aprovado em conjunto na msg_fa670bb9ec24468092. Ele pede que os aprovadores confiram as referências de linha contra o código atual antes do dispatch e registrem as correções no handoff, sem mudar o desenho. Este documento registra essa conferência.

**Resultado:** todas as referências de linha do plano conferem. As oito correções abaixo são de implementação e não alteram arquitetura, critérios nem escopo. As de 5 a 8 ficam em scripts/memory-eval/**, um caminho que o plano já autoriza.

**Execução:**
- o desenvolvedor é o claude-dev, com Haiku 5.5 e reasoning xhigh, confirmados pelo humano em 17/10/2026;
- o modo é sequencial, com um desenvolvedor;
- a ordem é T1 → T4, seguida de captura, julgamento incremental e comparação.

## Referências conferidas

| Referência do plano | Situação |
| --- | --- |
| normalizeMarkdownForEmbedding em summaries.ts:234-243 | Confere. É privada e tem três chamadores, em :156, :179 e :230 |
| splitPassages com 320 e 48 tokens | Confere: summaries.ts:15-16 e :47 |
| searchVector e searchLexical em lancedb-store.ts:124 e :146 | Confere |
| semanticRecallHits | Confere: semantic-ranking.ts:87-100 |
| parseMessages e safeJoin | Confere: markdown.ts:52 e paths.ts:26 |
| Thread fechada é a que tem SUMMARY.md | Confere: thread-index.ts:209 e summaries.ts:79-82 |
| ADR 0010 | Ainda não existe; o último é o 0009 |

## Correções de implementação

1. **Versão do manifest:** schemaVersion e retrievalContract aparecem fixos em types.ts:137/141, status.ts:56-57, rebuild-operations.ts:51-52 e rebuild-operations.ts:236/240. Todos passam a usar duas constantes, `MEMORY_SCHEMA_VERSION = 7` e `MEMORY_RETRIEVAL_CONTRACT = "source-layers-v1"`.
2. **documentSources:** normalizeWorkspaceSettings (settings.ts:129-147) nunca lança erro na leitura, e o padrão que lança, de searchRetryDepth, só vale no update. Como documentSources só é editado no JSON, uma entrada inválida é descartada na normalização, e cada motivo de rejeição da seção 4 do plano tem um cenário declarado no teste. Mostrar as rejeições no status fica para a E3, quando a camada 1 for ligada.
3. **Injeção de camadas:** materializedSources (rebuild-operations.ts:86-92) chama scanThreadSummarySources direto. MemoryOperationOptions (types.ts:290-296) ganha `indexedLayers?: readonly MemoryLayer[]`, com o padrão INDEXED_LAYERS. Esse é o ponto de injeção do --all-layers.
4. **Títulos `##` duplicados:** `recordId = ${threadId}:source:${slugify(title)}` (summaries.ts:187) faz duas seções com o mesmo slug colidirem, e o passagesByRecordId (:57-59) fica só com as passagens da última. O leitor de summary acrescenta `-2`, `-3` e assim por diante na colisão, com um teste. Não há impacto na comparação: 0 de 59 summaries do marc e 0 de 30 do ledgerline-en têm títulos duplicados.
5. **Checagem contra a produção:** assertProductionRecordIds (capture.ts:308-326) barraria a captura e a latência do marc, porque a normalização nova muda a divisão em passagens. Quando o schemaVersion do manifest de produção é igual ao do código, a checagem compara os record ids. Quando é diferente, compara só o conjunto de threadIds fixadas e grava no capture.json `productionCheck: "thread-ids"`, junto com as duas versões. Há um teste para cada ramo.
6. **captureId do --all-layers:** o fingerprint (capture-fingerprint.ts:28-53) inclui indexedLayers só quando ele é diferente de [0]. Assim, o cálculo dos captureIds padrão não muda e a captura com todas as camadas não colide com a normal.
7. **Baseline da E0 com o código novo:** o compare faz o replay das duas capturas com o ranking atual, e o cache de scores do reranker usa como chave o semanticRerankingDocument (semantic-ranking.ts:307-314). Por isso:
   - a saída de semanticRerankingDocument e o ranking não mudam na E1;
   - os campos de proveniência são opcionais em quem lê registros capturados (o tipo de registro em capture-types.ts e o semanticRecallHits);
   - **verificação nova:** o report da captura da E0, rodado com o código da E1, precisa dar métricas de M0 idênticas às do report.json aprovado.
8. **Report sem latência:** o report exige o latency.json (cli.ts:360-364), mas a E1 não tem critério de latência. O report ganha `--without-latency`, que renderiza "Latency: not measured" e só funciona com essa flag explícita. A latência do motor novo é medida na E2.

## Preparação do principal

- As capturas da E0 têm backup em .marc/cache/memory-eval-e0-backup/, idêntico ao original. O cache é ignorado pelo Git.
- **Hash do manifest de produção antes da E1:** 89a984426b1157aaa8f9d2fdafe9b50ecd83239cd86e27dbb174f9a94fba491a. O humano fez um rebuild incremental com o motor atual depois da E0. O manifest continua no schema 6, com 59 registros e as 56 threads fixadas presentes.

## Pontos de entrega

- **Entrega 1 do desenvolvedor:** depois da T4, com pnpm validate, pnpm build e pnpm test passando.
- **Entrega 2:** depois das capturas, com os captureIds, o compare e o report anexados, o resultado do --all-layers e o hash do manifest.
- **Julgamento incremental:** os pares novos são julgados pelo principal e pelo coaprovador, que o humano aciona, com o mesmo procedimento da E0.
- **Por último:** a revisão final do principal, a revisão do coaprovador e a aceitação do humano.
