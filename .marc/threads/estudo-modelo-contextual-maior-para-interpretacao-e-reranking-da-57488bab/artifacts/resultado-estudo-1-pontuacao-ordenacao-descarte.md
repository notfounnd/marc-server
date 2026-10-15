# Resultado do estudo 1/4: pontuação, ordenação e descarte

## Síntese

**Recomendação: manter o ranking produtivo atual. Nenhuma condição alternativa demonstrou uma melhoria segura e geral nesta rodada.**

O estudo isolou a transformação dos mesmos candidatos em resultados, sem trocar modelos, aumentar o conteúdo indexado, recalibrar coeficientes ou mudar a profundidade. Foram avaliados 44 casos lógicos a partir de 40 consultas efetivas distintas. A captura real foi realizada uma única vez.

O baseline encontrou o alvo histórico em primeiro lugar em 26/30 casos e no Top 10 em 27/30. Nos 12 controles positivos, encontrou o alvo em primeiro lugar em 8/12. As duas consultas de abstinência retornaram vazio. Esses grupos têm objetivos e cobertura diferentes. Não devem virar uma taxa universal de acerto do motor.

A rodada localizou dois problemas distintos: alvos que já são candidatos, mas são descartados pela elegibilidade, e alvos aceitos que ficam mal ordenados. Alterar apenas a ordenação não corrige o primeiro problema.

## Escopo e protocolo

- Somente o estudo 1/4, conforme o plano registrado antes do desenvolvimento.
- 30 consultas históricas, preservando consultas, alvos e estilos direto, indireto e implícito.
- 14 controles existentes, sendo 12 positivos e 2 de abstinência. Quatro pares reutilizam a mesma consulta efetiva, sem inferência duplicada.
- Consultas efetivas fixadas pelas fontes anteriores. O LFM não foi carregado nem reavaliado nesta rodada. Não se trata de uma avaliação ponta a ponta da interpretação de novas consultas.
- Geração congelada: `20261013051147276_6cfe9a14`, com 53 registros de sumário.
- Retriever `Xenova/multilingual-e5-small`, arquivo `model_int8.onnx`. Reranker `cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`, arquivo `model_O4.onnx`.
- Transformers.js 4.3.1 e execução Node.js local. Sem provisionamento, downloads, rebuild, purge ou troca de índice.
- Profundidade inicial, até 100 candidatos por canal e regras produtivas de seleção de passagens. Na consolidação desta base, cada consulta teve 53 candidatos.
- Canais densos de identidade/passagem e canais lexicais produtivos. Prefixo somente para consultas de um termo, conforme o comportamento existente.
- Scores de embedding e reranker capturados uma vez por consulta efetiva. O baseline foi reproduzido com os documentos, batch e scores capturados antes das comparações.
- Todas as condições foram declaradas antes dos resultados. Nenhum parâmetro, limiar, gabarito ou desempate foi ajustado para favorecer esta rodada.
- Sem dicionários, listas de palavras por idioma ou tratamento especial de um termo.

### Condições

| Condição | Alteração isolada |
| --- | --- |
| M0 | Baseline híbrido produtivo, com filtro e ordem atuais. |
| M1 | Retirar apenas o teto final, mantendo a elegibilidade própria e a ordem. |
| M2 | Ordenar os mesmos elegíveis pela elegibilidade própria. |
| M3 | Ordenar os mesmos elegíveis pelo score do reranker. |
| M4 | Ordenar os mesmos elegíveis por RRF suavizado, K=60 e pesos previamente fixados. |
| M5 | Recalcular elegibilidade com a função produtiva em singleton, sem margem entre candidatos, mantendo o restante das regras. |
| D0 | Diagnóstico sem filtro. Não é proposta produtiva. |

M0 a M5 mantiveram o limiar 0,5 e limite final de 50. D0 preservou todos os candidatos para identificar onde os alvos eram perdidos.

## Resultados históricos

Contagem de consultas cuja thread-alvo conhecida ficou na posição indicada ou acima. MRR mede a posição desse alvo, atribuindo zero quando ele não aparece.

| Condição | Top 1 | Top 3 | Top 5 | Top 10 | Top 50 | MRR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| M0 | 26/30 | 27/30 | 27/30 | 27/30 | 28/30 | 0,8856 |
| M1 | 26/30 | 27/30 | 27/30 | 27/30 | 28/30 | 0,8856 |
| M2 | 25/30 | 27/30 | 27/30 | 28/30 | 28/30 | 0,8700 |
| M3 | 26/30 | 27/30 | 27/30 | 28/30 | 28/30 | 0,8875 |
| M4 | 22/30 | 26/30 | 27/30 | 27/30 | 28/30 | 0,7994 |
| M5 | 26/30 | 27/30 | 27/30 | 27/30 | 28/30 | 0,8856 |
| D0 | 26/30 | 27/30 | 29/30 | 29/30 | 30/30 | 0,8989 |

