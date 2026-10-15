# Plano de Estudo: Configuração Própria na Segunda Etapa do LFM350M

## Síntese e Correção de Escopo

Esta rodada testa a proposta autorizada pelo humano: preservar o processo atual de identificação de erros de escrita e acrescentar um verificador com configuração própria, reutilizando o mesmo modelo carregado. A rodada anterior separou tarefas por prompt, mas não variou o decoding. Seus resultados continuam válidos para aquele protocolo e não encerram esta hipótese.

O trabalho é um experimento offline e descartável. Não altera a busca produtiva, seus contratos, pesos, índices, prompts, parâmetros ou TTLs. O plano e os resultados serão registrados nesta thread. Não será criada outra thread, nem feita promoção automática de uma configuração.

## Pergunta e Resultado Esperado

Uma segunda chamada, com configuração própria de geração, consegue recusar propostas indevidas e preservar consultas naturais sem perder as correções legítimas reconhecidas pelo caminho atual?

O resultado deve distinguir ganho consistente, perda de positivos, variação entre repetições, formato inválido e custo. Não basta produzir respostas diferentes. Nenhuma repetição favorável isolada será escolhida como evidência de melhora.

## Fontes e Limites Históricos

- Thread 57488bab, estudos e evidências já anexados, incluindo a rodada anterior de duas tarefas.
- Plano anterior `plano-estudo-duas-etapas-lfm350m.md`, imutável, SHA-256 `c2c9507b47b8288bd78ed783e2409ad7204c4ab46894b72aa3c8fdc16b985c77`.
- Resultado anterior `result.json`, SHA-256 `9429bbe12f07c997b1e32b8d73e0e4c13fe451c19831fadf8570740c6398408f`.
- Fixtures e evaluator existentes em `scripts/memory-interpreter-benchmark-cases.ts` e `scripts/memory-interpreter-benchmark-support.ts`.
- Contrato e implementação produtivos em `src/core/memory/query-interpretation.ts` e `query-interpretation-inference.ts`. A fonte produtiva confirma `do_sample:false` e `max_new_tokens:4`.
- Context7 consultado para API de opções por chamada. O índice não apresentou documentação de seed correspondente. O código e a API pública da versão instalada 4.3.1 foram verificados diretamente: `random.seed` alimenta o mesmo PRNG usado por `_weightedIndex`.
- `random.Random(42).random()` retornou 0.6394267984578837 no CLI real, sem carregar pipeline.

Contexto futuro, sem desenvolver ou decidir estas oportunidades:

marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae

marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f

A primeira oportunidade preserva summaries como bússola e propõe aprofundamento em conteúdo de threads fechadas com provenance e snapshot próprios. A segunda estuda expansão moderada/adaptativa, sem decidir remover o mecanismo de depth do core/MCP. Não são implementações já concluídas.

Quando uma evolução mudar efetivamente o corpus, os candidatos ou a política de profundidade, repetir a bateria e identificar a nova versão. Não adicionar adaptação, treinamento ou recalibragem automática em runtime.

## Escopo de Escrita e Delegação

Root exclusivo novo:

`C:/Users/junior/AppData/Local/Temp/marc-decoding-study-57488bab-20261013/`

Esse root não existe no preflight. O repositório, seus modelos, memória real, arquivos em stage e os roots anteriores são somente leitura:

- `C:/Projetos/marc/`, exceto os registros oficiais autorizados desta thread via MCP.
- `C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/`.
- `C:/Users/junior/AppData/Local/Temp/marc-two-stage-study-57488bab-20261013/`.

O desenvolvimento é delegado ao mesmo runtime Beauvoir, perfil compartilhado codex-dev, gpt-6-luna/xhigh confirmado pelo humano. O principal usa seu perfil de arquiteto e configuração previamente confirmados. Inventário conferido, sem administração de perfis. Um developer por vez, sem paralelização.

Antes de editar, o developer confirma seu bootstrap independente, lê o plano e fontes aplicáveis e devolve OK_BOOTSTRAP com workspace/path, regras críticas, configuração e fonte de confirmação, escopo, estado do root e bloqueios. Aguarda autorização explícita do principal pelo canal interno.

A atividade atômica do developer é construir a extensão mínima, validar sem inferência experimental, devolver relatório interno completo e publicar sua própria entrega consolidada via MCP. ACK, autorizações e correções não viram diário na thread. A matriz real será executada pelo principal somente depois da revisão integrada e do congelamento dos módulos.

