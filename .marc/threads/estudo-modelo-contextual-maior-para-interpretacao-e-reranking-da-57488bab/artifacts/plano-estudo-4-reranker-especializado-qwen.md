# Estudo 4/4 — Reranker especializado com candidatos congelados

## Síntese e pergunta

Comparar o reranker atual, cross-encoder/mmarco-mMiniLMv2-L12-H384-v1 O4, com onnx-community/Qwen3-Reranker-0.6B-ONNX q4. A pergunta é se pesos especializados mais recentes ordenam melhor as mesmas evidências, sem mudar recuperação, conteúdo indexado ou interpretação.

O candidato já consta no estudo documental desta thread. Não será uma nova pesquisa de interpretadores, implementação de memory_deep ou troca produtiva. Os estudos anteriores permanecem congelados. A autorização humana desta rodada permite preparar e executar o experimento, não promover um modelo ao produto.

## Fontes e decisões preservadas

- Bootstrap atual do workspace marc-dd422176e1, raiz C:/Projetos/marc, INSTRUCTIONS.md e RULES.md completos, AGENTS.md e skill marc-ops.
- README, Agent Workflows, Development e decisões arquiteturais aplicáveis à memória e ao bootstrap.
- Estudos documentais, resultados corrigidos do estudo 1, resultados dos estudos 2 e 3.
- Captura C0 do estudo 1, capture.data.json, SHA-256 46a71c7c6c9a51f78f4438135995db7e37572e99f428795562519afbcdb6bde5; fingerprint fd304b9e97515c48e2c7b5b7561ec53808c98c6e68ea628f21d1546e9d31686c.
- Relatório corrigido study-report-recomputed-v2.json, SHA-256 179092bdaf421c409156cc36c7442c781b790facf7a981d57d57e53d1df959f0. Não reutilizar julgamentos anteriores à correção.
- Context7 e implementação instalada de Transformers.js 4.3.1/ONNX Runtime 1.30.0; cards oficiais de Qwen e da conversão ONNX, consultados nesta rodada.

Não adicionar dicionários, listas por idioma, exceções por termo ou regras específicas para brutalism. O benchmark contém consultas históricas, diretas, implícitas, controles positivos e negativos; termos difíceis são casos de avaliação, não lógica especial.

## Conjunto congelado

Reutilizar 44 casos lógicos e 40 consultas efetivas distintas do estudo 1. Manter exatamente a consulta efetiva capturada, os canais, a shortlist por thread, ordem e texto de cada documento enviado ao mMARCO. Há 4.470 pares consulta-documento na captura. O novo reranker avaliará esses mesmos pares, em sequência, sem recapturar embeddings nem consultar o corpus ao vivo.

Preservar profundidade 0, limite de candidatos por canal, até três passagens por thread e limite final de 50 resultados. Não incluir CHAT, artifacts ou arquivos de regras. Não pedir nova correção ao LFM.

A amostra contém duplicatas e julgamentos incompletos. Relatar os 44 casos, as 40 consultas distintas, os positivos distintos e os dois controles de abstenção separadamente. Outras threads sem julgamento são desconhecidas, não negativas. Não afirmar precisão global ou generalização a consultas inéditas.

## Braços e métricas

| Braço | Definição | Finalidade |
| --- | --- | --- |
| A0 | Resultado produtivo M0 capturado com mMARCO | Baseline exibível |
| A1 | Ranking de threads pelo melhor score mMARCO das passagens congeladas, sem filtro | Diagnóstico de ordenação |
| B0 | Novos scores Qwen no mesmo pipeline produtivo, filtro 0,5, teto monotônico e desempates preservados | Efeito da substituição isolada |
| B1 | Ranking de threads pelo melhor score Qwen das mesmas passagens, sem filtro | Diagnóstico de ordenação |

A1/B1 não são resultados destinados à UI. O ranking diagnóstico pode listar threads em consultas sem resposta; isso não constitui sucesso de abstenção. A0/B0 avaliam resultado vazio e descarte no contrato atual.

Reproduzir o replay mMARCO contra a captura antes de inferência. Para o Qwen, confirmar que documentos solicitados pelo replay são exatamente os congelados. Associar scores a IDs/posições de evidências sem heurísticas de título ou perda de alinhamento.

