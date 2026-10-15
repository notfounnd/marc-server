# Plano do experimento com dois interpretadores ONNX

## Objetivo e decisão de escopo

Comparar o interpretador atual LFM2.5-350M com Qwen3.5-0.8B e LFM2.5-1.2B, mantendo o harness de correção, E5, mMARCO, elegibilidade, profundidade e índice produtivos.

O usuário autorizou preparar e executar a avaliação e informou que o estado anterior está em stage. Essa autorização não permite apagar, restaurar, substituir ou atualizar o stage. Não serão executados checkout, reset, clean, commit, stash ou stage. Git só será usado com autorização explícita aplicável; a inspeção do experimento pode ser feita por leitura e hashes.

Jev será tratado futuramente como camada complementar. Esta etapa não implementa juiz adicional, consolidação, memory_deep ou profundidade adaptativa.

## Fontes e baseline

- Skill marc-ops, bootstrap de marc-dd422176e1, RULES.md com Custom Rules, AGENTS.md e docs/agent-workflows.md.
- docs/memory.md e contratos de interpretação.
- Proposta original e estudo/evidências anexados nesta thread.
- src/core/memory/query-interpretation.ts, query-interpretation-inference.ts, query-candidates.ts, local-query-interpreter.ts, model-config.ts e store.ts.
- scripts/memory-quality-v4.ts e seus limites atuais.
- Documentação de Transformers.js via Context7 e implementação instalada 4.2.0.

O baseline inicial estudado tem 53 summaries, geração 20261012171458084_59902dec e hash de manifesto 5bd9ff94b34cd7afca843d91504ef85d1ac54048513420266a1be554ef9227c3. Reconfirmar antes de executar. Se mudou, fixar e registrar o snapshot novo e repetir o baseline necessário; não comparar snapshots diferentes como se fossem pareados.

## Perfis fixados

| Perfil | Modelo | Revisão | Precisão |
| --- | --- | --- | --- |
| Baseline | onnx-community/LFM2.5-350M-ONNX | Usar bundle já preparado e registrar identidade real | q4 |
| Qwen | onnx-community/Qwen3.5-0.8B-ONNX-OPT | 969350d5f4647ec9ac277110f8974c65d8c10e4b | q4, texto |
| LFM maior | LiquidAI/LFM2.5-1.2B-Instruct-ONNX | 10f72e70abf67ac0fd7ebf15bc5854726891d864 | q4 |

Confirmar novamente os arquivos e a disponibilidade antes do download. Não substituir revisão/modelo/precisão silenciosamente. Qwen somente texto deve usar os gráficos embed_tokens e decoder_model_merged, sem visão.

Cache e saídas brutas do experimento ficam em uma pasta identificada sob o diretório temporário autorizado, fora de .marc/memory e do cache produtivo. Relatórios consolidados serão anexados pela ferramenta mARC. Os dois bundles novos somam aproximadamente 1,52 GB de arquivos selecionados; dependências e temporários podem aumentar o espaço usado.

## Etapa 1. Desenvolvimento delegado e revisão do executor

Um desenvolvedor compartilhado codex-dev, modelo gpt-6-luna com reasoning xhigh, conforme configuração humana já confirmada. Limite ativo de um desenvolvedor, sem paralelismo.

Antes de editar, o desenvolvedor faz bootstrap independente, lê fontes e retorna OK_BOOTSTRAP com workspace, regras críticas, configuração solicitada/confirmada, paths e estado dos alvos. A autorização para editar é enviada pelo principal somente após conferir esse retorno, em canal interno.

### Escopo autorizado do código

Criar arquivos novos:

- scripts/memory-interpreter-benchmark.ts.
- scripts/memory-interpreter-benchmark-support.ts.
- scripts/memory-interpreter-benchmark-worker.ts.
- scripts/memory-interpreter-benchmark-cases.ts.
- test/memory-interpreter-benchmark.test.ts.
- test/memory-interpreter-benchmark-contract.test.ts.
- test/memory-interpreter-benchmark-storage.test.ts.

A revisão independente identificou que concentrar todos os testes em um arquivo viola o limite de 300 linhas do ESLint. Os dois caminhos adicionais estão autorizados exclusivamente para separar contratos e persistência experimental em Temp, preservando toda a cobertura e sem alterar regras ou suprimir checks.

O principal pode autorizar outro arquivo estritamente experimental se a decomposição exigir, antes da edição. Não editar src, package.json, lockfile, configuração, UI, scripts existentes, regras, skills, perfis, índices ou modelos produtivos.

Usar o padrão local de CLI TypeScript e bibliotecas instaladas. Não instalar dependências nem adicionar hooks.

### Executor e contratos

- Reutilizar queryInterpretationMessages, interpretMemoryQuery e buildMemoryQueryCandidates. Não trocar o prompt ou alterar regras por modelo.
- Geração determinística, contrato original de índice inteiro e max_new_tokens 4, com feedback/retry já existente. Se o formato/configuração de um modelo impedir isso, registrar como incompatibilidade experimental, não ajustar apenas aquele candidato para obter vantagem.
- Executar cada perfil em processo isolado e sequencial, com carga, coleta de RSS/ru_maxrss quando disponível, dispose e encerramento verificável.
- Usar device CPU e o mesmo limite de threads para os três perfis. Registrar limite adotado e opções realmente disponíveis. Não presumir VRAM.
- No baseline, reutilizar arquivos locais preparados, sem download ou mudança do cache produtivo. No experimento, resolver o layout local e registrar origem/revisão de cada bundle.
- Diferenciar erro/timeout/saída inválida de uma preservação semanticamente correta. O fallback atual não pode esconder falha do provider como acerto.
- Registrar todas as chamadas ao provider, outputs brutos curtos, feedback, quantidade de tentativas, decisão e interpretação efetiva.
- Separar os casos em que o harness não chamou o modelo daqueles em que houve decisão. Não atribuir no-op ao entendimento do modelo.
- Não iniciar prepare/rebuild/purge, initWorkspace ou alteração de settings. Obter workspace e manifesto por APIs de leitura.
- Não executar avaliação pesada ou baixar pesos durante a implementação até o principal revisar e autorizar o runner.