## Etapa 1: Processo Atual Preservado

Executar o baseline numérico fresco usando os helpers auditados e o contrato produtivo atual, sem prompt novo de grafia, mudança de candidatos ou parâmetros. Cada caso elegível chama o modelo uma vez inicialmente e conserva o guard de formato produtivo.

Manter mensagens, parsing, comportamento de sugestão/aplicação e `do_sample:false,max_new_tokens:4`. Não mutar o objeto compartilhado de opções para configurar o segundo papel.

A decisão fresca do primeiro processo é congelada por caso e reutilizada entre as configurações do segundo. Essa reutilização faz parte do desenho pareado, não é uma substituição por respostas da rodada anterior. Não regenerar o primeiro processo a cada temperatura.

Se o primeiro processo preserva a original com decisão válida, a segunda etapa não é necessária. Se aprova a proposta, o verificador decide. Erro ou formato inválido necessário não será convertido em acerto pela preservação de fallback.

## Etapa 2: Verificação Contextual da Proposta

O verificador deve avaliar a elegibilidade completa da troca, não apenas se duas frases tratam do mesmo assunto. Gramática, identificadores e números podem preservar assunto e ainda violar o contrato de correção.

Reutilizar literalmente o prompt `combined` da rodada anterior, sem criar ou ajustar novo texto depois dos resultados:

> Decide whether Proposed should replace Original. Accept only a clear accidental spelling repair that preserves the same intended request. Do not change valid words, grammar, inflection, accents alone, identifiers, numbers, or negation. Reply FIX to accept a repair, otherwise KEEP.

Esse mesmo prompt será usado em controle greedy e configurações amostradas. A diferença entre esses caminhos será a geração, não uma troca adicional de tarefa. Não usar o prompt de grafia especializada na primeira etapa.

Inputs normais são JSON com os textos completos: `{Original: query, Proposed: variants[1]}`. No stress, inverter apenas a ordem dos campos: `{Proposed: variants[1], Original: query}`. A guarda exige `variants[0] === query`.

Não enviar à etapa 2 a resposta, confiança, aprovação, índice escolhido ou feedback da primeira, gold, categoria, idioma, IDs esperados ou provenance do corpus. Usar apenas Original e Proposed, além do contrato system.

### Configurações Predefinidas

| ID | do_sample | temperature | max_new_tokens | top_k | top_p | Repetições |
| --- | --- | --- | --- | --- | --- | --- |
| G0 | false | Não aplicada | 4 | 0 | 1 | Uma |
| T020 | true | 0.2 | 4 | 0 | 1 | Três |
| T050 | true | 0.5 | 4 | 0 | 1 | Três |
| T080 | true | 0.8 | 4 | 0 | 1 | Três |

No segundo papel, `num_beams:1` e `num_return_sequences:1` são explícitos e constantes. Os demais defaults e assets são os mesmos para todas as configurações. Registrar as opções efetivas e conferir a origem dos defaults do modelo. Na primeira etapa, as opções produtivas não recebem esses campos adicionais.

`top_k:0,top_p:1` evita acrescentar um corte variável de amostragem à comparação entre temperaturas. Temperatura não modifica os pesos e não garante assertividade. O controle G0 permite separar efeito da segunda orientação do efeito de amostrar.

### Sementes e Pareamento

Usar somente a API nativa `prepared.baseline.transformers.random.seed(seed)`, no processo dedicado e sequencial do estudo. Não fazer monkeypatch, alterar biblioteca ou injetar campo de geração `seed` sem suporte.

Bases das três repetições: `[1729,4099,65537]`.

Derivar o seed de cada tentativa como os primeiros quatro bytes unsigned big-endian do SHA-256 de UTF-8 `JSON.stringify(["lfm-decoding-study-v1", base, caseId, attemptNumber])`. A tentativa inicial usa 1, retry usa 2. Configuração e ordem dos campos não entram no hash, permitindo o mesmo ponto inicial de sorteio entre temperaturas e entre normal/reversed.

G0 não necessita seed. Reinicializar o PRNG nativo imediatamente antes de cada chamada amostrada e registrar base, seed derivado, tentativa e opções junto aos inputs/output brutos. Toda inferência é sequencial. O processo do produto e seus estados aleatórios não são tocados.

Reproduzir a sequência aleatória não garante igualdade numérica em qualquer hardware/backend. Manter runtime e assets identificados e guardar as respostas efetivamente observadas.

