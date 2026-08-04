# Oportunidade: summary e encerramento de threads via MCP

## Motivacao e evidencia atual

O MCP atual expoe 24 tools, incluindo criacao/leitura de threads, postagem de mensagens e anexos. Nao expoe operacao para escrever ou atualizar SUMMARY.md nem acao dedicada de encerramento.

A thread marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba exigiu criar SUMMARY.md com apply_patch para concluir o fechamento. Os comentarios e anexos puderam ser registrados pelo MCP, mas a etapa final dependeu de acesso direto ao filesystem.

A fonte Markdown nao e o problema. A lacuna esta na superficie MCP: uma tool pode gravar o mesmo arquivo autoritativo usando os contratos seguros do core.

## Objetivo

Permitir que um cliente MCP conclua o ciclo de uma thread e mantenha seu resumo sem editar arquivos diretamente, sem depender de hooks, comandos ou formatos proprietarios de um aplicativo de agentes.

O agente continua responsavel por sintetizar e revisar o conteudo. A tool recebe Markdown fornecido pelo chamador e persiste esse conteudo; nao precisa de modelo adicional nem de geracao automatica de texto.

## Decisoes historicas a preservar

Fontes consultadas por memory_recall e thread_read:

- marc://$oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a
- marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

A presenca de SUMMARY.md determina closed. CHAT.md e SUMMARY.md continuam autoritativos. O indice JSON de threads, as projecoes da UI e a memory semantica sao derivados reconstruiveis.

As decisoes antigas de provider/ranking registradas nessas threads sao contexto historico, nao requisito de retroceder ao motor antigo. Esta oportunidade nao modifica modelos, ranking, elegibilidade, corpus ou schema do motor atual.

## Capacidades obrigatorias

1. Gravar o primeiro SUMMARY.md de uma thread existente, encerrando-a pelo contrato atual.
2. Atualizar o resumo de uma thread ja fechada, com politica explicita contra sobrescrita acidental.
3. Ler o resultado por thread_info/thread_read, reutilizando a superficie de leitura existente.
4. Retornar resultado estruturado util ao cliente: threadId, referencia, caminho do resumo, status, closedAt e indicacao de criacao/atualizacao/nenhuma alteracao.
5. Integrar a escrita aos mecanismos atuais de coordenacao, reconciliacao e observacao de mudancas.

## Contrato MCP a decidir no planejamento

Nome candidato: thread_write_summary. O nome e a assinatura ainda devem ser definidos no planejamento, nao estao aprovados para implementacao nesta oportunidade.

Como escrever o primeiro resumo ja encerra a thread por design, uma operacao unica de escrita pode cobrir criacao e atualizacao. Uma eventual thread_close separada so deve existir se trouxer semantica e validacao claras, sem criar dois caminhos divergentes para persistir o mesmo resumo.

Avaliar um modo explicito de criacao/atualizacao ou outra politica simples que impeça transformar uma tentativa de fechamento em sobrescrita silenciosa de resumo existente. Atualizacao deve ser intencional; idempotencia deve ser tratada separadamente de conflito de conteudo.

Inputs minimos esperados: threadId, conteudo Markdown e o bootstrapConfirmed padrao do MCP. Campos adicionais devem responder a necessidades concretas de conflito ou metadados, sem transformar a tool em um gerador de documentos.

Leitura existente com includeSummary deve continuar disponivel. Nao criar summary_read redundante sem demonstrar necessidade.

## Regras de persistencia e seguranca

- Workspace limitada a raiz vinculada ao processo MCP. Nao receber path arbitrario do chamador.
- Thread deve existir e ser valida. Rejeitar thread inexistente sem criar uma pasta fantasma.
- Destino fixo SUMMARY.md na thread resolvida pelo core. Bloquear traversal e escape da workspace.
- Conteudo deve ser Markdown textual nao vazio. Erro de validacao nao pode fechar a thread, truncar o resumo anterior ou alterar CHAT.md.
- Usar lock de escrita apropriado da thread e escrita atomica existentes no core. Evitar implementacao paralela propria.
- Definir tratamento de concorrencia para duas escritas no mesmo resumo. O lock evita escrita parcial, mas nao substitui uma politica explicita de conflito/sobrescrita.
- Preservar a identidade da thread e a data original de fechamento em atualizacoes, salvo alteracao intencional prevista em contrato.
- Conteudo idempotente nao deve renovar closedAt nem provocar processamento desnecessario.
- Definir propriedade e normalizacao dos metadados Thread/Closed, incluindo summaries legados sem data explicita. Nao aceitar contradicao silenciosa entre payload e identidade resolvida.
- Manter CHAT.md e artifacts existentes intactos. Nao apagar ou reescrever historico como efeito do fechamento.
- Falhas de gravacao devem preservar o resumo anterior e permitir retry seguro.
- Se a fonte for gravada mas uma projecao falhar, reportar/reconciliar a falha derivada sem inventar transacao atomica entre arquivos independentes ou tratar cache como autoridade.

