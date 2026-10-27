# Entrega 1c da E3: pré-estudo de discordância e paridade de admissão

Escopo: T1e (pré-estudo de discordância do funil contra o M0 nas capturas E2), T1e-b (modos de rank do reranker) e T1f (paridade de admissão com o M0, que corrige um defeito do núcleo). Autor: claude-dev. Revisor pendente: marc://@claude-software-architect.

## 1. Resumo

- O defeito era do núcleo: `admittedOf` filtrava pelo `eligibility` de `rankThreadCandidates`. O teto desse valor roda na ordem de `rankingScore` e inclui os inelegíveis. O M0 filtra pelo `semanticEligibility`, ordena pela ordem híbrida e aplica `applyMonotonicConfidence` só sobre os elegíveis. Um inelegível acima na ordem de `rankingScore` capava e derrubava outro grupo do conjunto.
- A correção segue o caminho do M0 sem reimplementá-lo. Paridade com o M0 no `passage-all`: 114 de 114 no marc e 40 de 40 no ledgerline, nos conjuntos admitidos e no Top-1.
- O modo de rank do núcleo continua `group`. O modo `passage` continua só no script, até a decisão dos aprovadores.

## 2. Causa e correção (caminhos)

- `src/core/memory/funnel-admission.ts`: `admittedOf` delega a `admittedOfCandidates`, que faz `rankThreadCandidates` e depois `hybridAdmissionOrder`, com o limiar aplicado à elegibilidade final. `candidateOf` foi exportado.
- `src/core/memory/hybrid-ranking.ts`: novo `hybridAdmissionOrder`, extraído de `rankHybridMemoryCandidates`, que agora o chama. `hybridScore` foi exportado. O comportamento do M0 não mudou.
- `src/core/memory/semantic-ranking.ts`: exportados `rerankingEntriesOf` e `applyRerankScores` (extraídos de `rerankPassages`) e o tipo `PassageRerankEntry`. Sem mudança de comportamento.
- `scripts/memory-eval/t1e-discordance-prestudy.ts` (297 linhas): usa `hybridAdmissionOrder` e `hybridScore`. Saída nova em `.marc/cache/memory-eval-e3/t1e/t1f-admission-parity.json`. Os JSONs anteriores não foram sobrescritos.

## 3. Testes e prova de falha antes da correção

- `test/memory-funnel-admission.test.ts`, caso 1 (g0 inelegível com melhor `rankingScore`, g1 e g2): falhou antes da correção. O funil admitia só g2; o M0 admite g2 e g1.
- O mesmo arquivo, caso 2 (paridade com quatro grupos, ALL_CANDIDATES): falhou antes da correção. g0 saía 0,9168 no funil e 0,9661 no M0; g1 saía 0,9982 e 0,9661.
- Depois da correção, os dois casos passam.
- `test/memory-funnel-admission-m0.test.ts` (grupos com várias passagens, rank do M0 pelos helpers exportados): passa. Simulei o caminho antigo nesse fixture: admitia só g3; o M0 admite g3, g2 e g1.
- Módulos relacionados (admissão, path, guards, funnel-run, funnel-variants): 33 de 33.

## 4. Paridade com o M0 (script, `passage-all`)

- marc: conjunto admitido igual em 114 de 114 casos; Top-1 igual em 114 de 114.
- ledgerline-en: conjunto admitido igual em 40 de 40; Top-1 igual em 40 de 40.

## 5. Expectativa do B7 (test/memory-eval-t1d-path.test.ts)

- A expectativa mudou de `["medium", "high"]` para `["high", "medium"]`, com comentário no teste.
- Motivo: pelo teto monotônico do M0, cada elegibilidade é no máximo a do grupo anterior na ordem híbrida. Um band alto nunca vem depois de um médio. O fixture original não tem como produzir esse cenário.
- A regra de parada sobre a lista inteira continua coberta no teste unitário de `memory-eval-t1d-guards.test.ts`.

## 6. Tabelas, antes e depois da T1f (marc, capturas E2 com 114 casos)

Célula: b/c/b+c sobre os positivos completos (100); e conjuntos admitidos que mudam (de 114).

T1e, modo group, antes da T1f:

| alocação | K=8 | K=10 | K=12 | K=15 | K=20 | K=25 | K=30 |
|---|---|---|---|---|---|---|---|
| primeiro passo | 4/3/7 · 31 | 4/2/6 · 30 | 4/1/5 · 31 | 4/0/4 · 28 | 3/0/3 · 26 | 3/0/3 · 26 | 3/0/3 · 25 |
| depth0 | 4/3/7 · 31 | 4/2/6 · 30 | 4/1/5 · 31 | 4/0/4 · 28 | 3/0/3 · 27 | 3/0/3 · 27 | 3/0/3 · 27 |

T1e, modo group, depois da T1f:

| alocação | K=8 | K=10 | K=12 | K=15 | K=20 | K=25 | K=30 |
|---|---|---|---|---|---|---|---|
| primeiro passo | 3/6/9 · 30 | 3/5/8 · 28 | 3/4/7 · 26 | 3/0/3 · 16 | 2/0/2 · 13 | 2/0/2 · 11 | 2/0/2 · 7 |
| depth0 | 3/6/9 · 30 | 3/5/8 · 28 | 3/4/7 · 26 | 3/0/3 · 16 | 2/0/2 · 14 | 2/0/2 · 12 | 2/0/2 · 11 |

T1e-b, modo passage, antes da T1f:

