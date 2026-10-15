# Atualização do runtime e avaliação completa do Qwen

## Resultado e estado da entrega

Atualização implementada e tecnicamente aprovada pelo principal, após revisão integrada e validação independente.

- @huggingface/transformers atualizado de ^4.2.0 para ^4.3.1.
- Instância transitiva efetivamente usada: onnxruntime-node 1.30.0, confirmada por resolução e importação nativa.
- Qwen3.5 de 0,8B inicializou e concluiu a matriz: o bloqueio CausalConvWithState desapareceu.
- A mudança de embeddings E5 foi comprovada em comparação controlada, exigindo nova geração.
- Identidade dos providers alinhada a transformers-js-4.3.1 e incremental protegido contra provider incompatível.
- Nenhum modelo foi promovido. O interpretador produtivo continua sendo LFM2.5 de 350M.
- A base real e seus pesos não foram reconstruídos, alterados ou apagados. O usuário deverá reiniciar e executar full rebuild.

Aprovação técnica do desenvolvimento não é aceite humano nem autorização de encerramento. A thread permanece aberta.

## Dependências e escopo efetivo

O manifesto preserva o padrão do projeto e altera somente a dependência direta da Hugging Face. A comparação estruturada do importador do lockfile confirmou que nenhuma outra dependência direta mudou. O fechamento transitivo da biblioteca inclui o runtime nativo e os pacotes necessários de tokenização, templating, imagens e backend web.

Não foi adicionado override do ONNX Runtime. A instância correta foi resolvida a partir do próprio pacote Transformers.js, não de uma cópia top-level arbitrária. O import nativo confirmou common e node em 1.30.0.

O pnpm ignorou o postinstall do ONNX Runtime conforme a política de aprovação existente. Não contornei essa política. Os binários CPU disponíveis no pacote funcionaram no Windows x64: import nativo, smoke e inferência real foram concluídos. Isso não certifica CUDA/GPU ou outras plataformas.

### Arquivos alterados nesta atualização

| Caminho | Adequação |
| --- | --- |
| package.json | Dependência ^4.3.1. |
| pnpm-lock.yaml | Regeneração pelo pnpm. |
| scripts/memory-interpreter-benchmark-support.ts | Assinatura offline-local-v3, sem invalidar pesos preparados. |
| scripts/memory-interpreter-benchmark-worker.ts | Metadados a partir de env.version carregado. |
| test/memory-interpreter-benchmark.test.ts | Versão tipada do provider e rejeição de checkpoint v2. |
| test/memory-interpreter-benchmark-contract.test.ts | Contrato da estratégia v3. |
| src/core/memory/model-config.ts | MEMORY_MODEL_VERSION = transformers-js-4.3.1. |
| src/core/memory/rebuild-operations.ts | Guard de compatibilidade antes de qualquer trabalho incremental. |
| test/core-memory-runtime-version.test.ts | Metadados, incompatibilidade, preservação e full explícito. |

A matriz em memory-interpreter-benchmark-cases.ts permaneceu congelada. Não houve mudança de gold, prompts, feedback, parser, retries, candidatos, quantização, threads ou opções de geração.

Não houve alteração de UI, seleção de modelos, scoring, thresholds, settings, schema ou contrato field-aware-hybrid-v2. A atualização da implementação de inferência, entretanto, alterou valores numéricos dos embeddings; não considero o comportamento matemático simplesmente idêntico porque a versão é minor.

## Comparação justa no runtime novo

Todos os três perfis foram executados novamente sobre os mesmos 62 casos: 30 consultas históricas, 8 controles e 24 pares balanceados. Cada perfil fez 49 decisões reais e teve 13 casos sem chamada.

Mesmos parâmetros: CPU, q4, duas threads intra/inter-op, do_sample false e max_new_tokens 4. Os processos foram sequenciais e separados. A geração textual do corpus foi 20261012171458084_59902dec, com 338 linhas e 53 summaries.

