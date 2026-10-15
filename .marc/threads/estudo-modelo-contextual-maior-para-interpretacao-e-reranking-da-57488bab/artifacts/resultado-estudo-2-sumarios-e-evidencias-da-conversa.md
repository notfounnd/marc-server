# Resultado do estudo 2/4: sumários e evidências da conversa

## Conclusão

**Recomendação: manter a busca produtiva atual. Não promover a expansão direta de sumários mais CHAT testada nesta rodada.**

A conversa acrescentou contexto útil em algumas consultas, mas não melhorou a amostra mais ampla. Nos 30 casos históricos, o alvo em primeiro caiu de 26 para 24, e entre os dez primeiros caiu de 27 para 26. O ganho aparente nos 12 controles positivos inclui duas entradas da mesma consulta efetiva, brutalism. Sem essa duplicação, os oito controles positivos distintos mantiveram cinco acertos em primeiro.

Isso não rejeita a oportunidade memory_deep. Mostra que acrescentar mensagens ao mesmo conjunto de candidatos, com o mesmo orçamento de três passagens por thread e a mesma regra de confiança, não é uma substituição segura da memória de sumários. Uma camada separada, com proveniência e tratamento da seleção de evidências, continua sendo uma hipótese relevante, ainda não implementada nem aprovada por este estudo.

marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae

Nenhum código produtivo, índice real, modelo, configuração ou documento de produto foi alterado. A thread permanece aberta e os estudos 3/4 e 4/4 não foram iniciados.

## Pergunta e método

A pergunta foi se disponibilizar mais evidência das conversas fechadas melhora a recuperação contextual sem trocar modelos ou ranking. A rodada seguiu o plano registrado antes do desenvolvimento.

- C0: os 338 registros/vetores da geração produtiva congelada, exclusivamente lidos.
- C1: os mesmos 338 registros/vetores, acrescidos de 450 passagens das 395 mensagens canônicas das mesmas 53 threads fechadas, em LanceDB temporário.
- Corpus de CHAT: 394.897 caracteres brutos, incluindo estrutura de mensagens; 283.686 caracteres nos corpos. SUMMARY: 161.798 caracteres. Essas contagens não são tokens.
- Cobertura: 53 CHAT, 53 SUMMARY, 395 IDs únicos no par thread/mensagem, nenhuma mensagem vazia e todas as 53 threads com passagens.
- Segmentação por mensagem com o segmentador/tokenizer produtivo do mMARCO, máximo de 320 tokens e overlap de 48. Sem fundir falas.
- Contexto neutro de seção, sem usar ID, autor, role, timestamp ou caminho como texto de embedding. A proveniência permanece no sidecar.
- E5 Xenova/multilingual-e5-small int8, dimensão 384. Reranker cross-encoder/mmarco-mMiniLMv2-L12-H384-v1, arquivo O4. Transformers.js 4.3.1.
- Mesmos canais vetoriais e lexicais, limite de 100 por canal, até três passagens por thread, limiar 0,5 e limite de 50 depois da consolidação.
- 44 casos lógicos e 40 consultas efetivas. Vetor da consulta calculado uma vez e compartilhado por C0/C1.
- As consultas efetivas do estudo anterior ficaram congeladas, inclusive correções anteriores. Não houve LFM nesta execução nem teste novo do interpretador.
- Sem lista de palavras, regra por idioma, bônus literal novo, seleção por gabarito, mudança de pesos ou ajuste após observar o resultado.
- Artifacts, RULES, código e documentos externos não entraram no corpus. Portanto, este estudo não cobre todo o escopo futuro de memory_deep.

Os modelos e tokenizers já estavam no cache. Não houve download ou preparação de modelos ausentes. Providers receberam a identidade real somente para leitura de configuração/cache; todos os mutators do store receberam a identidade temporária.

A validação local, antes da inferência, examinou 828 payloads E5 e 31.520 pares do reranker. Os máximos foram 352 e 380 tokens, respectivamente, abaixo de 512, sem truncamento silencioso.

## Resultados pareados

### Trinta casos históricos

A posição se refere ao alvo previamente definido para cada caso, não a uma avaliação completa de todos os outros resultados.

| Métrica | C0, sumários | C1, sumários mais CHAT |
| --- | ---: | ---: |
| Alvo em primeiro | 26/30 | 24/30 |
| Alvo entre os três primeiros | 27/30 | 26/30 |
| Alvo entre os cinco primeiros | 27/30 | 26/30 |
| Alvo entre os dez primeiros | 27/30 | 26/30 |
| Alvo entre os cinquenta primeiros | 28/30 | 27/30 |
| MRR | 0,8856 | 0,8303 |
| Ganhos/perdas/iguais frente a C0 | Referência | 1/2/27 |

