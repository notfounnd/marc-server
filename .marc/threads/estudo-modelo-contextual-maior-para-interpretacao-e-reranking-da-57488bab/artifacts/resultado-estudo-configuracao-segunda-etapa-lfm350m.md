# Estudo de configuração da segunda etapa do LFM350M

## Síntese e recomendação

Não incorporar esta segunda etapa à busca produtiva. Preservar o comportamento atual do produto.

A rodada testou a hipótese corrigida: manter a primeira etapa exatamente como está e especializar a configuração de geração de um segundo processo que reutiliza os mesmos pesos do LFM350M. A temperatura foi efetivamente aplicada com amostragem, não apenas declarada em uma configuração.

Nenhuma configuração melhorou as decisões sobre alterações indevidas ou consultas naturais. Temperaturas 0,2 e 0,5 produziram o mesmo resultado do controle determinístico nas três repetições. Temperatura 0,8 também não melhorou esses grupos e perdeu uma correção válida em uma repetição.

Essa conclusão vale para este modelo, prompt, limite de geração, conjunto de propostas e grade de configurações. Não demonstra que toda arquitetura em duas etapas ou toda temperatura possível falha.

## Escopo

- Thread de estudo 57488bab, sem implementação ou promoção de mudanças no produto.
- Extensão temporária em `C:/Users/junior/AppData/Local/Temp/marc-decoding-study-57488bab-20261013/`.
- Modelo existente `onnx-community/LFM2.5-350M-ONNX`, Q4, CPU, uma carga de pipeline e execução sequencial.
- Transformers.js 4.3.1, ONNX Runtime Node 1.30.0 e Node.js 22.20.0.
- Sem download, alteração de modelo, rebuild, purge, mudança de TTL, dicionários, listas de palavras, regras por idioma ou tratamento especial para um termo.
- Código, dependências, documentação do produto, modelos, memória e stage do Git preservados. Nenhum comando Git executado.

## Método

O plano foi anexado antes do desenvolvimento na mensagem `msg_f8ef617b8afd4fefac`. Seu SHA-256 congelado é `9c12b9514c6b58515cabd29a12d394ac0b215816c1eee6bcf32454c28cb84b01`.

A primeira etapa preservou o prompt numérico produtivo e os parâmetros `do_sample=false` e `max_new_tokens=4`. Cada caso recebeu uma decisão nova da primeira etapa; essa decisão foi reutilizada entre as condições da segunda etapa para isolar a variável estudada.

A segunda etapa recebeu somente o par original/proposta e uma instrução fixa para aceitar apenas uma correção acidental clara de escrita, sem trocar palavras válidas, gramática, flexão, identificadores, números ou negação. As respostas admitidas eram FIX ou KEEP. Não recebeu gabarito, categoria, idioma declarado, decisão anterior ou índice esperado.

| Condição | Amostragem | Temperatura | Repetições |
| --- | --- | --- | --- |
| G0 | Não | Não aplicada | 1 |
| T020 | Sim | 0,2 | 3 |
| T050 | Sim | 0,5 | 3 |
| T080 | Sim | 0,8 | 3 |

Todas as condições da segunda etapa usaram limite de quatro novos tokens, top_k=0, top_p=1, uma beam e uma sequência retornada.

As três bases de seed foram 1729, 4099 e 65537. Cada tentativa recebeu uma seed derivada de base, ID do caso e número da tentativa, aplicada pela API pública de RNG do Transformers.js. A mesma seed foi usada nas comparações pareadas entre temperaturas e entre as duas ordens de apresentação. Não houve monkeypatch de Math.random nem parâmetro de geração inventado.

O protocolo admitia uma tentativa adicional apenas para corrigir formato inválido. Não houve retry real nesta rodada.

### Conjunto e separação

- 62 casos congelados.
- 24 casos de calibração: seis correções válidas, seis alterações indevidas e 12 consultas naturais.
- 25 casos reservados: seis correções válidas, seis alterações indevidas e 13 consultas naturais, incluindo os controles C3 e C5.
- 13 casos de bypass, sem chamada ao modelo e sem contagem como acerto.
- Nove pares de stress na calibração e sete na validação, apresentados também na ordem inversa.

A geração congelada de referência foi `20261012171458084_59902dec`, com 338 registros e manifesto `5bd9ff94b34cd7afca843d91504ef85d1ac54048513420266a1be554ef9227c3`. A memória atual não foi regenerada.

O conjunto reservado é separado dentro desta rodada, mas seus casos já haviam aparecido em estudos anteriores. Não é um conjunto inteiramente novo e desconhecido em todo o histórico.

### Seleção antes da validação

A calibração exigia preservação das correções válidas que a primeira etapa acertou, pelo menos 5/6 acertos em alterações indevidas, 10/12 em consultas naturais, ausência de falhas e estabilidade de pelo menos 8/9 pares. Cobertura exata e três repetições completas eram obrigatórias.