M3 teve o melhor resultado histórico entre as alternativas admissíveis, mas o ganho foi pequeno e concentrado em 9I. Nos controles positivos, regrediu em três casos lógicos, correspondentes a duas consultas efetivas de segurança. Não justifica promoção pelo resultado histórico isolado.

Os dez casos históricos diretos ficaram em primeiro no baseline. M2 e M4 perderam essa posição em 9D. Portanto, suas melhorias pontuais não vieram sem perda do que já funcionava.

## Controles e cobertura dos julgamentos

| Condição | Alvo em Top 1 | Alvo em Top 3 | Alvo em Top 10 | MRR positivo | nDCG@10 conhecido | Abstinência |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| M0 | 8/12 | 8/12 | 8/12 | 0,6667 | 0,6386 | 2/2 |
| M1 | 8/12 | 8/12 | 8/12 | 0,6667 | 0,6386 | 2/2 |
| M2 | 5/12 | 8/12 | 8/12 | 0,5139 | 0,5245 | 2/2 |
| M3 | 5/12 | 8/12 | 8/12 | 0,5000 | 0,5136 | 2/2 |
| M4 | 8/12 | 8/12 | 8/12 | 0,6667 | 0,6386 | 2/2 |
| M5 | 7/12 | 7/12 | 7/12 | 0,5833 | 0,5622 | 2/2 |
| D0 | 8/12 | 10/12 | 10/12 | 0,7590 | 0,7747 | 0/2 |

**nDCG tem escopo parcial, somente dos julgamentos conhecidos. Não é precisão global.** Foram preservados os graus existentes. Resultados não julgados continuam desconhecidos, não automaticamente irrelevantes.

No baseline dos 12 controles positivos, houve 10 ocorrências de resultados explicitamente relevantes, nenhuma incidental e 10 não julgadas. A cobertura média do Top 10 foi 62,5% nas oito consultas lógicas não vazias. Não se atribuiu cobertura perfeita a uma lista vazia.

D0 teve 16 ocorrências relevantes, 5 incidentais e 615 não julgadas nos controles positivos, com cobertura média de 12,5%. Além disso, devolveu 53 threads em cada uma das duas consultas que deveriam retornar vazio.

Nos históricos, cada caso identifica um alvo positivo, sem julgar integralmente os outros resultados. As 83 ocorrências não julgadas do baseline histórico não podem ser chamadas de erros.

### Ganhos e regressões pareados

| Condição | Ganhos | Regressões |
| --- | --- | --- |
| M1 | Nenhum. Listas idênticas a M0 em 40/40 capturas. | Nenhuma. |
| M2 | 9I passou de 15º para 10º. | 9D passou de 1º para 2º. Q08 de 1º para 2º. Q10 e Q11 de 1º para 3º. |
| M3 | 9I passou de 15º para 8º. | Q08, Q10 e Q11 passaram de 1º para 3º. |
| M4 | 10P passou de 2º para 1º. | 3I de 1º para 4º. 5I e 9P de 1º para 3º. 7P e 9D de 1º para 2º. |
| M5 | Nenhum. | Q01 perdeu o alvo e passou a retornar vazio. |

Q10 e Q11 compartilham a consulta efetiva, preservando dois casos lógicos originalmente distintos. Os ganhos/perdas não devem ser apresentados como amostras estatisticamente independentes.

## Diagnóstico causal

O score de elegibilidade vem de uma transformação com coeficientes fixos. Não deve ser interpretado como uma probabilidade calibrada de relevância.

### 3P: elegibilidade insuficiente

Alvo `174c48b6`, indicador visual de saúde da memória. A thread estava nos canais densos e na posição 5 da consolidação sem filtro. Sua elegibilidade própria foi aproximadamente 0,0293 e o valor final 0,0143, ambos abaixo de 0,5. M1 a M5 não a recuperaram.

A captura refuta falta desse alvo entre os candidatos desta base. Mostra insuficiência dos sinais usados para admiti-lo, sem determinar, por si só, qual modelo ou conteúdo deve mudar.

### 6I: o teto não é a causa suficiente

Alvo `034ad1bf`, remoção dos comandos legados do MCP. Estava na posição 5 sem filtro. Sua elegibilidade própria foi aproximadamente 0,4029 e a final 0,0602. A própria nota já não passava no limiar.