O único ganho foi uma melhora da posição 15 para 13, ainda fora dos dez primeiros. As perdas incluíram um alvo antes em primeiro que deixou de ser aceito e outro que caiu de primeiro para terceiro.

### Doze controles positivos

| Métrica | C0 | C1 |
| --- | ---: | ---: |
| Alvo em primeiro | 8/12 | 9/12 |
| Alvo entre os três, cinco ou dez primeiros | 8/12 | 9/12 |
| Alvo entre os cinquenta primeiros | 8/12 | 9/12 |
| MRR | 0,6667 | 0,7500 |
| nDCG@10, somente julgamentos conhecidos | 0,6386 | 0,7112 |
| Ganhos/perdas/iguais | Referência | 2/1/9 |
| Resultados explicitamente relevantes | 10 | 11 |
| Resultados explicitamente incidentais | 0 | 0 |
| Resultados desconhecidos pelo gabarito | 10 | 14 |
| Cobertura julgada@10 média, buscas não vazias | 0,6250 em 8 | 0,6296 em 9 |

Os dois ganhos são brutalism e brutalismp, ambos executados como brutalism. Não são duas inferências independentes nem evidência de melhora em duas famílias. A perda foi brutal.

nDCG e cobertura acima não incluem os dois controles negativos. A entrega do executor também registra médias sobre os 14 controles; por isso seu MRR/top1 agregado difere desta tabela, que separa positivos e abstinência.

### Dois controles de abstinência

Ambas as condições retornaram busca vazia para as duas consultas negativas: invoice tax reconciliation for international payments e kubernetes autoscaling policy for production clusters. Resultado: 2/2 em C0 e 2/2 em C1.

Isso é preservação desses dois controles, não garantia de ausência de falsos positivos em outras consultas.

### Sem contar consultas efetivas repetidas

Verifiquei que as entradas duplicadas têm alvos e julgamentos equivalentes. Nas 38 consultas positivas distintas, mais dois controles negativos:

| Métrica, positivas distintas | C0 | C1 |
| --- | ---: | ---: |
| Alvo em primeiro | 31/38 | 29/38 |
| Alvo entre os três ou cinco primeiros | 32/38 | 31/38 |
| Alvo entre os dez primeiros | 32/38 | 31/38 |
| Alvo entre os cinquenta primeiros | 33/38 | 32/38 |
| MRR | 0,8307 | 0,7871 |
| Ganhos/perdas/iguais | Referência | 2/3/33 |

Nos oito controles positivos distintos, ambos ficaram em 5/8 no primeiro lugar. Essa leitura evita que a duplicação de brutalism esconda a regressão nas consultas variadas.

## Investigação das mudanças

### 1P: evidência útil recuperada, mas não enviada ao reranker

Consulta: agentes estao editando o arquivo de instrucoes geradas e misturando custom rules, qual decisao historica evita isso?

O alvo d34b7486 passou de primeiro para ausente dos resultados aceitos. Ele não desapareceu do corpus nem dos canais. A passagem Resultado do sumário, que explicava explicitamente a proibição de editar/estender INSTRUCTIONS gerado, continuou nos canais vetorial e lexical de C1, mas não foi selecionada entre as três passagens da thread enviadas ao reranker.

As três selecionadas foram contexto inicial de CHAT, Estado final de SUMMARY e tratamento realizado de CHAT. O texto informativo de Resultado perdeu a vaga. A melhor evidência do alvo em C1 teve nota do reranker de aproximadamente 0,0053, contra 0,8648 para a evidência de C0, e ficou abaixo do limiar.

O primeiro resultado de C1 passou a ser a oportunidade de organizar agentes registrados no RULES. Sua mensagem trata de inventário de agentes poluindo Custom Rules, um tema relacionado, mas não responde à decisão histórica sobre instruções geradas. Não chamo todos os outros resultados de irrelevantes: o gabarito não julga todos eles.

**Achado confirmado:** parte da regressão está na seleção de evidência antes do reranker. Não é ausência de conteúdo nem demonstração de que um modelo maior resolveria este caso sozinho.

### 9I e 9P: contexto adicional não garante melhor prioridade

