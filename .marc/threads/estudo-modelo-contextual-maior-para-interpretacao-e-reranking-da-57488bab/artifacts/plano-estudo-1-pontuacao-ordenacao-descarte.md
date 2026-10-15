# Plano do estudo 1/4 — pontuação, ordenação e descarte da busca

## Síntese e autorização

Executar somente o primeiro dos quatro estudos, de forma sequencial, e registrar os resultados nesta thread. O humano autorizou o estudo, não uma alteração produtiva. Após a conclusão e a apresentação no chat, aguardar seu feedback antes de qualquer próximo estudo ou desenvolvimento.

A pergunta é se a busca perde threads relevantes na conversão de evidências em elegibilidade e ordenação, mantendo os mesmos candidatos, consultas efetivas, modelos, conteúdo indexado e profundidade.

## Hipóteses e limites do diagnóstico

O estudo anterior observou três falhas históricas com mecanismos distintos: 3P tinha elegibilidade própria baixa; 6I tinha elegibilidade própria aproximada de 0,427 e valor limitado pela ordem de aproximadamente 0,062; 9I tinha elegibilidade própria alta, mas posição 15 antes do limite final.

A leitura atual do código exige uma ressalva: hybrid-ranking separa elegíveis pela semanticEligibility própria antes do reforço lexical. Entre notas próprias maiores ou iguais a 0,5, um teto formado por essas mesmas notas não pode baixar a nota abaixo de 0,5. Logo, não se deve presumir que a remoção do teto final, sozinha, recuperará o caso 6I. Essa condição será um controle causal, não uma solução previamente escolhida.

A transformação logística existente tem coeficientes fixos e um componente de margem aplicado ao primeiro candidato. O estudo não tratará esse resultado como probabilidade de relevância já calibrada.

## Escopo e exclusões

- Leitura do índice atual, captura das evidências uma vez e comparações locais offline.
- Nenhuma edição de src, scripts, test, docs, dependências, configurações, skills ou stage.
- Nenhuma mudança de modelo, download, prepare, rebuild, purge, TTL ou índice produtivo.
- Nenhuma nova interpretação de consultas: esta rodada isola pontuação e ordenação, não o estudo 3.
- Nenhuma indexação de conversas completas, profundidade adaptativa ou comparação de rerankers. Esses são os estudos 2, 3 e 4, que não serão iniciados.
- Não baixar limiares, treinar coeficientes, escolher uma configuração depois de ver os resultados ou criar regras por termo/idioma.
- Não exportar pacote integral de consultas, corpus ou código-fonte. A restrição de anexação da rodada anterior continua vigente. Evidência detalhada permanece local; o registro publicado será o relatório consolidado.
- Somente o diretório temporário `C:/Users/junior/AppData/Local/Temp/marc-ranking-study-57488bab-20261013/` poderá receber código e saídas do executor.
- Registros de plano, entrega e resultado serão feitos pelas ferramentas oficiais do mARC, sem diário de iterações.

## Fontes e corpus congelado

Fontes principais: AGENTS.md, marc-ops, RULES.md/Custom Rules, Agent Workflows, docs/memory.md, hybrid-ranking.ts, semantic-ranking.ts, semantic-eligibility.ts, lancedb-store.ts, tipos e providers de memória, scripts/memory-quality-v4.ts e os artifacts de diagnóstico da thread.

Geração atual autorizada: `20261013051147276_6cfe9a14`. SHA-256 do manifesto: `1a99b242539990b87afa7b016568c2eba9d0d248d5020bbcccaf708644f3dfcf`. O manifesto contém 53 summaries. Conferir a identidade e os hashes antes da captura e no encerramento. Não substituir silenciosamente a geração por outra.

Manter E5 small int8 e mMARCO O4 atuais. O LFM não será carregado nesta rodada. Usar as APIs de leitura existentes, getWorkspaceInfo em vez de initWorkspace e consultas sobre tabelas/índices existentes. Não executar o main do benchmark, que inicializa o workspace.

## Consultas e julgamentos

### Bateria histórica

Reutilizar as 30 consultas da tabela “Matriz das 30 consultas” do artifact avaliacao-baseline-e-diagnostico-memory.md. Preservar IDs, texto e sufixos dos alvos. Ler a tabela com parser estruturado de Markdown já disponível nas dependências, não por recortes arbitrários de linhas.

Para cada ID, fixar a consulta efetiva de results.baseline.effectiveQuery do snapshot evidencias-interpretadores-onnx-runtime-v3.json. Verificar igualdade da consulta original e compatibilidade dos 30 IDs. Esses textos são controles históricos fixos, não uma afirmação sobre o que o interpretador responderia novamente hoje. A comparação é pareada entre formas de pontuar, não entre interpretadores ou versões.

