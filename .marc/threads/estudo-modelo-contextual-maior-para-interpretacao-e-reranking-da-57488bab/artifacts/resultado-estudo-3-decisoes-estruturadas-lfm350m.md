# Resultado do estudo 3/4: decisões estruturadas do LFM

## Síntese e recomendação

**Não recomendo incorporar a decisão estruturada ou o limiar de confiança testados à busca produtiva.** Nenhuma política passou na calibração. A seleção foi congelada como null antes da validação, e não foi reaberta depois.

O LFM atual corrigiu os 12 pares de typos válidos, mas aceitou também as 35 propostas que deveriam ser rejeitadas. A alternativa simétrica preservou essas 35 consultas, porém reconheceu somente 1 dos 12 typos. Preservar tudo, sacrificando a correção que já funciona, não atende ao objetivo.

A rodada foi concluída e aprovada como estudo experimental. A promoção produtiva foi rejeitada. A busca, os modelos, os parâmetros, a memória e o stage foram preservados. A thread continua aberta e o estudo 4 não foi iniciado.

## O que foi estudado

Este estudo trata da escolha entre a consulta original e uma proposta de correção. Não mede relevância de threads ou taxa de acerto do motor completo. Não houve nova recuperação E5, consulta LanceDB, reranking mMARCO, indexação, rebuild, download, purge ou alteração de TTL.

O modelo foi o mesmo onnx-community/LFM2.5-350M-ONNX q4, com CPU e intra/inter-op 2/2. Uma única sessão foi reutilizada para geração e pontuação. Runtime Transformers.js 4.3.1, ONNX Runtime Node 1.30.0 e Node 22.20.0.

| Condição | Procedimento | O que isola |
| --- | --- | --- |
| G0 | Avaliador e geração produtivos, do_sample=false, max_new_tokens=4 | Comportamento atual |
| S0 | Logits de 0/1 no mesmo primeiro prompt produtivo, incluindo semanticAuditFeedback | Decisão condicionada aos índices permitidos |
| S1 | Pergunta simétrica nas ordens normal e invertida, remapeadas pelo conteúdo | Confiança, efeito de posição e concordância |

S1 calcula a média dos log-odds canonizados. Só aceita a proposta quando as duas ordens a favorecem e o limiar é atingido. Empate ou discordância conserva o original.

Temperaturas 0,5, 1, 2 e 4 foram avaliadas offline sobre os mesmos logits. Elas não ativam sampling, não alteram pesos e não mudam o argmax. A temperatura foi escolhida por NLL, com os desempates previstos. Os limiares foram 0,5, 0,65, 0,8, 0,9 e 0,95.

O controle fixo de S0/S1 usa T=1 e limiar 0,5. As curvas com T=4 são diagnósticos da configuração escolhida somente na calibração, não alternativas aprovadas.

## Fontes e governança

O plano foi registrado antes de implementar. Bootstrap, contrato completo, Custom Rules, AGENTS.md, marc-ops, README, Agent Workflows, Development e Memory foram lidos. A investigação usou context-mode, Context7 e sequential-thinking. A implementação instalada foi consultada porque a documentação encontrada não confirmava a exposição de logits pela geração.

A fonte produtiva injeta semanticAuditFeedback na primeira chamada. S0 capturou essa requisição através do avaliador, sem duplicar a função privada de feedback. O preflight inicial sem feedback não foi tratado como o prompt efetivo.

Plano registrado: plano-estudo-3-decisoes-estruturadas-lfm350m.md. SHA-256: 89d1774429e92e2442824b1228919259e2b5ea11620ec48378bcee41f936d91d.

O desenvolvedor compartilhado codex-dev, runtime Beauvoir, trabalhou sequencialmente com gpt-6-luna/xhigh confirmado pelo humano. Seu bootstrap independente foi verificado antes da autorização de edição. A entrega própria foi publicada na mensagem msg_60143368b53d401b91. O principal revisou e autorizou a captura separadamente.

A extensão final contém os dez arquivos previstos e dois módulos adicionais autorizados internamente para separar relatório e estado de execução. Essa organização não mudou o protocolo. Nenhum perfil, hook, configuração de cliente ou arquivo produtivo foi criado ou modificado.

## Dataset e limites de validade

Foram reconciliados os mesmos 62 casos e gabaritos históricos. Há 49 decisões e 13 bypasses, com partições fixas de 24/25/13.

