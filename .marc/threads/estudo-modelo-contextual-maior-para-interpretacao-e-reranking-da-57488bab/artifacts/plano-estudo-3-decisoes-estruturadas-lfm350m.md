# Plano do estudo 3/4 — decisões estruturadas e calibração do LFM

## Síntese

Investigar se o mesmo LFM2.5-350M q4 distingue correções válidas de alterações indevidas melhor quando suas escolhas são pontuadas diretamente, em vez de depender apenas do índice produzido por geração livre. Executar somente este estudo, registrar os resultados e aguardar o humano antes do estudo 4.

A autorização é experimental. Não implementar mudanças na busca produtiva, novos modelos ou dependências. A pergunta é sobre interpretação de consultas, não sobre substituir o E5 ou julgar relevância de threads.

## Contexto e fontes

Os experimentos anteriores de apresentação, duas etapas e sampling não produziram uma alternativa promovível. Os estudos 1 e 2 mantiveram consultas efetivas congeladas e, portanto, não avaliaram nova interpretação. A expansão simples de CHAT não foi promovida.

Fontes obrigatórias: AGENTS.md, skill marc-ops, bootstrap completo e Custom Rules, README, docs/agent-workflows.md, docs/development.md, docs/memory.md, query-interpretation.ts, query-interpretation-inference.ts, model-config.ts, casos e support do benchmark de interpretação, artifacts anteriores desta thread e fontes locais do Transformers.js 4.3.1. Context-mode é obrigatório. Context7 foi consultado e complementado com a implementação instalada porque a documentação consultada não confirmou a exposição de logits por generate.

O modelo instalado é onnx-community/LFM2.5-350M-ONNX, q4. CPU, uma sessão, intra/inter-op 2/2, arquivos locais, sem downloads. O cache real é .marc/cache/memory-models/onnx-community--LFM2.5-350M-ONNX/onnx-community/LFM2.5-350M-ONNX. Transformers.js 4.3.1 e ONNX Runtime Node 1.30.0 devem permanecer exatos.

A verificação somente com tokenizer confirmou, nos 49 prompts produtivos, prefixo preservado, máximo de 195 tokens e índices 0/1 como tokens únicos 525/526. Repetir esse controle no preflight para todos os prompts do novo executor. Nenhuma inferência experimental foi iniciada.

## Escopo e preservação

O único root de código e saídas autorizadas será C:/Users/junior/AppData/Local/Temp/marc-decision-study-57488bab-20261014/. Ele estava ausente no planejamento. Não escrever em src, scripts, test, docs, skills, configurações, dependências, memória, cache ou Git.

Ler fontes e resultados antigos, sem executar seus launchers, writers, lifecycle ou testes. Reutilizar somente helpers de leitura e avaliação comprovadamente sem efeitos de escrita. Preservar integralmente todos os diretórios de estudos anteriores, inclusive capturas, relatórios e checkpoints. Não retomar a rodada de sampling.

Registrar plano, entrega consolidada e resultado pelas ferramentas oficiais do mARC, com o ID canônico completo da thread. Não publicar diário de bootstrap, comandos ou revisão. Não exportar corpus, código integral ou arquivos brutos de evidência para artifacts da thread. Apenas relatório legível e evidência selecionada.

Congelar hashes das fontes, assets do modelo, contrato, settings, manifesto atual, stage e raízes antigas antes e depois. A geração produtiva esperada é 20261013051147276_6cfe9a14, manifesto 1a99b242539990b87afa7b016568c2eba9d0d248d5020bbcccaf708644f3dfcf. O dataset de interpretação é o snapshot histórico, não uma afirmação de que a geração antiga ainda é a memória ativa.

Sem dicionários, stopwords, listas por idioma, regras por termo, normalizações novas ou geração de alternativas adicionais. Os exemplos de typo do dataset são fixtures de avaliação, não regras produtivas.

## Corpus e partição congelados

Reconciliar os mesmos 62 casos do snapshot evidencias-interpretadores-onnx-runtime-v3.json e scripts/memory-interpreter-benchmark-cases.ts, usando os digests do runner offline anterior. Não executar main de scripts.