Resolver cada sufixo para exatamente uma thread do manifesto. Ausência ou ambiguidade é bloqueio, não descarte silencioso de cenário.

### Controles de relevância existentes

Reutilizar os 14 casos estáticos de qualityCases em scripts/memory-quality-v4.ts. Ler a declaração com AST de TypeScript e interpretação restrita das constantes/objetos e chamadas styleCase existentes. Não importar ou executar o main do script, nem extrair código com regex.

Fixar expectedEffectiveQuery quando definido, senão query. Preservar julgamentos e alvos existentes. Esses casos incluem temas variados, cinco casos da família de estilo, duas consultas de toggle, consultas de segurança/settings e duas consultas de abstinência. Não criar uma seleção centrada apenas em brutalism.

Total: 44 casos lógicos. Consultas efetivas idênticas serão capturadas uma vez e reutilizadas, preservando IDs e gabaritos distintos para a avaliação. Registrar quantidade real de consultas distintas e custo de cada captura.

### O que não será inferido dos rótulos

Na bateria histórica, o alvo conhecido é positivo, mas todas as outras threads são não julgadas, não automaticamente irrelevantes. Nos controles, preservar graus declarados; graus 0/1 conhecidos serão reportados separadamente dos resultados sem julgamento. A ausência em um mapa de julgamentos não será convertida em falso positivo.

As duas consultas explicitamente definidas para abstinência serão avaliadas pela presença ou ausência de resultados. Reportar também resultados novos legítimos quando reconhecidos, mas não alterar o gabarito no meio da comparação. A avaliação não produzirá uma taxa global de precisão a partir de rótulos incompletos.

## Captura real única

1. Validar fontes, manifesto, modelos existentes, corpus e geração; registrar hashes e protocolo antes de carregar modelos.
2. Obter a representação E5 de cada consulta efetiva distinta, sem preparar ou baixar modelos.
3. Usar profundidade 0: limite de 100 candidatos por canal, conforme política produtiva. Consultar identidade e passagem separadamente; título e summary por FTS; titlePrefix somente para consulta de um termo, seguindo a política atual.
4. Chamar rankHybridMemoryCandidates com um provider de reranking que registra entradas e saídas reais do mMARCO. Manter seleção produtiva de até três passagens por thread e batch size atual.
5. Persistir localmente canais, IDs, evidências, sinais, consultas efetivas, documentos enviados ao reranker, scores, candidatos consolidados e duração.
6. Reproduzir o baseline através da função produtiva, com replay estrito das mesmas chamadas registradas ao reranker. Conferir igualdade de ordem, scores, elegibilidade e limites. Mismatch é bloqueio, não tolerância genérica.
7. Todas as condições usam essa captura, sem novo embedding ou reranking. Não construir canais sintéticos nem re-embedar o corpus.
8. Captura sequencial em um único executor. Guardar progresso, PID, lock exclusivo e estado de falha. Nunca lançar um segundo worker enquanto existir execução ativa ou aprovação pendente.
9. Liberar providers/workers mesmo em erro. Conclusão somente após cleanup e confirmação do encerramento.

## Condições predefinidas

Todas as condições avaliáveis preservam limiar 0,5. Não haverá busca de coeficientes ou seleção de limiar pelo resultado.

| ID | Condição | Variável isolada |
| --- | --- | --- |
| M0 | Pipeline híbrido produtivo exato | Baseline |
| M1 | Mesma ordem de M0, elegibilidade própria sem teto final | Controle de remoção do teto |
| M2 | Elegibilidade própria igual à de M0; ordenar pela nota própria descendente | Ordenação por evidência de elegibilidade |
| M3 | Elegibilidade própria igual à de M0; ordenar pelo score do reranker descendente | Ordenação pelo julgador treinado |
| M4 | Elegibilidade própria igual à de M0; ordenar por RRF suavizado com K=60 | Influência excessiva das primeiras posições |
| M5 | Avaliar applyEligibility em cada candidato isoladamente, sem margem entre threads nem teto; manter ordenação híbrida atual entre os novos elegíveis | Dependência da margem de ranking na elegibilidade |
| D0 | Ordem completa de candidatos de M0, sem filtro final | Controle diagnóstico de cobertura/limite, nunca proposta produtiva |

M1 a M4 mantêm exatamente o conjunto elegível pela nota própria produtiva; a comparação não pode atribuir ganho de cobertura a essas condições se houver apenas ganho de ordem.

M4 preserva pesos existentes: identidade 1, passagem 1, reranker 2; lexical título 2, summary 0,75 e prefixo 0,5. Usar 1/(60+rank) para os componentes presentes. Sem rank, contribuição zero. O reforço lexical não pode tornar elegível uma thread que não passou na elegibilidade própria.

M5 usa a função produtiva applyEligibility com um array de um candidato por chamada; isso remove rankingMargin e teto entre candidatos sem duplicar coeficientes. Recalcular os elegíveis e o reforço lexical com os mesmos candidatos e regras existentes. Não usar importação de código alterado ou runtime patch.