### Parsing e Guard

Reutilizar `executeRole` e o contrato de enum da rodada anterior. Aceitar somente `raw.trim().toUpperCase()` exatamente igual a FIX ou KEEP. Não aceitar explicações, pontuação ou sinônimos.

Uma resposta inválida pode receber uma única retentativa de formato, com o mesmo prompt/pair e `Return exactly one of: FIX or KEEP`. Não repetir decisões válidas. Erro de provider encerra o papel como falha. Reter cada tentativa e não esconder invalidade recuperada nas gates.

Se o primeiro aprova e FIX é válido, manter a proposta. KEEP válido veta a proposta. Se o primeiro já preserva validamente a original, não chamar o segundo. Se uma etapa necessária falha, a decisão do experimento é falha/não pontuada, mesmo que o contrato produtivo preserve a original como fallback seguro.

## Amostra e Partição Prévia

Reutilizar os 62 casos congelados: 49 decisões e 13 bypasses. Conservar variantes, flags de sugestão, expectativas e distinção entre aplicação e sugestão. Não recalcular candidatos com o rebuild atual, nem pontuar bypasses como acertos.

Partição reservada para seleção nesta rodada, não corpus novo nunca visto por estudos anteriores:

- Calibração: 24 casos, sendo 6 positivos, 6 negativos e 12 naturais.
- Validação reservada: 25 casos, sendo 6 positivos, 6 negativos e 13 naturais. C3/C5 ficam aqui.
- Bypasses: 13, verificados como ausência de chamadas e pontuação.
- Stress original: 16 casos, 9 de calibração e 7 de validação.

Algoritmo: em cada grupo, ordenar pelo SHA-256 de `"lfm-decoding-study-v1|" + group + "|" + caseId`, com desempate por ID. Grupo usa os nomes `positive`, `negative`, `natural`. Remover C3/C5 da ordenação natural e reservá-los. Tomar os primeiros 6/6/12 para calibração e o restante para validação.

IDs de calibração:

- P03-en-recieve-context
- P12-es-aplicacon
- P02-en-brutalismp
- P20-pt-permissao-context
- P04-en-seperate-context
- P01-en-toogle
- P13-es-negacion
- P22-pt-editando-evitando
- P21-pt-onde-node
- P08-en-number
- P07-en-invoice-involve
- P14-es-number
- 5I
- 7I
- 10P
- 2P
- 5P
- 1P
- 3I
- 1D
- 10D
- 9P
- 2I
- 7P

IDs de validação:

- P19-pt-reconstrucao-context
- P17-pt-interpetacao
- P11-es-reconstrucion-context
- P18-pt-configuracao-context
- P09-es-interpetacion
- P10-es-configuracion-context
- P16-es-technical-neighbor
- P05-en-grammar
- P24-pt-accent-only
- P06-en-negated-command
- P15-es-identifier
- P23-pt-inalterados-inalterado
- 8I
- 6P
- 6D
- 3P
- 8P
- 1I
- 4I
- 9I
- 4P
- 4D
- 10I
- C3
- C5

Stress de calibração: P01-en-toogle, P03-en-recieve-context, P07-en-invoice-involve, P13-es-negacion, P21-pt-onde-node, 1D, 2I, 7I, 10D.

Stress de validação: P09-es-interpetacion, P11-es-reconstrucion-context, P17-pt-interpetacao, P19-pt-reconstrucao-context, P05-en-grammar, P15-es-identifier, P24-pt-accent-only.

Bypasses: 2D, 3D, 5D, 6I, 7D, 8D, 9D, C1, C2, C4, C6, C7, C8.

Validar denominadores e disjunção/cobertura antes de carregar pipeline. Não alterar partição por resultado.

## Ordem, Orçamento e Seleção

1. Validar fontes, código, protocolo, runtime, RNG e pesos sem carregar pipeline.
2. Carregar uma única pipeline LFM350M Q4, CPU 2 intra-op + 2 inter-op e acesso remoto desligado.
3. Executar a etapa 1 fresca nos 24 casos de calibração e verificar os 13 bypasses sem inferência. Congelar essas decisões por ID.
4. Executar todas as configurações/repetições do verificador nos casos de calibração, normal e stress da própria partição.
5. Calcular elegibilidade e seleção apenas da calibração. Persistir seleção ou null, com fingerprint, antes de qualquer inferência da primeira ou segunda etapa nos casos de validação.
6. Executar a etapa 1 fresca nos 25 casos reservados e congelar suas decisões. Executar depois todas as configurações/repetições do verificador nessa partição, mesmo se nenhuma for elegível, como diagnóstico. Não trocar o selecionado após conhecer essa parte.
7. Recomputar outcomes pelo evaluator produtivo sem novas chamadas, agregar métricas, desalocar pipeline e encerrar o processo.
8. O principal verifica independentemente a matriz, recursos, seleção antecipada, invariantes e preservação de fontes, depois registra entrega final.