9I, consulta indireta sobre a ferramenta que verifica referências, artifacts, mensagens e regras antes de fechar uma thread, passou de posição 15 para 13. CHAT trouxe uma entrega que descreve workspace_audit, Custom Rules e a skill local. É evidência útil, mas o alvo continua fora do Top 10.

O primeiro resultado de C1 foi autocomplete de referências. Li a mensagem original: ela fala de ordem de sugestões, navegação, atalhos e revisão de documentos antes de encerrar, não da ferramenta de auditoria perguntada. Portanto, o avanço do alvo em duas posições não equivale a uma resposta inicial polida.

9P passou de primeiro para terceiro. Sua evidência adicional descreve o encerramento da entrega de audit/Custom Rules, porém uma mensagem do bug de referências em inline code ficou acima, por falar de artifacts, skill e recomendações. Há proximidade de tema, sem justificativa para anunciar melhora universal.

### Brutalism: ganho real de contexto, com alcance limitado

C0 retornava busca vazia para brutalism. C1 trouxe a thread de estilo neo-brutalism em primeiro. A evidência veio da mensagem inicial de maio de 2026, que descreve explicitamente a linguagem visual da UI, fluxos, componentes e critérios da oportunidade. Conferi a mensagem original e seu hash.

O ganho não veio apenas de um registro do benchmark repetindo a consulta. É contexto genuíno da oportunidade, anterior à rodada atual. Ainda assim, é uma proposta inicial, não prova automática de implementação: SUMMARY continua a decisão consolidada.

marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1#msg_abb2014a7310460093

interface com brutalism continuou em primeiro em C0 e C1. A nova passagem é mais explicativa e o score do reranker subiu, mas a posição já era correta antes. A variante original interace usa a mesma consulta efetiva congelada.

Para brutal houve perda: C0 retornou um resultado e C1 retornou busca vazia. A mesma passagem de sumário recebeu exatamente a mesma nota de reranker, aproximadamente 0,028943, nas duas condições. O que mudou foram os sinais relativos do conjunto de candidatos: suporte, concentração, margem e posição. A elegibilidade do alvo caiu de aproximadamente 0,8444 para 0,0335.

**Achado confirmado:** a regra atual de confiança depende do conjunto recuperado. Expandir o corpus pode mudar a aceitação mesmo sem mudar o score absoluto do mesmo par consulta/documento.

toggle e toogle permaneceram com busca vazia em ambos. A expansão não resolveu esses controles.

### Diagnósticos 3P e 6I

- 3P, indicador de saúde da memória: candidato sem filtro passou de quinto para terceiro, mas a elegibilidade própria continuou baixa, de aproximadamente 0,0293 para 0,0235. O alvo não foi aceito. A passagem de Resultado do sumário estava nos canais de C1, mas não chegou ao reranker.
- 6I, remoção de create_thread/read_thread: candidato sem filtro passou de quinto para quarto, mas o alvo continuou não aceito. A passagem principal permaneceu no reranker; sua nota mudou pouco, de aproximadamente 0,2477 para 0,2481, insuficiente para resolver a exclusão. O primeiro resultado de C1 foi uma proposta de leitura incremental, relacionada à economia de contexto, mas sem explicar a remoção perguntada.
- 9I não foi tratado como busca vazia: o alvo continuou aceito, agora na posição 13.

Nenhum desses casos recebeu regra especial ou provocou nova inferência de ajuste.

## Revisão de proveniência

Examinei as mudanças da melhor evidência nas 40 consultas efetivas. Foram sete mudanças da primeira thread e 16 mudanças do primeiro recordId; 13 primeiros resultados de C1 usaram CHAT. Li as mensagens canônicas correspondentes, verificando identidade e hash, além das evidências dos ganhos/perdas.

A revisão incluiu temas variados: instruções/regras, rebuild incremental, referências/artifacts, leitura de threads, health/rebuild, audit, ordenação, segurança de token e UI. Não ficou restrita à família brutalism.

Entre as evidências novas com alvo correto, várias são registros de oportunidade ou plano, não entregas finais. Exemplos: rebuild incremental, health/background e segurança de token. Isso melhora a localização do assunto, mas exige conservar a autoridade do sumário ao interpretar o resultado.

Também houve mudança qualitativa não refletida na posição do alvo: em 10P, sobre trabalhos recentes enterrados e ordenação no servidor, o alvo permaneceu em segundo, mas o primeiro resultado mudou para daemon detached. Li essa mensagem: ela descreve CLI, leases, estado de runtime e instalação, sem explicar a ordenação de threads perguntada.

