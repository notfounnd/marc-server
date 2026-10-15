# Correção do avaliador e relatório derivado v2

## Escopo
Corrigido `parseQualityCases`: chaves computadas agora avaliam a expressão TypeScript; chaves normais continuam resolvidas por `propertyKey`. A alteração está em `study-inputs.mjs:181` e seu uso em `study-inputs.mjs:190`.

O replay é local e usa rankings capturados, sem provider. M5 é verificado como subconjunto de M0, e cada uma das 44 × 7 combinações compara efetivamente nove invariantes não graduados com o relatório original. As métricas graduadas não são comparadas com a versão anterior.

## Verificações
- `node --import tsx --test study-recompute.test.mjs`: 3/3, sem skips.
- CLI `node --import tsx study-recompute.mjs --recompute`: exit 0; criou somente `study-report-recomputed-v2.json`.
- AST e linhas não brancas nos 3 arquivos: inputs 298, recompute 239, teste 118; zero `else` e zero if aninhado.
- 40 capturas, 44 casos, 280 assinaturas JSON iguais e 308 comparações efetivas de invariantes.
- M1 mantém membership de M0 em 40/40; M5 é subconjunto de M0 em 40/40.
- Chamadas de embedding, reranking e carga de modelo na recomputação: zero.
- 12 controles positivos e 2 abstentions permanecem separados.

## Métricas corrigidas
nDCG@10 conhecido: M0/M1/M4 0.6386349514026026; M2 0.5245457642002241; M3 0.5136349514026026; M5 0.5621916670098561; D0 0.7746736913861659.

M0: 10 relevantes, 0 incidentais, 10 desconhecidos, cobertura média 0.625 em 8 casos avaliáveis. M5: 9 relevantes, 0 incidentais, 10 desconhecidos. D0: 16 relevantes, 5 incidentais, 615 desconhecidos, cobertura média 0.125.

## Lineage e hashes
Capture fingerprint: `fd304b9e97515c48e2c7b5b7561ec53808c98c6e68ea628f21d1546e9d31686c`.
Evaluator fingerprint: `c461c954f286b300b2a59c08fd354ee96d549c4777aadeec3fee02c74c72b1be`.
Plano: `4e20d409f760d79fbb4213e1157593fe6ecd7321ad2001cc869354c3a1ce4143`; manifest: `1a99b242539990b87afa7b016568c2eba9d0d248d5020bbcccaf708644f3dfcf`.

- `study-report-recomputed-v2.json`: SHA-256 `179092bdaf421c409156cc36c7442c781b790facf7a981d57d57e53d1df959f0`.
- V1 `study-report-recomputed.json` foi preservado: SHA-256 `93d5e304e8edbe179756de1017cc1c67907e2f59cea1a667866b9d86bffd1581`.
- Os cinco originais mantêm os hashes fixados no plano/fixture: fingerprint, checkpoint, captura, run e relatório.
- O relatório v2 preserva os 29 source digests e 8 model digests originais. A versão anterior do relatório original é inválida somente para métricas graduadas; consultas, alvos e rankings foram preservados.

## Estado
Nenhuma captura ou inferência foi repetida. Nenhuma fonte produtiva foi alterada. Revisão independente do principal pendente.