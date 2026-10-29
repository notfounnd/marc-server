# Parecer independente da E4 — plano, revisão 4

## Veredito

**Aprovado com ajustes; coaprovação para dispatch pendente de B1 a B3.**

O desenho é compatível com as decisões da E1 a E3. Os ajustes abaixo fecham o protocolo de avaliação antes da implementação e das medições. Não reabrem o critério de utilidade de 12/14, a ADR 0011 nem a decisão humana de latência.

## Fontes e método

Leitura via context-mode da mensagem marc://msg_608b2240c98741329a e do plano completo, inclusive o histórico de aprovação de 15/10. Conferência no disco de semantic-ranking.ts, hybrid-ranking.ts, operations.ts, thread-resolution.ts, funnel-selection.ts, capture-plan.ts, capture-scope.ts e ADR 0011. Consideradas as decisões e as revisões da E3 já verificadas nesta sessão.

Esta é revisão de plano, não validação de implementação da E4. Não executei Git, rebuild, capture, validate nem comandos do harness. Não alterei código, testes, docs, datasets ou memória produtiva.

## Pontos coaprovados

### Dois modos

Com threadId, ler passagens da thread fechada e indexada, aplicar sourceTypes antes da seleção, reranquear todas até B=232 e usar cosseno apenas acima do teto é uma hipótese de avaliação coerente. O teto não está aprovado como resultado de qualidade da E4: sua adoção depende dos critérios desta etapa. scopeTruncated torna o corte visível. Não atribuir groupBand ao modo com escopo evita aparentar uma admissão global que não aconteceu.

Sem escopo, compor as funções exportadas permite preservar o pool consolidado da depth 2 e guardar os scores individuais sem alterar o recall. A admissão por eligibility >= 0,5 e a faixa por memoryBandOf correspondem à ADR 0011. Filtrar sourceTypes apenas na saída preserva os documentos e a admissão. Identity-only precisa continuar sendo pontuada para a paridade dos grupos, mas não virar passagem de saída.

### Proteção do recall

