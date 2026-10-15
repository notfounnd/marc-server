# Estudo de duas etapas especializadas com o LFM 350M

## Objetivo e restrições

Avaliar se separar correção de escrita e preservação da intenção melhora a interpretação da busca com o mesmo modelo pequeno. O usuário autorizou o estudo, não uma mudança produtiva. Não adicionar dicionários, listas por idioma, exceções por termo, modelos, downloads, dependências ou alterações no motor de busca.

Os papéis serão duas tarefas lógicas executadas sequencialmente na mesma instância de pipeline, não dois modelos carregados em processos distintos. Manter o contexto completo em ambos. O segundo papel não recebe a resposta, aprovação ou confiança do primeiro.

## Fontes e decisões preservadas

Ler AGENTS.md, skill marc-ops, contrato integral do bootstrap e Custom Rules, docs/memory.md, docs/development.md, docs/agent-workflows.md, fixtures e evaluator do benchmark, query-interpretation.ts e query-interpretation-inference.ts.

A thread 57488bab contém a comparação dos modelos e o estudo de apresentações. A evidência congelada tem 62 casos, 49 decisões e 13 no-call. A última rodada mostrou forte influência da ordem e não aprovou as apresentações A/B.

O recall desta atividade retornou a thread 834716ba. Ela foi lida antes do plano. Preservar as decisões de origem da correção: a alternativa pode ser aplicada automaticamente quando a grafia original está ausente do corpus, ou somente sugerida quando ela está presente. Este estudo não reabre o uso de LFM no reranking, a elegibilidade semântica das threads, o deep retry ou os TTLs.

Usar exclusivamente as consultas, alternativas, gold e flags de aplicação/sugestão da evidência anterior e das fixtures reconciliadas. Não gerar candidatos a partir da memória atual. Reutilizar os helpers validados do estudo anterior somente para leitura e importação, sem editá-los.

## Variáveis fixas

- onnx-community/LFM2.5-350M-ONNX, mesmos pesos locais Q4.
- Transformers.js 4.3.1 e ONNX Runtime Node 1.30.0.
- CPU, duas threads intra-op e duas inter-op, uma instância de pipeline.
- do_sample false, max_new_tokens 4 em todos os papéis.
- Mesmo conjunto de casos, contexto e alternativa existente.
- Sem mudanças produtivas em src, scripts, test, docs, package.json, lockfile, AGENTS, RULES, skill, configurações, cache de pesos, memória real ou stage.
- Sem comandos Git, PowerShell, instalação, prepare, rebuild, purge ou escrita nos arquivos do experimento anterior.

## Papéis e controle predefinidos

### Papel de escrita

Mensagem de sistema:

> Decide only whether Proposed repairs an accidental spelling error in Original. Do not judge topical similarity. Keep Original if its wording is valid. Changes only to accents, grammar, inflection, identifiers, numbers, or negation are not spelling repairs. Reply FIX for a clear spelling repair, otherwise KEEP.

Saídas permitidas: FIX ou KEEP.

### Papel de intenção

Mensagem de sistema:

> Decide only whether Original and Proposed express the same intended request. A spelling mistake may be repaired without changing that request. Check the actual words and full context, not whether they are generally related. A change in topic, action, entity, negation, number, or identifier changes the request. Reply SAME if the request is preserved, otherwise CHANGED.

Saídas permitidas: SAME ou CHANGED.

### Controle combinado de uma etapa

Mensagem de sistema:

> Decide whether Proposed should replace Original. Accept only a clear accidental spelling repair that preserves the same intended request. Do not change valid words, grammar, inflection, accents alone, identifiers, numbers, or negation. Reply FIX to accept a repair, otherwise KEEP.

Saídas permitidas: FIX ou KEEP.

O controle combinado é indispensável: mudar de números para palavras pode melhorar o resultado sem que duas etapas sejam necessárias. Não atribuir esse ganho à decomposição.

Em todos os novos papéis, a mensagem do usuário é um objeto JSON contendo Original e Proposed, com os textos integrais. Na ordem normal, Original aparece primeiro. Na ordem invertida, Proposed aparece primeiro, mantendo nomes e conteúdos. Não incluir gold, exemplos resolvidos, idioma, proveniência do corpus ou decisões de outros papéis na entrada do modelo.