Retirar somente o teto não poderia recuperá-lo. O código primeiro separa elegíveis por nota própria. Entre notas já maiores ou iguais a 0,5, um teto formado por essas mesmas notas não cruza para baixo de 0,5. M1 foi um controle causal e confirmou listas idênticas ao baseline em todas as capturas.

### 9I: ordenação, não descarte

Alvo `184fd8bb`, auditoria de Custom Rules. Elegibilidade própria aproximadamente 0,9043 e final 0,6692. O alvo foi aceito, mas ficou em 15º.

M2 o colocou em 10º e M3 em 8º. Esse é um problema de prioridade entre resultados admitidos. No limite 50 ele já aparecia no baseline. A falha histórica neste caso era no limite 10, não uma busca completamente vazia.

### Controles curtos e margem

- Q01, consulta efetiva `brutal`, retornou o alvo em primeiro no baseline. M5 perdeu esse resultado ao retirar a margem entre candidatos.
- Q02 e Q03 compartilham a consulta efetiva `brutalism`. O alvo estava em segundo sem filtro, com elegibilidade própria aproximadamente 0,3745, mas ficou fora de todas as condições admissíveis.
- Q04 e Q05, consulta efetiva `interface com brutalism`, retornaram o alvo em primeiro no baseline. Esta rodada não reexecutou o interpretador do typo original de Q05.
- Q06, `toggle`, teve o alvo conhecido em 27º sem filtro e elegibilidade própria aproximadamente 0,0083. Q07, `toogle`, teve o mesmo alvo em 14º e nota aproximadamente 0,0098. Todas as condições admissíveis retornaram vazio nesses dois controles.

Essas falhas não foram escondidas pela recomendação de manter o ranking. Significam que ele foi a melhor escolha entre as alternativas testadas, não que a busca esteja perfeita.

## Correção do avaliador e integridade da evidência

A revisão independente encontrou 11 chaves de julgamentos extraídas incorretamente: uma propriedade TypeScript como `[TOKEN_SECURITY_THREAD]` virava o nome literal da constante, não seu valor. Consultas, alvos, scores, candidatos e posições estavam corretos. As métricas graduadas e contagens de julgamentos de parte dos controles estavam incorretas.

A correção ocorreu no mesmo loop, pelo mesmo desenvolvedor. Ela preservou os cinco arquivos originais e a primeira recomputação. O relatório válido para a avaliação final é `study-report-recomputed-v2.json`, com identificação separada da captura e do avaliador corrigido.

Nenhuma captura, carga de modelo ou inferência foi repetida. A recomputação comparou 280 assinaturas de rankings e 308 combinações de caso/condição com nove invariantes não graduados por combinação. Também conferiu M1 idêntico a M0 e M5 como subconjunto de M0 em 40/40 capturas.

Identificação local:
- Captura: `fd304b9e97515c48e2c7b5b7561ec53808c98c6e68ea628f21d1546e9d31686c`.
- Avaliador final: `c461c954f286b300b2a59c08fd354ee96d549c4777aadeec3fee02c74c72b1be`.
- SHA-256 da captura bruta: `46a71c7c6c9a51f78f4438135995db7e37572e99f428795562519afbcdb6bde5`.
- SHA-256 do relatório v2: `179092bdaf421c409156cc36c7442c781b790facf7a981d57d57e53d1df959f0`.
- SHA-256 do manifesto: `1a99b242539990b87afa7b016568c2eba9d0d248d5020bbcccaf708644f3dfcf`.
- SHA-256 do plano: `4e20d409f760d79fbb4213e1157593fe6ecd7321ad2001cc869354c3a1ce4143`.

Executor, testes e dados integrais permanecem na raiz local autorizada `C:/Users/junior/AppData/Local/Temp/marc-ranking-study-57488bab-20261013/`. Esta publicação contém resultados agregados, diagnóstico selecionado e revisão, não exporta o código ou corpus integral. A autorização de exportação da rodada anterior continua pendente e não foi contornada.

## Custo observado e encerramento da execução

- Captura de 20:59:19 a 21:23:55 UTC de 13/10/2026, aproximadamente 24 minutos e 36 segundos.
- 40 requisições ao provider de embedding e 40 ao provider de reranking.
- 4.470 documentos/passagens pontuados no reranking, batch informado de 8.
- 577 batches estimados pela soma de `ceil(documentos/batch)` por requisição. Não são 40 forward passes nem uma contagem instrumentada de execuções internas ONNX.
- Tempos somados aproximados: embedding 100,5 s, recuperação 9,6 s e ranking capturado 1.343,2 s. O replay usou scores já calculados. Sua rapidez não representa uma melhora da busca produtiva.
- RSS observado somente do coordenador: pico de 380,34 MiB e 222,72 MiB após cleanup. Os processos de inferência não tiveram RSS medido. Não usar esses valores para estimar a RAM total dos modelos ou garantir compatibilidade com 8 GB.
- Run completo, 40/40 consultas, lock removido e saída 0 do PID 37612 verificada diretamente. O resultado não foi aceito apenas porque havia arquivos parciais.

