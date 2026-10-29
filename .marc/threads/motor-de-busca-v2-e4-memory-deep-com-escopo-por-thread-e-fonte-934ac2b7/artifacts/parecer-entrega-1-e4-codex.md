# Revisão independente da Entrega 1 da E4 — estado corrigido

## Veredito

**Pendente: dois bloqueios na fidelidade e no gate do harness T2.**

O desenho e o núcleo da T1 estão coerentes com o plano. Reproduzi a preservação comportamental do recall nas capturas congeladas. Não coaprovo a Entrega 1 como pronta para avaliação real enquanto o replay deep não representar a deduplicação da saída produtiva e o gate não avaliar a configuração efetivamente adotada após recuo.

Este parecer não modifica a arquitetura coaprovada, os 14 casos ou os limites de qualidade e latência.

## Fontes e escopo

- Entrega: marc://msg_9c73a89ee3d947d89c, entrega-1-e4.md.
- Revisão principal: marc://msg_6964436a464243b7ad, revisao-entrega-1-e4.md.
- Plano coaprovado, inclusive a revisão das classes.
- Código no disco: deep*.ts, resolução no core/MCP, leitura filtrada do store, exposição MCP/CLI, funções compartilhadas do ranking, captura/fingerprint, dataset e julgamentos por passagem, deep-run, variantes, worksheet, métricas, protocolo e testes correspondentes.

Leitura, testes puros e reproduções em memória via context-mode. Não usei Git, não executei rebuild/capture ou validate e não editei arquivos protegidos. O único novo registro é este parecer.

## B1 — O replay não deduplica como o produto

**Arquivos e linhas:**
- scripts/memory-eval/deep-variants.ts:142, 196 e 210–214: as variantes mantêm todas as ocorrências no ranking.
- scripts/memory-eval/deep-metrics.ts:39–41: o Top5 é cortado diretamente desse ranking.
- src/core/memory/deep.ts:148 e 177 e deep-output.ts:51–58: a produção aplica firstPerPassage antes do limite.

**Problema:** a identidade de uma passagem depende do caminho e do texto, não do ordinal do record. O mesmo texto repetido em uma fonte pode gerar records distintos com o mesmo passageId. A produção retorna uma ocorrência; o harness conta todas.

**Reprodução independente, sem arquivos ou modelos:** cinco records incidentais, com recordId distintos e o mesmo passageId, precedem uma passagem útil com outro passageId. Todos os scores e vetores estão completos.

- Harness: os cinco primeiros são a passagem incidental repetida; Success@5 = falso.
- Saída produtiva: firstPerPassage seguido do limite produz a incidental e a útil; Success@5 = verdadeiro.
- Não há grau ausente nem par ausente: a diferença é exclusivamente a transformação de saída.

**Risco:** métricas, worksheet e diagnóstico de ordering/cap podem julgar outro Top5 que não é o oferecido pelo memory_deep.

**Aceite:** deduplicar por passageId, mantendo o melhor resultado na ordem já definida, antes de cortar o Top5 de todas as variantes pertinentes, incluindo DEEP_ALL, DEEP_COSINE e eventual DEEP_BUDGET. Preservar pairs como contagem dos documentos realmente reranqueados, sem reduzi-la por causa da deduplicação de saída. Adicionar paridade com duplicatas no modo scoped e no unscoped, verificando Top5, métricas e worksheet.

As duas capturas congeladas que li não têm passageId duplicado; isso explica por que a paridade histórica não revela este defeito. Não elimina a divergência do contrato nem protege o novo corpus.

## B2 — O gate ignora a configuração de recuo

**Arquivos e linhas:**
- scripts/memory-eval/deep-variants.ts:103–121: DEEP continua com B=232; o orçamento recebido gera DEEP_BUDGET separado.
- scripts/memory-eval/deep-run.ts:120–140: o relatório recebe deepBudget, mas o gate usa sempre item.variants.DEEP.
- scripts/memory-eval/deep-run.ts:205–213: as classes também usam sempre DEEP.
- scripts/memory-eval/cli.ts:1638–1646: o argumento é apenas validado como inteiro positivo.