Há 49 decisões com exatamente duas variantes e 13 bypasses. Preservar query, variants, expectedIndex, expectedCorrectionApplied, expectedEffectiveQuery, expectedSuggestedQuery, suggestionOnlyIndexes e naturalCohort. A decisão de sugerir versus aplicar segue o avaliador produtivo, não um novo contrato.

Reutilizar exatamente CALIBRATION_IDS, VALIDATION_IDS e BYPASS_IDS do study-protocol.mjs da rodada de decoding, exclusivamente como fonte de dados e função pura de partição: 24 calibração, 25 validação e 13 bypasses. Calibração contém 6 typos positivos, 6 pares negativos e 12 consultas naturais. Validação contém 6/6/13.

Este conjunto já apareceu nas pesquisas anteriores. Validação é reservada para a seleção desta rodada, não um holdout novo nunca visto. Detectar e reportar consultas/pares idênticos dentro e entre partições, métricas por caso e por pares distintos. A conferência independente encontrou 46 pares distintos entre 49 decisões e três pares repetidos entre calibração e validação: P02/C5, P01/C3 e 2I/P23. Reportar também o subconjunto de validação sem esses três pares contaminados, sem usá-lo para mudar a seleção. Duplicatas não podem ser contadas como evidência independente de generalização. Não trocar partição ou rótulos depois de ver resultados.

## Condições predefinidas

### G0 — baseline produtivo

Usar queryInterpretationMessages e o avaliador produtivo exatos, pipeline com do_sample=false e max_new_tokens=4. Registrar resposta real, decisão, correção, sugestão, retries, inválidos e erro. Comparar com o snapshot antigo e publicar divergências, sem tratar snapshot como execução atual.

### S0 — decisão pontuada no prompt produtivo

Usar a mesma primeira requisição do avaliador produtivo, incluindo o semanticAuditFeedback que interpretMemoryQuery injeta. Capturar essa requisição por provider de gravação sem inferência no preflight, sem duplicar ou hardcodear a função privada de feedback. Aplicar o chat template exato, sem tokens especiais duplicados, e executar model.forward sobre a entrada tokenizada. O controle inicial de 195 tokens não incluía feedback e não deve ser apresentado como limite final dos prompts efetivos. Capturar o último vetor de logits e extrair os logits dos tokens 0 e 1.

O argmax condicionado aos índices válidos é uma decisão estruturada. Registrar também argmax do vocabulário completo, probabilidade total de emissão de 0 ou 1 no vocabulário completo e dimensões dos logits. Não esconder que a geração livre poderia emitir outra coisa.

### S1 — decisão pontuada simétrica com controle de ordem

Usar a seguinte instrução en-US, congelada:

Choose the query text that should be used or suggested. Preserve the original unless another option fixes a clear accidental character-level typo. Do not accept synonyms, inflections, accent-only changes, grammar changes, number or identifier changes, or changes in meaning. If uncertain, choose the option equal to the original. Return only its integer index.

Mensagem user congelada:

Original query: <JSON da consulta>
Options:
0: <JSON da opção 0>
1: <JSON da opção 1>

Executar ordem normal e invertida, preservando o texto Original query e remapeando a escolha ao conteúdo original. Nenhum gabarito, justificativa da fixture, nome de grupo ou resultado de busca aparece no prompt.

Definir d_normal como logit da proposta menos logit do original na ordem normal; d_invertido com o mesmo significado na ordem invertida. O score agregado é a média dos dois log-odds. Registrar cada ordem e a discordância. Uma correção só pode ser aceita pela política seletiva quando as duas ordens favorecem a proposta e a probabilidade agregada atinge o limiar escolhido. Empate ou discordância preserva o original.

S0 e S1 sem limiar, em T=1 e corte 0,5, são controles descritivos fixos. Não confundir melhoria de score com melhoria da escolha.

## Probabilidades e calibração offline

Para S0, d=logit_proposta-logit_original. Para S1, d é a média dos dois d remapeados. p(proposta)=sigmoid(d/T), com cálculo numericamente estável.

Essa é uma probabilidade condicionada às duas opções, não uma garantia de correção nem probabilidade de relevância de uma thread. A massa permitida no vocabulário completo é diagnóstico separado. Não usar confiança autorrelatada.

