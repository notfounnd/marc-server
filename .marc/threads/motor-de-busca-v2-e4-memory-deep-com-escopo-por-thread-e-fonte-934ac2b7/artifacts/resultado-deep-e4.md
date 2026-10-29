# Resultado do marc-deep (E4)

## Resumo

O `deep-run` da captura marc-deep/58686cbe9fc0 rodou com os julgamentos já consolidados (consenso coaprovado pelo Codex, com os ajustes dele).

- **Gate do `DEEP`: aprovado.** Success@5 de 13 em 14 (o mínimo era 12), sem casos incompletos e com 100% dos resultados dentro do escopo.
- A única falha, D03, é de **ordering**. Os trechos da evidência foram pontuados, mas ficaram abaixo da 5ª posição.
- O corte em B = 232 não teve efeito nas métricas: `DEEP` e `DEEP_ALL` têm o mesmo Success@5, MRR@5 e P@5. O top 5 do D14 muda, sem mudar o resultado do caso.
- **Coaprovação do Codex:** gate de qualidade e continuidade à T3. A adoção final depende da T3, em que a qualidade e os dois gates de latência têm de passar juntos. Se o recuo B' for usado, valem a reavaliação única e todos os gates de novo.
- **Proposta do principal:** adotar o `DEEP` com B = 232, sem D10 e sem reavaliação. O D03 vai para o estudo de modelos. A E4 segue para a T3 (latência, skill, docs e ADR 0013).

## Protocolo

- 14 casos: 4 sem escopo e 10 com escopo; 2 casos com escopo passam de B = 232 (D13 com 408 trechos e D14 com 597).
- `protocolIncomplete: false`.
- Julgamentos: 101 trechos, kappa ponderado de 0,896, nenhum conflito no merge. O detalhe está no artifact do consenso.
- Comandos: `merge-judgments --corpus marc-deep --capture 58686cbe9fc0`, `validate --corpus marc-deep` (0 issues) e `deep-run --corpus marc-deep --capture 58686cbe9fc0`, todos via context-mode.

## Métricas por variante

| Variante | Success@5 | MRR@5 | P@5 | Incompletos |
|---|---|---|---|---|
| `DEEP` (B = 232) | 13/14 | 0,738 | 0,571 | 0 |
| `DEEP_ALL` (sem corte) | 13/14 | 0,738 | 0,571 | 0 |
| `DEEP_COSINE` (referência) | 13/14 | 0,750 | 0,500 | 0 |

`DEEP_BUDGET` não foi exercitado: o recuo B' só existe se a medição de latência da T3 reprovar o B = 232.

## Casos

| Caso | Modo | Trechos no escopo | Cortado | `DEEP` | `DEEP_ALL` | `DEEP_COSINE` | Saturados no top 5 |
|---|---|---|---|---|---|---|---|
| D01 | sem escopo | - | não | sucesso | sucesso | sucesso | 0 |
| D02 | sem escopo | - | não | sucesso | sucesso | sucesso | 1 |
| D03 | sem escopo | - | não | **falha (ordering)** | falha | falha | 1 |
| D04 | sem escopo | - | não | sucesso | sucesso | sucesso | 1 |
| D05 | escopo | 9 | não | sucesso | sucesso | sucesso | 0 |
| D06 | escopo | 12 | não | sucesso | sucesso | sucesso | 1 |
| D07 | escopo `[summary, artifact]` | 14 | não | sucesso | sucesso | sucesso | 0 |
| D08 | escopo | 36 | não | sucesso | sucesso | sucesso | 0 |
| D09 | escopo `[artifact]` | 48 | não | sucesso | sucesso | sucesso | 0 |
| D10 | escopo | 104 | não | sucesso | sucesso | sucesso | 0 |
| D11 | escopo `[chat]` | 34 | não | sucesso | sucesso | sucesso | 0 |
| D12 | escopo | 194 | não | sucesso | sucesso | sucesso | 0 |
| D13 | escopo `[artifact]` | 408 | sim | sucesso | sucesso | sucesso | 0 |
| D14 | escopo | 597 | sim | sucesso | sucesso | sucesso | 0 |

Nos dois casos cortados, o `DEEP` acertou. Só o D14 teve um top 5 diferente entre `DEEP` e `DEEP_ALL`, com o mesmo sucesso e o mesmo MRR (1,0).

## Diagnóstico do D03

**Consulta:** "qual foi o raciocínio para indexar apenas summaries na memory v1?"

- **A thread certa foi achada.** A `0e4dbaac` está em 1º no recall de produção, e o 2º trecho do `DEEP` é do `SUMMARY.md` dela (seção Decisões), julgado com grau 1.
- **Uma das evidências foi oferecida ao reranker e ficou abaixo do top 5.** O caminho sem escopo pontua 132 entradas:
  - a mensagem do `CHAT.md` com o objetivo citado (`#35f55350464b3efc`) ficou em 10º na saída efetiva do `DEEP`;
  - a seção Contexto do `SUMMARY.md` (`#fac53cdfbaaa0268`) não entra nesse pool.
  - As posições 29 e 67 citadas na primeira versão deste artifact eram da matriz capturada (538 registros), não da saída do `DEEP`. O Codex corrigiu isso no parecer.
- **Nenhum trecho de grau ≥ 2 apareceu no top 5 de qualquer variante.** O cosseno também falhou.

Pela precedência pré-declarada (segmentation → admission/pool → cap → ordering), a classe é **ordering**:
- uma passagem da evidência está no pool de um grupo admitido, fora do top 5. A classe admission/pool exigiria que nenhuma estivesse;
- o `DEEP_ALL` falha igual.

Ordering é o destino pré-declarado para o estudo de modelos. A classe, sozinha, não prova que trocar o modelo resolve o caso.

A consulta pede o "raciocínio", e a evidência fala da motivação em termos gerais, sem as palavras "indexar" ou "summaries". É um problema de relevância do modelo, não do desenho do `memory_deep`. Pelo plano, isso vai ao estudo de modelos, sem ajuste fino em 14 casos.

## Observações para o estudo de modelos

- **Reranker e cosseno empatam no Success@5 (13/14).** O reranker ganha em P@5 (0,571 contra 0,500) e o cosseno fica um pouco à frente em MRR@5 (0,750 contra 0,738). Com 14 casos, essas diferenças não são conclusivas.
- **Saturação do score:** 4 casos têm 1 trecho saturado perto de 1 no top 5. O desempate pré-declarado foi usado, sem efeito no gate.
- **Casos sem escopo (D01 a D04):** dependem da admissão da depth 2. Os quatro tiveram a thread certa admitida, e o D03 falhou só na ordem.

## Proposta de decisão

1. **Adotar o `DEEP` com B = 232.** O gate passou com folga de 1 caso, e o corte não mudou nenhum resultado.
2. **Nenhuma escolha D10 e nenhuma reavaliação.** Não houve falha de cap, admission/pool ou segmentation.
3. **D03 vai para o estudo de modelos,** como caso de ordering.
4. **Seguir para a T3:** medição de latência com o B = 232 (M0, com escopo e sem escopo), skill, docs, ADR 0013 e recalibração da descrição da ferramenta. O recuo B' só é usado se a mediana com escopo passar de 1,2 × M0.