Nenhuma configuração foi elegível. A seleção nula foi persistida antes da primeira chamada dos casos reservados. Uma observação independente confirmou 330 avaliações de calibração concluídas, seleção congelada e nenhuma avaliação da segunda etapa reservada iniciada naquele momento.

Todas as configurações foram depois avaliadas no conjunto reservado para diagnóstico. Não foi escolhida uma alternativa depois de olhar esses resultados. A validação exigia 5/6 alterações indevidas, 11/13 consultas naturais, preservação das correções válidas, controles corretos, ausência de falhas e estabilidade 7/7.

## Resultados

Estes números avaliam a decisão de corrigir ou manter consultas com propostas congeladas. Não são a taxa de acerto do retriever, do reranker ou do motor completo de busca.

### Resultado completo por condição

| Condição e repetição | Correções válidas | Alterações indevidas rejeitadas | Consultas naturais corretas | Stress estável |
| --- | --- | --- | --- | --- |
| Primeira etapa atual, nova execução | 12/12 | 0/12 | 2/25 | Não se aplica |
| G0 | 12/12 | 0/12 | 2/25 | 16/16 |
| T020, repetição 1 | 12/12 | 0/12 | 2/25 | 16/16 |
| T020, repetição 2 | 12/12 | 0/12 | 2/25 | 16/16 |
| T020, repetição 3 | 12/12 | 0/12 | 2/25 | 16/16 |
| T050, repetição 1 | 12/12 | 0/12 | 2/25 | 16/16 |
| T050, repetição 2 | 12/12 | 0/12 | 2/25 | 16/16 |
| T050, repetição 3 | 12/12 | 0/12 | 2/25 | 16/16 |
| T080, repetição 1 | 12/12 | 0/12 | 2/25 | 16/16 |
| T080, repetição 2 | 12/12 | 0/12 | 2/25 | 16/16 |
| T080, repetição 3 | 11/12 | 0/12 | 2/25 | 16/16 |

Nas três repetições de T020 e T050, mínimo, máximo e média foram 12 acertos positivos, zero negativos e dois naturais. Em T080, os positivos tiveram mínimo 11, máximo 12 e média 11,67; negativos e naturais continuaram em zero e dois.

### Calibração e conjunto reservado

Na calibração, a primeira etapa e todas as condições obtiveram 6/6 correções válidas, 0/6 alterações indevidas e 0/12 consultas naturais. A estabilidade foi 9/9, mas não compensou o fracasso nos critérios de qualidade.

No conjunto reservado, a primeira etapa, G0, T020, T050 e as duas primeiras repetições de T080 obtiveram 6/6 correções válidas, 0/6 alterações indevidas e 2/13 consultas naturais. A última repetição de T080 caiu para 5/6 correções válidas. A estabilidade foi 7/7 em todas as condições.

### Vetos, divergências e regressões

- Nenhum veto útil.
- Um veto prejudicial em um caso normal: `P09-es-interpetacion`, em T080, repetição 3.
- O mesmo veto apareceu na apresentação inversa desse caso. São duas chamadas físicas, mas uma regressão de caso, não duas perdas independentes.
- A resposta bruta foi KEEP. O verificador bloqueou uma correção que a primeira etapa havia acertado.
- As outras condições não mudaram o índice escolhido pela primeira etapa.
- Não houve variação de decisão nas três repetições de T020 e T050.
- Estabilidade de apresentação não equivale a correção: a decisão errada de T080 foi estável nas duas ordens.

O resultado não sustenta adicionar custo ao fluxo por meio desta segunda etapa. Aumentar a temperatura produziu uma perda, sem o ganho buscado nas consultas naturais.

## Custo observado

| Condição | Chamadas reais da segunda etapa | Menor tempo | Maior tempo | Média por chamada |
| --- | --- | --- | --- | --- |
| G0 | 65 | 1,66 s | 2,79 s | 2,18 s |
| T020 | 195 | 1,80 s | 3,02 s | 2,27 s |
| T050 | 195 | 1,82 s | 2,94 s | 2,25 s |
| T080 | 195 | 1,77 s | 2,96 s | 2,26 s |

Esses tempos são de chamadas físicas da segunda etapa, incluindo apresentações inversas. Não são tempos de replay em cache nem uma promessa de latência produtiva. Quando a segunda etapa é necessária, ela acrescenta processamento mesmo reutilizando o modelo residente.

- 49 chamadas da primeira etapa e 650 da segunda, totalizando 699.
- Zero retries, erros de execução ou respostas inválidas.
- Duração total observada de aproximadamente 27,54 minutos.
- Pico de RSS do processo de aproximadamente 750,76 MiB.
- RSS de aproximadamente 123,42 MiB após dispose.
- 291 amostras de recursos persistidas.
- Worker 17468 encerrado e lock liberado, confirmados independentemente.
- A mesma cópia dos pesos foi reutilizada. Não houve segunda instalação nem novo custo de disco para modelo.

O pico inclui runtime, modelo e dados do executor. Não representa apenas os tensores do modelo nem uma estimativa de toda a aplicação em um PC de 8 GB.

## Revisão final integrada