Temperaturas fixas: 0,5, 1, 2 e 4. Não são temperaturas de geração ou sampling. Temperature scaling será calculado offline sobre os mesmos logits e não muda o argmax. Escolher separadamente para S0/S1 a temperatura de menor NLL nos 24 casos de calibração. Desempatar por menor Brier, proximidade de T=1 e menor T. Definir gold binário pelo expectedIndex, não por presence de correctionApplied.

Limiares fixos: 0,5, 0,65, 0,8, 0,9 e 0,95. Aceitar proposta quando p>=limiar; caso contrário preservar original. Para S1 aplicar também concordância das duas ordens. Nunca transformar incerteza em uma terceira consulta inventada.

Gates de calibração: pelo menos 5/6 decisões positivas corretas, 6/6 negativas preservadas e 12/12 outcomes corretos no grupo natural. Outcome completo, inclusive sugestão, deve respeitar os gabaritos. Selecionar somente entre políticas que passam todos os gates. Desempatar por total de outcomes corretos, menor NLL, menor Brier, S0 antes de S1 e menor limiar. Registrar o resultado e congelar a seleção antes de analisar validação.

Se nenhuma passar, seleção=null. Ainda avaliar descritivamente S0/S1 fixos e temperaturas escolhidas na calibração na validação, sem procurar nova configuração vencedora. Não reabrir seleção, relaxar gates ou fabricar melhora.

Na validação, uma hipótese candidata exige pelo menos 5/6 positivas, 6/6 negativas e 13/13 outcomes corretos no grupo natural, com melhora em preservação das consultas cujo gold é 0 sobre G0 e sem queda nas correções válidas em relação a G0. O grupo natural de validação inclui os controles C3/C5, cujo gold é 1 e exige sugestão/correção correta, não preservação forçada do índice 0. Mesmo que passe, não há promoção automática ou modificação produtiva neste estudo.

## Métricas e análise

Reportar totais e matrizes de confusão por grupo e partição, modelo escolheu versus aplicação/sugestão, mudanças indevidas e correções perdidas. Publicar ganhos, regressões e empates por caso e por pares distintos.

Reportar NLL, Brier e ECE com cinco bins fixos [0,0,2), [0,2,0,4), [0,4,0,6), [0,6,0,8), [0,8,1], em que confiança é max(p,1-p) e acerto é argmax versus expectedIndex. Indicar bins vazios e tamanho do conjunto, sem alegar calibração global.

Diagnosticar posição das opções, correções erradas de alta confiança e comparações com typos corretos. Não selecionar análise apenas de brutalism. Incluir idiomas/famílias já declarados como resultados estratificados, nunca como regras do algoritmo.

Métricas desta rodada não medem taxa de acerto do motor completo. Não executar E5, LanceDB, mMARCO, rebuild ou novas buscas produtivas para esta ablação.

## Execução e recursos

Criar preflight que valida fontes, hashes, corpus, partição, duplicatas, modelos locais, API instalada e tokenização sem carregar ONNX. Não truncar prompts. Modelo indisponível, prefixo incompatível, rótulo multi-token, versão alterada ou índice/gold inválido são bloqueios explícitos.

Um único processo, uma sessão de modelo, execução sequencial. São 49 chamadas iniciais de G0 e 147 forwards de pontuação. G0 pode fazer no máximo uma tentativa adicional prevista pelo avaliador por saída inválida, até 98 chamadas de geração. Forwards falhos não recebem retry silencioso. Contar chamadas efetivas e tokens gerados separadamente, não afirmar que generate equivale a um único forward ONNX.

Persistir por caso completo e fase, com fingerprint de plano, fontes, código, dataset, configuração e pesos. Retomada apenas com fingerprint exato, prefixo de casos válido e sem lock ativo. Nunca sobrescrever evidência de captura completa ou lançar executor duplicado. O processo grava PID/estado e relatório de cleanup.

A seleção usa somente records da calibração. Persistir decisão congelada antes de avaliar validação. Não executar carga dupla de modelo para score e greedy: reutilizar pipeline.model e pipeline.tokenizer ou uma única instância equivalente.