**Problema:** runDeepReport(inputs, B') informa deepBudget=B', mas a aprovação ainda usa os resultados do orçamento antigo. A completude de DEEP_BUDGET não corrige isso: uma variante de recuo completa pode ter qualidade insuficiente.

**Reprodução independente com runDeepReport inteiro, só em memória:**
- 14 casos, sendo 10 scoped e 4 unscoped; cada escopo tem 233 passagens elegíveis.
- Todos os scores, graus e evidências estão presentes; zero incompletos.
- B'=1.
- DEEP e DEEP_ALL: 14 sucessos.
- DEEP_BUDGET: 4 sucessos, pois os dez casos scoped perdem a passagem útil.
- Resultado do relatório: protocolIncomplete=false, gate.applied=true, gate.passed=true, successDeep=14.

É exatamente a transferência de aprovação de B=232 para B' que o critério 5 proíbe.

**Aceite:** tornar explícita a configuração avaliada/adotada e ligar gate, conformidade e diagnóstico dessa configuração aos resultados correspondentes. Manter o baseline DEEP separado para comparação, sem lhe atribuir a aprovação de B'. Um recuo com 4/14 deve reprovar mesmo quando o baseline tem 14/14; um recuo completo e >=12/14 pode passar o gate de qualidade. Se o parâmetro representar o recuo do plano, exigir também seu domínio válido 1 <= B' < 232. A checagem conjunta com latência continua na T3; o problema aqui é o gate de qualidade da T2.

## T1 — Avaliação

### Preservação do recall

Reexecutei replayCapture em memória com os mesmos insumos e vetores do caminho da CLI, sem escrever relatórios:

| Corpus | Casos | SHA256 do replay M0/DEPTH2, idêntico ao congelado |
|---|---:|---|
| marc / 87cd2e4d96f7 | 137 | ec3eb25e21aaf36f0df5173ad56b7130110f2bc00fba56813513c8e73f01e80b |
| ledgerline-en / 0d31bd4afd3f | 79 | bf872d5f11b0a069531453ce65f5416330acfe35b07d105045ce3d4cede7bceb |

Zero variantes incompletas. A serialização foi reproduzida exatamente como no comando do harness, não apenas comparada por sequência de threads.

Os testes P1 verificam ranked integral, documentos, ordem, lote e uma chamada, com empate, dispersão, identity-only e origem lexical. Executei esses testes puros. Li também a paridade de ponta a ponta no mesmo índice; não a reexecutei, pois sua preparação chama rebuild em workspace temporário e preservei a proibição desta rodada.

Não usei diff Git. Portanto, a afirmação histórica de arquivos intocados vem da entrega/revisão principal; minha evidência independente é a leitura do fluxo e a reprodução comportamental por hash.

### Duplicação delimitada de operations.ts

As cópias de prontidão, seleção de campos lexicais, store e resultado vazio permanecem pequenas e anotadas. Respeitam a exclusão coaprovada e usam os módulos compartilhados de status, interpretação, busca por camada e ranking. Não proponho refatorar operations.ts nesta etapa.

A paridade no caminho pronto não prova, sozinha, todos os ramos de erro e lock. Esses ramos têm testes dedicados, que examinei; a manutenção deve preservar os dois conjuntos, sem alegar que apenas o teste de ponta a ponta cobre todas as cópias.

### Dois modos, erros e transportes

- Scoped: resolução no core, SUMMARY não vazio, manifest por relativeSummaryPath, filtro threadId no store com escape SQL e sourceTypes antes de pontuar. Todas as passagens até o teto entram; acima dele há corte por cosseno. Empate por score, cosseno e recordId; sem groupBand.
- Unscoped: composição das funções exportadas, mesmos documentos e admissão da depth 2, identity-only pontuada e não retornada, groupBand pelo grupo e sourceTypes só na saída.
- MCP: bootstrap/schema e limites, MemoryDeepError convertido em toolError.
- CLI: query obrigatória; opções sem valor não viram execução sem escopo; tipos e limites conferidos pelo core.
- Proveniência, dedupe e ações por autoridade estão presentes no produto. A lacuna B1 é no replay dessa saída, não uma remoção da deduplicação produtiva.

Não identifiquei outro bloqueio funcional na T1 dentro desta leitura.

## T2 — Pontos conformes e limites

- O corpus contém 62 IDs únicos, todos com SUMMARY presente; inclui E3 e exclui E4. O dataset real ainda não tem os 14 casos, como previsto nesta entrega.
- kMax é parametrizado, 0 no marc-deep e omitido do fingerprint no padrão histórico de 30.
- A captura mantém todo o escopo/evidência e o pool dos canais mesmo com kMax=0.
- A worksheet une as variantes, inclui DEEP_BUDGET quando solicitado, ordena por passageId, não exibe scores/posição/variante e mostra texto integral. Precisa receber o ranking deduplicado de B1.
- Grau ausente nos Top5 gera missing-grade/incomplete. Par ausente não vira score zero.
- O protocolo exige 14 casos, 4+10 e ao menos um escopo acima de 232 após os filtros. A estratificação restante ainda depende da elaboração/revisão dos casos.
- As classes corrigidas estão de acordo: segmentation exige todas as citações unindexable; admission/pool exige que nenhuma citação indexada esteja em grupo admitido e no pool; missing em qualquer citação deixa incomplete, sem classe. Precedência e alsoTruncated preservados.
- O merge mantém identidades por passageId e não substitui grau existente conflitante. Não executei merge.

## Checks independentes

- 64/64 testes focados puros, sem skips ou falhas: pool/P1, output e testes deep de captura de escopo, dataset, evidência, métricas, protocolo, variantes e worksheet. O teste denominado capture nesse conjunto verifica funções puras; não chama captureMemoryEval.
- Typecheck sem emissão: exit 0.
- ESLint sem fix nos arquivos deep, dataset-deep, judgments-passage e testes deep: exit 0.
- Replays congelados: igualdade byte a byte nos dois corpora, como acima.
- Duas reproduções adicionais em memória confirmaram B1 e B2.
- Manifest lido: ae070d9ac0d23f58aa7b6d825740c476dba663203ce1bcdf1103e852cfd767db, correspondente ao hash declarado na revisão principal.
- A suíte completa 1.146/1.146 e validate/build permanecem evidência da revisão principal, não nova execução minha.

## Próximo passo

Corrigir B1 e B2, adicionar regressões e repetir as verificações afetadas antes da coaprovação da Entrega 1. Nenhuma captura real do marc-deep foi feita por mim. Qualidade real, production check das 62 threads, latência e recalibração da descrição MCP continuam pendentes das etapas declaradas. A descrição atual sobre todos os trechos e cerca de 22 s não deve ser tratada como garantia medida.

Thread mantida aberta.