Medir Top-1/Top-3/Top-10/Top-50, posição recíproca, nDCG@10 com os julgamentos conhecidos, cobertura do alvo no pool, ganhos e perdas por consulta, melhor passagem por thread, elegibilidade e tamanho da resposta. Registrar mudanças de posição e scores em casos selecionados e uma matriz legível por caso.

Não ajustar limiar, temperatura, prompt, pesos de fusão ou seleção de passagens após olhar resultados. Scores de dois modelos não são probabilidades intercambiáveis. O teste de B0 com 0,5 é uma ablação explícita, não prova de calibração.

Para recomendar uma próxima avaliação de promoção, exigir simultaneamente ausência de regressão no Top-1/Top-10 histórico, preservação do Top-1/Top-10 dos controles positivos, dois controles negativos vazios e ganho de pelo menos dois alvos Top-1 entre positivos distintos, acompanhado de melhoria na relevância graduada conhecida. Mesmo um candidato que cumpra esses critérios precisa de holdout novo e validação de recursos/plataformas antes de ser produtivo. Um ganho apenas de B1 recomenda estudar integração/calibração, não substituir o modelo diretamente. Registrar toda regressão, mesmo se a média melhorar.

## Modelo, preparação e scoring

Fixar revisão 9995c50e2310679108a55f5ccd16ba8be9f17c20, dtype q4, CPU, batch efetivo 1, intraOpNumThreads 2 e interOpNumThreads 2. Um único modelo carregado por vez. E5, LFM e mMARCO não serão carregados durante a captura Qwen.

Metadados do Hub indicam gated false e Apache-2.0. onnx/model_q4.onnx tem 995.235.866 bytes e SHA-256 787193952a9aa58374381ec7647b160ac6c200a386dbfc3bc998a3c458081330. A revisão e todos os assets selecionados devem ser registrados com tamanho e SHA-256 local. Baixar somente os arquivos necessários, não todas as quantizações. Não instalar ou atualizar dependências.

Preparação experimental em C:/Users/junior/AppData/Local/Temp/marc-reranker-study-57488bab-20261014/model/. Não reutilizar mecanismos produtivos de prepare/purge nem gravar no cache do projeto. Downloader deve restringir origem e paths, verificar tamanho/hash dos pesos, gravar temporariamente e publicar arquivo completo só após verificação, sem sobrescrever evidência prévia. Registrar falhas e arquivos incompletos; não aceitar fallback silencioso.

Usar AutoTokenizer e AutoModelForCausalLM local_files_only após preparação. O Qwen é um reranker causal, não um classificador genérico. Construir o prompt oficial, com instrução invariável "Given a web search query, retrieve relevant passages that answer the query", sistema oficial e sufixo assistant com think fechado. Seguir o template oficial de pontuação, não gerar explicações ou texto livre.

Ler logits yes/no na última posição real de cada prompt e calcular softmax binária numericamente estável. Verificar IDs de tokens, dimensões, finitude, intervalo e quantidade de scores. Registrar diferença de logits, score e tokens por par. Liberar tensores de entrada, logits e caches após cada chamada.

Preflight tokeniza os 4.470 prompts antes de carregar pesos. Orçamento máximo de 2.048 tokens, sem truncação. Se algum documento exceder o orçamento ou o contexto real do modelo, interromper e registrar a incompatibilidade antes de alterar o protocolo. Não cortar documento ou remover sufixo silenciosamente. Validar o método com fixtures determinísticas e o Tensor real da biblioteca.

## Execução, recursos e recuperação

Executar uma captura completa após a revisão técnica do runner. Operações sequenciais, sem outro benchmark em paralelo. Uma chamada forward por par necessário; contar invocações reais, erros e retomadas, não estimativas como chamadas observadas. Um checkpoint por progresso durável permite continuar após falha sem reprocessar pares concluídos. Fingerprint inclui plano, código, revisão/assets, runtime e fontes congeladas. Rejeitar checkpoint de identidade diferente, contagens inválidas, resultados duplicados ou completos sem evidência de unload.

Timeout de segurança por operação de 120 segundos, sem meta de vitória por latência. RSS amostrado a cada segundo, limite de segurança experimental de 3,5 GiB observado entre chamadas. Esse limite não é uma garantia rígida de alocação nem comprovação de suporte a PC de 8 GB. Se excedido, interromper com diagnóstico, descarregar modelo e preservar checkpoint. Medir carga, scoring, unload, CPU/threads configurados, duração total e RSS após unload. Verificar código de saída real do processo e remoção do lock.