Não reclassifiquei desconhecidos como erros ou acertos depois de observar o resultado. As observações qualitativas ficam separadas das métricas congeladas. O risco de contaminação histórica permanece: algumas conversas fechadas já falam de testes de busca e consultas semelhantes; este não é um holdout novo.

## Execução e custo observado

Uma única captura no PID 37708, sem retry ou inferência concorrente. O principal confirmou independentemente o término por handle Windows de leitura do próprio processo: saída 0 em 14/10/2026 às 01:52:55 UTC, status completo, 40 consultas e lock ausente. O sampler terminou com amostra after-dispose.

| Medida | Observado |
| --- | ---: |
| Novos embeddings de documento | 450 |
| Requests de embedding de documento | 113, lotes de até 4 |
| Requests de embedding de consulta | 40, compartilhados por C0/C1 |
| Invocações lógicas de reranker | 80 |
| Requests reais de reranker | 40 |
| Cache hits por chave exata | 40 |
| Documentos realmente enviados ao reranker | 4.236 |
| Batches de reranker estimados | 547 |
| Embedding das passagens, incluindo checkpoints | 41,76 s |
| Combine C1 | 0,20 s |
| Rebuild temporário C1 | 0,75 s |
| Captura das 40 consultas | 939,56 s, cerca de 15 min 40 s |
| Tempo nos requests reais de reranker | 902,26 s |
| Soma dos embeddings de consulta | 0,695 s |
| Preflight do executor | 62,79 s |
| Replay e avaliação | 0,90 s |
| Base temporária C1 | 2.653.948 bytes, aproximadamente 2,53 MiB |

Os 547 batches são estimativa por quantidade de documentos/batch configurado, não instrumentação dos forwards ONNX ou de eventual backoff. Não converter esse número em contagem medida de execuções físicas.

As 199 amostras medem apenas o coordenador. Maior RSS amostrado: 1.757.810.688 bytes, aproximadamente 1,64 GiB. Pico relatado pela API do processo: 1.732.944 KiB, aproximadamente 1,65 GiB. Os workers dos modelos não estão incluídos. O coordenador do estudo carrega tokenizers e faz validação exaustiva; isso não é medição da RAM total da busca produtiva nem garantia para PC de 8 GB.

C0 aproveitou scores do estudo 1 somente quando consulta, documentos ordenados, batch, hashes dos modelos e runtime eram idênticos. O custo desta rodada não representa executar C0 fresco e C1 duas vezes, nem uma promessa de latência para a UI.

## Revisão final integrada do principal

**Veredito técnico: aprovado como estudo offline concluído. Recomendação produtiva: não promover C1.**

Escopo revisado: plano, contrato do workspace, 13 módulos/testes temporários, fontes canônicas, identidade/generation, integração com o store/ranking produtivos, capture/checkpoints, cache, métricas, proveniência, cleanup, resultados e entregas próprias do desenvolvedor.

Critérios ligados à implementação e evidência:
- Fontes/autoridade: parser canônico, conferência dos marcadores/IDs, SUMMARY físico e hash do manifesto, snapshots CHAT e sidecar por passagem. Cobertura real 53/395/450, sem alteração das fontes.
- Isolamento: WorkspaceInfo real para leitura das fontes e do cache já existente nos providers; identidade física temporária nos mutators. Integração real em LanceDB de teste confirma reconstrução, preservação dos vetores e canais. Geração encaminhada também às buscas lexicais.
- Materialização: adapter produtivo do mMARCO, segmentação por mensagem, contexto neutro, contagem do payload final sem truncamento. Os 31.520 pares reais cabem em 512.
- Concorrência/recuperação: batches externos de quatro, sobra/retomada testadas, checkpoint por batch/consulta, fingerprint e lock exclusivo. Não houve retomada na execução final.
- Fidelidade/avaliação: oito contratos existentes do ranking passaram. O principal refez 80 rankings com scores capturados, 40 comparações C0 contra estudo 1, 44 avaliações e 88 verificações independentes de posição/recíproco, sem diferenças nem novas inferências.
- Integridade/escopo: depois da execução, 15 grupos de arquivos produtivos/configuração/modelos/stage e 16 arquivos protegidos do estudo 1 mantiveram seus hashes. Nenhum Git foi executado.
- Autoria/loop: desenvolvedor compartilhado codex-dev, runtime Beauvoir, modelo gpt-6-luna/xhigh confirmado pelo humano. Bootstrap independente verificado antes das edições; autorização e correções ficaram no canal interno. Entregas próprias msg_b95b742de3c944ad86 e msg_54f7ac887e264496b6 conferidas contra os arquivos e resultados.
- Qualidade de código: 13 módulos/testes dentro de 300 linhas não brancas, sem erro de parse, else ou if aninhado; testes sem branches/skips. 31/31 testes temporários e 8/8 contratos produtivos passaram na validação independente do principal.
- Documentação: este relatório e o plano documentam o estudo; produto e documentação permanente não mudaram. Browser não se aplica, pois não houve UI.
- Classificação: experimento temporário offline, não mudança executável do repositório nem entrega release-ready. Não executei nem alego passes de pnpm validate/build/test completos.