## Indices, daemon e memory

A operacao deve reutilizar a reconciliacao e notificacao de mudancas existentes, para que thread_info/thread_list, a UI e seus eventos observem o estado correto.

Validar o fluxo tanto com daemon ativo quanto com MCP usado sem daemon. A persistencia fonte nao pode depender de uma UI ou de outro processo estar aberto.

Com autoRebuild desligado, um resumo novo/alterado deve tornar a memory stale ate rebuild incremental explicito, preservando a configuracao do usuario.

Com autoRebuild ligado, o mecanismo existente deve solicitar apenas reconciliacao incremental, respeitando lock compartilhado, batch size, coalescencia e politica vigente de erro/degradacao. Nao enfileirar rebuild completo por padrao nem duplicar uma reconciliacao ja executada pelo watcher.

Gravar um resumo nao exige preparar modelos, baixar caches ou carregar inferencia na chamada MCP. Se processamento derivado ocorrer em background, a resposta deve distinguir persistencia concluida de processamento ainda pendente.

Nao mudar o motor de busca para implementar o lifecycle dos summaries.

## Fluxo do agente e documentacao

Atualizar docs/mcp-tools.md, documentacao de lifecycle/arquitetura e as recomendacoes geradas pertinentes para orientar uso da nova tool no encerramento, em vez de exigir escrita direta do arquivo.

Atualizar marc-ops e exemplos somente depois de o contrato real existir, preservando ativacao sempre ativa, bootstrap, Custom Rules, artefatos, referencias e auditoria.

O processo deve continuar exigindo validacao tecnica e autorizacao de fechamento conforme o fluxo da workspace. A tool nao decide autonomamente que um trabalho terminou e nao deve ser chamada automaticamente ao fim de qualquer resposta.

Acesso direto aos arquivos continua uma possibilidade arquitetural; ele deixa de ser necessario para clientes MCP completarem o fluxo normal.

A documentacao do produto, schemas, nomes/descriptions das tools, codigo e testes permanecem em en-US. Comunicacao e plano operacional desta thread em pt-BR.

## Criterios de aceite e verificacao

- Criacao inicial pelo MCP produz SUMMARY.md valido e closed observavel por thread_info/thread_list.
- Leitura com includeSummary devolve o conteudo persistido.
- Atualizacao explicita preserva identidade e metadados de fechamento conforme o contrato escolhido.
- Repeticao idempotente produz resultado previsivel sem alterar datas ou reprocessar o indice indevidamente.
- Conteudo vazio, thread inexistente e payload invalido falham sem efeitos colaterais.
- Tentativas de traversal/escape sao rejeitadas.
- Falha de filesystem preserva o resumo anterior; erros sao estruturados/legiveis ao cliente.
- Concorrencia no mesmo recurso nao produz conteudo truncado nem sobrescrita silenciosa contraria a politica definida.
- Threads distintas mantem o isolamento e nao recebem bloqueio global sem necessidade.
- CHAT.md, mensagens, artifacts e resumo de outras threads nao sao alterados.
- Core e MCP usam a mesma regra de fechamento, sem coluna/status autoritativo concorrente com SUMMARY.md.
- Indice JSON e UI acompanham criacao e atualizacao, inclusive apos restart e reconciliacao.
- Memory auto off/on respeita os comportamentos descritos, incluindo lock de rebuild e ausencia de full implicito.
- Testes usam workspaces temporarias e providers/stores controlados, sem baixar modelos nem fazer rebuild/purge da base real.
- Testes unitarios e de contrato MCP, falhas/concorrencia e smoke test real do fluxo completo.
- pnpm run validate, pnpm test e pnpm build aprovados na futura implementacao.
- Revisao de compatibilidade Windows/Linux/macOS sem comandos de shell especificos de um cliente.
- Auditoria mARC apos registros completos, distinta da revisao tecnica.
- Se houver novos efeitos de UI, atualizar o backlog Playwright antes do encerramento.

## Fora de escopo

Nao reabrir ou remover SUMMARY.md implicitamente. Nao gerar resumo com LLM embarcado. Nao implementar hooks para CLIs de terceiros, automacoes proprietarias ou nova pagina de UI apenas para viabilizar MCP. Nao alterar modelos, pesos, elegibilidade, ranking, corpus ou schema da memory. Nao criar outro arquivo autoritativo para o estado de fechamento.

## Estado desta oportunidade

Registro autorizado pelo usuario. Nao e um plano de execucao aprovado e nenhum desenvolvimento foi iniciado. O planejamento futuro deve ler esta oportunidade, confirmar as decisoes de contrato e registrar seu proprio plano antes de implementar.