| Partição | Typos positivos | Pares negativos | Grupo natural | Total de decisões |
| --- | --- | --- | --- | --- |
| Calibração | 6 | 6 | 12 | 24 |
| Validação | 6 | 6 | 13 | 25 |

O grupo natural de validação inclui C3/C5, cujos gabaritos exigem sugestão ou correção. Eles não devem ser preservados artificialmente como índice 0.

Os casos já eram conhecidos dos estudos anteriores. Esta validação é reservada para a seleção desta rodada, mas não é um holdout novo. Três pares atravessam as partições: P02/C5, P01/C3 e 2I/P23. Seus logits capturados foram idênticos. Há 46 pares distintos, e a validação sem essas repetições contém 22 casos.

Gates de calibração: pelo menos 5/6 typos corretos, 6/6 negativos preservados e 12/12 outcomes naturais corretos. Nenhuma das dez políticas passou. Não houve relaxamento, escolha posterior, mudança de gabarito ou nova geração de candidatos.

## Resultados dos controles fixos

As decisões de G0 e S0 fixo foram iguais em todos os 49 casos. As respostas reais de G0 também coincidiram com o snapshot anterior: índice 1 em todas as decisões, sem inválidos ou retries.

| Partição e grupo | G0 / S0 fixo | S1 fixo |
| --- | --- | --- |
| Calibração: typos | 6/6 | 1/6 |
| Calibração: negativos | 0/6 | 6/6 |
| Calibração: naturais | 0/12 | 12/12 |
| Validação: typos | 6/6 | 0/6 |
| Validação: negativos | 0/6 | 6/6 |
| Validação: naturais, incluindo C3/C5 | 2/13 | 11/13 |

A soma bruta de S1, 36/49 contra 14/49, não significa que a alternativa seja melhor para o produto. Ela troca quase todas as correções válidas por preservação. O requisito era melhorar a segurança sem perder a correção útil.

| Unidade avaliada | G0 / S0 fixo | S1 fixo |
| --- | --- | --- |
| 49 casos, com repetições | 14 corretos | 36 corretos |
| 46 pares distintos | 12 corretos | 35 corretos |
| 22 casos de validação sem repetições entre partições | 6 corretos | 16 corretos |

Na validação sem repetições, S1 preserva os 16 originais válidos, mas perde os seis typos. Esse é o mesmo problema, não uma melhoria escondida pela duplicação.

Nos 24 pares declarativos, S1 acertou 0/4 typos em inglês, 0/4 em espanhol e 1/4 em português. Preservou 4/4 pares negativos em cada idioma. Nenhuma regra por idioma foi adicionada.

Dos 35 outcomes indevidos de G0, 14 aplicaram uma correção automaticamente e 21 mantiveram a consulta efetiva original, mas sugeriram uma alternativa incorreta. Portanto, não é correto afirmar que todas as 35 buscas tiveram seu texto efetivo alterado. Também não é correto apresentar esses números como erro de ranking.

## Curvas de limiar com temperatura escolhida na calibração

T=4 foi a temperatura de menor NLL para S0 e S1. A escolha ocorreu antes da validação.

| Método e limiar | Calibração: typos / negativos / naturais | Validação: typos / negativos / naturais |
| --- | --- | --- |
| S0, 0,50 | 6/6 · 0/6 · 0/12 | 6/6 · 0/6 · 2/13 |
| S0, 0,65 | 6/6 · 1/6 · 0/12 | 6/6 · 0/6 · 2/13 |
| S0, 0,80 | 3/6 · 2/6 · 1/12 | 2/6 · 2/6 · 2/13 |
| S0, 0,90 | 0/6 · 6/6 · 11/12 | 0/6 · 6/6 · 11/13 |
| S0, 0,95 | 0/6 · 6/6 · 12/12 | 0/6 · 6/6 · 11/13 |
| S1, 0,50 | 1/6 · 6/6 · 12/12 | 0/6 · 6/6 · 11/13 |
| S1, 0,65 | 1/6 · 6/6 · 12/12 | 0/6 · 6/6 · 11/13 |
| S1, 0,80 | 0/6 · 6/6 · 12/12 | 0/6 · 6/6 · 11/13 |
| S1, 0,90 | 0/6 · 6/6 · 12/12 | 0/6 · 6/6 · 11/13 |
| S1, 0,95 | 0/6 · 6/6 · 12/12 | 0/6 · 6/6 · 11/13 |

Não foi selecionado o melhor resultado descritivo da validação. A seleção continua null.

## Confiança não substitui discriminação

