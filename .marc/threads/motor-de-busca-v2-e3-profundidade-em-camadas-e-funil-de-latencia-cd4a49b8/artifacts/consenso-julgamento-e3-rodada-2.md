# Consenso do julgamento da E3, rodada 2

Resposta do avaliador a (claude-software-architect) à revisão do avaliador b em marc://msg_99a5dff2b43e4697b2.

## Resumo

- **Contestações do avaliador b na rodada 1:** aceitas as 61 (2 no ledgerline-en e 59 no marc), com os graus defendidos.
- **Escala:** adotada a redação de quatro graus proposta pelo avaliador b.
  - Tema vizinho, sozinho, vale 0.
  - Menção incidental ao assunto específico, referência ou indicação de fonte vale 1.
  - Resposta parcial substantiva vale 2.
  - Resposta integral vale 3, independentemente da thread de origem.
- **Divergências 0/1:** a regra automática foi retirada. As 550 células (490 no marc e 60 no ledgerline-en) foram adjudicadas pelo trecho integral da worksheet, com essa escala:
  - 400 coincidem com o grau do avaliador b;
  - 165 adotam o grau do avaliador a e ficam abertas à revisão do avaliador b.
- **Gatilho da auditoria cega, contado por par auditado:**
  - marc: 3 de 274 pares, ou 1,09%, abaixo de 2% (1I/f04c7cae, C2/d14fb686 e T01/e54fb794, todos com grau 2);
  - ledgerline-en: 0 de 158 pares.
  - Todos os pares auditados permanecem na referência.

## Distribuição com a proposta desta rodada

| Corpus | 0 | 1 | 2 | 3 | Relevantes (≥ 2) |
| --- | ---: | ---: | ---: | ---: | ---: |
| ledgerline-en | 1.560 | 80 | 13 | 1 | 14 |
| marc | 3.525 | 553 | 154 | 43 | 197 |

## Critério aplicado nas células 0/1

- **Grau 1** quando o trecho menciona o assunto específico da consulta ou indica a fonte. Exemplos:
  - as matrizes de consultas dos estudos 57488bab e 834716ba, que reproduzem a consulta e o alvo;
  - as listas de hashes do 3c4dda95 que nomeiam a thread-alvo;
  - menções ao mecanismo perguntado (bootstrap, cursor, lock, toggle).
- **Grau 0** quando o trecho só compartilha vocabulário ou área. Exemplos:
  - entregas de memória sem relação com o assunto;
  - resumos que tratam de outro problema;
  - listas de hashes que não nomeiam a thread-alvo;
  - textos de bootstrap ou Custom Rules em consultas sobre outro tema.
- Nas consultas brutal, brutalism e interface com brutalism, o trecho 594973bb sobre a tradução de rótulos do toast não menciona neobrutalism e recebe 0. Em J07, a consulta sobre a sombra dos componentes, os trechos sobre a busca por "brutalism" são tema vizinho e recebem 0.

## Células abertas

Estas são as células em que o grau proposto difere do grau do avaliador b. As colunas trazem o caso, o sufixo do groupId, a camada e os graus a, b e proposto.

### ledgerline-en (15, proposto 1 onde b deu 0)

| Caso | Grupo | Camada | a | b | Proposto |
| --- | --- | --- | ---: | ---: | ---: |
| L10 | c71e0b94 | c2 | 1 | 0 | 1 |
| L29 | b4e8c293 | c2 | 1 | 0 | 1 |
| LY17 | 41c7f0ae | c0 | 1 | 0 | 1 |
| LY17 | 41c7f0ae | c2 | 1 | 0 | 1 |
| LY17 | c39e5d62 | c2 | 1 | 0 | 1 |
| LY18 | 41c7f0ae | c0 | 1 | 0 | 1 |
| LY20 | e07d5c18 | c1 | 1 | 0 | 1 |
| LY20 | b4e8c293 | c2 | 1 | 0 | 1 |
| LY21 | 41c7f0ae | c0 | 1 | 0 | 1 |
| LI04 | 6b5c9e04 | c0 | 1 | 0 | 1 |
| LI04 | 6b5c9e04 | c2 | 1 | 0 | 1 |
| LA03 | c0e6b915 | c0 | 1 | 0 | 1 |
| LA03 | c0e6b915 | c2 | 1 | 0 | 1 |
| LA03 | e94b1d26 | c2 | 1 | 0 | 1 |
| LA05 | c0e6b915 | c2 | 1 | 0 | 1 |