## Revisão final integrada do principal

**Veredito: aprovado como estudo offline isolado. Nenhuma mudança produtiva aprovada ou promovida.**

O principal revisou o plano, fontes dos parsers e ranking, sete arquivos iniciais da extensão e dois arquivos novos de recomputação/teste, fontes de consultas e julgamentos, capturas, relatório v2 e entrega autoral consolidada do desenvolvedor. Não se limitou ao último diff ou à ausência de achados críticos.

### Critérios e evidência verificada

- **Comparação causal válida:** as 40 capturas tiveram o baseline produtivo reexecutado pelo principal com os scores e documentos gravados, sem modelos. A igualdade da representação serializada foi confirmada. As 308 posições de alvo foram conferidas independentemente.
- **Alternativas sem mudança de universo:** M1 preservou exatamente as listas de M0. Em M2, M3 e M4, 120 verificações de conjuntos confirmaram os mesmos elegíveis nesta base. M5 foi conferido como subconjunto de M0, não apenas como conjunto originado da base.
- **Julgamentos confiáveis no escopo declarado:** os 14 controles foram reconciliados com IDs reais do manifesto. O principal calculou os scores graduados independentemente e reproduziu exatamente o relatório v2. Os 12 positivos e as 2 abstinências permanecem separados.
- **Arquitetura e manutenção:** o executor continua temporário, separado do produto. Reutiliza o ranking e o cálculo de elegibilidade existentes. A correção de parser não duplicou regras por idioma, e a recomputação reutiliza o sumarizador existente, preservando a origem da evidência.
- **Falhas e ciclo de vida:** antes da captura, 21/21 checks focados passaram, incluindo os controles de erro, lock e cleanup. Depois da correção, o principal executou 11/11 checks seguros: 3 regressões do avaliador e 8 contratos existentes do ranking, sem falhas ou skips.
- **Proteção da captura:** uma tentativa de ampliar a validação pós-captura com a suíte antiga foi rejeitada pela revisão automática por risco aos arquivos de evidência. O comando não foi executado e não houve contorno. A validação continuou pela alternativa focada segura.
- **Regras e escopo:** AST dos nove módulos não encontrou else, if aninhado ou condicionais nos testes. Todos ficaram dentro de 300 linhas não brancas. A investigação e validação usaram context-mode. Edições manuais foram delegadas e feitas por apply_patch nativo. Nenhum Git, PowerShell, hook ou troca de configuração foi executado.
- **Preservação:** hashes de produto, scripts, testes do repositório, docs, harness, dependências, memória, modelos e índice do stage conferiram com o estado anterior, inclusive na verificação final de 21:51:15 UTC. As mudanças persistentes no projeto são apenas os registros autorizados desta thread.
- **Autoria e entrega:** bootstrap independente e autorização do principal foram verificados no canal interno. Foi reutilizado o perfil compartilhado e o desenvolvedor publicou sua própria entrega. A correção consolidada e seu anexo foram lidos e reconciliados com o código e as evidências.

### Limites e estado de aprovação

Os dados vêm de uma base pequena, com 53 sumários, menos que o limite de candidatos por canal. Encontrar todos os alvos antes do filtro não prova cobertura equivalente em bases maiores. Os julgamentos são parciais, as consultas são herdadas e parte dos controles compartilha consulta efetiva. Não houve holdout novo, avaliação completa de relevância humana, profundidades adicionais ou nova interpretação por LFM.

A classificação é estudo temporário offline, conforme o escopo registrado, não mudança executável do repositório nem entrega release-ready. Não foram executados `pnpm validate`, `pnpm build` ou `pnpm test` completos. Não são passes presumidos. Não há alteração de documentação de produto porque nenhuma API, configuração, funcionalidade ou comportamento produtivo mudou. O plano, método, resultados e limites estão nos registros desta thread.

## Decisão e próximo passo

Manter M0. Não promover M2, M3, M4 ou M5, não retirar o filtro e não anunciar ganho de qualidade produtiva. M1 confirmou uma propriedade causal do código, sem ganho de resultados.

A evidência orienta a continuidade da investigação sobre admissão e contexto dos candidatos, mas não escolhe, nesta etapa, uma implementação ou modelo novo. Os estudos 2/4, 3/4 e 4/4 não foram iniciados.

Aguardar o feedback do humano. A thread permanece aberta.
