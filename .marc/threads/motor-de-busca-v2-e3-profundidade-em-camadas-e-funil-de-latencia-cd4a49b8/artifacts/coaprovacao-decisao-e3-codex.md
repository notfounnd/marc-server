# Coaprovação da proposta de decisão da E3

## Veredito

**Coaprovo a direção escolhida em D10, a retirada do funil/adaptação da produção e o início da T3 reduzida.** Há ajustes de relato e de aceites a preservar, listados abaixo. Eles não reabrem a decisão humana nem impedem a T3; impedem apenas apresentar como comprovados a identidade histórica de DEPTH0 ou o aceite de rebuild na máquina de referência.

Esta revisão é da proposta de decisão e de sua evidência de medição, não a aprovação final da implementação da E3.

## Fontes e conferência

- Proposta: marc://msg_e55e07f2ab4e49dfb5 e decisao-e3.md.
- Entrega revisada da T2: marc://msg_9c2f4550754e4ae9a8 e entrega-t2-e3-revisao.md.
- Escolha humana e T4 paralela: marc://msg_6b39861026694b3fa4.
- Plano da E3, revisão 8: seções 1, 4, “Avaliação e decisão” e tarefas.
- Os quatro t2-report.json/t2-report-cosine-fts.json das capturas marc/87cd2e4d96f7 e ledgerline-en/0d31bd4afd3f.
- Código de t2-run.ts, t2-decision.ts, evaluation.ts, dataset.ts, metrics.ts e a implementação de DEPTH0 em variants.ts, nos trechos pertinentes.

Inspeção por context-mode, sem executar novamente o harness ou regravar suas saídas.

## 1. Critérios e números da T2

### H4

Confirmo a reprovação no marc:

- Recall dos finalistas: diferença −0,063444, IC [−0,090634; −0,037267], cujo limite inferior não atende > −0,02.
- K = 30, o K_max, em todos os folds, com met=false. A cláusula “se algum fold já usava K_max” já leva a D10: não cabe ampliar silenciosamente a grade ou selecionar K > 30 sem nova matriz autorizada.
- Sobrevivência por passageId: 16/22 = 0,727273; após o único recuo cosine-fts, 17/22 = 0,772727. Ambos abaixo de 0,90.
- Top1 total FUNNEL × ALL_PASSAGES: não inferior nos dois modos. Isso não compensa as outras condições, que são conjuntas.

No ledgerline-en, K=20 atende a regra, o recall não perde relevantes, a sobrevivência é 29/29 e o Top1 total é não inferior. Os subconjuntos extras do relatório não devem ser confundidos com novos gates depois da medição.

### H5

Confirmo a reprovação no marc:

- Top1 total melhora +0,121951; o recall melhora nos implicit (+0,182927) e layer (+0,520000).
- Exposição incidental total piora: −0,162602, IC [−0,295775; −0,048780]. O código inverte corretamente essa métrica de dano para base − candidato; negativo significa mais exposição no ADAPTIVE.
- Abstenção correta é inconclusiva no modo cosine e piora no cosine-fts.
- J01 e J07 param na camada 0 antes da evidência na camada 1: 2/8, excedendo o máximo de 1. Ambos são disparos de grau 1 na faixa alta, com score arredondado a 1.
- Determinismo: nenhuma divergência nos 137 casos do marc e 79 do ledgerline-en.

O resultado favorável em Top1/recall não permite compensar os gates de dano e de parada. A reprovação não é um problema apenas de latência, portanto se aplica o recuo da linha H5 do plano. Não é preciso reabrir o critério nem transformar a ampliação de um resultado inconclusivo em tentativa de salvar uma hipótese que já falha por exposição e armadilhas.

No ledgerline-en, passam os critérios primários declarados de H5. Isso não autoriza adoção por corpus ou substitui a decisão conservadora para o produto.

### Referência comum e lacunas

A implementação corresponde ao referencial descrito na entrega revisada:

- evaluation.ts:181–204 atribui aos dois lados a mesma profundidade de referência, o máximo das depths comparadas.
- dataset.ts:149–175 usa o maior grau entre as camadas efetivamente julgadas até essa profundidade. Uma camada ausente não é inventada como 0.
- metrics.ts:224–240 usa essa referência no denominador; o numerador continua com os graus acessíveis à própria variante.
- A completude é aferida na própria depth de cada variante. t2-run.ts:944–969 separa as células ausentes da referência como diagnóstico, sem bloquear artificialmente uma variante completa.

Conferi os diagnósticos: H4 sem células pendentes de referência; H5 com 510 no marc/cosine, 505 no recuo e 76 no ledgerline-en. As lacunas de grupos relevantes são 30/332 no marc e 2/103 no ledgerline-en. As sete variantes têm cobertura própria completa. Isso sustenta as comparações no universo julgado, não uma declaração de recall completo sobre conteúdo que ninguém julgou.

As faixas passam no critério externo declarado, mas os cortes altos saturados e os disparos incidentais mostram que esse passe não valida a regra de parada por si só.

## 2. Consequências e escopo de produção

Coaprovo:

- UI com uma busca em depth 0, sem Deep, sem expansão adaptativa e sem funil.
- Camadas 1 e 2 indexadas e acessíveis por pedido explícito no MCP/CLI e na continuidade já prevista na E4.
- T3 limitada a esse percurso, com reranqueamento completo sem a pré-seleção K/P/B do funil, preservando a ordenação/admissão aprovada para o caminho correspondente.
- Código experimental do funil no harness para estudo futuro, sem ativação oculta ou fallback adaptativo na produção.
- T4 em paralelo, porque sua retirada de Deep/searchRetryDepth e o contrato de grupos sem thread valem nos dois resultados. Esta coaprovação não declara revisada ou pronta a implementação paralela.

O acesso explícito a depth 2 no MCP não equivale a afirmar que uma busca mais profunda é universalmente melhor, nem autoriza aplicar ao MCP o gate de latência que foi declarado para a UI.

## 3. Ajustes no relato e nos aceites

### R1. “DEPTH0 = M0” não é identidade histórica comprovada

**Referências:** decisao-e3.md:43, :47 e :50; plano:74–78 e :383.

A revisão 6 já substituiu identidade por não inferioridade contra o M0 congelado: o índice misto mudou BM25 em 114/114 casos e três vetores da camada 0. Usar o algoritmo de ordenação/admissão do M0, como faz variants.ts:421–430, não prova que o resultado seja idêntico à captura anterior à E3.

**Ajuste pedido:** escrever “DEPTH0 usa o caminho de ordenação/admissão do M0, sem funil”, sem alegar identidade binária ou igualdade histórica das listas. Preservar como aceite de integração a não inferioridade já aprovada contra 1b68a7e3f4e6, nos casos comuns pareados, para Top1-alvo, recall implicit e abstenção, com δ 0,05 e bootstrap por família. Não encontrei essa comparação histórica nos reports T2 examinados; H5 contra DEPTH0 não a substitui.

Esse é um aceite existente, não uma nova hipótese nem uma exigência de refazer T2 antes de iniciar T3.

### R2. Rebuild de 177 s não fecha o critério de máquina

**Referência:** decisao-e3.md:36; plano:308.

O valor 177 s está abaixo de 900 s, mas o próprio texto informa que a medição não foi feita na máquina de referência. Logo, “passa” extrapola a condição pré-registrada.

**Ajuste pedido:** registrar “177 s e pico de 2,7 GB nesta máquina; aceite na máquina de referência pendente de medição ou dispensa humana explícita”. A D10 que escolhe não adotar o funil/adaptação não é, por si só, dispensa desse outro critério. Não executei rebuild nem validei independentemente essa medição de tempo/RAM.

### R3. Intervalo da abstenção deve identificar o scope

**Referência:** decisao-e3.md:33.

O IC [−0,462; 0] é a linha total do report. A linha explicitamente negative, correspondente ao rótulo “nos negativos”, traz −0,214286 com IC [−0,428571; 0] no cosine; no cosine-fts, −0,285714 com IC [−0,5; −0,071429].

**Ajuste pedido:** usar a linha negative ou identificar que o IC reproduzido veio de total. O veredito permanece inconclusivo/piora, respectivamente; esse ajuste não modifica a consequência de H5.

## 4. T5: medir o percurso que realmente será entregue

Coaprovo a substituição de ADAPTIVE pelo caminho efetivo da UI na medição final, porque ADAPTIVE foi retirado da produção por D10. Preservar:

- UI/DEPTH0 e M0 pré-E3 na mesma execução e na máquina de referência.
- M0 com lotes na ordem original/input, como plano:197–200; a ordenação por tamanho da E3 não deve diminuir a referência.
- O limite humano já declarado: mediana da UI ≤ 1,2 × mediana do M0. “Deve ficar igual” não é uma obrigação de igualdade exata de tempos e não substitui essa regra.
- p95 e alvo de 5 s reportados, sem virarem novos gates.
- Caminho real do MCP com depth 2 e reranqueamento completo medido separadamente, apenas reportado, sem aplicar-lhe o teto da UI.

A latência ainda não foi medida nesta revisão. Não deduzo seu resultado da remoção do funil ou de um replay offline. Manter ADR/docs e os demais aceites da T5 que não foram dispensados, sem ampliar a implementação para recuperar o experimento reprovado.

## Checks e limites

Executei por context-mode:

node --test --import tsx test/memory-eval-common-reference.test.ts test/memory-eval-t2-decision.test.ts test/memory-eval-t2-determinism.test.ts

Resultado: exit 0; 7 testes aprovados, zero falhas e zero skips.

Os 1.009 testes e os checks globais são evidência relatada pelo desenvolvedor, não uma execução repetida por mim nesta revisão. Não fiz Git, capture, rebuild, pnpm validate nem alterações nos dados/saídas. A única escrita é este parecer e sua publicação na thread.

**Conclusão:** a decisão conservadora e o escopo reduzido podem seguir. A igualdade histórica de DEPTH0, o aceite de rebuild na máquina de referência e a latência final não são fatos já demonstrados pela T2. A aprovação técnica final da E3 e o encerramento da thread continuam pendentes dos seus respectivos aceites.