| Medida | Baseline 350M | LFM 1,2B | Qwen 0,8B |
| --- | --- | --- | --- |
| Decisões corretas nas consultas naturais | 2/25 | 20/25 | 18/25 |
| Typos legítimos reconhecidos nos pares | 12/12 | 3/12 | 2/12 |
| Alterações indevidas rejeitadas nos pares | 0/12 | 11/12 | 12/12 |
| Pares completos corretos | 12/24 | 14/24 | 14/24 |
| Erros de provider | 0 | 0 | 0 |
| Saídas inválidas | 0 | 0 | 0 |
| Retries | 0 | 0 | 0 |

As decisões do baseline e do LFM maior não mudaram entre a rodada v2 e v3. Isso foi comparado caso a caso, não inferido apenas pela igualdade dos totais.

Esses valores medem interpretação e o resultado completo do contrato de aplicação/sugestão. Não são taxa de sucesso do motor de busca, não incluem casos sem chamada como acertos e não substituem validação do índice regenerado.

### Qwen: qualidade e limites

O smoke retornou uma decisão válida, mas semanticamente incorreta: 0 para toogle/toggle. O sucesso de carregamento não foi confundido com acerto.

Na matriz completa:

- 42 respostas 0 e 7 respostas 1.
- Corrigiu apenas P09, interpetación/interpretación, e P19, reconstrçuão/reconstrução.
- Rejeitou os 12 negativos sintéticos.
- Nas consultas naturais, aprovou cinco sugestões indevidas, em 2P, 3I, 4D, 7I e 10D, sem aplicação automática.
- Recusou os controles C3 e C5, toogle e brutalismp.

Portanto, 12/12 negativos não significa ausência de falsos positivos em consultas reais. Ele foi conservador, perdeu correções importantes e não superou o LFM maior na amostra natural.

Não recomendo promover o Qwen ou o LFM 1,2B sob o contrato atual. Uma eventual evolução do harness precisa de nova decisão e reavaliação, sem alterar estes rótulos retrospectivamente.

### Recursos observados no mesmo runtime

| Medida | Baseline 350M | LFM 1,2B | Qwen 0,8B |
| --- | --- | --- | --- |
| Tempo do worker, load + matriz | 85,16 s | 322,18 s | 153,47 s |
| Mediana por chamada | 1,62 s | 6,33 s | 3,11 s |
| P95 por chamada | 2,53 s | 7,97 s | 3,87 s |
| Pico RSS do worker | 595,9 MiB | 1.336,8 MiB | 1.150,3 MiB |

Windows x64, i5-1335U, 12 CPUs lógicas, aproximadamente 16 GB, Node v22.20.0 e pnpm 10.10.0. Outros aplicativos e pressão variável de memória limitam a interpretação dos tempos.

Não certifiquei máquinas de 8 GB, Linux, GPU, nem o RSS total do mARC. Os valores são dos processos isolados e não medidas de memória residual após dispose.

A espera de ferramenta novamente terminou após 300 s no LFM, mas o processo avançou até concluir os 62 casos e produzir resultado final. Não iniciei duplicata nem somei uma retomada aos tempos. O resultado final foi confirmado no checkpoint e no arquivo completo.

## Embeddings: prova de que full rebuild é necessário

O principal comparou os 338 embeddingText da base, mesma ordem e lotes de quatro. Mesmos pesos E5 int8, prefixo passage, mean pooling e normalização. As bibliotecas foram executadas em processos separados para não misturar runtimes nativos.

| Comparação | Resultado |
| --- | --- |
| 4.2.0 versus vetores armazenados | 338/338 exatamente iguais; diferença máxima 0. |
| 4.3.1 versus 4.2.0 | Nenhum vetor exatamente igual; cosseno mínimo 0,9954012463639351. |
| Diferença absoluta máxima | 0,014543144963681698. |

A diferença não foi explicada por agrupamento: as ordens e os lotes foram controlados, e a biblioteca antiga reproduziu exatamente a geração armazenada. Não atribuí o efeito exclusivamente a um componente interno; a atualização inclui biblioteca, tokenização e runtime.

Antes de alinhar a identidade, uma verificação diagnóstica em processo novo carregou E5 e mMARCO e manteve dois alvos conhecidos em top 1. Isso comprova funcionamento dos modelos, não legitimidade de manter consultas novas contra embeddings antigos em produção.

