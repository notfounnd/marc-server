# Plano - Recuperacao hibrida orientada por campos com LanceDB

## Objetivo

Evoluir a busca mantendo E5-small + mMARCO e usando o LanceDB para acrescentar recuperacao lexical BM25. A unidade de decisao continuara sendo a thread, nao o registro individual.

O match lexical servira para descobrir e ordenar candidatos. A elegibilidade continuara exclusivamente semantica, impedindo que uma thread apareca apenas porque contem o termo pesquisado.

## Indice e persistencia

- Elevar o manifest para schema v5 e registrar um contrato de recuperacao field-aware-hybrid-v1.
- Manter Markdown e SUMMARY.md como fontes de verdade. Todos os campos e indices novos serao projecoes reconstruiveis.
- Materializar somente nas linhas identity os campos lexicalTitle, lexicalSummary e lexicalTitlePrefix.
- Manter esses campos vazios nas passagens, evitando que a quantidade de chunks aumente artificialmente a relevancia lexical da thread.
- Criar indices FTS antes de publicar a geracao.
- Usar tokenizer simple para titulo e sintese.
- Usar tokenizer ngram com prefixOnly para o titulo prefixado.
- Aplicar lowercase e ASCII folding.
- Nao aplicar stemming, stopwords dependentes de idioma ou fuzziness.
- Validar contagem de registros e presenca dos indices antes de publicar o manifest.

## Contratos internos

- Separar no MemoryVectorStore as operacoes searchVector e searchLexical.
- Introduzir hits lexicais tipados com campo, rank e score BM25, sem misturar essas escalas com cosine.
- Passar ao ranking canais explicitos para identidade vetorial, passagens vetoriais, titulo exato, sintese executiva e prefixo de titulo.
- Preservar os contratos publicos da UI e do MCP.

## Fluxo de busca

1. Interpretar a consulta com o LFM e obter effectiveQuery.
2. Gerar um unico embedding da consulta.
3. Executar em paralelo os canais vetoriais e lexicais.
4. Ativar o canal prefixado somente para consultas efetivas de um termo.
5. Consolidar todos os registros por threadId.
6. Para candidatos descobertos pelo FTS, calcular a similaridade com o vetor armazenado da identidade.
7. Reordenar identidade ou passagens com mMARCO.
8. Calcular elegibilidade usando somente identidade, passagens e reranker.
9. Eliminar candidatos abaixo do gate semantico.
10. Aplicar fusao lexical somente entre candidatos semanticamente aprovados.
11. Manter o score publico limitado pela confianca semantica e monotonico na ordenacao final.

A fusao inicial preservara os pesos semanticos atuais e acrescentara suporte lexical limitado: titulo exato 2, sintese 0.75 e prefixo 0.5. BM25 bruto nunca sera somado diretamente aos scores dos modelos.

## Rebuild e compatibilidade

- Full e incremental continuarao criando uma geracao completa e isolada.
- A geracao sera publicada somente depois da criacao e validacao dos indices FTS.
- Falhas preservarao o manifest e a geracao anteriores. A geracao incompleta ficara disponivel para o purge existente.
- Schema ou contrato de recuperacao incompativel devera produzir status incompatible.
- A migracao exigira um full rebuild explicito uma vez.
- Depois da migracao, rebuilds automaticos e incrementais tambem reconstruirao os indices lexicais.
- Modelos atuais, TTL, sanitizacao e recursos de purge serao preservados.

## Validacao de qualidade

- Manter o baseline vetorial e comparar o hibrido com titulo e sintese e o hibrido com titulo, sintese e prefixo.
- Usar LanceDB real nos testes de integracao. Stores falsos fornecerao ranks lexicais controlados, sem reimplementar BM25.
- Separar casos de calibracao e aceitacao para evitar ajuste direcionado a brutalism.
- Cobrir consultas de termo unico, prefixo, typo, multiplos termos, parafrases e dominios ausentes.
- Exigir UI neo-brutalism acima da calibragem para brutalism.
- Exigir comportamento correto para brutal, brutalismp, toggle e toogle.
- Exigir thread de UI em primeiro para interface com brutalism.
- Preservar as familias de seguranca e settings.
- Manter resultados vazios para financas e infraestrutura.
- Impedir aprovacao por evidencia exclusivamente lexical.
- Impedir regressao nos casos atualmente corretos.
- Entre estrategias aprovadas, promover a de maior macro NDCG@10 e MRR. Em empate, escolher a variante sem prefixo.
- Se nenhuma variante cumprir os gates, manter o baseline e registrar o relatorio sem promover a mudanca.

## Verificacao e entrega

- Refatorar arquivos extensos apenas quando houver separacao real de responsabilidade.
- Atualizar docs/memory.md com arquitetura, rebuild obrigatorio, canais e regra de elegibilidade.
- Executar testes unitarios, integracao real com LanceDB, harness completo, pnpm run validate, pnpm test e pnpm build.
- Registrar na thread resultados, metricas, estrategia promovida ou rejeitada e riscos.
- Aguardar feedback antes de encerrar a thread.