Orçamento máximo de chamadas iniciais: **699**, se todos os 49 primeiros processos aprovarem propostas.

- Primeiro processo: 49 chamadas iniciais, 13 bypasses.
- Calibração do segundo: 24 normais + 9 stress, multiplicados por dez condições, total 330.
- Validação do segundo: 25 normais + 7 stress, multiplicados por dez condições, total 320.
- Dez condições: G0 uma vez, três temperaturas com três repetições cada.
- Segundo processo: até 650 iniciais. O fluxo condicional reduz chamadas quando o primeiro preserva a original ou falha.
- Guard máximo de duas tentativas por etapa/caso: teto de 1.398 tentativas nativas, contando primeiro e segundo. Registrar orçamento real, retries e eventuais perdas de execução. Não relançar job concluído.

O baseline fresco continua tendo 49 chamadas iniciais no total, apenas dividido por partição. Resultados e gold reservados não entram na seleção. O checkpoint deve comprovar essa barreira também para a primeira etapa.

Não acrescentar novas temperaturas, prompts, budgets, votação ou ensemble depois de ver resultados. Não escolher a melhor repetição ou transformar as três repetições em um fluxo produtivo de três chamadas.

### Elegibilidade na Calibração

Cada configuração amostrada deve, em cada uma das três repetições:

- Preservar todos os positivos que o primeiro processo acertou, por ID, não apenas por contagem.
- Atingir pelo menos 5/6 negativos recusados e 10/12 naturais corretos.
- Ter zero erros/invalidade em etapas necessárias, inclusive respostas inválidas recuperadas.
- Manter escolha textual normal/reversed em pelo menos 8/9 casos de stress da calibração.

Se mais de uma for elegível, ordenar lexicograficamente por maior mínimo de naturais corretos entre repetições, maior soma de naturais, maior mínimo de negativos, maior soma de negativos e maior mínimo de estabilidade. Empate final usa menor temperatura. Desempenho não decide qualidade.

Se nenhuma for elegível, selecionar null. Continuar a parte reservada diagnosticamente, sem permitir um novo vencedor escolhido a partir dela.

### Confirmação na Parte Reservada

O selecionado deve, em cada repetição, preservar positivos acertados pelo primeiro por ID, recusar pelo menos 5/6 negativos, acertar pelo menos 11/13 naturais e manter C3/C5 corretos. Erros/invalidade necessários devem ser zero. Estabilidade pareada deve ser 7/7 nessa partição.

Relatar também resultados completos de 12 positivos, 12 negativos e 25 naturais, por repetição, com critérios históricos 10/12, 9/12, 20/25, C3/C5 e estabilidade 14/16. Não ocultar perdas em qualquer grupo ou contra G0. Para recomendar avanço, exigir ganho em naturais ou negativos contra G0 e primeiro processo, sem regressão de positivos nem de naturais. Evidência promissora não aplica configuração à produção.

Apresentar média, mínimo, máximo, desacordos por caso e vetos úteis/prejudiciais. Três sementes são exploração controlada, não prova estatística geral. Todos os presets devem aparecer no relatório, não só o selecionado.

## Implementação Mínima e Ciclo de Vida

Reutilizar leitores, baseline runtime, loader, parsing/guard, lifecycle e evaluator já auditados. Não recriar o framework, copiar modelos, instalar dependências ou mudar helpers anteriores. Nova extensão idealmente usa cinco a sete módulos pequenos, com responsabilidades necessárias e até 300 linhas não-brancas por arquivo.

O root anterior tem writers restritos ao próprio root. Não contornar esse guard para gravar fora dele. A extensão nova deve ter IO mínimo com caminho resolvido dentro do root novo, escrita atômica e compatibilidade de fingerprint/ordem dos jobs.

O launcher retorna rapidamente com PID, identidade, status e paths, sem aguardar a matriz inteira no transporte MCP. Spawn direto Node com `windowsHide:true`, sem PowerShell. Lock exclusivo antes de lançar, recusa de worker ativo ou execução já concluída. Não remover arquivos para tornar um resultado incompatível reutilizável.