Liberar tensores de forward e caches, inclusive em erro, e descartar sessão em finally. Revisar a API real antes de assumir que dispose existe em todos os outputs. Confirmar encerramento real, lock removido e exit code, não só arquivo complete. RSS e tempos são do processo amostrado; declarar esse limite e não extrapolar garantia de PC de 8 GB.

## Desenvolvimento delegado e revisão

Principal: codex-software-architect, configuração principal já confirmada para análise e revisão. Desenvolvedor compartilhado codex-dev, runtime Beauvoir, gpt-6-luna/xhigh confirmado pelo humano. Um desenvolvedor ativo, sequencial. Não criar perfis ou delegar novamente.

Antes de editar, o dev faz bootstrap independente, lê fontes e plano, retorna OK_BOOTSTRAP com identidade, regras críticas, configuração/confirmador, paths e estado dos alvos. Principal verifica e autoriza internamente. Sem inferência real durante implementação.

Unidade atômica: executor offline completo e testável. Arquivos previstos dentro do novo root: decision-protocol.mjs, decision-inputs.mjs, decision-runtime.mjs, decision-scores.mjs, decision-evaluation.mjs, decision-checkpoint.mjs, decision-executor.mjs, decision-cli.mjs, decision.test.mjs e decision-lifecycle.test.mjs. Separações adicionais exigem autorização interna de escopo antes da edição. Módulos até 300 linhas não brancas.

Implementar testes determinísticos antes da lógica: logits conhecidos/extremos e não finitos, remapeamento normal/invertido, prefixo e tokens de rótulo inválidos, empate, discordância, threshold, sugestão-only, bypass sem inferência, seleção sem acesso à validação, gates elegível/inelegível, bins vazios, fingerprints/resume, concorrência/locks e cleanup em falha. Usar seam tipada para filesystem/erro dependente de ambiente e integração real em diretório de fixture isolado. Não usar links privilegiados ou skips.

Testes não podem ter branches de seleção de cenário. Código não pode ter else ou if aninhado. Usar guardas simples e dispatch tables apropriadas. Manual edits exclusivamente apply_patch. Não executar testes antigos que escrevem em capturas anteriores.

O dev entrega relatório interno com paths/linhas/checks/resultados/limites e sua própria mensagem consolidada oficial na thread. Entrega de implementação não autoriza captura. Principal revisa todo o estado integrado, executa testes novos e preflight independentemente e autoriza internamente a rodada real somente após aprovação técnica do executor.

Após a captura, validar replay independente das distribuições, seleção, métricas, gold e contagens. Verificar antes/depois e integridade das raízes anteriores. Consolidar resultado e revisão final em artifact, com escopo/fontes, critérios ligados à evidência, achados, limitações e veredito explícito. Auditoria estrutural não substitui essa revisão.

## Validação e classificação

Entrega experimental temporária e registros mARC, não release-ready ou alteração do produto. Aplicar testes focados do executor, controles produtivos de interpretação sem inferência, análise AST/sintaxe, preflight local e replay independente, com hashes de preservação.

Não executar pnpm validate em write-mode nem declarar suite/build produtivos aprovados sem tê-los executado. A exceção de escopo experimental das rodadas anteriores continua restrita aos roots temporários e à ausência de alteração produtiva. Se o desenvolvimento exigir mudanças de código/dependência produtivos, parar e pedir nova autorização.

Revisar docs/memory.md e workflow para confirmar que continuam descrevendo o produto intocado. Não alterar documentação produtiva para apresentar hipótese como funcionalidade.

Executar preflight estrutural depois de plano/artifact/metadados registrados e scope messages após a entrega/resultado estarem anexados. Não repetir audits como ritual.

## Pendências e conclusão

Não há decisão produtiva a tomar antes do experimento. Bloqueios técnicos devem ser reportados, não contornados por nova dependência/modelo. Resultados insuficientes serão registrados como resultado válido de pesquisa, sem calibração ilimitada.

Encerrar a rodada com recomendação direta, resultados verificáveis e limites. Manter a thread aberta e aguardar feedback do humano. Não iniciar estudo 4.
