# Parecer independente sobre a decisão da E2

## Veredito

**Coaprovo os vereditos de H1, H2, H6, H7 e H3/H8, com os esclarecimentos abaixo.** As reproduções somente leitura confirmam os números usados na decisão. Não há promoção de modelo ou de ranking nesta decisão: o caminho escolhido preserva a ordem, a admissão e a interpretação do M0.

A Fase C depende da decisão humana D10 sobre as faixas. O escopo de limpeza também precisa preservar o runner genérico de benchmarks, conforme a observação sobre T6.

Fontes: msg_155b5ce737b54867a4, decisao-e2.md, plano da E2 revisão 3, adendo H7/H8 revisão 1, handoff-e2-correcoes.md e seção de estatística da E0. Foram conferidos o código das funções de avaliação e as saídas das capturas marc/1b68a7e3f4e6 e ledgerline-en/5ae0f660527c.

## Verificação independente

As análises executadas usaram Node com tsx e arquivos já existentes, sem escrever em capturas, código, datasets, julgamentos ou consensos:

- As seis comparações foram recalculadas com compareCaptures e comparadas integralmente aos compare-*.json. Todas coincidiram, incluindo scopes, intervalos, termos e cobertura.
- Os relatórios dos dois corpora foram reconstruídos em memória com replayCapture e buildReport. Variantes, métricas M0/produção, atribuição, interpretação, equivalência, folds, estilos e tamanho do corpus coincidiram com report.json.
- renderMarkdown(report.json) reproduziu exatamente cada report.md.
- Os 2.879 pares de fit-predictions.json coincidiram com os rótulos, folds, eligibility e admissão M0 atuais. As probabilidades externas p e semanticOnly e as faixas de recuo também foram reproduzidas pelos parâmetros armazenados de cada fold.
- H2 foi recalculada usando as calibrações do próprio fold, não as de produção. Os desvios, frações na mesma faixa e reprovações coincidiram.
- As contagens H3/H8 foram recalculadas por caso a partir dos outcomes gravados e da expectativa pré-declarada: sem gabarito, manter a consulta. Coincidiram nos 114 casos do marc e nos 40 do ledgerline-en.
- A análise auxiliar H6 do recuo foi reproduzida com labelledPairsOf e os cortes de produção do recuo. Também foi verificada a aplicação dos juízes no segundo corpus, sem reajuste.

Não foram executados os comandos fit, calibrate, h3, judge, choice, latency ou merge-judgments. As funções de comparação e relatório foram chamadas em memória, sem as CLIs que gravam arquivos. Nenhum modelo foi carregado ou baixado. Não foi usado Git.

## Vereditos por hipótese

### H1: coaprovo a reprovação e o recuo

O Top1-alvo mudou de 0,66 para 0,65, com IC da diferença [-0,0970149254; 0,0744680851], sem comprovar não inferioridade com margem 0,05.

O alvo de 3P tem p = 0,055653377 e semanticOnly = 0,049262598, abaixo do corte baixo externo de 0,075299376. Não foi admitido. O alvo de 6I foi admitido na faixa baixa, com semanticOnly = 0,089164959.

O recall de admissão melhora em 0,075 e a abstenção permanece não inferior, mas isso não substitui os demais critérios. O recuo reproduz a ordem e a admissão do M0. Sua precisão de admissão é 102/223 = 0,457399103, contra 117/365 = 0,320547945 no H1.

O sinal de exposição incidental foi interpretado corretamente na decisão: +0,13 é pior, independentemente do termo genérico mostrado pelo harness.

### H2: coaprovo a reprovação de N1 e N2

- N1: desvio da baixa 0,134101942 > 0,10; mesma faixa em 0,465753425 < 0,80.
- N2: desvios da média 0,204101723 e da baixa 0,450026599 > 0,10; mesma faixa em 0,139726027 < 0,80.

Fica a calibração padrão. Sem T3 no caminho escolhido.

### H6: coaprovo o limite e a consulta D10

No caminho p, os resultados acumulados acima de cada corte do marc são 16/16, 28/28 e 35/38. A calibração padrão falha no critério externo, como gravado.

O recuo de cortes do próprio ledgerline-en, ainda sobre p, passa no cálculo aninhado do harness: 0,90, 0,546511628 e 0,302325581. Isso não aprova o caminho escolhido: H1 foi reprovada e produção preservará a admissão do M0.

No caminho efetivamente escolhido, os 38 admitidos pelo M0 são todos relevantes. Com os cortes de produção do recuo, as faixas exclusivas são:

| Faixa | Relevantes / admitidos | Precisão |
| --- | --- | --- |
| alta | 26/26 | 1,0 |
| média | 9/9 | 1,0 |
| baixa | 3/3 | 1,0 |

Para essa amostra e essa admissão fixa, trocar somente cortes não cria erros entre os admitidos: toda faixa não vazia continua com precisão 1. Isso não pode satisfazer as distâncias absolutas de até 0,10 às metas 0,60 e 0,30. Esvaziar uma faixa não demonstra aprovação. O argumento auxiliar é válido, sem precisar rodar um novo ajuste.

**Precisão de linguagem:** accumulatedBands, em scripts/memory-eval/calibration.ts, mede conjuntos acumulados score >= corte, não os blocos exclusivos exibidos pela UI. As tabelas de H2 e do ramo p da H6 devem ser identificadas assim. A análise auxiliar de 26/9/3 e o diagnóstico do recuo no marc são exclusivos e restritos aos admitidos. Essa distinção não muda os vereditos e evita apresentar os dois estimandos como se fossem o mesmo.

### H7: coaprovo a rejeição dos dois juízes