A identidade persistida anterior ainda dizia transformers-js-4.2.0 e o guard de status comparava essa versão. Atualizá-la é necessário para representar a mudança real; não reescrevi o manifesto antigo para fingir compatibilidade.

Após a adequação, a consulta de status da base real em processo novo confirmou:

- status incompatible.
- searchReady false.
- rebuildReady true.
- Retriever, reranker e interpretador preparados.
- Message: Memory index was built with a different provider contract.

Assim, os pesos existentes são reutilizáveis e o índice antigo fica protegido até reconstrução completa.

## Proteção do incremental

A revisão encontrou um segundo risco: o reconcile incremental validava schema/contrato, mas não a identidade do provider. Poderia preservar linhas antigas, embutir apenas fontes alteradas e publicar a nova versão sobre representações misturadas. Com nenhuma fonte alterada, poderia retornar um no-op sem orientar a recuperação necessária.

A implementação agora reutiliza memoryProvidersMatch antes de:

1. Materializar fontes ou tokenizar passagens.
2. Decidir no-op.
3. Ler e preservar linhas.
4. Executar embeddings.
5. Publicar uma geração.

Em mismatch, retorna erro orientando full rebuild. Não converte incremental em full e não altera o caminho full. Manual e automático compartilham essa operação, portanto a barreira cobre ambos.

Os fixtures Temp verificaram mismatch com fontes inalteradas e alteradas, preservação de manifesto/geração/linhas e zero materialização, leitura de linhas ou embeddings novos. O full explícito cria nova geração, versão nova e reembute todos os records do fixture.

Não executei incremental ou full na base produtiva para experimentar essa rejeição. A evidência transacional veio de fixtures isolados; a verificação real foi somente leitura.

## Revisão integrada final do principal

### Escopo e fontes

Revistos: planos e complementos, nove caminhos alterados, metadados, lockfile estruturado, guard de status e dispatcher existentes, contratos de inferência reutilizados, quatro entregas/consolidações do desenvolvedor pertinentes, resultados v2/v3, controle E5 e status real após mudança.

Revisão e comandos por context-mode; comandos Bash/Node com janelas ocultas. Edições manuais do desenvolvedor por native apply_patch. Lock regenerado por pnpm. Registros pela ferramenta oficial do mARC.

Desenvolvedor: Rawls, runtime 01a13295-ba2b-7173-adbd-4e689c217e59, perfil compartilhado codex-dev, gpt-6-luna/xhigh conforme confirmação humana. Bootstrap independente e autorizações de escopo conferidos internamente. Não criei perfis por spawn ou deleguei em paralelo.

Entregas próprias verificadas: msg_91727619a1a549d3a2, msg_c36874b446514df098, msg_6d9e61669bc742848b e msg_051b78a9d3d646b699. O principal não retransmitiu a entrega do executor como sua.

### Critérios e avaliação

| Critério | Evidência e julgamento |
| --- | --- |
| Atualização mínima | Package normalizado reproduz SHA anterior; importador do lock só mudou HF. Sem override e sem outra dependência direta atualizada. |
| Resolver bloqueio nativo | Import confirmou 1.30.0; Qwen executou smoke e matriz completos sem erro. |
| Comparação equivalente | Três modelos repetidos no runtime novo; mesma matriz, corpus textual, pins e parâmetros. |
| Metadados e checkpoints coerentes | env.version real no benchmark, assinatura v3, regressão de rejeição de v2, marcador de pesos preservado. |
| Evitar indexação silenciosamente incompatível | E5 338 controlados comprovam diferença; versão 4.3.1 e status real incompatible. |
| Impedir mistura por incremental | Guard antes dos efeitos, fixtures no-op/changed e recuperação full explícita; dispatcher/full intactos. |
| Preservar base e pesos | Manifesto e 36 arquivos protegidos mantiveram hashes; não houve rebuild, purge ou download de modelos. |
| Arquitetura e manutenção | Reuso do comparador existente, guard flat, sem nova abstração de routing ou algoritmo de ranking. |
| Regras e testes | Sem else/if aninhado no escopo; novos testes declarativos sem branches/skips, abaixo de 300 linhas. |
| Docs proporcionais | docs/memory.md já exige full quando o contrato de embedding muda. Planos e relatório detalham upgrade/restart; sem nova API/UI a documentar. |
| Aceite e limites | Código aprovado tecnicamente; produto em uso aguarda restart/full; modelos novos não promovidos; thread aberta. |

