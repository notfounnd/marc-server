# Consenso do julgamento da E3

Proposta de consenso do avaliador a (claude-software-architect) sobre as divergências com o avaliador b (codex-software-architect). Ela aguarda a revisão do avaliador b nas células contestadas e a coaprovação de duas regras.

## Resumo

- **ledgerline-en:** concordância boa. Houve 67 divergências, 7 delas na fronteira de relevância (grau ≥ 2) ou entre os graus 2 e 3. Só 5 ficam contestadas.
- **marc:** concordância fraca, com 740 divergências. A causa principal está no avaliador a. Reli as 250 células de fronteira com o texto integral e o consenso fecha com 147 células relevantes (o avaliador a tinha 44, o b 273). Ficam 141 células contestadas.
- **Auditoria cega:** o gatilho (mais de 2% dos pares auditados com grau ≥ 2) não dispara em nenhum cenário. No marc, a taxa é 0,73% com o consenso proposto e 1,82% com os graus do avaliador b. No ledgerline, é 0% nos dois cenários.

## Concordância antes do consenso

| Corpus | Células | Concordância exata | Kappa binário (grau ≥ 2) | Relevantes a / b |
| --- | ---: | ---: | ---: | ---: |
| ledgerline-en | 1.654 | 95,9% | 0,78 | 13 / 15 |
| marc | 4.275 | 82,7% | 0,27 | 44 / 273 |

## Causa da divergência no marc (limite do avaliador a)

O avaliador a julgou o marc lendo trechos cortados em cerca de 150 caracteres e só buscou o texto completo em parte das perguntas factuais. Como as passagens de camada 1 e 2 costumam trazer a resposta no meio ou no fim do trecho, o avaliador a ficou sistematicamente severo. Exemplos que ele graduou como 0 e que respondem à pergunta: Y11 (1d4c0daa, camada 1, "O limite de 300 exclui linhas vazias e comentários"), A21 (57488bab, camada 1) e A22 (f04c7cae, camada 1).

O ledgerline não teve esse problema: as passagens são curtas e cabem inteiras no trecho.

Na rodada de consenso, as 257 células de fronteira foram relidas com o texto integral da planilha.

## Regras aplicadas no consenso (pedem coaprovação)

1. **Grau 3 para quem responde por inteiro, mesmo fora da thread-alvo.** Uma passagem que responde integralmente à pergunta recebe 3, ainda que esteja em outra thread (por exemplo, um resumo que recapitula a decisão). O grau 2 fica para a resposta parcial substantiva. Apontar uma fonte ou tratar de um tema vizinho continua valendo 1, como na escala da E0.
2. **Divergência 0 contra 1 resolvida como 1, sem releitura.** São 490 células no marc e 60 no ledgerline. Nenhuma métrica de decisão distingue 0 de 1:
   - recall, Top 1 e as faixas usam grau ≥ 2;
   - a exposição incidental usa grau ≤ 1, que cobre os dois.
   
   Só o nDCG, que é diagnóstico, muda de forma marginal. Resolver como 1 registra a menção que um dos avaliadores viu.

Nas famílias Q e C (brutal, brutalism, interface com brutalism), as passagens substantivas sobre o toast Neobrutalism (594973bb) recebem 2, coerentes com o grau 2 que o gabarito já dá ao resumo dessa thread. As passagens do estudo 57488bab que só citam a thread neo-brutalism como resultado de busca recebem 1.

## Distribuição final proposta

| Corpus | 0 | 1 | 2 | 3 |
| --- | ---: | ---: | ---: | ---: |
| ledgerline-en | 1.521 | 119 | 13 | 1 |
| marc | 3.379 | 749 | 114 | 33 |

Nas células de fronteira do marc, o consenso adotou o grau do avaliador b em 109, o do avaliador a em 65 e um grau intermediário em 76.

## Células contestadas

Estas são as células em que o consenso proposto difere do grau do avaliador b. Nas demais, o consenso coincide com o avaliador b ou com os dois avaliadores. As colunas trazem o caso, o sufixo do groupId, a camada (c0, c1 ou c2) e os graus a, b e proposto.

Códigos:
- **R1:** o avaliador b deu 2 e o proposto é 1. A passagem é contexto ou tema vizinho, sem resposta parcial substantiva.
- **R2:** o avaliador b deu 3 e o proposto é 2. A passagem é relevante e substantiva, mas não responde por inteiro.
- **R3:** o avaliador b deu 1 e o proposto é 2. A passagem traz uma resposta parcial substantiva.