O baseline atual continua usando sua função produtiva, feedback e resposta numérica originais, sem mudanças.

## Decisão de duas etapas e ablações

Avaliar quatro abordagens sobre as mesmas alternativas:

1. Baseline numérico produtivo, executado novamente nesta rodada.
2. Controle combinado de uma etapa com palavras.
3. Papel de escrita sozinho.
4. Escrita seguida de intenção: aceitar a alternativa somente com FIX e SAME.

Não apresentar o papel de intenção isolado como detector de typos. Uma alteração gramatical pode preservar o assunto e ainda assim ser proibida para correção de escrita. O gold final não será usado como se fosse gold semântico específico desse papel.

Para diagnóstico, executar os dois papéis separadamente em todo caso com chamada. Essa execução antecipada da intenção, mesmo quando a escrita responde KEEP, serve para análise contrafactual. A decisão lógica de duas etapas e sua estimativa de custo condicional ignoram a segunda resposta quando a primeira é KEEP.

Gravar os vetos úteis do segundo papel, os vetos que removem correções legítimas e as aceitações indevidas que permanecem. Comparar a solução conjunta com a escrita sozinha e com o controle combinado, não apenas com o baseline mais fraco.

## Parsing, falhas e bypass

Aceitar somente uma das palavras fechadas após trim e normalização de caixa. Não aceitar sinônimos, explicações, pontuação adicional ou respostas aproximadas. Estas palavras são valores do protocolo, não vocabulários por idioma.

Uma saída inválida pode receber uma única repetição de formato no mesmo papel, com o mesmo sistema e a instrução adicional no usuário: Return exactly one of: seguida das palavras daquele papel. Não repedir decisões válidas nem alterar prompts após observar resultados.

Registrar ambas as respostas brutas, mensagens, duração e erro. Falha de provider ou segunda saída inválida não vira aprovação nem acerto por preservar a original. Uma etapa necessária inválida deve produzir resultado não escorado/falho na abordagem correspondente. Se a escrita responde KEEP validamente, uma intenção contrafactual inválida não invalida essa decisão lógica, porque a segunda chamada não existiria no fluxo condicional.

Os 13 casos literais ou sem duas alternativas devem manter zero chamadas e score null. Reutilizar o evaluator produtivo para comprovar aplicação, sugestão ou preservação finais, sem misturar esse score com o acerto isolado de uma palavra.

## Matriz e critérios antes da inferência

Executar os 62 casos completos na ordem normal. São 49 chamadas iniciais de cada um dos quatro papéis reais: baseline, combinado, escrita e intenção, total de 196 chamadas.

Executar também os três papéis com palavras em ordem de campos invertida nos mesmos 16 casos do piloto anterior, total de 48 chamadas iniciais. O máximo inicial esperado é 244; retries de formato devem ser contados separadamente. Reutilizar respostas válidas para recompor as ablações, sem repetir inferência idêntica.

Os 16 casos de estresse são P01-en-toogle, P03-en-recieve-context, P09-es-interpetacion, P11-es-reconstrucion-context, P17-pt-interpetacao, P19-pt-reconstrucao-context, P05-en-grammar, P07-en-invoice-involve, P13-es-negacion, P15-es-identifier, P21-pt-onde-node, P24-pt-accent-only, 1D, 2I, 7I e 10D.

Informar separadamente 12 positivos, 12 negativos e 25 decisões naturais, estas compostas por 23 históricos com chamada e C3/C5. Os casos sem chamada não contam como acertos.

Para classificar uma abordagem como promissora, exigir pelo menos 10/12 positivos, 9/12 negativos, 20/25 naturais, preservação de C3/C5, nenhum erro ou inválido nas etapas necessárias e a mesma escolha textual em pelo menos 14/16 casos de estresse. Qualquer perda frente ao baseline deve ser explicitada, mesmo dentro destes mínimos.