No ramo escolhido, Qwen não altera a precisão de admissão nem a exposição incidental. Kev melhora a precisão em apenas 0,002060356, com IC [0; 0,006729960], sem o termo melhora. A exposição incidental também não diminui. Os dois têm Top1-alvo inconclusivo.

No ramo H1, também não há o ganho exigido: o IC da precisão do Qwen cruza zero e o da exposição incidental termina em zero; Kev não reduz exposição e seu IC de precisão começa em zero.

Há ainda uma reprovação externa independente no ramo escolhido. Com os parâmetros de produção do marc e sem reajuste no ledgerline-en:

| Juiz no recuo | Alta | Média | Baixa |
| --- | --- | --- | --- |
| Qwen | 29/29 | 6/6 | 3/3 |
| Kev | 27/27 | 7/7 | 4/4 |

Todos os 38 admitidos de cada juiz continuam relevantes. Logo, ambos falham nas metas externas da média e da baixa. Como H7 só filtra e reordena a pré-admissão do M0, qualquer subconjunto não vazio desses 38 pares continua com precisão 1.

A E2 segue sem juiz e sem T2b. A adoção de modelo novo e seu teto de custo não são acionados.

### H3/H8: coaprovo manter A

Contagens reproduzidas nos dois corpora somados:

| Alternativa | Correções certas | Correções indevidas | Sugestões certas | Sugestões indevidas |
| --- | --- | --- | --- | --- |
| A | 14 | 13 | 3 | 119 |
| B | 14 | 15 | 2 | 94 |
| C | 6 | 2 | 0 | 19 |
| D_KEV | 14 | 100 | 0 | 5 |
| D_LFM | 5 | 92 | 0 | 6 |

B aumenta um tipo de erro e perde sugestões certas; C perde acertos; D_KEV e D_LFM aumentam correções indevidas e perdem sugestões certas. Nenhuma atende ao critério conjuntivo pré-declarado. A exclusão do Laya corresponde à restrição de runtime sem dependência nova registrada no handoff.

Manter A é o recuo da comparação, não uma aprovação irrestrita de sua qualidade. A diferença entre estas contagens e a seção Interpretation dos report.md vem do universo: H3 inclui todos os casos, enquanto a seção histórica do report usa os casos com expectedInterpretation.

## Ampliação

Concordo em não ampliar nesta decisão, mas **não coaprovo a afirmação genérica de que efeitos pequenos ou ganho não demonstrado jamais poderiam mudar com casos novos**.

A justificativa suficiente, preservando os critérios, é:

1. H1 já falha no alvo obrigatório 3P da avaliação congelada.
2. H7 no ramo escolhido já falha no segundo corpus por uma razão independente dos ICs inconclusivos do marc. Ampliar o recorte do marc não remove o fato de que todos os candidatos pré-admitidos do ledgerline-en são relevantes e as faixas média e baixa não satisfazem a distância exigida.
3. A regra estatística da E0 permite uma única ampliação; ela não transforma uma falha determinística em aprovação nem exige novos casos para confirmar uma hipótese que já falhou em outro critério necessário.

As rodadas que preencheram julgamentos são cobertura, não ampliação estatística. O esclarecimento da decisão está correto.

## D10 e Fase C

### D10

Coaprovo submeter ao humano a opção de usar faixas heurísticas ordinais, sem prometer probabilidades, precisão numérica ou generalização entre projetos. A aprovação dessa concessão é humana e precisa anteceder o dispatch da implementação correspondente.

Nos admitidos externos do marc, as faixas exclusivas são 52/59 = 0,881355932, 34/83 = 0,409638554 e 16/81 = 0,197530864. A média e também a baixa excedem a distância de 0,10 às respectivas metas; o arredondamento da baixa para 0,20 não deve esconder isso. No ledgerline-en, as três precisões são iguais a 1: os dados não demonstram uma separação de confiança nesse corpus.

Não apresentar a inclusão das faixas como melhora comprovada da recuperação. O recuo conserva o motor; a mudança é de contrato e exposição dos resultados. Como a baixa será recolhida, a decisão humana deve considerar que ela contém resultados relevantes: 16 no marc e 3 no ledgerline-en nesta avaliação.

Se o humano não aceitar as faixas, revisar D2 e T5 antes do dispatch, como já prevê a proposta. Não implementar silenciosamente o caminho sem band.

### Fase C

Coaprovo T2 no recuo, T5 e T6, com medição de ponta a ponta e as seguintes condições:

- T2 preserva score como eligibility, a admissão e a ordenação M0; acrescenta band e abstained conforme a decisão humana. Não remove os módulos antigos de elegibilidade nem introduz juiz, calibração por projeto ou interpretador novo.
- T5 aplica a mesma semântica no core, MCP, HTTP, CLI e UI, com catálogo en-US, migração do snapshot e validação de navegador.
- T6 remove os scripts e testes de experimentação realmente substituídos e os comandos memory:quality e memory:benchmark.
- **Ajustar a remoção de test:benchmark:** package.json define um runner genérico, pnpm dlx tsx. Ele ainda é documentado em docs/development.md:54 e usado por performance/thread-index.benchmark.mjs, fora dos estudos de memory. Preservá-lo é a solução conservadora; removê-lo exigiria uma migração explícita desses usos e escopo documental correspondente. Não se trata de mudar um critério de qualidade depois da medição.
- Medir o caminho produtivo completo, com a condição de desktop da E0, e registrar a comparação de latência prevista no plano. Não inferir custo zero apenas pela ausência de um modelo novo.

A revisão desta decisão não é revisão final da implementação de produção, aceite humano ou autorização de encerramento.
