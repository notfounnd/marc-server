# Estudo 4/4: reranker especializado Qwen frente ao mMARCO

## Síntese e decisão

**Recomendação: manter o mMARCO e a busca atual. Não promover o Qwen nesta rodada.**

O Qwen melhorou a ordenação de parte dos casos difíceis e recuperou mais alvos no Top 10. Contudo, perdeu primeiras posições que o motor atual acertava. Nas 38 consultas positivas distintas, o Top 1 passou de **31 para 29**, enquanto o Top 10 passou de **32 para 35**. Não existe uma melhora global inequívoca que justifique substituir o motor atual.

A hipótese foi testada integralmente, não apenas com termos associados a brutalism. Foram concluídos os 4.470 pares congelados, correspondentes a 40 consultas efetivas e 44 casos lógicos. Houve 4.470 chamadas de `model.forward`, sem falhas e sem retentativas. O processo encerrou com código real 0, descarregou o modelo e liberou o lock.

O estudo está tecnicamente aprovado como experimento offline concluído. A substituição do reranker foi **rejeitada pelos critérios de promoção previamente definidos**, não por uma preferência posterior por velocidade. A thread permanece aberta para avaliação humana.

## Pergunta e recorte

A pergunta foi se um reranker especializado mais recente melhora a busca quando recebe exatamente as mesmas consultas, passagens e candidatos que o reranker atual.

Não foram alterados o retriever E5, o interpretador LFM, os embeddings, o corpus, o conteúdo indexado, os pesos produtivos, o limite de resultados, o TTL ou os níveis de busca. Não foram introduzidos dicionários, listas por idioma, exceções para termos específicos ou correções manuais dos resultados.

O estudo anterior sobre adicionar CHAT ao conteúdo indexado continua separado. Aqui foi utilizada exclusivamente a captura C0 de sumários do estudo 1. A comparação não mistura um novo modelo com uma nova base.

## Modelos e execução

| Item | Referência atual | Candidato |
| --- | --- | --- |
| Modelo | cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 | onnx-community/Qwen3-Reranker-0.6B-ONNX |
| Variante | O4, scores congelados do estudo 1 | q4 |
| Execução nesta rodada | Replay sem carregar o modelo | CPU, um par por chamada |
| Revisão do candidato | Não aplicável | 9995c50e2310679108a55f5ccd16ba8be9f17c20 |
| Threads ORT do candidato | Não aplicável | intraOp 2 e interOp 2 |

O template binário e a instrução do Qwen foram congelados antes da captura. O score foi extraído dos logits dos tokens yes/no na última posição real e calculado por softmax binário estável. Não houve geração de uma resposta textual para cada par.

Foram preservadas as quebras de linha do template oficial, inclusive as duas quebras depois de `</think>`. O template não foi retocado depois de observar os resultados.

Fontes técnicas utilizadas na preparação:

