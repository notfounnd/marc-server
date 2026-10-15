# Avaliação real dos dois interpretadores ONNX

## Síntese e decisão

Rodada executada em 12/13 de outubro de 2026. Nenhum modelo foi promovido e nenhum parâmetro da busca produtiva foi alterado.

O LFM2.5 de 1,2B executou a matriz completa e preservou melhor as consultas válidas do que o baseline de 350M. Entretanto, reconheceu apenas 3 dos 12 typos legítimos dos pares controlados, recusou toogle/toggle e brutalismp/brutalism e ainda aprovou alterações indevidas. Não recomendo substituí-lo automaticamente em produção.

O Qwen3.5 de 0,8B não inicializou no runtime instalado. Isso impede medir sua qualidade nesta rodada. Não é evidência de que o modelo seja semanticamente pior.

O executor experimental e sua integração estão tecnicamente aprovados para este estudo. A promoção de um interpretador não está aprovada. A thread permanece aberta para avaliação humana.

## Escopo preservado

- Comparação de interpretadores, não de retriever ou reranker.
- E5, mMARCO, corpus, geração da memória, settings, UI, prompt, feedback, gold e regras produtivas permaneceram inalterados.
- Os experimentos não chamaram prepare, rebuild, purge ou initWorkspace produtivos.
- Nenhum Git foi executado. Não houve stage, checkout, reset, commit ou reversão automática.
- Os dois bundles novos foram baixados somente na pasta experimental em Temp. Nenhum peso foi adicionado ao repositório.
- Jev, memory_deep, profundidade adaptativa e mudanças na arquitetura da busca continuam fora desta rodada.
- A recuperação híbrida foi consultada, sem alteração de código, apenas para verificar o efeito das interpretações distintas.

### Código experimental adicionado

| Arquivo | Responsabilidade |
| --- | --- |
| scripts/memory-interpreter-benchmark.ts | CLI, snapshot somente leitura, execução sequencial e checkpoints. |
| scripts/memory-interpreter-benchmark-support.ts | Perfis, assinaturas, isolamento, contratos e avaliação. |
| scripts/memory-interpreter-benchmark-worker.ts | Processo isolado, pipeline público, inferência e liberação. |
| scripts/memory-interpreter-benchmark-cases.ts | Matriz declarativa congelada. |
| test/memory-interpreter-benchmark.test.ts | Semântica, falhas e fontes locais. |
| test/memory-interpreter-benchmark-contract.test.ts | Pins, geração, gold e protocolo de saída. |
| test/memory-interpreter-benchmark-storage.test.ts | Isolamento, marcador, ativos, smoke e checkpoint. |

Esses sete arquivos são novos em relação ao inventário anterior ao experimento. As correções do carregamento não mudaram a matriz congelada. O benchmark permanece fora do produto.

## Protocolo e rastreabilidade

### Perfis

| Perfil | Modelo | Revisão efetivamente utilizada |
| --- | --- | --- |
| Baseline | onnx-community/LFM2.5-350M-ONNX | Bundle produtivo local existente. Revisão de cache não presumida; revision null no resultado. |
| Candidato LFM | LiquidAI/LFM2.5-1.2B-Instruct-ONNX | 10f72e70abf67ac0fd7ebf15bc5854726891d864 |
| Candidato Qwen | onnx-community/Qwen3.5-0.8B-ONNX-OPT | 969350d5f4647ec9ac277110f8974c65d8c10e4b |

A comparação usou CPU, q4, geração determinística sem amostragem e max_new_tokens 4. Cada perfil recebeu intraOpNumThreads 2 e interOpNumThreads 2 e executou em processo próprio, sequencialmente.

O benchmark reutiliza buildMemoryQueryCandidates, interpretMemoryQuery e queryInterpretationMessages do produto. Parser, feedback de auditoria, retry e regras de aplicação/sugestão não foram substituídos por uma implementação experimental.

O baseline foi conferido contra a revisão pública 7dd4999565b0342c381ba90a3d8fc467d6df19c4. Configuração, vocabulário, chat template e pesos relevantes correspondem. A diferença observada no tokenizer_config.json é a ausência local de response_template. O pipeline instalado decodifica a continuação gerada diretamente e não usa esse campo nesse caminho. Essa diferença não explica a saída constante do baseline; não foi usada para alterar ou baixar novamente o cache.

### Corpus e ambiente