| Partição e método | NLL em T=1 | NLL em T=4 | Brier em T=1 | Brier em T=4 |
| --- | --- | --- | --- | --- |
| Calibração, S0 | 4,852492 | 1,414716 | 0,734951 | 0,524062 |
| Validação, S0 | 4,080594 | 1,240686 | 0,673106 | 0,468225 |
| Calibração, S1 | 2,313724 | 0,929958 | 0,439706 | 0,332628 |
| Validação, S1 | 3,003133 | 1,091204 | 0,547636 | 0,387167 |

T=4 reduz a confiança excessiva, mas não reordena as escolhas. Não corrige a incapacidade de separar proposta válida de proposta indevida.

Na calibração de S0, o quinto maior log-odds entre os seis typos válidos foi 4,878239, enquanto uma proposta proibida atingiu 10,548344. Um corte que rejeite todas as proibidas não consegue preservar cinco dos seis typos. Isso é um diagnóstico da separação observada, não uma busca de limiar fora da grade registrada.

A ECE em T=4 foi 0,568253/0,482401 em S0 e 0,269136/0,376246 em S1, respectivamente calibração/validação. Na faixa de confiança agregada [0,8; 1], S0 teve 3/18 acertos na calibração e 2/15 na validação. S1 teve 3/7 e 3/8. Os bins inferiores a 0,4 ficaram vazios. Os cinco bins e seus tamanhos estão no relatório local.

A ECE mede o argmax da distribuição, não a política seletiva de S1 depois da abstenção. Não atribuir a confiança média do argmax à decisão conservadora de retornar o original.

## Efeito da ordem e exemplos selecionados

Inverter as opções mudou a escolha de conteúdo em 32/49 decisões. Houve 17/49 escolhas estáveis, das quais só uma favoreceu a proposta nas duas ordens: P20-pt-permissao-context. agreementCount conta essa concordância pró-proposta, não estabilidade geral.

| Caso | Gold | Probabilidade de proposta em S0, T=1 | S0, T=4 | Proposta em S1 normal / invertido |
| --- | --- | --- | --- | --- |
| invoice → involve | preservar | 0,877138 | 0,620436 | 0,000070 / 0,000000334 |
| onde → node em pergunta contextual | preservar | 0,999499 | 0,869870 | 0,999999878 / 0,0000267 |
| editando → evitando em pergunta contextual | preservar | 0,999717 | 0,885185 | 0,881686 / 0,050155 |
| recieve → receive no contexto de manifesto | corrigir | 0,998578 | 0,837338 | 0,109699 / 0,0000358 |
| brutalismp → brutalism | corrigir | 0,992447 | 0,771986 | 0,000431 / 0,0000243 |
| toogle → toggle | sugerir, mantendo original efetivo | 0,979240 | 0,723810 | 0,003081 / 0,0000000587 |
| permisão → permissão em pergunta de reconstrução | corrigir | 0,998587 | 0,837557 | 0,998457 / 0,759887 |

Os números de S1 nas duas últimas colunas são probabilidades da proposta remapeada pelo conteúdo, em T=1. Não são probabilidades da relevância de uma thread.

O formato não foi o principal obstáculo. O argmax do vocabulário completo ficou em 0/1 nas 147 pontuações. A menor massa total desses dois índices foi 0,998335. O modelo responde no formato permitido, mas essa conformidade não garante a decisão correta.

A conclusão não está concentrada em brutalism. O mesmo comprometimento aparece em typos, negação, números, identificadores, inflexões e perguntas naturais de mais de um idioma.

## Execução, recursos e encerramento real

Uma única captura foi lançada. PID 35688, início do launcher 2026-10-14T06:58:54.821Z. A sessão do executor foi de 06:58:56.808Z a 07:05:07.879Z, em 371,062 segundos, aproximadamente 6 min 11 s.

- 49 invocações de geração e 147 invocações de pontuação com forward direto.
- Zero retries, erros, falhas, respostas inválidas ou chamadas de modelo nos 13 bypasses.
- Geração somada: 91,952 s. Pontuação somada: 263,938 s. Esses tempos incluem o trabalho da chamada, não apenas kernels ONNX.
- Carga do modelo: 605,843 ms. Dispose da sessão: 81,067 ms.
- Pico de RSS amostrado: 853.929.984 bytes, aproximadamente 814 MiB.
- RSS após dispose: 180.543.488 bytes, aproximadamente 172 MiB.
- 199 amostras. Intervalo nominal de 1 s, com maior intervalo observado de 3,399 s.