Desempates das condições usam rankingScore original e ordem original estável como últimos critérios, de forma explícita. Não ordenar pelo ID do alvo nem consultar o gabarito na produção das listas.

D0 não tem interpretação de qualidade produtiva. Serve para separar falta de candidatos, posição baixa e exclusão por elegibilidade.

## Métricas e diagnóstico

- Alvo histórico em Top-1, Top-3, Top-5, Top-10 e Top-50.
- MRR do alvo conhecido e posições por caso.
- Presença do alvo em canais/consolidação e posição antes/depois do filtro.
- Contagens retornadas nos limites 5, 10 e 50.
- Ganhos, perdas e empates pareados com M0, discriminados por consulta e por estilo.
- Exposição de julgamentos explicitamente incidentais/irrelevantes, cobertura dos julgamentos e quantidade de resultados não julgados.
- Sucesso nas duas consultas de abstinência.
- Nos 14 controles, métricas graduadas somente com escopo e cobertura declarados; não chamar rótulos parciais de precisão completa.
- Para 3P, 6I e 9I, expor nota própria, componente de margem, valor após teto, ranking e motivo de exclusão.
- Durações reais de captura separadas das durações de replay e análise. Não apresentar replay como ganho de latência da busca produtiva.
- Quantidade real de inferências, reuso, pico de RSS observado e estado após cleanup.
- Preservação de hashes do produto, corpus, modelos, manifesto e índice do stage.

## Validação e loop

Um único desenvolvedor compartilhado, sequencial, com configuração já confirmada gpt-6-luna/xhigh. Principal mantém papel de arquitetura/revisão com reasoning confirmado high. Não alterar perfis ou configurações do cliente. Se houver perda dessa confirmação ou bloqueio de ferramenta, comunicar em vez de substituir silenciosamente.

Antes de editar, o desenvolvedor fará bootstrap independente, lerá fontes e plano atual, devolverá OK_BOOTSTRAP com escopo/configuração/regras e aguardará autorização explícita do principal.

Implementar somente o executor temporário modular, com no máximo 300 linhas não brancas por módulo, guard clauses, sem else/if aninhado e testes/fixtures sem escolha condicional de cenários. Usar context-mode, Bash e apply_patch nativo. Nenhum Git.

Testes focados obrigatórios:
- Parser das 30 consultas e extração AST dos 14 controles, com gabaritos preservados e consultas efetivas fixas.
- Resolução única dos 30 sufixos, mismatch de texto e fonte/manifesto incompatíveis.
- Captura/replay exato do baseline e zero inferência adicional em todas as comparações.
- Controle do teto, incluindo prova de que um teto entre notas elegíveis não cruza 0,5.
- Ordenações M2/M3, fórmula RRF K=60 e limiar sem promoção lexical.
- M5 equivalente à função produtiva em singleton, sem duplicar coeficientes.
- Limites após filtragem e consolidação, não antes.
- Resultados desconhecidos não classificados como irrelevantes e controles de abstinência.
- Escopo de escrita, lock/PID duplicado, falha e cleanup antes de conclusão.

Executar também os contratos existentes de semantic/hybrid ranking aplicáveis. A entrega é estudo offline temporário, não mudança executável do repositório ou release-ready. Não executar comandos write-mode amplos do projeto para “validar” uma área que permanece somente leitura; registrar os checks focados e seus limites, sem inventar aprovação de validate/build/test completos.

O desenvolvedor publica sua própria entrega consolidada via MCP sob codex-dev, com relatório interno e message ID. O principal revisa o estado integrado inteiro, corrige pelo mesmo loop, confere evidência e dá autorização separada para a captura real. Nenhuma inferência experimental durante testes ou preparação sem autorização.

## Entrega e decisão

Anexar o relatório legível com método, resultados por condição/caso, regressões, controles, custos, preservação, limitações e revisão final integrada do principal. Os detalhes integrais de código/corpus/evidência permanecem no diretório local autorizado, sem contornar a restrição anterior de exportação.

Uma melhora em alvos conhecidos não prova relevância perfeita de todos os resultados. Não aprovar uma implementação produtiva apenas pelo maior Top-1. Recomendar próximos passos somente quando ganhos, regressões e cobertura de julgamento estiverem claros.

Ao final, comentar o resultado no chat e na thread. Não fechar a thread, não iniciar o estudo 2/4 e aguardar o feedback do humano.

## Perguntas pendentes

Nenhuma pergunta bloqueia este estudo. A autorização de exportação integral da rodada anterior continua pendente e não é necessária para publicar este relatório agregado. Qualquer expansão de corpus, modelos, profundidade, grade de condições, escrita ou implementação produtiva requer nova decisão.