- Workspace: marc-dd422176e1, raiz C:\\Projetos\\marc.
- Geração: 20261012171458084_59902dec.
- Manifesto SHA-256: 5bd9ff94b34cd7afca843d91504ef85d1ac54048513420266a1be554ef9227c3.
- 338 linhas vetoriais e 53 summaries fechados.
- Windows x64, Intel Core i5-1335U, 12 CPUs lógicas, aproximadamente 16 GB de RAM.
- Node v22.20.0, Transformers.js 4.2.0, onnxruntime-node 1.24.3.
- Existiam outros aplicativos e pressão variável de memória. Os tempos e o RSS não são certificação de uso em computadores de 8 GB.

### Matriz

62 casos por perfil executável:

- 30 consultas históricas diretas, indiretas e implícitas.
- 8 controles do corpus, incluindo literal, sugestão, typo e negativos.
- 24 pares controlados, balanceados em 12 correções legítimas e 12 alternativas que devem ser rejeitadas.
- Nos pares, 8 casos por idioma: inglês, espanhol e português.
- Casos com palavra única e com contexto; negação, números, identificadores, palavras válidas, flexões e acentuação.

As buscas naturais produziram 25 chamadas ao modelo e 13 casos sem chamada. Os 24 pares sempre produziram chamada. Portanto, cada perfil executável fez 49 decisões reais, não 62 inferências.

Os rótulos foram corrigidos e congelados antes de observar respostas. Acentuação isolada não foi tratada como typo obrigatório. Não houve ajuste posterior para favorecer um candidato. A comparação final confirmou que ambos receberam a mesma ordem, consultas, modos e variantes.

Casos sem chamada, falhas de provider e fallback não contam como acertos do modelo. As fixtures determinísticas exercitam falhas, retries e preservação; não dependem de perguntas aos pesos reais para simular erro.

## Resultados de interpretação

| Medida | Baseline 350M | LFM 1,2B |
| --- | --- | --- |
| Casos coletados | 62 | 62 |
| Decisões reais | 49 | 49 |
| Casos sem chamada | 13 | 13 |
| Consultas naturais com decisão correta | 2/25, 8% | 20/25, 80% |
| Typos legítimos reconhecidos nos pares | 12/12, 100% | 3/12, 25% |
| Alternativas indevidas rejeitadas nos pares | 0/12, 0% | 11/12, 91,7% |
| Pares completos corretos | 12/24, 50% | 14/24, 58,3% |
| Provider errors | 0 | 0 |
| Saídas inválidas | 0 | 0 |
| Retries | 0 | 0 |

A coluna de acerto valida o resultado completo do contrato, incluindo preservação, aplicação ou sugestão quando pertinentes. Não mede somente se uma resposta possui formato válido.

Esses percentuais são de interpretação sob o harness atual. Não são taxa de sucesso da busca completa, nem contradizem automaticamente os 27/30 top 1 da avaliação anterior. Uma consulta indevidamente alterada pode ainda recuperar a thread certa; uma correção legítima pode não recuperar conteúdo relevante.

### Baseline

As 49 respostas brutas foram 1. Ele selecionou a alternativa tanto quando era uma correção legítima quanto quando modificava gramática, intenção ou identificadores.

Nas 25 consultas naturais com inferência, reconheceu os dois controles de typo, C3 e C5, mas errou as outras 23 decisões. Dessas 23, duas causaram aplicação indevida, em 2I e 9P; as outras 21 foram sugestões indevidas sem aplicação.

Uma execução fria adicional colocou o caso P06, com negação, como primeira pergunta de um processo novo. O baseline também retornou 1. Isso reproduz ao menos esse erro sem depender da ordem da matriz ou de reutilização longa do pipeline. O controle adicional não entrou no denominador da matriz.

### LFM maior

O LFM retornou 0 em 42 decisões e 1 em 7. Não apresentou o comportamento constante do baseline, mas ficou excessivamente conservador para typos úteis.

Reconheceu apenas:

- P04: seperate models from cache → separate models from cache.
- P09: interpetación → interpretación.
- P17: interpetação → interpretação.

Nos negativos, o erro foi P16: diagnóstico → pronóstico. É uma troca de significado técnico, não uma correção aceitável.

Nas consultas naturais, os cinco erros foram:

| Caso | Falha |
| --- | --- |
| 9P | Aprovou anexam → anexar, alteração de flexão; foi aplicada. |
| 10I | Sugeriu alterações de flexão em uma pergunta válida; não aplicou. |
| 10P | Sugeriu alterações de flexão em uma sentença válida; não aplicou. |
| C3 | Recusou toogle → toggle; perdeu a sugestão legítima. |
| C5 | Recusou brutalismp → brutalism; perdeu a correção legítima. |