Não se mediu o número de forwards internos de model.generate. Não somar os dois contadores como se fossem 196 execuções internas ONNX.

A medição de RSS é do processo Node que hospedou o modelo, não da soma de todos os aplicativos ou processos do PC. Ela não garante funcionamento confortável em qualquer máquina com 8 GB. O tempo da bateria também não é latência de uma busca normal. O forward de pontuação retorna logits da sequência completa neste bundle, enquanto G0 usa a geração produtiva.

Os outputs reais tinham forma [1, sequência, 65536], com sequência entre 105 e 263 tokens. A fatia final foi [1,1,65536]. O preflight comprovou 147 prompts, 294 verificações de rótulo com prefixo preservado e máximo de 264 tokens com o rótulo, abaixo do limite 128000 declarado no config local. O valor sentinela do tokenizer não foi usado como limite.

O checkpoint foi marcado complete em 07:05:07.929Z depois do dispose. O principal confirmou a terminação real com exit code 0 por handle somente leitura do próprio PID em 07:05:08.043Z. O lock foi removido. Um arquivo complete sozinho não foi tratado como prova de encerramento.

## Evidências preservadas

Root local: C:/Users/junior/AppData/Local/Temp/marc-decision-study-57488bab-20261014/.

| Evidência | Tamanho | SHA-256 |
| --- | --- | --- |
| decision-study-report.json | 1.046.601 bytes | cf65e5eb312b0ef0f5d2cd7a99a5b54504fea69d0bab56fff88b5fee8c90b6a0 |
| decision-checkpoint.json | 583.007 bytes | b27b1e497ea94480536a9e3ca6832f59b138a701016f2ac3959b681cdca0c1dd |

Fingerprint do executor e preflight: 0a5f033613600bcbe2300b594faff0025a91b0ae374f6e643fc372077ce87a5d.

O relatório bruto e o checkpoint permanecem locais. Não foi anexado pacote integral de consultas, corpus ou código. O registro publicado é este relatório consolidado com evidência selecionada.

## Revisão integrada final do principal

**Escopo revisto:** os 12 módulos/testes autorizados, fontes produtivas de interpretação, APIs instaladas, gabaritos, partições, preflight, entrega do desenvolvedor, captura, replay, contagens, recursos e preservação. A revisão avaliou todo o executor e seu resultado, não apenas o último ajuste.

| Critério | Implementação e evidência verificada |
| --- | --- |
| Comparação com o produto | G0 usa o avaliador original e S0 recebe a primeira requisição com feedback real. As 49 respostas, escolhas e outcomes de G0 coincidem com o snapshot. |
| Probabilidades corretas | Último timestep real, rótulos 525/526, remapeamento normal/invertido, cálculo estável, massa permitida e argmax completo separados. Teste com Tensor real sem sessão ONNX. |
| Separação calibração/validação | 24 casos completos antes do freeze. Assinatura e temperatura recalculadas somente da calibração no resume. Seleção null preservada antes da validação. |
| Segurança e lifecycle | Lock exclusivo, paths confinados ao root, checkpoints imutáveis após conclusão, persistência de invocações e scores parciais, cleanup de tensores e sessão. Exit code real 0 e lock ausente. |
| Qualidade de implementação | Todos os módulos têm até 261 linhas não brancas. Parse/AST sem else ou if aninhado. Testes determinísticos sem branches de seleção ou skips. |
| Testes e contratos | Principal repetiu 28/28 testes novos. Os 15/15 contratos produtivos focados também passaram. Preflight independente sem pipeline, 147 prompts e 294 provas de sufixo. |
| Replay independente | 1.336 asserções sobre decisões, outcomes, NLL/Brier, snapshot, duplicatas e contagens, sem divergência. Dez checagens adicionais de ECE, seleção de temperatura e totais também coincidiram. |
| Preservação | Em 07:17:09.046Z, os 15 grupos de produto/config/modelos/stage e cinco roots antigos eram idênticos aos hashes anteriores. Nenhum comando Git foi executado. |
| Documentação | docs/memory.md, Development e Agent Workflows continuam descrevendo o produto intocado. Não precisam incorporar uma hipótese rejeitada como funcionalidade. |

Os ajustes encontrados na revisão foram devolvidos ao mesmo desenvolvedor e integrados antes da captura. Eles incluíram a forma real de Tensor.slice, empate conservador, descarte das saídas flat do forward, limite de contexto, contador de concordância, controles T=1, invocações reais, recursos e validade do checkpoint de seleção. Foram consolidados aqui, sem diário de cada iteração.