As correções resolvidas antes da captura incluíram contratos flat/wrapper de vetores, geração lexical, adapter de tokenização, padding sem truncamento, métricas booleanas, armazenamento/proveniência, caminhos físicos, cleanup parcial e separação da CLI/relatório. Nenhuma correção mudou o protocolo de qualidade depois do resultado.

Limites técnicos remanescentes: não há regressões dedicadas para uma thread que resolve para outra ainda dentro de threads nem para mutação de SUMMARY entre preflight e revalidação. Os guards de igualdade física e hash foram revisados e as fontes reais validadas antes/depois. São limites explícitos de coverage deste executor temporário, não aprovação de reutilização produtiva.

Limites de inferência: corpus pequeno; identidades das 53 threads cabem no limite 100, sem provar recall em bases grandes; gabaritos parciais; consultas não independentes; nenhum holdout novo; metadados de conversa não conferem autoridade decisória; RAM apenas do coordenador. Não há taxa global de acerto/erro comprovada.

## Evidências locais e identidades

Raiz de código e dados temporários:
C:/Users/junior/AppData/Local/Temp/marc-content-study-57488bab-20261013/

As capturas/corpus/código completos não foram exportados nem anexados. Foram publicados somente resultados legíveis e evidência selecionada.

| Item | SHA-256 |
| --- | --- |
| Fingerprint executado | 134219d3b5c5220ce0a27df5875057ca7c98f2cd3d1fc08204e4582b6f8459c9 |
| Plano | 7043c322341e0ff7fdf27114a65fdc2fee2316c12adf635889c81c52277ea267 |
| Manifesto | 1a99b242539990b87afa7b016568c2eba9d0d248d5020bbcccaf708644f3dfcf |
| CHAT agregado | 9ab6870a435d283abf20f79656db8b8c1220393fecb0546fbc8e5fd80469e54e |
| Configuração | ab8f2df35ee53770a55f560ae9d795907503016e1bc1b039e2818369fa8dc536 |
| capture.data.json | 977f1452c5e96a4ef58f24bb5d59d46750fa75a35b6e176250d1ef5d1d041ec7 |
| study-report.json | e3ecd14e2d6f20147e06a0ebed97f315e7fe547967dc7c155bea6a2bf96d998a |
| study-provenance.json | fc55159b9494675d2878cc44dac89bb7134ad07de1eb8e6d2f999b1d44b84940 |
| study-resources.json | 811f30104027eb2dbf5564772d3a9fc93fa33385623f5daa32885e216c7a5f25 |
| study-checkpoint.json | 30d4d444e29f0fc15dc2aa40623ff3039dc3802932f6a1868ab8471ef32df76a |
| study-run.json | ba2383e4e4f50e12f313aed0ff53356875ba9dbdeecac23a33c883146a3564af |

Geração: 20261013051147276_6cfe9a14. Nenhuma escrita na memória produtiva.

## Posições por caso

Ausente significa alvo fora dos resultados aceitos, não necessariamente busca inteira vazia. Busca vazia foi confirmada explicitamente para brutal em C1, brutalism em C0, toggle/toogle em ambos e os dois negativos em ambos. Consultas originais foram preservadas, inclusive sua grafia; as efetivas congeladas estão identificadas na análise e no método.