Dos 23 casos históricos com inferência, preservou corretamente 20. Os dois controles naturais de typo não foram reconhecidos.

### Pares por idioma

| Idioma | Baseline | LFM 1,2B |
| --- | --- | --- |
| Inglês | 4/8 | 5/8 |
| Espanhol | 4/8 | 4/8 |
| Português | 4/8 | 5/8 |

A amostra não sustenta afirmar superioridade universal em um idioma. O aumento de acertos totais veio sobretudo da rejeição de mudanças indevidas, não de melhor capacidade de corrigir.

## Compatibilidade Qwen

Preparação e smoke local reproduziram:

> Fatal error: com.microsoft:CausalConvWithState(-1) is not a registered function/op

A falha ocorre ao carregar decoder_model_merged_q4.onnx em onnxruntime-node 1.24.3, antes de gerar a primeira resposta. Os arquivos textuais selecionados, dados externos, configuração e tokenizer estão presentes na revisão pinada. Não houve download de gráficos de visão.

O resultado de smoke contém profileResults vazio e exit 1. Não existe nota de qualidade, latência de inferência válida ou medida de RAM comparável para esse modelo.

Não alterei dependências, ONNX, node_modules ou export, nem substituí o modelo silenciosamente. Uma avaliação de qualidade do Qwen exige resolver essa compatibilidade em escopo próprio e repetir o protocolo.

## Verificação na recuperação híbrida existente

Foram seis consultas únicas, via MCP memory_recall, com queryMode literal, depth 0 e limit 50. Literal impede que o interpretador produtivo faça uma segunda alteração e permite atribuir o efeito à consulta testada. Foi usada a mesma geração da memória, sem rebuild ou mudança de elegibilidade/ranking.

Só 2I e C5 tiveram consulta efetiva diferente entre os dois perfis. Também conferi a original e a alteração indevida de 9P, compartilhada pelos dois.

| Consulta | Observação |
| --- | --- |
| 2I original, summaries inalterados | Thread 3e422682 em top 1; um resultado. |
| 2I alterada, summaries inalterado | Mesma thread em top 1; um resultado. |
| 9P original, anexam artefatos | Thread 184fd8bb em top 1; dois resultados. |
| 9P alterada, anexar artefatos | Mesma thread em top 1; três resultados. |
| brutalismp literal | Um resultado: thread e4478bac de calibragem. |
| brutalism literal | Nenhum resultado em depth 0. |

A alteração de 9P adicionou aa4908aa, processamento em background, ao conjunto retornado. Não considerei isso ganho de relevância. O top 1 esperado permaneceu estável.

Nesta amostra alterada, a maior preservação do LFM não demonstrou ganho de top 1. A correção de brutalismp pelo baseline é legítima, mas também não resolveu a recuperação desejada para brutalism em depth 0. O LFM mantém a typo e retorna a thread de calibragem, o que não valida qualidade contextual.

A observação não é um teste de toda a busca nem de todos os níveis deep. Não reabri a calibração do motor nesta rodada.

## Recursos observados

| Medida | Baseline | LFM 1,2B | Qwen 0,8B |
| --- | --- | --- | --- |
| Arquivos locais do perfil | 297.116.035 bytes, aproximadamente 297 MB | 853.546.211 bytes, aproximadamente 854 MB | 666.373.456 bytes, aproximadamente 666 MB |
| Pico RSS do worker na bateria | Aproximadamente 600 MiB | Aproximadamente 1.315 MiB | Não comparável: não executou inferência |
| Tempo do worker, carregamento + matriz | 104,32 s | 411,24 s | Não comparável |
| Mediana por chamada | 2,13 s | 8,11 s | Não medida |
| P95 por chamada | 2,43 s | 11,35 s | Não medido |

O RSS inclui o processo isolado e seu runtime nativo. Não é soma de todo o mARC, navegador e sistema operacional. O estado afterRssBytes registrado é anterior ao dispose; não o apresentei como medida de memória residual depois da liberação.

Os workers concluíram e encerraram. Os PIDs do job LFM prolongado deixaram de existir. O finally aguarda dispose do pipeline. Não há evidência de um worker experimental ainda carregando modelos.

A espera de uma ferramenta terminou após 300 segundos durante a bateria do LFM, mas o worker continuou avançando até produzir 62 casos e resultado final. Não iniciei duplicata e não misturei uma retomada com esse processo vivo. O tempo total real de 411,24 segundos foi preservado.

### Retenção dos arquivos experimentais