## Etapa 2. Matriz de interpretação

Duas baterias complementares, declaradas e congeladas antes de executar:

1. As 30 consultas históricas e os oito controles registrados, usando candidatos produzidos pelo corpus atual.
2. Casos declarativos de seleção entre duas variantes, para exercitar correção legítima e rejeição de alternativas indevidas mesmo quando o gerador natural não produz candidatos.

A segunda bateria deve cobrir:

- Typos reais, incluindo toogle/toggle e brutalismp/brutalism, sem dominar a amostra.
- Erros em termos como incremental, configuração, rebuild, referência e security.
- Preservação de invoice, palavras válidas, flexões, gramática e estilo.
- Preservação de negações, números, comandos, identificadores e intenção.
- Alternativas semanticamente próximas, mas não equivalentes.
- Português, inglês e espanhol.
- Modo literal, sugestão sem aplicação e preservação em saída inválida/erro.
- Consultas com uma palavra e com contexto.

Rótulos: índice esperado, consulta efetiva esperada e sugestão esperada quando aplicável. O principal revisa os rótulos antes da execução; não ajustá-los depois de conhecer a resposta de um modelo.

Casos de falha de provider, parser, retry e literal são testes determinísticos com fixtures, não perguntas que exigem pesos reais.

## Etapa 3. Preparação e execução supervisionada

Após revisão do executor:

1. Reconfirmar corpus, manifesto, candidatos e arquivos produtivos protegidos por hashes.
2. Preparar os dois bundles experimentais, um de cada vez. Registrar os arquivos e bytes baixados; não carregar ambos simultaneamente.
3. Fazer smoke test de cada perfil, com o contrato real, para validar tokenizer, texto-only, graphs, output e dispose.
4. Executar baseline e os dois candidatos sobre a mesma matriz.
5. Persistir checkpoints de resultados na pasta experimental para recuperar uma interrupção sem repetir toda a bateria.
6. Comparar os resultados de interpretação e selecionar as consultas cuja interpretação mudou.
7. Reexecutar a recuperação híbrida existente para as consultas originais/efetivas distintas, na mesma geração e depth 0, reutilizando resultados quando idênticos. Sem novo reranker ou mudança de elegibilidade.
8. Confrontar ganhos de correção com resultados de busca, sem tratar o índice selecionado ou a string corrigida como prova suficiente de utilidade.

Se houver OOM, incompatibilidade ou falha de download, registrar o fato, preservar o baseline e avaliar o outro perfil. Não encerrar um agente aparentemente parado sem verificar aprovação pendente.

## Métricas e critérios de avaliação

- Acerto de seleção apenas nos casos em que houve chamada ao modelo.
- Correção legítima, correção destrutiva, sugestão e preservação correta.
- Saídas inválidas, erros, timeouts e retries, sem contar fallback como vitória do modelo.
- Resultados por idioma, tipo de consulta e família.
- Alvos históricos e relevância dos resultados nas consultas alteradas.
- Tempo observado, cold/warm quando medido, RSS e pico do processo experimental, bytes do bundle e estado após dispose.
- Qualidade primeiro; latência não é motivo para encerrar a avaliação sem entender o resultado.
- A máquina disponível tem aproximadamente 16 GB. Mesmo um perfil que execute aqui não fica aprovado para 8 GB sem avaliação própria.
- Um candidato não vence por corrigir brutalism se piorar termos válidos ou consultas contextualizadas.

## Validação e revisão integrada

Código experimental e testes são entrega executável. Exigem testes focados, typecheck/checks pertinentes e pnpm validate, pnpm build, pnpm test, com inspeção dos efeitos de formatação.

Antes de pnpm validate, capturar hashes dos arquivos existentes que podem ser tocados pelo formatter. A execução não pode modificar silenciosamente trabalho anterior fora do escopo. Se houver conflito de formatação, relatar e resolver com autorização; não restaurar em massa ou sobrescrever o stage.

O principal revisa integralmente os arquivos novos, aceitação, isolamento, reutilização do harness, fixtures, erros, recursos e evidências. Achados retornam ao mesmo desenvolvedor e o loop continua até aprovação técnica.

A documentação do procedimento experimental fica neste plano e no relatório de entrega; não há alteração de docs de produto enquanto não houver funcionalidade produtiva.

## Entregas e registros

- O desenvolvedor publica sua entrega consolidada própria, pelo MCP e perfil codex-dev, com escopo, checks, limites e pendência de revisão principal.
- O principal anexa resultados experimentais, comparação, revisão integrada e recomendação ao final.
- Coordenação, OK_BOOTSTRAP, autorizações e iterações ficam internas. Nada de diário por comando ou ajuste.
- O usuário receberá resultados e limites, incluindo eventual incompatibilidade. Não promover modelo nem fechar a thread sem decisão humana.