**Veredito da extensão temporária: aprovado.** A revisão do principal abrangeu os sete módulos e o arquivo de testes, o plano congelado, os helpers reutilizados, o fluxo público de CLI, as entradas e os resultados completos. A aprovação é do estudo executado, não da adoção da hipótese no produto.

**Veredito para promoção produtiva: rejeitado nesta rodada.** Não houve ganho de qualidade que justificasse a segunda etapa; uma condição trouxe regressão.

### Critérios vinculados à evidência

- Preservação da primeira etapa: parâmetros produtivos conferidos no CLI, novas decisões para os 49 casos e nenhum parâmetro de sampling injetado nessa etapa.
- Isolamento da variável: prompt fixo, mesmo modelo, mesmos pares e seeds pareadas; opções e seeds verificadas nas tentativas brutas.
- Separação calibração/validação: ordem revisada no executor, teste do fluxo completo e seleção nula observada antes das avaliações reservadas da segunda etapa.
- Erros e bypass: sem falsa conversão de falha em acerto, 13 bypasses sem inferência e totais físicos distintos dos totais lógicos.
- Encerramento: conclusão persistida somente após dispose; PID encerrado e lock removido.
- Qualidade e rastreabilidade: métricas por fase, grupo, condição e repetição, vetos, regressões, stress e custos reais; conferência independente a partir de registros e gabaritos.
- Escopo: os 14 grupos/arquivos de integridade permaneceram idênticos à base, incluindo src, scripts, test, docs, modelos, memória, contratos e índice do stage.
- Regras de código: módulos abaixo do limite de 300 linhas não brancas, ausência de else e if aninhado, testes sem seleção condicional de cenários.
- Entrega autoral: mensagem `msg_d9fd3d18195a454fb3` publicada pelo perfil compartilhado codex-dev, verificada pelo principal.

### Validações executadas pelo principal

- Suíte temporária: 16/16 cenários, zero falhas e zero skips.
- Contratos existentes de interpretação e inferência: 15/15, zero falhas e zero skips.
- CLI público `--validate-inputs`: exit 0, sem carregar pipeline, com verificação do plano, runtime, RNG e pesos locais.
- Recomputação independente dos 650 registros da segunda etapa: zero divergências em seeds, opções, pares, parsing e classificação de acerto.
- Contagem independente de tentativas: 699.
- Hashes antes/depois: zero mudanças nos 14 grupos/arquivos protegidos.
- Inspeções e validações feitas com context-mode; edições manuais da extensão feitas pelo desenvolvedor com apply_patch nativo.

A classificação é estudo offline isolado, sem alteração executável do repositório e sem declaração de entrega release-ready. Foram executadas as verificações focadas previstas no plano. Não foram executados pnpm validate, pnpm build ou a suíte completa pnpm test nesta rodada; nenhum desses comandos é apresentado como aprovado.

Não houve necessidade de editar a documentação produtiva, pois nenhuma arquitetura, API, configuração ou comportamento do produto mudou. O material de pesquisa foi registrado nesta thread.

## Limites e continuidade

A grade tem três temperaturas, três seeds e um prompt fixo com limite de quatro novos tokens. Não é busca exaustiva de todas as configurações, não altera pesos e não mede generalização estatística para qualquer consulta futura.

A reutilização de um modelo residente é viável como mecanismo de execução, mas não foi suficiente para obter especialização útil nesta tarefa. A contribuição desta rodada é excluir estas condições com evidência, sem mexer na busca atual.

As evoluções f04c7cae, sobre conteúdo aprofundado de threads fechadas, e 4f477d9f, sobre profundidade adaptativa, podem mudar candidatos e contexto. Uma futura avaliação deverá congelar novamente corpus, propostas, protocolo e parâmetros, sem herdar a conclusão como verdade universal.

A thread permanece aberta para discussão do estudo. Não há implementação produtiva ou encerramento autorizado por esta entrega.

## Rastreabilidade e evidência local

Fingerprint da execução: `077eeffb521a87a25ffeab986eeabcda6bbb33527dbec5d71f2fc270aace2fd2`.

Diretório final: `C:/Users/junior/AppData/Local/Temp/marc-decoding-study-57488bab-20261013/runs/077eeffb521a87a25ffeab986eeabcda6bbb33527dbec5d71f2fc270aace2fd2/`. Os arquivos checkpoint.json, run.json, resources.json e launcher.json preservam respostas, mensagens de entrada, decisões, seeds, parâmetros, progresso, custos e encerramento.

O pacote integral foi preparado em memória, sem copiar modelos ou modificar arquivos protegidos. Ele contém 3.002.832 bytes decodificados, com SHA-256 `53505d172cf44c4dbb83103db9d3bccc5013f9a2eacc634ff9da5c76201731db`.

Sua anexação integral foi bloqueada pelo revisor automático por conter consultas, trechos do workspace e fontes completas. Não houve tentativa de contornar o bloqueio. A autorização específica foi solicitada ao humano. Até essa autorização, o relatório consolidado é o registro publicado e a evidência integral permanece local; ela não deve ser tratada como já anexada.