Os bundles foram mantidos para reprodução em:

C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013/models

São 1.519.919.667 bytes, aproximadamente 1,52 GB, fora do cache produtivo. Há um marcador por perfil, arquivos pinados e uma pequena duplicata de config criada pela descoberta da biblioteca. Não criei uma política produtiva de limpeza nem deletei modelos em uso.

As evidências essenciais estão anexadas à thread, não dependem exclusivamente de Temp. A eventual remoção desses bundles elimina a possibilidade de repetir a inferência sem baixar novamente, mas não apaga o relatório ou o registro dos resultados. Não removi arquivos produtivos ou staging para executar essa limpeza.

## Correção necessária do executor

A primeira execução de LFM preparou pesos, mas falhou na geração porque pipeline.tokenizer era null. O caminho de descoberta do Transformers.js 4.2.0 não repassava a revisão/cache local ao buscar tokenizer_config.json, embora os arquivos corretos estivessem no diretório pinado.

O smoke inicial havia terminado com exit 0 do coletor, mas continha provider-error, não uma decisão válida. Essa interpretação de sucesso foi corrigida; a rodada v1 com erros não recebeu score e está excluída das tabelas.

O complemento offline-local-v2 corrige o executor:

- Prepare usa ID remoto e revisão explícita.
- Run e smoke usam o diretório local exato, sem acesso remoto.
- Verifica configuração, tokenizer e ONNX dentro desse diretório, não em qualquer pasta irmã do cache.
- Reutiliza o marcador existente por perfil/modelo/revisão/caminho. Não baixa novamente os mesmos pesos por mudar a estratégia de carregamento.
- A assinatura v2 invalida somente checkpoints e resultados incompatíveis.
- Smoke exige uma decisão real com índice inteiro dentro das variantes, persiste o diagnóstico antes de falhar e repete a validação ao retomar.
- Acerto semântico não é critério de smoke. O smoke v2 do LFM respondeu 0 para toogle e foi válido para carregamento, mas incorreto semanticamente.
- Preserva prompt, feedback, gold, opções de geração e regras existentes.

A prova isolada de P06 retornou 0 no LFM maior com os mesmos arquivos locais. Foi diagnóstico de carregamento e uma decisão correta, não prova de superioridade em toda a matriz.

## Revisão integrada final do principal

### Fontes e escopo efetivamente revisados

Revisão de todo o executor autorizado, dos sete arquivos, das fixtures congeladas, dos contratos produtivos reutilizados, do plano e complemento, dos dois relatórios próprios do desenvolvedor, das saídas v2 completas e das consultas MCP de recuperação.

Inspeção e comandos foram feitos por context-mode. Manual edits do desenvolvedor foram feitos por native apply_patch. Artefatos e entregas foram registrados pelas ferramentas oficiais do mARC.

Delegação sequencial ao runtime Rawls, 01a13295-ba2b-7173-adbd-4e689c217e59, perfil compartilhado codex-dev, gpt-6-luna com reasoning xhigh conforme confirmação humana. Bootstrap independente e autorização explícita foram verificados antes das edições. O principal não criou perfil por spawn nem publicou a entrega do desenvolvedor como sua.

Entregas próprias verificadas: msg_3d8a906ceb284096bc e msg_d950e8b99d1548429a.

### Critérios confrontados com implementação e evidência

| Critério | Avaliação do principal |
| --- | --- |
| Isolar experimento de produção | Paths canonicalizados em Temp, baseline local-only, APIs de leitura, testes de escapes e verificação final por hashes. |
| Preservar fontes e staged work | 310 arquivos preexistentes com hashes inalterados; nenhum comando Git. Não alego comparação byte a byte do índice Git. |
| Preservar modelos e índice | 36 arquivos protegidos com hashes inalterados, sem arquivo extra nesses diretórios; manifesto e geração idênticos. |
| Comparação justa | Mesma ordem, consultas, modos e variantes confirmados; parâmetros CPU/q4/prompt/gold congelados. |
| Não inflar acertos por fallback | Status separado, modelCorrect null quando não há decisão; fixtures de provider/invalid/literal executadas. |
| Exigir smoke real | Decisão válida e índice em range, resultado salvo antes da falha, validação de retomada. Testes e smoke real v2 confirmam distinção. |
| Reproduzir falhas | Baseline frio P06 e Qwen local reproduzidos; v1 de tokenizer excluída das métricas e refeita corretamente. |
| Entender resultado da busca | Seis consultas distintas da recuperação existente; ranking não tratado como consequência automática da seleção do modelo. |
| Manter arquitetura e regras | Reuso de contratos produtivos; variação por estratégia; sem else/if aninhado; testes declarativos sem branches ou skips. |
| Completar validação | Checks independentes focados e globais passaram no estado final; nenhuma mudança de código depois. |
| Manter documentação proporcional | CLI help, plano, complemento e relatório documentam ferramenta experimental. Nenhuma nova funcionalidade de produto exige mudar README/API/UI. |
| Distinguir execução e promoção | Executor aprovado; Qwen bloqueado no runtime; nenhum candidato aprovado para substituição produtiva. |