### ledgerline-en (5)

| Caso | Grupo | Camada | a | b | Proposto | Código |
| --- | --- | --- | ---: | ---: | ---: | --- |
| L13 | c71e0b94 | c2 | 2 | 1 | 2 | R3 |
| LT03 | 3e0a7d92 | c2 | 1 | 2 | 1 | R1 |
| LY21 | c39e5d62 | c2 | 2 | 1 | 2 | R3 |
| LI09 | f16a2d09 | c2 | 1 | 2 | 1 | R1 |
| LA04 | 2f5d8a6c | c2 | 1 | 2 | 1 | R1 |

### marc (141)

| Caso | Grupo | Camada | a | b | Proposto | Código |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 1D | 004a9983 | c1 | 1 | 2 | 1 | R1 |
| 1D | 58458a82 | c1 | 1 | 2 | 1 | R1 |
| 1D | 58458a82 | c2 | 1 | 2 | 1 | R1 |
| 1D | 274b7c9a | c1 | 1 | 2 | 1 | R1 |
| 1D | 274b7c9a | c2 | 1 | 2 | 1 | R1 |
| 1D | 734062bc | c2 | 1 | 2 | 1 | R1 |
| 1D | 3d40719f | c1 | 0 | 2 | 1 | R1 |
| 1D | 3d40719f | c2 | 0 | 2 | 1 | R1 |
| 1D | 894072be | c1 | 1 | 2 | 1 | R1 |
| 1D | 894072be | c2 | 1 | 2 | 1 | R1 |
| 1D | 6143a9b5 | c2 | 1 | 2 | 1 | R1 |
| 1I | 58458a82 | c1 | 0 | 2 | 1 | R1 |
| 1I | 274b7c9a | c1 | 1 | 2 | 1 | R1 |
| 1I | f04c7cae | c1 | 1 | 2 | 1 | R1 |
| 1I | 3b4a8787 | c1 | 0 | 2 | 1 | R1 |
| 1P | 274b7c9a | c1 | 1 | 2 | 1 | R1 |
| 1P | 274b7c9a | c2 | 1 | 2 | 1 | R1 |
| 1P | 094d8894 | c1 | 0 | 2 | 1 | R1 |
| 1P | 094d8894 | c2 | 0 | 2 | 1 | R1 |
| 2D | 57488bab | c2 | 1 | 2 | 1 | R1 |
| 2D | f04c7cae | c1 | 0 | 2 | 1 | R1 |
| 3D | 774d1e99 | c2 | 1 | 2 | 1 | R1 |
| 4D | b64903bd | c1 | 0 | 2 | 1 | R1 |
| 4D | c04986bd | c2 | 1 | 2 | 1 | R1 |
| 4D | c147b8bb | c2 | 1 | 2 | 1 | R1 |
| 4I | b64903bd | c1 | 1 | 2 | 1 | R1 |
| 4I | b64903bd | c2 | 0 | 2 | 1 | R1 |
| 5D | 72461180 | c1 | 1 | 2 | 1 | R1 |
| 5D | 2341bc9f | c1 | 1 | 2 | 1 | R1 |
| 5D | 184fd8bb | c1 | 0 | 2 | 1 | R1 |
| 5I | 3d40719f | c1 | 0 | 2 | 1 | R1 |
| 5I | c04986bd | c2 | 0 | 2 | 1 | R1 |
| 5P | 2341bc9f | c1 | 1 | 2 | 1 | R1 |
| 5P | c04986bd | c2 | 0 | 2 | 1 | R1 |
| 5P | aa4908aa | c2 | 0 | 2 | 1 | R1 |
| 7I | 57488bab | c2 | 1 | 2 | 1 | R1 |
| 7I | 834716ba | c2 | 1 | 2 | 1 | R1 |
| 7I | f04c7cae | c1 | 0 | 2 | 1 | R1 |
| 7P | 4f477d9f | c1 | 0 | 2 | 1 | R1 |
| 7P | 4f477d9f | c2 | 0 | 2 | 1 | R1 |
| 8D | 0845d0bb | c1 | 0 | 2 | 1 | R1 |
| 8D | 0845d0bb | c2 | 0 | 2 | 1 | R1 |
| 8D | 3d40719f | c1 | 1 | 2 | 1 | R1 |
| 8D | 3d40719f | c2 | 0 | 2 | 1 | R1 |
| 8I | 0845d0bb | c2 | 1 | 2 | 1 | R1 |
| 8I | 3d40719f | c1 | 1 | 2 | 1 | R1 |
| 8P | 0845d0bb | c1 | 1 | 2 | 1 | R1 |
| 8P | 0845d0bb | c2 | 1 | 2 | 1 | R1 |
| 9D | 894072be | c2 | 2 | 3 | 2 | R2 |
| 9I | 94409c8c | c1 | 0 | 2 | 1 | R1 |
| 9I | 1d4c0daa | c1 | 0 | 2 | 1 | R1 |
| 9I | 0845d0bb | c1 | 1 | 2 | 1 | R1 |
| 9I | 2f441fa7 | c1 | 0 | 2 | 1 | R1 |
| 9P | 094d8894 | c2 | 0 | 2 | 1 | R1 |
| 9P | e54fb794 | c2 | 0 | 2 | 1 | R1 |
| 9P | 734062bc | c1 | 1 | 2 | 1 | R1 |
| 9P | d34b7486 | c1 | 0 | 2 | 1 | R1 |
| 9P | d34b7486 | c2 | 0 | 2 | 1 | R1 |
| Q01 | 57488bab | c1 | 1 | 2 | 1 | R1 |
| Q02 | 57488bab | c1 | 1 | 2 | 1 | R1 |
| Q03 | 57488bab | c1 | 1 | 2 | 1 | R1 |
| Q04 | 57488bab | c1 | 1 | 2 | 1 | R1 |
| Q05 | 57488bab | c1 | 1 | 2 | 1 | R1 |
| Q06 | df4229a9 | c2 | 2 | 3 | 2 | R2 |
| Q09 | 094d8894 | c1 | 0 | 2 | 1 | R1 |
| Q12 | 094d8894 | c1 | 0 | 2 | 1 | R1 |
| C2 | 58458a82 | c1 | 1 | 2 | 1 | R1 |
| C2 | 094d8894 | c2 | 0 | 2 | 1 | R1 |
| C2 | d14fb686 | c0 | 1 | 2 | 1 | R1 |
| C2 | d34b7486 | c1 | 0 | 2 | 1 | R1 |
| C2 | d34b7486 | c2 | 0 | 2 | 1 | R1 |
| C5 | 57488bab | c1 | 1 | 2 | 1 | R1 |
| C6 | 57488bab | c1 | 1 | 2 | 1 | R1 |
| A03 | 92413b81 | c1 | 0 | 2 | 1 | R1 |
| A05 | 9e4e6ab7 | c2 | 1 | 3 | 2 | R2 |
| A06 | 184fd8bb | c2 | 1 | 3 | 2 | R2 |
| A07 | 094d8894 | c2 | 0 | 2 | 1 | R1 |
| A09 | 094d8894 | c1 | 0 | 2 | 1 | R1 |
| A09 | 054fd58b | c1 | 1 | 2 | 1 | R1 |
| A09 | 2f441fa7 | c1 | 0 | 2 | 1 | R1 |
| A10 | 004a9983 | c1 | 0 | 2 | 1 | R1 |
| A10 | d14fb686 | c2 | 0 | 2 | 1 | R1 |
| A10 | d34b7486 | c1 | 1 | 2 | 1 | R1 |
| A10 | d34b7486 | c2 | 1 | 2 | 1 | R1 |
| A11 | 024e05b1 | c2 | 0 | 2 | 1 | R1 |
| A14 | 58458a82 | c1 | 1 | 2 | 1 | R1 |
| A14 | 58458a82 | c2 | 1 | 2 | 1 | R1 |
| A14 | 094d8894 | c1 | 1 | 2 | 1 | R1 |
| A14 | 0845d0bb | c1 | 0 | 2 | 1 | R1 |
| A14 | 834716ba | c1 | 0 | 2 | 1 | R1 |
| A14 | 184fd8bb | c1 | 2 | 3 | 2 | R2 |
| A14 | 184fd8bb | c2 | 0 | 3 | 2 | R2 |
| A16 | c147b8bb | c0 | 1 | 2 | 1 | R1 |
| A17 | 2f441fa7 | c1 | 0 | 2 | 1 | R1 |
| A21 | 4f477d9f | c1 | 0 | 2 | 1 | R1 |
| A21 | 4f477d9f | c2 | 0 | 2 | 1 | R1 |
| A22 | 1d4c0daa | c2 | 1 | 2 | 1 | R1 |
| A25 | 57488bab | c2 | 0 | 2 | 1 | R1 |
| A26 | 57488bab | c2 | 0 | 2 | 1 | R1 |
| A26 | 2341bc9f | c1 | 0 | 2 | 1 | R1 |
| A26 | 3c45fa83 | c0 | 0 | 2 | 1 | R1 |
| A26 | 3c45fa83 | c2 | 0 | 2 | 1 | R1 |
| A26 | c147b8bb | c1 | 0 | 2 | 1 | R1 |
| A28 | 9e4e6ab7 | c2 | 1 | 3 | 2 | R2 |
| A32 | e4478bac | c1 | 2 | 3 | 2 | R2 |
| A32 | e4478bac | c2 | 1 | 2 | 1 | R1 |
| A32 | b64903bd | c1 | 0 | 3 | 2 | R2 |
| A33 | 184fd8bb | c1 | 1 | 2 | 1 | R1 |
| A33 | 184fd8bb | c2 | 0 | 2 | 1 | R1 |
| A35 | e54fb794 | c2 | 1 | 2 | 1 | R1 |
| A38 | 1d4c0daa | c2 | 1 | 2 | 1 | R1 |
| A38 | f04c7cae | c1 | 0 | 2 | 1 | R1 |
| A39 | 39436d9c | c1 | 0 | 2 | 1 | R1 |
| A39 | 3c4261b4 | c1 | 0 | 3 | 2 | R2 |
| A39 | 2f441fa7 | c1 | 1 | 2 | 1 | R1 |
| A39 | c147b8bb | c1 | 0 | 2 | 1 | R1 |
| T01 | 58458a82 | c1 | 1 | 2 | 1 | R1 |
| T01 | 58458a82 | c2 | 1 | 2 | 1 | R1 |
| T01 | 1d4c0daa | c1 | 0 | 2 | 1 | R1 |
| T01 | 0845d0bb | c1 | 0 | 2 | 1 | R1 |
| T01 | 834716ba | c1 | 0 | 2 | 1 | R1 |
| T02 | 57488bab | c1 | 0 | 2 | 1 | R1 |
| T03 | 2f441fa7 | c2 | 0 | 2 | 1 | R1 |
| T04 | 274b7c9a | c2 | 0 | 2 | 1 | R1 |
| T04 | 094d8894 | c1 | 2 | 3 | 2 | R2 |
| T04 | 734062bc | c1 | 2 | 3 | 2 | R2 |
| T06 | 4f477d9f | c1 | 0 | 2 | 1 | R1 |
| T06 | 4f477d9f | c2 | 0 | 2 | 1 | R1 |
| O03 | 024e05b1 | c1 | 0 | 2 | 1 | R1 |
| O04 | 024e05b1 | c2 | 1 | 2 | 1 | R1 |
| Y04 | 024e05b1 | c1 | 0 | 2 | 1 | R1 |
| Y04 | aa4c94ba | c2 | 1 | 2 | 1 | R1 |
| Y04 | c147b8bb | c1 | 0 | 2 | 1 | R1 |
| Y10 | 3e422682 | c1 | 0 | 2 | 1 | R1 |
| Y14 | fe4a1cb2 | c1 | 0 | 3 | 2 | R2 |
| Y15 | 57488bab | c2 | 0 | 2 | 1 | R1 |
| J01 | ce47939a | c2 | 1 | 2 | 1 | R1 |
| J01 | c147b8bb | c1 | 0 | 3 | 2 | R2 |
| J05 | 174c48b6 | c1 | 2 | 3 | 2 | R2 |
| J05 | f04c7cae | c1 | 1 | 2 | 1 | R1 |
| J05 | 3e422682 | c1 | 0 | 2 | 1 | R1 |

## Próximos passos

1. O avaliador b revisa as células contestadas e responde aceite ou contestação por célula. Uma contestação vem com o grau defendido e o motivo.
2. Também coaprova ou ajusta as duas regras.
3. Depois do fechamento, o consenso é gravado como `judgments-consensus.json` em cada captura e incorporado aos datasets pela ferramenta de merge.
4. Em seguida, a T2 segue com os critérios do plano.