Para recomendar duas etapas em vez de uma, exigir ainda ganho sobre o controle combinado e sobre escrita sozinha na rejeição de alterações indevidas ou preservação de consultas reais, sem reduzir os positivos que esses controles acertam. Se uma etapa com palavras resolver tão bem quanto duas, não recomendar complexidade adicional.

Não ajustar prompts, rótulos, filtros, gold ou parâmetros depois dos resultados. Não acrescentar novo modelo ou terceira configuração de duas etapas. Resultado inconclusivo ou negativo encerra esta rodada de estudo.

## Execução, preservação e custo

Escrita experimental somente em C:/Users/junior/AppData/Local/Temp/marc-two-stage-study-57488bab-20261013/. Manter o diretório do estudo anterior e os arquivos do projeto somente leitura. Edições manuais via apply_patch.

O desenvolvedor compartilhado codex-dev, gpt-6-luna com reasoning xhigh, constrói e testa a extensão isolada. O principal planeja, verifica o bootstrap independente/contrato válido, autoriza, revisa o conjunto integrado e executa a matriz real. Um desenvolvedor por vez. Não administrar perfis nem despachar outros agentes.

Retornar OK_BOOTSTRAP com identidade, fontes aplicáveis, regras críticas, configuração confirmada, escopo e estado dos alvos. Reutilizar contrato ainda conhecido; após compaction, reler skill e fazer bootstrap. Não editar até autorização explícita. Não registrar ACK ou iterações em documentos.

A extensão deve reutilizar o carregador offline, reconciliador, evaluator e parser de output do estudo anterior quando apropriado, sem reimplementar a infraestrutura inteira. Fingerprint inclui protocolo novo, fontes congeladas, helpers importados, runtime, pesos, parâmetros e código da extensão.

Evitar o timeout de transporte já conhecido. Um launcher no próprio runner pode iniciar um único worker Node em background, sem janela, com PID, progresso, resultado, erro e métricas persistidos no diretório experimental. Não usar PowerShell, shell writes ou lançar uma duplicata enquanto o PID estiver ativo. Terminar a tarefa somente após o worker finalizar e o principal verificar sua saída.

Persistir cada caso completo e recursos, incluindo duração, CPU, RSS inicial/final e pico amostrado combinado com process.resourceUsage. Descarregar o pipeline em finally, registrar finalização e verificar término do PID. O launcher retorna rapidamente; monitoramento usa somente leitura.

Medir custo real do estudo e custo projetado do fluxo condicional separadamente. Não declarar dobro exato de RAM ou latência. Uma só instância não duplica os pesos, mas cada chamada adicional custa processamento e pode usar estado temporário.

## Testes e revisão

Testes determinísticos e branch-free para prompts exatos, full context, independência do segundo papel, parsing/retry, fallback não contado como acerto, bypass, lógica FIX e SAME, veto útil e prejudicial, recomposição sem chamadas duplicadas, aplicação/sugestão, grupos e denominadores, metadata/fingerprint, progresso/finalização e CPU/cache locais.

Manter até 300 linhas não brancas por arquivo e fluxo sem else ou if aninhado. Confirmar CLI real de validação sem carregar pipeline. O principal executa os testes independentemente e revisa todo o estado integrado, não só a última correção.

Classificação: estudo isolado e registros mARC, sem alteração de tooling produtivo nem declaração release-ready. Aplicar checks focados, integridade dos arquivos e metadata. Não executar pnpm validate em modo de escrita sem mudança produtiva. Testes focados não serão chamados de suíte completa.

Comparar SHA-256 do código, docs, harness, package/lockfile, modelos, geração real e índice do Git antes/depois. Não reverter mudanças externas; relatar divergências. A base deve continuar ready com 53 summaries se não houver mudança externa.

## Entrega

O desenvolvedor publica sua própria entrega consolidada do runner no MCP sob codex-dev, devolvendo messageId ao principal. O principal publica relatório final em pt-BR e evidência estruturada completa com revisão integrada, resultados e limites, sem execução diária registrada a cada passo.

Responder claramente se duas etapas ajudaram, se o ganho é explicado pelo controle de uma etapa, onde ocorrem os erros e qual é o custo observado. Não confundir qualidade da interpretação com relevância das threads. Manter a thread aberta para o usuário decidir a continuidade.