### marc (150)

O proposto é 0 onde o avaliador b deu 1, salvo nas 22 linhas marcadas com proposto 1.

| Caso | Grupo | Camada | a | b | Proposto |
| --- | --- | --- | ---: | ---: | ---: |
| 1I | 58458a82 | c2 | 0 | 1 | 0 |
| 1I | 184fd8bb | c2 | 0 | 1 | 0 |
| 1P | 054fd58b | c2 | 0 | 1 | 0 |
| 1P | 894072be | c1 | 1 | 0 | 1 |
| 2D | 3c4dda95 | c2 | 0 | 1 | 0 |
| 2D | aa4908aa | c2 | 0 | 1 | 0 |
| 2D | d540c6b4 | c1 | 0 | 1 | 0 |
| 2I | 774d1e99 | c1 | 0 | 1 | 0 |
| 2I | 774d1e99 | c2 | 0 | 1 | 0 |
| 2I | aa4908aa | c1 | 0 | 1 | 0 |
| 2I | d540c6b4 | c1 | 1 | 0 | 1 |
| 2I | 934c4896 | c1 | 0 | 1 | 0 |
| 2P | 3c4dda95 | c2 | 0 | 1 | 0 |
| 3I | 94409c8c | c1 | 0 | 1 | 0 |
| 3I | 94409c8c | c2 | 0 | 1 | 0 |
| 5D | 274b7c9a | c2 | 0 | 1 | 0 |
| 5D | b64903bd | c2 | 0 | 1 | 0 |
| 5D | f04c7cae | c2 | 0 | 1 | 0 |
| 5I | 3d40719f | c2 | 0 | 1 | 0 |
| 5P | b64903bd | c2 | 0 | 1 | 0 |
| 6I | d14fb686 | c2 | 0 | 1 | 0 |
| 7D | e4478bac | c1 | 1 | 0 | 1 |
| 7I | 0e4dbaac | c1 | 0 | 1 | 0 |
| 7I | 0e4dbaac | c2 | 0 | 1 | 0 |
| 7I | f04c7cae | c2 | 0 | 1 | 0 |
| 7P | 0e4dbaac | c1 | 0 | 1 | 0 |
| 7P | e4478bac | c1 | 0 | 1 | 0 |
| 8D | 39436d9c | c2 | 0 | 1 | 0 |
| 8D | 3c4dda95 | c0 | 0 | 1 | 0 |
| 8D | 3c4dda95 | c2 | 0 | 1 | 0 |
| 8I | 774d1e99 | c1 | 1 | 0 | 1 |
| 8I | 2f441fa7 | c1 | 0 | 1 | 0 |
| 8P | 72461180 | c0 | 0 | 1 | 0 |
| 9D | d14fb686 | c0 | 0 | 1 | 0 |
| 9D | d14fb686 | c1 | 0 | 1 | 0 |
| 9D | d14fb686 | c2 | 0 | 1 | 0 |
| 9D | d34b7486 | c1 | 0 | 1 | 0 |
| 9D | d34b7486 | c2 | 0 | 1 | 0 |
| 9I | 0e4dbaac | c1 | 0 | 1 | 0 |
| 9I | 3c4dda95 | c1 | 0 | 1 | 0 |
| 9I | 3c4dda95 | c2 | 0 | 1 | 0 |
| 9I | 894072be | c1 | 0 | 1 | 0 |
| 9I | 2f441fa7 | c2 | 0 | 1 | 0 |
| 9P | 92413b81 | c1 | 0 | 1 | 0 |
| 9P | 094d8894 | c1 | 0 | 1 | 0 |
| 9P | e54fb794 | c0 | 0 | 1 | 0 |
| 9P | 834716ba | c0 | 0 | 1 | 0 |
| 9P | 734062bc | c2 | 0 | 1 | 0 |
| 9P | 3b4a8787 | c1 | 0 | 1 | 0 |
| Q04 | 594973bb | c1 | 0 | 1 | 0 |
| Q05 | 594973bb | c1 | 0 | 1 | 0 |
| Q08 | 0e4dbaac | c2 | 0 | 1 | 0 |
| Q09 | d540c6b4 | c1 | 0 | 1 | 0 |
| Q10 | 0e4dbaac | c1 | 0 | 1 | 0 |
| Q10 | 0e4dbaac | c2 | 0 | 1 | 0 |
| Q11 | 0e4dbaac | c1 | 0 | 1 | 0 |
| Q11 | 0e4dbaac | c2 | 0 | 1 | 0 |
| Q12 | d540c6b4 | c1 | 0 | 1 | 0 |
| C1 | 774d1e99 | c1 | 0 | 1 | 0 |
| C1 | 774d1e99 | c2 | 0 | 1 | 0 |
| C1 | aa4908aa | c1 | 0 | 1 | 0 |
| C1 | d540c6b4 | c1 | 1 | 0 | 1 |
| C2 | 094d8894 | c1 | 0 | 1 | 0 |
| C2 | 3b4a8787 | c1 | 0 | 1 | 0 |
| C6 | 594973bb | c1 | 0 | 1 | 0 |
| A02 | 834716ba | c1 | 0 | 1 | 0 |
| A02 | 834716ba | c2 | 0 | 1 | 0 |
| A03 | 004a9983 | c1 | 0 | 1 | 0 |
| A03 | dd4a5684 | c1 | 0 | 1 | 0 |
| A03 | dd4a5684 | c2 | 0 | 1 | 0 |
| A03 | 92413b81 | c2 | 0 | 1 | 0 |
| A03 | 934c4896 | c0 | 0 | 1 | 0 |
| A04 | 004a9983 | c1 | 0 | 1 | 0 |
| A04 | 57488bab | c1 | 0 | 1 | 0 |
| A05 | 094d8894 | c1 | 0 | 1 | 0 |
| A05 | d14fb686 | c0 | 0 | 1 | 0 |
| A05 | d14fb686 | c2 | 0 | 1 | 0 |
| A05 | d34b7486 | c1 | 0 | 1 | 0 |
| A05 | d34b7486 | c2 | 0 | 1 | 0 |
| A07 | 92413b81 | c1 | 1 | 0 | 1 |
| A09 | 5845b8a1 | c0 | 1 | 0 | 1 |
| A10 | 274b7c9a | c1 | 0 | 1 | 0 |
| A10 | 274b7c9a | c2 | 0 | 1 | 0 |
| A10 | 184fd8bb | c1 | 0 | 1 | 0 |
| A10 | fe4a1cb2 | c1 | 0 | 1 | 0 |
| A10 | fe4a1cb2 | c2 | 0 | 1 | 0 |
| A13 | 94409c8c | c1 | 0 | 1 | 0 |
| A13 | 94409c8c | c2 | 0 | 1 | 0 |
| A13 | 57488bab | c2 | 0 | 1 | 0 |
| A14 | 72461180 | c1 | 0 | 1 | 0 |
| A14 | 72461180 | c2 | 0 | 1 | 0 |
| A14 | 054fd58b | c0 | 0 | 1 | 0 |
| A14 | 054fd58b | c2 | 0 | 1 | 0 |
| A14 | 734062bc | c1 | 0 | 1 | 0 |
| A14 | 6143a9b5 | c2 | 0 | 1 | 0 |
| A17 | 3d40719f | c0 | 1 | 0 | 1 |
| A19 | e54fb794 | c0 | 0 | 1 | 0 |
| A20 | fe4a1cb2 | c1 | 0 | 1 | 0 |
| A22 | 004a9983 | c1 | 1 | 0 | 1 |
| A23 | 57488bab | c1 | 0 | 1 | 0 |
| A25 | 094d8894 | c1 | 0 | 1 | 0 |
| A26 | 2341bc9f | c2 | 0 | 1 | 0 |
| A26 | 1d4c0daa | c1 | 0 | 1 | 0 |
| A28 | 004a9983 | c1 | 0 | 1 | 0 |
| A28 | 094d8894 | c2 | 0 | 1 | 0 |
| A28 | 3d40719f | c0 | 0 | 1 | 0 |
| A28 | 3d40719f | c1 | 0 | 1 | 0 |
| A28 | 3d40719f | c2 | 0 | 1 | 0 |
| A29 | fe4a1cb2 | c1 | 0 | 1 | 0 |
| A29 | fe4a1cb2 | c2 | 0 | 1 | 0 |
| A31 | 024e05b1 | c1 | 0 | 1 | 0 |
| A31 | 024e05b1 | c2 | 0 | 1 | 0 |
| A33 | 0e4dbaac | c1 | 0 | 1 | 0 |
| A34 | dd4a5684 | c1 | 1 | 0 | 1 |
| A35 | 774d1e99 | c1 | 0 | 1 | 0 |
| A35 | 39436d9c | c1 | 0 | 1 | 0 |
| A37 | 834716ba | c0 | 0 | 1 | 0 |
| A38 | 094d8894 | c2 | 0 | 1 | 0 |
| T01 | 004a9983 | c2 | 0 | 1 | 0 |
| T01 | 92413b81 | c1 | 0 | 1 | 0 |
| T02 | 3c4261b4 | c1 | 0 | 1 | 0 |
| T03 | 3b4a8787 | c1 | 1 | 0 | 1 |
| T05 | 57488bab | c1 | 0 | 1 | 0 |
| T06 | 0e4dbaac | c2 | 0 | 1 | 0 |
| T08 | aa4908aa | c1 | 0 | 1 | 0 |
| T08 | 3e422682 | c1 | 1 | 0 | 1 |
| T08 | 3e422682 | c2 | 1 | 0 | 1 |
| O01 | 004a9983 | c1 | 0 | 1 | 0 |
| O01 | 004a9983 | c2 | 0 | 1 | 0 |
| O01 | dd4a5684 | c1 | 0 | 1 | 0 |
| O01 | dd4a5684 | c2 | 0 | 1 | 0 |
| O01 | 834716ba | c1 | 1 | 0 | 1 |
| O03 | 72461180 | c0 | 0 | 1 | 0 |
| O03 | 72461180 | c1 | 0 | 1 | 0 |
| O03 | 72461180 | c2 | 0 | 1 | 0 |
| Y02 | 0845d0bb | c1 | 1 | 0 | 1 |
| Y05 | f04c7cae | c1 | 0 | 1 | 0 |
| Y05 | f04c7cae | c2 | 0 | 1 | 0 |
| Y08 | 3b4a8787 | c2 | 1 | 0 | 1 |
| Y09 | 774d1e99 | c1 | 1 | 0 | 1 |
| Y09 | 3d40719f | c1 | 1 | 0 | 1 |
| Y12 | 594973bb | c1 | 0 | 1 | 0 |
| Y13 | 57488bab | c1 | 1 | 0 | 1 |
| Y14 | 894072be | c0 | 1 | 0 | 1 |
| J01 | f04c7cae | c1 | 0 | 1 | 0 |
| J01 | 2f441fa7 | c0 | 0 | 1 | 0 |
| J01 | 2f441fa7 | c2 | 0 | 1 | 0 |
| J01 | c147b8bb | c2 | 0 | 1 | 0 |
| J04 | 3b4a8787 | c2 | 1 | 0 | 1 |
| J06 | f04c7cae | c1 | 0 | 1 | 0 |

## Próximos passos

1. O avaliador b aceita ou contesta as 165 células, aceitando por bloco quando a mesma evidência sustentar a mesma conclusão.
2. Com o consenso fechado, gravo `judgments-consensus.json` nas duas capturas, reconfiro o gatilho por par auditado e incorporo o resultado aos datasets.