| alocação | K=8 | K=10 | K=12 | K=15 | K=20 | K=25 | K=30 |
|---|---|---|---|---|---|---|---|
| primeiro passo | 3/3/6 · 32 | 3/2/5 · 32 | 3/1/4 · 33 | 3/0/3 · 32 | 3/0/3 · 32 | 3/0/3 · 32 | 3/0/3 · 29 |
| depth0 | 3/3/6 · 32 | 3/2/5 · 32 | 3/1/4 · 33 | 3/0/3 · 32 | 3/0/3 · 32 | 3/0/3 · 32 | 3/0/3 · 32 |

T1e-b, modo passage, depois da T1f:

| alocação | K=8 | K=10 | K=12 | K=15 | K=20 | K=25 | K=30 |
|---|---|---|---|---|---|---|---|
| primeiro passo | 2/6/8 · 30 | 2/5/7 · 28 | 2/4/6 · 26 | 2/0/2 · 16 | 2/0/2 · 13 | 2/0/2 · 11 | 2/0/2 · 7 |
| depth0 | 2/6/8 · 30 | 2/5/7 · 28 | 2/4/6 · 26 | 2/0/2 · 16 | 2/0/2 · 14 | 2/0/2 · 12 | 2/0/2 · 11 |

Ledgerline-en (40 casos): nos dois modos e nas duas alocações, b=0 e c=0 em todo K, antes e depois. Conjunto admitido: group muda em 1 caso (L07) em todo K; passage muda em 0 caso. Abstenção: 0 mudanças nos 14 negativos do marc e nos 6 do ledgerline, em todas as células.

Casos de Top-1 no K=12, depth0, antes e depois da T1f (group | passage):

| caso | M0 | antes (group) | depois (group) | depois (passage) |
|---|---|---|---|---|
| 3I | acerta (g3) | perde: status-health g1 à frente, alvo rr1 el 0,9991 pos 2 | perde (igual) | acerta: alvo pos 1, rr1, el 1,0000 |
| 9P | acerta (g3) | perde: alvo não é finalista (rr –) | perde (igual) | perde (igual) |
| 10P | erra (g0) | ganha: alvo rr1 el 0,7532 | ganha (igual) | ganha (igual) |
| C2 | acerta (g3) | perde: alvo não é finalista (rr –) | perde (igual) | perde (igual) |
| A35 | acerta (g3) | perde: alvo rr2, el 0,3190, não admitido | acerta: alvo rr2, el 0,5642, pos 1 | acerta (igual) |

Novos ganhos no K=12 (Q02, Q03, C5), nos dois modos: o M0 não admite nenhum candidato nesses positivos, e o funil admite o alvo com rr2 e el 0,5444. Vêm da restrição a finalistas no rank do reranker, não da admissão. Com todos os grupos (`passage-all`), o funil e o M0 batem em 114 de 114.

A35: a eligibility mudou de 0,3190 para 0,5642. A perda era o teto de um inelegível, corrigido pela admissão. Nos dois modos, o alvo passa a pos 1.

## 7. Aproximações do pré-estudo

1. Catálogo: os registros dos canais de profundidade 0 (`semanticHitsForChannels`). A captura E2 não tem catálogo.
2. Cosseno: a E2 não guarda vetores de passagem. A ordem por cosseno usa o escore do canal, com vetor [s, raiz(1 - s²)] e consulta [1, 0]. Verificado nas identidades: 6384 hits no marc e 1200 no ledgerline, desvio máximo 2,4e-7. Nas passagens, é suposição do mesmo caminho de busca vetorial, não verificada.
3. Escores: vêm da captura, pela chave do par. Um par ausente torna o caso incompleto. Nenhum caso ficou incompleto.
4. Primeiro passo: composto com primitivas exportadas e conferido contra `runFunnel`: 1694 checagens do modo group, todas iguais.
5. Julgamentos: os do dataset atual. O dataset do marc tem 137 casos e a captura E2 tem 114; o ledgerline tem 69 e a captura tem 40. As capturas não foram refeitas. Positivos (100) e acertos do M0 (66) são iguais antes e depois, o que sugere que os julgamentos dos casos capturados não mudaram.
6. Sem cortes de faixa; profundidade só 0; modo `passage` só no script.

## 8. Teste de dataset (correção)

- `test/memory-eval-dataset.test.ts`: contagem do marc em 137. A checagem contra o corpus fixado agora usa a mesma função do comando `validate` (`validationCorpus`, exportada de `scripts/memory-eval/cli.ts` sem mudar comportamento) e passa `sources` ao `validateDataset`. Antes, a chamada não passava as fontes, e toda evidência virava `evidence-source-missing`.
- `test/memory-eval-dataset-ledgerline.test.ts` (novo): contagem do ledgerline em 69 e validação contra o pin e as fontes do fixture. Ficou em arquivo próprio porque o arquivo do marc passou do limite de 300 linhas (`max-lines`).
- Nenhum dataset nem o corpus fixado foi alterado.

## 9. Checks

- `pnpm validate`: exit 0 (lint, formatação e typecheck).
- `pnpm build`: exit 0.
- `pnpm test`: 960 de 960 passam.
- Manifest `.marc/memory/manifest.json`: sha256 `b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a`, igual antes e depois.
- A inspeção do repositório foi feita com Bash e leitura direta de arquivos. O context-mode não foi usado nesta entrega.
- Não usei Git, não carreguei modelos, não refiz capturas nem rebuild, e não alterei datasets nem o corpus fixado.

## 10. Limites e pendências

- O modo de rank do núcleo segue `group`. Paridade total com o M0 em grupos de várias passagens vale só com o rank do M0 (`passage-all` e o teste multi-passagem). A decisão do modo fica com os aprovadores.
- As capturas E2 não foram refeitas, e o escopo de casos das tabelas é o da captura.
- Os ganhos novos no K=12 vêm da restrição a finalistas no rank. Vale decidir se ela é aceitável antes da captura pontuada.