Checkpoint por primeiro caso/verificador concluído, com progress e seleção congelada. Se retomada for necessária, validar fingerprint e prefixo/IDs antes de pular jobs concluídos. Falhas de startup, execução e persistência devem ser duráveis. Não usar erro/fallback como acerto.

Medir RSS start/after-load/peak/after-dispose, CPU e duração real de cada tentativa. Não tratar tempo de replay como inferência. Separar o custo da matriz do custo de um fluxo condicional de duas chamadas.

Sempre parar sampler e chamar dispose antes do marcador de conclusão. Principal verifica término do PID. Não iniciar inferência experimental durante implementação ou testes sem autorização posterior explícita. Recall MCP literal exigido pela skill é permitido, mas não é inferência da matriz e não deve ser contado como tal.

## Aceite e Validação do Developer

Sem modelo experimental real na fase de construção:

- CLI real de validação: assets locais, fontes, fonte RNG, protocolo, denominadores, partições e fingerprint, `pipelineLoaded:false`.
- Verificar parâmetro do primeiro processo exatamente igual ao produtivo e que segundo não muta suas opções.
- Fake provider integra primeiro, verificador e evaluator, preservando aplicação/sugestão, bypass e falha sem crédito.
- Cobrir orçamento 699 no cenário de aprovação de todos, redução condicional, zero duplicação de recomposição e isolamento dos casos.
- Testar seeds derivados iguais por case/repeat/attempt entre perfil e ordem, diferentes entre repetições e retries.
- Teste real do RNG público sem pipeline, sem seed fictício ou monkeypatch.
- Parsing/guard e invalidade recuperada contabilizados, provider errors, veto útil/prejudicial e perda de positivo por ID.
- Seleção somente na calibração, registro antecipado, null quando inelegível e proibição de troca com resultados reservados.
- Checkpoints, fingerprint, lançamento concorrente fake, PID e ordem cleanup/complete, inclusive falha de startup.
- Inspeção AST: sem else ou if aninhado no código novo, sem condicionais/skips em testes/fixtures/helpers de testes, tamanho até 300 linhas não-brancas.
- Testes e fixtures determinísticos, mesmo que a matriz real tenha sampling.
- Manual edits via apply_patch, investigação/validação via context-mode. Sem comandos Git ou PowerShell. Não contornar aprovação ou recusa de cleanup.

Entrega interna: arquivos/linhas, fontes/bootstrap/modelo e confirmação, resumo, comandos e resultados reais, limites, documentação, riscos, caminhos de lançamento e fingerprint. Publicação própria consolidada via MCP sob codex-dev, com artefato detalhado e message ID, marcando revisão principal pendente sem antecipar aprovação.

## Revisão do Principal e Entrega Final

O principal lê todo o estado integrado autorizado, repete os checks afetados, verifica autoria/evidência e devolve achados ao mesmo developer pelo canal interno. Só depois congela código e autoriza a matriz real.

Ao terminar, recomputar decisões e métricas a partir das tentativas, conferir seleção persistida antes do reservado, seeds/inputs/options, cobertura, custos, término do processo e hashes de source/old helpers/pesos/memória/stage. Arquivar respostas completas, mesmo se comprimidas sem perda, com SHA-256 decodificado verificado.

Registrar relatório consolidado com revisão substantiva, critérios ligados à evidência, perdas e limites, veredicto do estudo separado de recomendação de configuração. Não declarar rejeição universal da hipótese se os presets falharem. Não adaptar código/prompts/gates após resultados.

Entrega experimental isolada, sem mudança produtiva ou release-ready. Validação focada da extensão e contratos reutilizados, sem declarar pnpm validate/build/test do produto como executados. Nenhuma alteração nos docs do produto é necessária sem mudança produtiva, mas a revisão de impacto deve ser declarada. Browser não aplicável.

Após arquivos, metadata e mensagem final, audit de mensagens no checkpoint pertinente. Thread permanece aberta aguardando avaliação humana. Não encerrar sem autorização.

## Perguntas Pendentes

Nenhuma decisão humana adicional é necessária para este protocolo de estudo autorizado. Se RNG nativo, assets, fontes ou delegação efetiva não puderem ser estabelecidos, registrar o bloqueio antes de editar ou inferir, sem substituir silenciosamente ferramenta, modelo, parâmetros ou dataset.