Um probe independente somente em memória confirmou também o caminho elegível: com scores sintéticos perfeitos, o executor seleciona uma política e confirma 24/24 e 25/25. Isso é teste do mecanismo de avaliação, não resultado do modelo. A captura real não passou nos gates.

**Veredito técnico:** aprovado como estudo offline concluído e registro de resultado negativo útil. Rejeitada a promoção de S0/S1 ou de seus limiares para produção.

**Limitações:** dataset pequeno e já conhecido, três pares repetidos entre partições, uma captura determinística, medição de RSS amostrada no processo, e ausência de testes de latência/UI ou release do produto. As verificações foram focadas conforme o escopo experimental registrado. pnpm validate, pnpm build e pnpm test completos não foram executados nem declarados aprovados. Não há declaração release-ready.

## Matriz por caso

Gold 0 significa preservar a consulta e não sugerir a proposta. Gold 1 significa selecionar a correção, aplicando ou sugerindo segundo a proveniência existente. Os 13 bypasses não têm uma decisão de modelo e estão fora desta tabela.

| Caso | Partição | Gold | G0 / S0 fixo | S1 fixo |
| --- | --- | --- | --- | --- |
| P03-en-recieve-context | calibração | 1 | correto | erro |
| P12-es-aplicacon | calibração | 1 | correto | erro |
| P02-en-brutalismp | calibração | 1 | correto | erro |
| P20-pt-permissao-context | calibração | 1 | correto | correto |
| P04-en-seperate-context | calibração | 1 | correto | erro |
| P01-en-toogle | calibração | 1 | correto | erro |
| P13-es-negacion | calibração | 0 | erro | correto |
| P22-pt-editando-evitando | calibração | 0 | erro | correto |
| P21-pt-onde-node | calibração | 0 | erro | correto |
| P08-en-number | calibração | 0 | erro | correto |
| P07-en-invoice-involve | calibração | 0 | erro | correto |
| P14-es-number | calibração | 0 | erro | correto |
| 5I | calibração | 0 | erro | correto |
| 7I | calibração | 0 | erro | correto |
| 10P | calibração | 0 | erro | correto |
| 2P | calibração | 0 | erro | correto |
| 5P | calibração | 0 | erro | correto |
| 1P | calibração | 0 | erro | correto |
| 3I | calibração | 0 | erro | correto |
| 1D | calibração | 0 | erro | correto |
| 10D | calibração | 0 | erro | correto |
| 9P | calibração | 0 | erro | correto |
| 2I | calibração | 0 | erro | correto |
| 7P | calibração | 0 | erro | correto |
| P19-pt-reconstrucao-context | validação | 1 | correto | erro |
| P17-pt-interpetacao | validação | 1 | correto | erro |
| P11-es-reconstrucion-context | validação | 1 | correto | erro |
| P18-pt-configuracao-context | validação | 1 | correto | erro |
| P09-es-interpetacion | validação | 1 | correto | erro |
| P10-es-configuracion-context | validação | 1 | correto | erro |
| P16-es-technical-neighbor | validação | 0 | erro | correto |
| P05-en-grammar | validação | 0 | erro | correto |
| P24-pt-accent-only | validação | 0 | erro | correto |
| P06-en-negated-command | validação | 0 | erro | correto |
| P15-es-identifier | validação | 0 | erro | correto |
| P23-pt-inalterados-inalterado | validação | 0 | erro | correto |
| 8I | validação | 0 | erro | correto |
| 6P | validação | 0 | erro | correto |
| 6D | validação | 0 | erro | correto |
| 3P | validação | 0 | erro | correto |
| 8P | validação | 0 | erro | correto |
| 1I | validação | 0 | erro | correto |
| 4I | validação | 0 | erro | correto |
| 9I | validação | 0 | erro | correto |
| 4P | validação | 0 | erro | correto |
| 4D | validação | 0 | erro | correto |
| 10I | validação | 0 | erro | correto |
| C3 | validação | 1 | correto | erro |
| C5 | validação | 1 | correto | erro |

## Próximo passo

Manter o motor produtivo atual. A camada de interpretação não ganhou uma substituição aprovada nesta rodada. O resultado mostra que pontuar diretamente e achatar confiança, isoladamente, não resolve a distinção semântica observada no LFM350M.

Aguardar o feedback do humano antes do estudo 4/4 sobre rerankers especializados. Não implementar outra calibração, novo modelo ou mudança de arquitetura automaticamente.