- [Modelo original e template oficial](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B).
- [Conversão ONNX na revisão fixada](https://huggingface.co/onnx-community/Qwen3-Reranker-0.6B-ONNX/tree/9995c50e2310679108a55f5ccd16ba8be9f17c20).
- Documentação via Context7 e implementação local do Transformers.js para carregamento local, dtype, nome do arquivo e entradas efetivamente expostas pelo grafo.

Runtime medido: Node v22.20.0, Transformers.js 4.3.1 e ONNX Runtime 1.30.0.

### Braços comparados

| Braço | Modelo | Ordenação e descarte |
| --- | --- | --- |
| A0 | mMARCO | Pipeline produtivo atual, com fusão, elegibilidade e limite monotônico |
| A1 | mMARCO | Melhor score de passagem por thread, sem filtro de elegibilidade, até 50 resultados |
| B0 | Qwen | Mesmo pipeline e parâmetros produtivos de A0 |
| B1 | Qwen | Melhor score de passagem por thread, sem filtro de elegibilidade, até 50 resultados |

A1 e B1 são diagnósticos, não alternativas prontas para a UI. Sem o filtro, ambos devolvem resultados nos controles negativos. Sua eventual melhora de cobertura não deve ser confundida com melhora de abstenção.

O uso dos mesmos parâmetros em A0 e B0 testa uma substituição direta. Não presume que o score de dois modelos tenha a mesma calibração. Não houve recalibração oportunista de thresholds, fusão ou pesos nesta rodada.

## Base e independência das contagens

- 44 casos lógicos, dos quais 42 positivos e 2 controles negativos.
- 40 consultas efetivas distintas, das quais 38 positivas e 2 negativas.
- 30 casos históricos, com uma consulta distinta por caso.
- 12 casos positivos de qualidade, correspondentes a 8 consultas efetivas distintas.
- 4 casos lógicos duplicam consultas efetivas após interpretação.
- 4.470 pares distintos de consulta e documento.
- Corpus C0: 53 threads fechadas e 338 registros.
- Geração congelada: `20261013051147276_6cfe9a14`.
- Busca em profundidade 0, limite de 50 resultados e até 3 passagens por thread, sem modificar a shortlist.

Uma mesma consulta efetiva pode representar mais de um caso lógico. Por isso o resultado principal abaixo usa 38 consultas positivas distintas. Q02 e Q03, por exemplo, não são duas vitórias independentes do candidato.

## Resultados

### Consultas positivas distintas

Top 1 significa que um alvo esperado está em primeiro lugar. Top 10 e Top 50 indicam a presença de um alvo até essas posições. MRR considera a posição do primeiro alvo esperado. Não se trata de precisão global de todos os resultados exibidos.

| Métrica | A0 atual | A1 sem filtro | B0 Qwen integrado | B1 Qwen sem filtro |
| --- | ---: | ---: | ---: | ---: |
| Consultas positivas distintas | 38 | 38 | 38 | 38 |
| Top 1 | 31/38 | 29/38 | 29/38 | 29/38 |
| Top 10 | 32/38 | 37/38 | 35/38 | 35/38 |
| Top 50 | 33/38 | 38/38 | 35/38 | 38/38 |
| MRR | 0,830702 | 0,826937 | 0,823246 | 0,842845 |
| Controles negativos vazios | 2/2 | 0/2 | 2/2 | 0/2 |

B0 ganhou a primeira posição em 2 consultas distintas e perdeu em 4, saldo de **-2**. A mudança de 31 para 29 primeiras posições não é explicada por duplicatas.

### Recortes históricos e de qualidade

| Métrica | A0 | A1 | B0 | B1 |
| --- | ---: | ---: | ---: | ---: |
| Top 1 histórico, 30 casos | 26 | 26 | 23 | 24 |
| Top 10 histórico, 30 casos | 27 | 30 | 29 | 29 |
| MRR histórico | 0,885556 | 0,907870 | 0,842778 | 0,886111 |
| Top 1 de qualidade, 12 casos lógicos positivos | 8 | 5 | 10 | 9 |
| Top 10 de qualidade, 12 casos lógicos positivos | 8 | 11 | 10 | 10 |
| Top 1 de qualidade, 8 consultas positivas distintas | 5 | 3 | 6 | 5 |
| Top 10 de qualidade, 8 consultas positivas distintas | 5 | 7 | 6 | 6 |

A interpretação relevante é a troca entre conjuntos: o Qwen melhora o recorte de qualidade, mas piora primeiras posições históricas. Um agregado favorável apenas nos casos difíceis esconderia essa regressão.

### Julgamentos graduados

| nDCG@10, apenas julgamentos conhecidos | A0 | A1 | B0 | B1 |
| --- | ---: | ---: | ---: | ---: |
| 12 casos lógicos positivos de qualidade | 0,638635 | 0,639187 | 0,805302 | 0,824655 |
| 8 consultas positivas distintas de qualidade | 0,598809 | 0,583493 | 0,723809 | 0,741482 |

O ganho de nDCG também existe depois de remover duplicatas. Ainda assim, os julgamentos são parciais. Threads não julgadas não foram convertidas em irrelevantes, e o valor não permite afirmar uma precisão global do sistema. O protocolo usa julgamentos conhecidos para calcular o ganho, mantendo a posição real de cada resultado. Os casos históricos não têm a mesma cobertura de notas graduadas.

## Mudanças concretas

| Caso | Posição do alvo em A0 | Posição do alvo em B0 | Leitura |
| --- | ---: | ---: | --- |
| 1P | 1 | 3 | Perda de primeira posição |
| 5I | 1 | 2 | Perda de primeira posição |
| 6I | Ausente | 2 | Recuperação de alvo antes descartado |
| 9D | 1 | 2 | Perda de primeira posição |
| 9I | 15 | 4 | Melhora de posição |
| 9P | 1 | 5 | Perda de primeira posição |
| 10P | 2 | 1 | Ganho de primeira posição |
| Q02 | Ausente | 1 | Ganho de primeira posição |
| Q03 | Ausente | 1 | Mesmo ganho efetivo de Q02, sem crédito independente |

Nos termos já fornecidos pelo usuário:

- `brutal`: alvo em primeiro lugar nos quatro braços.
- `brutalism`, consulta efetiva de Q02 e Q03: ausente em A0, terceiro em A1 e primeiro em B0/B1.
- `interface com brutalism`, consulta efetiva de Q04 e Q05: alvo em primeiro lugar nos quatro braços.
- `toggle`: alvo ausente nos braços integrados, 16º em A1 e 17º em B1.
- `toogle`: alvo ausente nos braços integrados, 8º em A1 e 19º em B1.

Os ganhos não se resumem a brutalism, pois 10P também melhora e 6I/9I recuperam posições. Entretanto, o principal ganho de qualidade no Top 1 corresponde a uma única consulta efetiva. A evidência não sustenta apresentar o resultado como uma melhora generalizada.

### O que o diagnóstico separa

Todos os 38 alvos de consultas positivas distintas aparecem no Top 50 dos braços sem filtro. Assim, para os alvos deste conjunto C0, a ausência no resultado integrado não decorre simplesmente de a thread nunca chegar ao reranker.

Há efeitos diferentes:

- Ordenação: o modelo muda a ordem e pode piorar um alvo, como em toggle/toogle no braço sem filtro.
- Integração: a elegibilidade e a fusão ainda podem retirar um alvo, como 3P, Q06 e Q07.
- Julgamento: a presença de um alvo não prova que todos os outros resultados tenham sido relevantes.

O Qwen não corrige sozinho os três problemas. Retirar filtros também não resolve, pois os dois controles negativos passam a ter 50 resultados em A1/B1. Esta conclusão não invalida a descoberta do estudo 2 sobre uma passagem útil perder espaço antes do reranker. Ela diz respeito aos candidatos e alvos efetivamente congelados aqui.

## Critérios de promoção

Os sete critérios foram recalculados independentemente e conferem com o relatório produzido pelo executor.

| Critério fixado antes da captura | Resultado |
| --- | --- |
| Não perder Top 1 em nenhum caso histórico acertado | Falhou: 1P, 5I, 9D e 9P |
| Não perder Top 10 histórico | Passou |
| Preservar Top 1 positivo do recorte de qualidade | Passou |
| Preservar Top 10 positivo do recorte de qualidade | Passou |
| Manter os dois controles negativos vazios em B0 | Passou |
| Ganhar pelo menos 2 consultas positivas distintas líquidas no Top 1 | Falhou: 2 ganhos e 4 perdas, saldo -2 |
| Melhorar nDCG com os julgamentos graduados conhecidos | Passou |

**Resultado: 5 de 7 critérios atendidos. Promoção rejeitada.**

Os critérios não foram relaxados depois da captura. Mesmo que todos passassem, o protocolo permitiria recomendar uma nova validação com holdout e recursos, não substituir automaticamente o modelo produtivo.

## Execução e consumo medido

| Medida | Observação |
| --- | --- |
| Início do ciclo do processo | 2026-10-14 13:48:05.725 UTC |
| Início do checkpoint de pares | 2026-10-14 13:48:17.309 UTC |
| Descarregamento concluído | 2026-10-14 23:30:31.481 UTC |
| Tempo total do ciclo | 34.945,111 s, aproximadamente 9h42min25s |
| Carregamento do modelo | 11,545 s |
| Execução com captura | 34.933,123 s |
| Descarregamento | 0,415 s |
| Soma dos forwards | 33.907,021 s |
| Média por forward | 7,585 s |
| Mediana por forward | 6,697 s |
| Percentil 95 por forward | 15,728 s |
| Tokens dos prompts | Entre 108 e 487, sem truncamento |
| Chamadas de model.forward | 4.470 |
| Falhas e retentativas | 0 e 0 |
| Pacote local do candidato | 5 arquivos, 1.006.665.497 bytes, cerca de 960 MiB |
| Arquivo ONNX q4 | 995.235.866 bytes |
| Maior RSS amostrado pelo executor | 1.980.301.312 bytes, cerca de 1,84 GiB |
| Pico de working set retornado pelo Windows em uma leitura durante a execução | 2.095.353.856 bytes, cerca de 1,95 GiB |

O grafo expõe logits `[1, N, 151669]` para toda a sequência e não oferece a entrada `num_logits_to_keep`. O runner usou o grafo como fornecido, com full-prefill, e extraiu a última posição. Não o alterou para fabricar um resultado de desempenho melhor. A duração observada pertence a essa conversão, configuração e máquina, não a toda implementação possível do Qwen.

O tempo não foi apenas download ou carregamento repetido. O modelo ficou carregado durante os 4.470 forwards, e a soma desses forwards explica a maior parte do tempo total. Não há base para prometer uma busca interativa instantânea com esta execução. A média de forwards por consulta completa representa muitos minutos de processamento, não alguns segundos.

Não foi executada uma nova captura mMARCO com recursos idênticos, pois o protocolo reutiliza os scores congelados. Portanto, este estudo não calcula um fator confiável de lentidão entre os modelos.

RSS amostrado não é um limite duro de alocação nativa, nem equivale a RAM total necessária. Em uma leitura do processo, o Windows também retornou aproximadamente 3,31 GiB de memória privada comprometida, medida diferente do working set. O computador observado tem cerca de 16 GiB; não houve validação real em uma máquina de 8 GiB. Tampouco houve execução Linux ou macOS. Nada disso foi tratado como teste aprovado de compatibilidade ou de orçamento de RAM.

O executor manteve uma proteção cooperativa de RSS de 3,5 GiB antes/depois dos forwards e por amostragem. Ela não impede uma alocação nativa transitória acima desse valor.

### Arquivos e sanitização

O download ficou em uma pasta experimental separada, não no cache produtivo. O caminho abaixo é uma referência histórica e foi removido na sanitização posterior:

`C:/Users/junior/AppData/Local/Temp/marc-reranker-study-57488bab-20261014/`

Somente os cinco assets necessários foram baixados. O modelo ficou descarregado, o processo encerrou e o lock foi removido. No encerramento inicial da captura, aproximadamente 1 GB de assets ainda estava nessa pasta para reprodução, fora do cache usado pela aplicação. Não existe limpeza automática dos arquivos experimentais nesta entrega, e não foi alegado que o purge produtivo alcança esse diretório.

**Sanitização posterior autorizada pelo humano, em 2026-10-15 00:35 UTC:** foram removidas as oito pastas temporárias desta thread, incluindo os estudos de intérpretes, prompt, dois papéis, decoding, ranking, conteúdo, decisão e reranker. Foram excluídos 195 arquivos, totalizando 2.782.966.657 bytes, aproximadamente 2,78 GB. Isso inclui modelos experimentais, scripts descartáveis, capturas brutas, checkpoints e relatórios JSON temporários. Planos, relatórios e mensagens registrados no repositório foram preservados. Os 15 grupos protegidos, incluindo o índice do Git e o cache produtivo, continuaram com os mesmos hashes. A remoção foi explicitamente autorizada, não automática.

## Validação independente

A análise e os comandos de validação foram executados por context-mode, com processamento local e saídas numéricas ou estruturais. Os arquivos brutos de corpus, consultas e relatórios privados não foram publicados na thread.

Verificações do principal:

1. Reexecução final dos quatro módulos de teste do runner: **41/41**, zero falhas e zero skips.
2. Contratos produtivos de ranking híbrido e semântico: **8/8**, sem carregar modelos.
3. Inspeção sintática/AST de 13 módulos: zero erros de parse, zero else, zero if aninhado, zero ramos condicionais nos cenários de teste e máximo de 278 linhas não vazias por arquivo.
4. Replay de A0 nas 40 consultas: 40 rankings serializados e 40 conjuntos de condições idênticos à captura original.
5. Recomputação dos scores dos 4.470 pares a partir dos logits yes/no: erro máximo observado 0; dtype, dimensões, tokens e histórias de tentativa consistentes.
6. Correspondência sem depender da ordem de propriedades JSON entre os pares do checkpoint e da captura final.
7. Replay de B0 nas 40 consultas sem inferência: resultados e ordem completa dos candidatos idênticos à captura.
8. Reconstrução independente de B1, pelo melhor score por thread e desempate pela ordem congelada dos documentos: 40/40 consultas idênticas.
9. Recomputação independente das métricas de 44 casos em 4 braços: **176 avaliações** conferidas.
10. Correspondência das métricas A0 de 44 casos com o relatório corrigido do estudo 1.
11. Recomputação dos sete critérios e dos ganhos/perdas por consulta distinta: veredito idêntico ao executor.
12. Verificação de hashes dos cinco assets locais contra o manifesto preparado.
13. Confirmação do código real de saída do processo 31136 pelo handle do Windows: **0**. O resultado não foi inferido do campo expectedExitCode.
14. Conferência de descarregamento, parada da amostragem e ausência do lock.

A recomputação independente não invocou modelos, não regravou capturas e não executou novamente os estudos anteriores.

### Preservação

Os hashes finais confirmaram preservação de todos os 15 grupos protegidos: src, scripts, test, docs, skills, memória produtiva, cache de modelos produtivo, AGENTS, README, package.json, lockfile, RULES, INSTRUCTIONS, configuração e índice do Git.

As seis pastas dos estudos anteriores permaneceram idênticas, inclusive os dados, scripts e relatórios dos estudos de prompt, dois papéis, decoding, ranking, conteúdo e decisão estruturada. Nenhum comando Git foi executado, e o stage não foi alterado.

O agregado dos 13 módulos do estudo 4 permaneceu congelado durante a captura.

### Classificação e limites da entrega

Esta é uma entrega de estudo offline com executor experimental fora do código produtivo, não uma alteração do mecanismo de busca distribuído nem uma declaração de release-ready. Foram feitos os checks focados acima.

`pnpm validate`, `pnpm build` e a suíte integral `pnpm test` não foram executados nesta rodada e não são apresentados como aprovados. O escopo preservou o produto e o stage congelados, e o validate tem efeitos de escrita. A aprovação deste relatório se restringe ao estudo e às evidências especificadas, não substitui a validação de uma futura implementação produtiva.

A documentação de produto não precisou mudar: nenhuma configuração, API, UI, dependência ou comportamento distribuído foi alterado. O resultado e o protocolo ficam documentados como artefatos operacionais da thread.

## Revisão integrada final do principal

### Escopo e fontes efetivamente revisados

Foram revisados o plano anexado antes da implementação, as decisões da thread, os 13 módulos experimentais e seus quatro módulos de teste, os rankings híbrido/semântico e a elegibilidade produtiva, os helpers e julgamentos congelados do estudo 1, o relatório corrigido desse estudo, o manifesto de assets, o fingerprint preparado e todos os dados finais do estudo 4.

A revisão cobriu a integração entre preparação, tokenizer, modelo, captura, checkpoint, replay, métricas, descarregamento e publicação. Não se limitou ao último diff do desenvolvedor nem à ausência de falhas nos testes.

### Critérios relacionados à implementação e à evidência

| Critério | Comportamento integrado | Evidência verificada pelo principal |
| --- | --- | --- |
| Comparação justa | Consulta, canais, ordem e documentos congelados; só troca de scores | Alinhamento de 4.470 pares e replay exato de 40 consultas |
| Inferência correta | Template fixo, logits float32 da última posição, softmax binário | Recomputação dos 4.470 scores e inspeção das dimensões |
| Separar modelo de integração | A0/B0 produtivos e A1/B1 realmente sem filtro | Reconstrução de B1 por melhor passagem e controles negativos |
| Não contar duplicatas como vitórias | Contagens lógicas e consultas efetivas separadas | 44 casos, 40 consultas, 38 positivas distintas e saldo -2 |
| Conclusão sem ajuste posterior | Sete critérios congelados antes da captura | Recomputação independente e reprovação de dois critérios |
| Execução encerrada corretamente | Dispose, amostragem encerrada, liberação do lock e saída real | Estado final e handle do processo retornando código 0 |
| Preservar produto e estudos | Sem modificação produtiva, sem nova geração de embeddings | Hashes dos 15 grupos, seis estudos anteriores e índice Git |
| Qualidade do executor | Falhas explícitas, estados duráveis e testes determinísticos | 41 testes, checagem AST e captura completa sem retries |

### Achados resolvidos antes da captura

As iterações internas corrigiram pontos que poderiam invalidar o experimento: braço diagnóstico inicialmente filtrado, nome do arquivo/dtype, template do Qwen, regressões avaliadas apenas por agregado, confusão entre número de threads e passagens, identidade do runtime e assets, contadores de tentativas/forwards, validação de checkpoints, tratamento de falhas e liberação de recursos.

Uma falha real de preparação revelou a ausência do valor padrão de options. Ela foi corrigida, recebeu regressão, invalidou a aprovação anterior e foi reavaliada antes do download e da captura válidos. As duas tentativas de preparação que falharam não carregaram o modelo nem produziram scores. O estado final tem 41 testes, enquanto a entrega inicial do desenvolvedor registrava 39. Não se atribui à entrega inicial o resultado posterior.

O principal também corrigiu sua checagem de igualdade para comparar objetos JSON semanticamente, não pela ordem textual das propriedades. Isso não alterou os dados nem o executor congelado.

### Autoria, regras e arquitetura

O principal atuou como codex-software-architect, com gpt-6.1-sol/high confirmado pelo humano. O desenvolvedor Beauvoir reutilizou codex-dev, com gpt-6-luna/xhigh confirmado, bootstrap próprio e autorização explícita antes das edições. O trabalho permaneceu sequencial.

A entrega consolidada do desenvolvedor foi publicada por ele mesmo em `msg_95c53152ad154a16ac` e conferida pelo principal. Os ajustes e revisões ficaram no canal interno, sem transformar a thread ou um artefato em diário.

O executor é isolado e não cria uma nova abstração no produto. A separação entre protocolo, entrada, runtime, estado, replay e relatório permite verificar cada responsabilidade e reaproveitar a captura sem inferência adicional. Markdown continua sendo o registro humano autoritativo da investigação; JSON é evidência estruturada experimental e não substitui a thread.

### Limitações e veredito

Permanecem os limites de base pequena, julgamentos parciais, ausência de holdout novo, calibração não intercambiável entre modelos, execução em uma única máquina e ausência de validação real de 8 GiB ou multiplataforma. O resultado não prova que o Qwen nunca possa ser útil com outra integração. Prova que esta substituição direta não atende ao contrato de qualidade estabelecido.

**Veredito técnico do estudo: approved.** O experimento foi concluído e suas evidências são internamente consistentes, reproduzidas e suficientes para responder à hipótese delimitada.

**Veredito de promoção: rejected.** O ganho nos casos de qualidade e no Top 10 não compensa as regressões de Top 1 segundo os critérios aprovados.

Não há nova alteração de implementação depois desta revisão. Qualquer nova calibração, shortlist, grafo ou modelo precisa de escopo e comparação novos; não foi iniciada uma quinta rodada. Aceite humano e encerramento da thread continuam pendentes.

## Matriz dos 44 casos

As colunas mostram a posição do primeiro alvo esperado, não um score. Ausente significa que o alvo não apareceu na lista do braço. Nos controles negativos não existe alvo esperado; o critério é retornar lista vazia. As consultas originais continuam nas evidências locais, sem republicar o corpus privado neste anexo.

| Caso | A0 | A1 | B0 | B1 |
| --- | ---: | ---: | ---: | ---: |
| 1D | 1 | 1 | 1 | 1 |
| 1I | 1 | 1 | 1 | 1 |
| 1P | 1 | 1 | 3 | 2 |
| 2D | 1 | 1 | 1 | 1 |
| 2I | 1 | 1 | 1 | 1 |
| 2P | 1 | 1 | 1 | 1 |
| 3D | 1 | 1 | 1 | 1 |
| 3I | 1 | 1 | 1 | 1 |
| 3P | Ausente | 9 | Ausente | 12 |
| 4D | 1 | 1 | 1 | 1 |
| 4I | 1 | 1 | 1 | 1 |
| 4P | 1 | 1 | 1 | 1 |
| 5D | 1 | 1 | 1 | 1 |
| 5I | 1 | 1 | 2 | 2 |
| 5P | 1 | 1 | 1 | 1 |
| 6D | 1 | 1 | 1 | 1 |
| 6I | Ausente | 2 | 2 | 1 |
| 6P | 1 | 1 | 1 | 1 |
| 7D | 1 | 1 | 1 | 1 |
| 7I | 1 | 1 | 1 | 1 |
| 7P | 1 | 1 | 1 | 1 |
| 8D | 1 | 1 | 1 | 1 |
| 8I | 1 | 1 | 1 | 1 |
| 8P | 1 | 1 | 1 | 1 |
| 9D | 1 | 1 | 2 | 2 |
| 9I | 15 | 8 | 4 | 2 |
| 9P | 1 | 1 | 5 | 2 |
| 10D | 1 | 1 | 1 | 1 |
| 10I | 1 | 1 | 1 | 1 |
| 10P | 2 | 2 | 1 | 1 |
| Q01 | 1 | 1 | 1 | 1 |
| Q02 | Ausente | 3 | 1 | 1 |
| Q03 | Ausente | 3 | 1 | 1 |
| Q04 | 1 | 1 | 1 | 1 |
| Q05 | 1 | 1 | 1 | 1 |
| Q06 | Ausente | 16 | Ausente | 17 |
| Q07 | Ausente | 8 | Ausente | 19 |
| Q08 | 1 | 3 | 1 | 3 |
| Q09 | 1 | 1 | 1 | 1 |
| Q10 | 1 | 3 | 1 | 1 |
| Q11 | 1 | 3 | 1 | 1 |
| Q12 | 1 | 1 | 1 | 1 |
| Q13, controle negativo | Vazio | 50 resultados | Vazio | 50 resultados |
| Q14, controle negativo | Vazio | 50 resultados | Vazio | 50 resultados |

## Proveniência e reprodução

Plano registrado antes do desenvolvimento:

`artifacts/plano-estudo-4-reranker-especializado-qwen.md`

SHA-256 do plano: `2c7377d4c9220a707501dff11b3932e6cedc05cb81bc7d7d1946b51f2f0dc0e2`.

Fingerprint do experimento preparado e executado: `61167f07898d0527c1882a3b2b0d9b04b13fea34ed2dde5f151ef4595578a9cf`.

| Evidência local | SHA-256 |
| --- | --- |
| Agregado dos 13 módulos | e7137ee0362a2ca09b670fe1cbe576eaad1c4510b63c98dccfdec2c6ab468dea |
| capture.data.json | 31f99f976eb5d635325af70694b6d7661e8f887de3ff18db51d6e8a851c10354 |
| capture.checkpoint.json | 1c3fecd45775b91938d5f945b7457837764c7ed039b24f4aedcba50b8de19f89 |
| study-report.json | 5a79017a4424ac4f6a4e4f93606ab1b73c4342e2fe65e2fb71dbfffa1ee3e258 |
| study-fingerprint.json | 6db3dbe3c403fdb61d1b4e4357ad74282edf07793387350b4c5a9547741a06c9 |
| model-assets.json | 428128e716536b9acb163cccba35ac64e44efb945feb87bbaace6f314972bcaf |
| onnx/model_q4.onnx | 787193952a9aa58374381ec7647b160ac6c200a386dbfc3bc998a3c458081330 |

O agregado de módulos ordena os nomes com localeCompare e calcula SHA-256 sobre JSON de pares nome/hash dos arquivos. Os hashes identificam os arquivos efetivamente verificados antes da sanitização autorizada. As cópias temporárias foram removidas; não é mais possível repetir o replay a partir delas sem reconstruir as entradas. Os resultados consolidados permanecem nos artefatos da thread.

Os módulos estavam na pasta experimental: reranker-protocol.mjs, reranker-inputs.mjs, reranker-download.mjs, reranker-runtime.mjs, reranker-capture.mjs, reranker-replay.mjs, reranker-report.mjs, reranker-state.mjs, reranker-cli.mjs e os quatro módulos de teste.

Os comandos do runner são `--validate-inputs`, `--prepare` e `--run`, executados com Node e `--import tsx`. Preparação e inferência exigem as autorizações explícitas separadas previstas no runner. Não repetir `--run` sobre um estudo concluído: a duplicação é recusada. Essa orientação de reutilizar a captura pronta valia antes da sanitização. Após a remoção autorizada, não há captura bruta local para novo replay; uma reprodução futura exige recuperar ou reconstruir o material experimental, com nova autorização de escopo.

## Encaminhamento

O estudo 4/4 encerra esta sequência autorizada de experimentos, não a thread. A busca produtiva permanece como estava.

O achado útil para uma evolução futura é que há ganho graduado real do candidato em parte das consultas, mas ele não se transforma em melhor Top 1 global com a integração congelada. Uma próxima proposta deve escolher explicitamente se pretende investigar calibração/fusão, seleção de passagens ou execução de um grafo mais adequado, com novos dados de validação. Isso não autoriza combinar mudanças agora nem ajustar o conjunto de teste até fazê-lo passar.

Aguardar feedback humano antes de qualquer nova rodada ou encerramento.