### Verificações independentes

- pnpm validate: passou.
- pnpm build: passou, com o aviso já existente de chunks maiores que 500 kB.
- pnpm test: 302/302 passaram, zero falhas e zero skips.
- Bateria focada dos três arquivos: 18/18 passaram.
- ESLint scoped nos sete arquivos: passou.
- Prettier explícito com ignore-path .gitignore nos sete arquivos: passou.
- Typecheck ampliado para CLI, support, worker, cases e testes: zero diagnósticos, executado com cwd do repositório.
- AST: nenhum else ou if aninhado nos scripts; testes sem if/switch/ternário e sem skips.
- Arquivos de teste: 269, 291 e 285 linhas não vazias, dentro do limite de 300.
- Browser não aplicável: não houve alteração de UI.
- Não houve autorização nem execução de hooks específicos de cliente.

A primeira tentativa do principal de typecheck ampliado, dentro do cwd do sandbox, não encontrou tipos de Node. Reexecutado com Node no cwd real do repositório, terminou com zero diagnósticos. Não contei a tentativa inválida como validação bem-sucedida.

### Achados resolvidos e limites

Resolvidos: limite de arquivo de teste, pin digitado incorretamente antes da inferência, descoberta offline do tokenizer, smoke que confundia coleta com inferência válida, validade dos resultados retomados e diferenciação de fallback/acerto.

Restam limites relevantes:

- Qwen não avaliável semanticamente no runtime atual.
- LFM 1,2B falha em correções essenciais e ainda tem falso positivo.
- A amostra é pequena e congelada; não é benchmark universal ou certificação de qualidade de busca.
- Todos os resultados são condicionados ao harness atual. Não testei novos prompts ou limites de geração.
- Não foi feita certificação em Linux ou em 8 GB, nem medição de RSS do conjunto completo do mARC.
- Nenhum ganho de relevância downstream foi demonstrado nas consultas efetivas que mudaram.
- Bundles experimentais continuam ocupando espaço em Temp para reprodução.

### Veredito

**Aprovado tecnicamente:** executor experimental e confiabilidade das evidências v2, com o bloqueio do Qwen explicitamente separado de qualidade.

**Não aprovado:** promover um novo interpretador, afirmar melhoria geral da busca ou certificar RAM de 8 GB.

O estudo permite uma decisão informada. A próxima intervenção, se autorizada, precisa escolher entre investigar compatibilidade do Qwen ou refinar e reavaliar o contrato do interpretador. Nenhuma dessas intervenções foi iniciada automaticamente. Aceite humano e encerramento permanecem pendentes.

## Evidências anexadas e arquivos completos

O anexo evidencias-experimento-interpretadores-onnx-v2.json preserva os 62 casos, consultas, variantes, outputs, índices, resultados completos da interpretação e tempos dos dois perfis executáveis, além do modelo, memória, snapshot e hashes. Os índices esperados de casos sem chamada são placeholders de preservação, não notas de inferência.

Saídas completas do executor permanecem na pasta experimental:

| Arquivo | SHA-256 |
| --- | --- |
| evaluate-baseline-v2.json | 1154ad5807119a0e980a2d48c8a2647df4f69fa9e88fdb7074b845eac66571c9 |
| evaluate-lfm12-v2.json | 05041175afdcbaead89099dbe0c5c1b738e639c816f327bbbbd25490e3540e26 |
| smoke-lfm12-v2.json | 3e6607b015b36bc40899d7ef6fc65632563358ae03eb552febaae3278ca3c6f9 |
| smoke-qwen08b-v2.json | a34305d10aaa198fb59660ea5f82d181cf7caa79a8776784139cddf6a1c29652 |

A geração e os hashes protegidos foram reconfirmados depois das consultas MCP. Índices, caches e resultados são derivados; os registros oficiais desta avaliação são os anexos e mensagens da thread. Nada nesta avaliação exige reverter o código ou o conteúdo previamente colocado em stage.