A exclusão de semantic-ranking.ts, hybrid-ranking.ts, operations.ts e scoring/** é adequada. O P1 deve comparar a estrutura ranked integral e os documentos na mesma ordem, não só os grupos admitidos. Os casos declarados de empate, identity-only e hit lexical protegem justamente diferenças que já importaram na E3. Os replays congelados e os testes de recall sem edição complementam essa proteção, inclusive para mudanças no store compartilhado.

### Resolução, escopo e documentação

Mover resolveThreadId para o core e manter re-export no MCP evita dependência inversa e preserva os consumidores atuais. A resolução atual só verifica diretório e CHAT.md; as checagens adicionais de fechamento e presença do summary no manifest são necessárias e corretamente previstas no core.

O corpus marc-deep separado, passageJudgments por passageId, serialização/fingerprint compatíveis e captura de todo o escopo para DEEP_ALL preservam a distinção entre utilidade da passagem e mera presença da thread.

O escopo de escrita ampliado cobre store, resolução, exports, transportes, harness e docs. As exclusões preservam UI/HTTP e ranking produtivo. A ADR 0013 deve registrar o orçamento como decisão específica do deep, condicionada aos resultados, não como adoção do funil rejeitado pela E3.

## B1 — Cobertura de julgamento do diagnóstico e dos recuos

**Seções:** Julgamento por trecho, Replay e critério 2; linhas 245–260, 267 e 284–293 do plano.

A worksheet inclui apenas Top5 de DEEP e DEEP_COSINE. Entretanto, a classe cap depende de saber se DEEP_ALL passa. Uma passagem que entra no Top5 apenas quando o teto é removido pode estar sem grau. Ter o score dessa passagem capturado não equivale a ter sua relevância julgada.

**Risco:** classificar cap com grau presumido, ou deixar o diagnóstico sem resposta apesar de declarar a captura completa. O mesmo vale para passagens novas expostas por uma reavaliação autorizada.

**Ajuste e aceite:** a worksheet deve cobrir a união dos Top5 de DEEP, DEEP_COSINE e DEEP_ALL, mais os Top5 novos da configuração final após recuo, se ocorrer. Manter cegamento e identidade por passageId. Uma variante sem todos os graus exigidos deve ficar incomplete; ausência de grau nunca significa zero. Só decidir DEEP_ALL passa/falha e a classe cap após essa cobertura.

## B2 — O orçamento final precisa passar nos dois gates

**Seções:** critérios 2 e 4, tarefas e riscos; linhas 284–299 e 343.

A qualidade é decidida antes da T3. O critério 4 permite reduzir B para B' e exige nova medição, mas não exige repetir Success@5 para esse novo orçamento. Diminuir o teto pode remover a única passagem útil: a aprovação de B=232 não se transfere para B'.

**Risco:** adotar uma configuração que cabe na latência, mas não satisfaz o critério de qualidade já aprovado.

**Ajuste e aceite:** congelar a configuração final e exigir, sobre ela, simultaneamente Success@5 >=12/14, zero incompletos, conformidade de escopo e os gates de latência. Reexecutar o replay de qualidade após B', completar os julgamentos novos de B1 e não adotar a versão se a qualidade cair. Definir como o recuo de latência consome o limite de uma reavaliação/D10; não abrir uma sequência adicional de tentativas.

A fórmula de B' deve declarar unidades e um inteiro válido, estritamente menor que B para ser redução; se não existir orçamento positivo viável, reportar falha em vez de criar um teto inválido. O overhead não deve contar a interpretação duas vezes.

**Cobertura do corte:** a estratificação atual exige duas threads acima de 120, o que não garante nenhuma acima de 232. Pré-fixar ao menos um caso com mais de B passagens elegíveis após sourceTypes, para avaliar utilidade real no ramo truncado, além do teste sintético de 233 registros. Isso não altera a meta de 12/14 nem exige aumentar o dataset.

## B3 — Entradas e referência de latência por modo

**Seções:** Casos e critério 4; linhas 227–234 e 295–298.

Há quatro consultas sem escopo e dez com threadId, mas o protocolo manda executar os três caminhos nas 14 consultas. Não define o threadId das quatro execuções scoped nem explicita se as dez consultas scoped também serão medidas sem escopo.

**Risco:** escolher escopos após observar os resultados, medir chamadas inválidas ou comparar medianas de misturas diferentes de consultas.

**Ajuste e aceite:** pré-registrar a tabela de entradas de cada caminho: query, queryMode, threadId e sourceTypes, deixando explícito onde cada campo é removido ou definido. Se forem 14 por modo, definir antes os escopos adicionais. Se cada modo usar apenas seu subconjunto original, declarar o tamanho e comparar com o M0 das mesmas consultas. Não derivar escopos dinamicamente dos resultados do recall.

Manter a máquina de referência, aquecimento, três repetições, intercalação e M0 na cópia de camada 0. A equality de pares é com o replay do próprio caminho, não entre deep e M0.

## Observação sobre as classes

Coaprovo separar segmentation, cap, ordering e admission/pool e seus destinos. Na implementação, declarar a precedência e a variante de referência de cada condição: quando a evidência ficou fora do teto e DEEP_ALL também falhou por ordenação, o relatório precisa distinguir as duas perdas sem forçar a classe cap. Todo caso de falha deve ter classificação verificável, sem converter julgamento ausente em falha do modelo.

## Limites da aprovação

B=232 deriva de uma medição anterior, não de garantia de latência para qualquer thread ou comprimento de trecho. groupBand continua heurístico e pertence ao grupo, não à passagem. Os 14 casos formam um gate da etapa, não promessa geral de qualidade.

Não há aprovação de execução da E4 neste parecer enquanto B1 a B3 permanecerem abertos. A thread continua aberta.
