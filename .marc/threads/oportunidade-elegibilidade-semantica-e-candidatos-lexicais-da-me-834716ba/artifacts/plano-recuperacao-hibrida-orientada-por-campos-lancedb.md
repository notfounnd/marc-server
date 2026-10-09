# Plano - Recuperação híbrida orientada por campos com LanceDB

## Objetivo

Evoluir a busca mantendo E5-small + mMARCO e usando o LanceDB para acrescentar recuperação lexical BM25. A unidade de decisão continuará sendo a thread, não o registro individual.

O match lexical servirá para descobrir e ordenar candidatos. A elegibilidade continuará exclusivamente semântica, impedindo que uma thread apareça apenas porque contém o termo pesquisado.

## Índice e persistência

- Elevar o manifest para schema v5 e registrar um contrato de recuperação field-aware-hybrid-v1.
- Manter Markdown e SUMMARY.md como fontes de verdade. Todos os campos e índices novos serão projeções reconstruíveis.
- Materializar somente nas linhas identity os campos lexicalTitle, lexicalSummary e lexicalTitlePrefix.
- Manter esses campos vazios nas passagens, evitando que a quantidade de chunks aumente artificialmente a relevância lexical da thread.
- Criar índices FTS antes de publicar a geração.
- Usar tokenizer simple para título e síntese.
- Usar tokenizer ngram com prefixOnly para o título prefixado.
- Aplicar lowercase e ASCII folding.
- Não aplicar stemming, stopwords dependentes de idioma ou fuzziness.
- Validar contagem de registros e presença dos índices antes de publicar o manifest.

## Contratos internos

- Separar no MemoryVectorStore as operações searchVector e searchLexical.
- Introduzir hits lexicais tipados com campo, rank e score BM25, sem misturar essas escalas com cosine.
- Passar ao ranking canais explícitos para identidade vetorial, passagens vetoriais, título exato, síntese executiva e prefixo de título.
- Preservar os contratos públicos da UI e do MCP.

## Fluxo de busca

1. Interpretar a consulta com o LFM e obter effectiveQuery.
2. Gerar um único embedding da consulta.
3. Executar em paralelo os canais vetoriais e lexicais.
4. Ativar o canal prefixado somente para consultas efetivas de um termo.
5. Consolidar todos os registros por threadId.
6. Para candidatos descobertos pelo FTS, calcular a similaridade com o vetor armazenado da identidade.
7. Reordenar identidade ou passagens com mMARCO.
8. Calcular elegibilidade usando somente identidade, passagens e reranker.
9. Eliminar candidatos abaixo do gate semântico.
10. Aplicar fusão lexical somente entre candidatos semanticamente aprovados.
11. Manter o score público limitado pela confiança semântica e monotônico na ordenação final.

A fusão inicial preservará os pesos semânticos atuais e acrescentará suporte lexical limitado: título exato 2, síntese 0.75 e prefixo 0.5. BM25 bruto nunca será somado diretamente aos scores dos modelos.

## Rebuild e compatibilidade

- Full e incremental continuarão criando uma geração completa e isolada.
- A geração será publicada somente depois da criação e validação dos índices FTS.
- Falhas preservarão o manifest e a geração anteriores. A geração incompleta ficará disponível para o purge existente.
- Schema ou contrato de recuperação incompatível deverá produzir status incompatible.
- A migração exigirá um full rebuild explícito uma vez.
- Depois da migração, rebuilds automáticos e incrementais também reconstruirão os índices lexicais.
- Modelos atuais, TTL, sanitização e recursos de purge serão preservados.

## Validação de qualidade

- Manter o baseline vetorial e comparar o híbrido com título e síntese e o híbrido com título, síntese e prefixo.
- Usar LanceDB real nos testes de integração. Stores falsos fornecerão ranks lexicais controlados, sem reimplementar BM25.
- Separar casos de calibração e aceitação para evitar ajuste direcionado a brutalism.
- Cobrir consultas de termo único, prefixo, typo, múltiplos termos, paráfrases e domínios ausentes.
- Exigir UI neo-brutalism acima da calibragem para brutalism.
- Exigir comportamento correto para brutal, brutalismp, toggle e toogle.
- Exigir thread de UI em primeiro para interface com brutalism.
- Preservar as famílias de segurança e settings.
- Manter resultados vazios para finanças e infraestrutura.
- Impedir aprovação por evidência exclusivamente lexical.
- Impedir regressão nos casos atualmente corretos.
- Entre estratégias aprovadas, promover a de maior macro NDCG@10 e MRR. Em empate, escolher a variante sem prefixo.
- Se nenhuma variante cumprir os gates, manter o baseline e registrar o relatório sem promover a mudança.

## Verificação e entrega

- Refatorar arquivos extensos apenas quando houver separação real de responsabilidade.
- Atualizar docs/memory.md com arquitetura, rebuild obrigatório, canais e regra de elegibilidade.
- Executar testes unitários, integração real com LanceDB, harness completo, pnpm run validate, pnpm test e pnpm build.
- Registrar na thread resultados, métricas, estratégia promovida ou rejeitada e riscos.
- Aguardar feedback antes de encerrar a thread.