### Checks independentes no último estado

- pnpm validate: exit 0.
- pnpm build: exit 0; aviso existente de chunk maior que 500 kB.
- pnpm test: 309/309, zero failures/skips.
- Bateria completa do benchmark: 20/20.
- Regressões de versão/guard: 5/5, também incluídas na suite global.
- Typecheck ampliado do benchmark: zero diagnósticos.
- ESLint e Prettier explícitos do escopo, incluindo scripts ignorados por padrão: passaram.
- AST dos fontes alterados: zero else ou if aninhado.
- AST dos testes alterados: zero if/switch/ternário. Arquivos de teste com 293, 291 e 215 linhas não vazias.
- Estado real em processo novo: incompatible, search bloqueada, rebuild liberado, três modelos preparados.
- Browser não aplicável: não houve edição de UI; validação do produto reiniciado fica com o humano.

Uma tentativa inicial de probe core por node -e herdou flags de avaliação inadequadas no fork e o worker saiu. O probe foi reexecutado com execArgv de loader apropriado somente no processo de teste; nenhum código do cliente/manager foi alterado para contornar isso. A tentativa falha não foi contabilizada como sucesso ou como regressão da biblioteca.

### Preservação e veredito

Dos 310 arquivos preexistentes protegidos, apenas os quatro caminhos autorizados mudaram: package.json, pnpm-lock.yaml, model-config.ts e rebuild-operations.ts. Os scripts/testes experimentais já novos antes desta atualização mudaram somente no escopo declarado. Os pesos e a geração antiga não mudaram.

Não executei Git, stage, checkout, reset ou commit. O staging prévio do usuário não foi alterado por este trabalho.

**Veredito técnico: aprovado**, pela evidência integrada da atualização, carregamento dos três modelos, contratos/checkpoints, barreira de compatibilidade, preservação e validação.

**Pendentes humanos:** reiniciar e executar full rebuild, validar o uso e decidir próximos estudos. Não declaro a memória produtiva pronta antes da nova geração. Não certifico qualidade universal da busca, 8 GB ou plataformas não testadas.

## Próxima ação do usuário

1. Reiniciar o ecossistema para carregar build, biblioteca e guard novos. Não usar processos antigos como prova da versão atual.
2. Executar Full rebuild da memória. Incremental não basta e será rejeitado enquanto a geração for incompatível.
3. Conferir Memory status current/ready e as consultas usuais.

Os três modelos já estão preparados. Não é necessário baixar pesos novamente apenas por esta atualização.

Nenhum modelo experimental foi selecionado em produção. Os bundles Qwen e LFM maiores continuam isolados em Temp, aproximadamente 1,52 GB, para reprodução. Não apaguei diretórios produtivos ou arquivos staged.

## Evidências e limites da rodada

- evidencias-interpretadores-onnx-runtime-v3.json: 62 casos, gold de índice congelado, inputs, variantes, raw outputs, resultados completos e tempos dos três perfis, pins e parâmetros.
- comparacao-controlada-e5-runtime-4.2-e-4.3.json: prova numérica do requisito de full rebuild.
- Saídas completas em C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013: evaluate-baseline-v3.json, evaluate-lfm12-v3.json, evaluate-qwen08b-v3.json e smoke-qwen08b-v3.json.

Os anexos preservam as evidências relevantes sem depender exclusivamente de Temp. Não alterei o resultado anterior para esconder o bloqueio do Qwen: ele foi resolvido por esta atualização e avaliado somente depois.

A comparação dos interpretadores usa texto/candidatos congelados da geração antiga; não usa seus vetores para julgar correção. Portanto, a exigência de regenerar a memória não invalida esses resultados, mas impede extrapolá-los para a relevância de uma geração nova ainda não construída.