| Caso | Consulta original | Alvo C0 | Alvo C1 | Pareado |
| --- | --- | ---: | ---: | --- |
| 1D | separar INSTRUCTIONS.md gerenciado do RULES.md customizavel no bootstrap | 1 | 1 | igual |
| 1I | onde fica o protocolo operacional estavel e onde ficam as regras comportamentais do workspace? | 1 | 1 | igual |
| 1P | agentes estao editando o arquivo de instrucoes geradas e misturando custom rules, qual decisao historica evita isso? | 1 | ausente | perda |
| 2D | rebuild incremental da memory com batches limitados | 1 | 1 | igual |
| 2I | como evitar reprocessar summaries inalterados e o pico de RAM do ONNX? | 1 | 1 | igual |
| 2P | a reconstrucao tentou alocar 2,67 GiB; qual solucao foi adotada mantendo o full explicito? | 1 | 1 | igual |
| 3D | indicador visual de memory no card da workspace | 1 | 1 | igual |
| 3I | qual icone mostra indice pronto, stale, erro ou rebuild? | 1 | 1 | igual |
| 3P | preciso enxergar no card se a base de conhecimento esta saudavel sem abrir as configuracoes | ausente | ausente | igual |
| 4D | esquemas de visualizacao das colunas da UI para Threads, Marckers e arquivo | 1 | 1 | igual |
| 4I | como funcionam os modos exclusivos e a rolagem propria nas tres colunas? | 1 | 1 | igual |
| 4P | ao abrir agentes ou arquivo, somente o conteudo ativo e o botao de fechar devem permanecer na coluna central | 1 | 1 | igual |
| 5D | gramatica marc:// para referencias internas de artifacts e mensagens | 1 | 1 | igual |
| 5I | como navegar para um artifact vinculado a uma mensagem de outra thread? | 1 | 1 | igual |
| 5P | quero copiar um endereco canonico que abra agente, thread, mensagem ou anexo dentro da UI | 1 | 1 | igual |
| 6D | remover aliases legados do MCP e manter nomes canonicos como thread_create | 1 | 1 | igual |
| 6I | por que create_thread e read_thread deixaram de ser expostos? | ausente | ausente | igual |
| 6P | a lista de ferramentas esta duplicada e gasta contexto com comandos equivalentes | 1 | 1 | igual |
| 7D | tuning de recall e ranking da memory para token da interface | 1 | 1 | igual |
| 7I | como fazer uma decisao historica especifica superar threads genericas semanticamente proximas? | 1 | 1 | igual |
| 7P | a busca acha a decisao correta, mas coloca resultados genericos de UI antes dela | 1 | 1 | igual |
| 8D | status health e rebuild do thread-index em background | 1 | 1 | igual |
| 8I | como a UI serve um snapshot stale enquanto o indice reconstrói? | 1 | 1 | igual |
| 8P | a listagem nao pode travar durante uma reconstrucao pesada e ainda precisa indicar degradacao | 1 | 1 | igual |
| 9D | workspace_audit para Custom Rules com Trigger, Do instead, Evidence e Severity | 1 | 1 | igual |
| 9I | qual ferramenta verifica referencias, artifacts, mensagens e regras antes de fechar uma thread? | 15 | 13 | ganho |
| 9P | agentes nao aplicam as regras do workspace nem anexam artefatos corretamente; que suporte local foi criado? | 1 | 3 | perda |
| 10D | ordenar threads mais novas no topo por closedAt e createdAt | 1 | 1 | igual |
| 10I | qual regra ordena threads abertas e encerradas na listagem? | 1 | 1 | igual |
| 10P | trabalhos recentes aparecem enterrados e a UI nao deveria reordenar no cliente | 2 | 2 | igual |
| Q01 | brutal | 1 | ausente | perda |
| Q02 | brutalismp | ausente | 1 | ganho |
| Q03 | brutalism | ausente | 1 | ganho |
| Q04 | interface com brutalism | 1 | 1 | igual |
| Q05 | interace com brutalism | 1 | 1 | igual |
| Q06 | toggle | ausente | ausente | igual |
| Q07 | toogle | ausente | ausente | igual |
| Q08 | interface token rotation security | 1 | 1 | igual |
| Q09 | structured workspace settings json | 1 | 1 | igual |
| Q10 | seguranca da rotacao de token da interface | 1 | 1 | igual |
| Q11 | seguranca da rotacao de toke da interface | 1 | 1 | igual |
| Q12 | structured worksapce settings json | 1 | 1 | igual |
| Q13 | invoice tax reconciliation for international payments | ausente | ausente | igual |
| Q14 | kubernetes autoscaling policy for production clusters | ausente | ausente | igual |

## Próximo passo

Aguardar avaliação humana deste estudo 2/4. Não implementar expansão produtiva, recalibrar pesos ou iniciar estudos 3/4 e 4/4 sem nova orientação.