Ao retomar uma captura, registrar a chamada que falhou e não esconder seu custo. Não executar duas capturas concorrentes nem inferir conclusão apenas pela existência do relatório. Manter pesos e outputs do estudo separados da produção; relatar ocupação recuperável, sem apagar automaticamente evidências.

## Escopo e handoff atômico

Um desenvolvedor sequencial, perfil compartilhado codex-dev, runtime Beauvoir, gpt-6-luna com xhigh confirmado pelo humano. Principal codex-software-architect, gpt-6.1-sol com high confirmado pelo humano. Perfis representam papéis e não novos spawns. Limite humano vigente de um desenvolvedor ativo.

Único write scope de implementação: raiz temporária marc-reranker-study-57488bab-20261014. Arquivos previstos reranker-protocol.mjs, reranker-inputs.mjs, reranker-download.mjs, reranker-runtime.mjs, reranker-capture.mjs, reranker-replay.mjs, reranker-report.mjs, reranker-state.mjs, reranker-cli.mjs, reranker.test.mjs, reranker-lifecycle.test.mjs e reranker-download.test.mjs. Cada módulo até 300 linhas não vazias. Outras subdivisões exigem autorização interna do principal antes da edição.

Também são permitidos artifacts e mensagens consolidadas desta thread exclusivamente pelas tools oficiais do mARC. Nenhuma alteração em src, scripts, test, docs, package/lock, configurações, perfis, memória produtiva, cache produtivo, Git ou seis raízes anteriores de estudo. Novos JSON/checkpoints/model assets são saídas geradas do executor autorizado, não edições manuais via shell/context-mode.

Antes de editar, desenvolvedor deve fazer bootstrap independente, ler fontes aplicáveis e o plano e devolver OK_BOOTSTRAP com identidade, fontes, regras críticas, configuração e fonte da confirmação humana, paths/status e hash do plano. Esperar autorização explícita interna. Usar apply_patch nativo para código manual e context-mode para investigação/validação. Não usar PowerShell ou comandos Git.

## Validação e revisão

Testes determinísticos e sem branches de cenário: scoring estável/ties/não finitos, template e tokenização, alinhamento/query/shortlist, replay e diagnóstico, ordenação estável, métricas/deduplicação, download verificado, arquivo parcial/corrompido, divergência de revisão/hash, checkpoint/resume, contador de tentativa falha, completude, lock/conflito, root físico e descarregamento inclusive em falha. Fixtures filesystem em paths temporários exclusivos com cleanup seguro. Não executar testes antigos que escrevem nas raízes congeladas.

Entrega experimental, sem declaração release-ready. Executar checks de sintaxe/AST, testes completos do runner e contratos produtivos focados de ranking sem escrita. Não executar pnpm validate em modo write contra arquivos produtivos congelados. Não declarar pnpm validate/build/test completos aprovados quando não executados. A produção não é modificada nesta rodada.

Principal fará revisão independente integrada do runner antes de preparar/executar modelos e novamente dos resultados: critérios, alinhamento do corpus, matemática, comparabilidade, lifecycle, métricas, preservação, docs e riscos. Reproduzir scores derivados, rankings e agregados offline, sem repetir inferência por rotina. Conferir hashes de produto/stage e seis raízes anteriores antes/depois.

Desenvolvedor publica sua própria entrega consolidada quando transferir a tarefa ao principal, com arquivos, checks reais, riscos e revisão pendente. Coordenação, autorizações e correções ficam internas, sem diário na thread. Principal registra resultado e revisão final aprovados/pendentes/rejeitados em artifact consolidado e mensagem legível. Auditoria preflight após plano/metadados e messages após entrega final.

## Saída e próximos passos

Registrar resultado em pt-BR com recomendação clara de manter ou aprofundar candidato, evidências por caso, limites e custo de disco/RAM. A busca produtiva permanece intacta qualquer que seja o resultado. A thread fica aberta para feedback humano. Não iniciar quinto estudo, trocar modelo, implementar nova arquitetura ou fechar a thread automaticamente.

Não há decisão de produto pendente para executar este protocolo. Eventual falha de runtime, download, orçamento ou evidência é um resultado a registrar, não autorização para trocar silenciosamente modelo, quantização ou regras.
