# Proposta - coordenacao global de rebuild da memory entre processos

## Problema observado

Durante o encerramento de marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4, um rebuild foi iniciado pela tool MCP.

A UI detectou que o novo SUMMARY.md tornava a memory stale, mas manteve o indicador DatabaseBackup durante toda a execucao. Ela nao exibiu DatabaseZap.

O sintoma visual revelou um problema de coordenacao:

- o daemon so conhece rebuilds iniciados pelo seu BackgroundMemoryReconciler;
- a tool MCP e a CLI chamam o rebuild do core diretamente;
- portanto, processos distintos podem ter visoes diferentes do mesmo workspace;
- um rebuild externo tambem nao e bloqueado pelo rebuild em memoria do daemon.

A UI esta correta ao mapear stale para DatabaseBackup e rebuilding para DatabaseZap. O estado publicado pelo daemon e que nao representa execucoes iniciadas fora dele.

## Evidencia

Validacao observada no workspace marc:

1. Novo SUMMARY.md foi criado ao fechar a thread de provider aquecido.
2. memory_status retornou stale, com 34 summaries e 33 indexados.
3. memory_rebuild pela MCP processou o novo summary.
4. Durante o processamento, a UI permaneceu stale.
5. Ao final, a snapshot passou para ready, com 34 summaries indexados.

O codigo confirma o motivo:

- BackgroundMemoryReconciler mantem preparePromise e rebuildPromise somente na memoria do processo que o criou.
- A UI recebe health por /api/status, que consulta esse reconciler local.
- memory_rebuild da MCP e marc memory rebuild da CLI usam rebuildMemory diretamente e nao atualizam o reconciler do daemon.
- Os testes existentes cobrem deduplicacao de requests concorrentes dentro do daemon, mas nao entre daemon, MCP e CLI.

## Invariante desejado

Deve existir no maximo um rebuild de memory ativo por workspace, independentemente da origem:

~~~text
UI -> daemon
auto rebuild -> daemon
memory_rebuild -> MCP
marc memory rebuild -> CLI
~~~

Qualquer origem deve observar a mesma coordenacao.

Enquanto houver rebuild ativo:

- nenhum segundo rebuild deve iniciar;
- o status do workspace deve ser rebuilding;
- a UI deve exibir DatabaseZap;
- o estado stale nao deve mascarar a execucao;
- o resultado final deve convergir para ready, stale ou degraded conforme o resultado real.

## Direcao arquitetural

Usar uma unica coordenacao compartilhada por workspace. Ela deve ser simultaneamente:

1. exclusao mutua para o rebuild;
2. fonte derivada do estado rebuilding;
3. mecanismo de recuperacao de execucao abandonada.

Nao criar um arquivo de status visual separado de um lock. O lock compartilhado deve ser o proprio sinal operacional.

~~~text
UI / MCP / CLI
  -> tenta adquirir coordenacao de rebuild do workspace
  -> lock livre: executa rebuild
  -> lock ocupado: nao inicia outro rebuild

daemon /api/status
  -> lock ocupado: rebuilding
  -> lock livre e snapshot divergente: stale
  -> lock livre e snapshot atual: ready
~~~

O estado deve ficar sob .marc/cache/, ser descartavel e nunca substituir SUMMARY.md, CHAT.md, artifacts, rules ou manifest como fonte de verdade.

A implementacao deve avaliar reaproveitar a infraestrutura existente de locks cooperativos, incluindo recuperacao de lock stale, em vez de introduzir uma segunda familia de locks.

## Escopo esperado

- Centralizar a entrada de rebuild em um coordinator compartilhado por workspace.
- Fazer UI, auto rebuild, MCP e CLI passarem por esse coordinator.
- Publicar rebuilding a partir da coordenacao compartilhada, nao apenas de rebuildPromise local.
- Definir retorno idempotente para uma segunda solicitacao: anexar-se ao job ativo ou receber resultado explicito de already running.
- Recuperar estado se o processo executor cair, para evitar rebuilding permanente.
- Preservar operacao de MCP e CLI sem daemon ativo.
- Manter memory_status sem carregar o modelo.
- Preservar Markdown como fonte de verdade e LanceDB como snapshot derivada.
- Atualizar testes de core, daemon, MCP e CLI para concorrencia entre processos.
- Atualizar docs/memory.md e docs/ui-and-daemon.md com o contrato de coordenacao.

## Criterios de aceite

- Rebuild iniciado pela MCP faz a UI mostrar DatabaseZap enquanto estiver ativo.
- Rebuild iniciado pela CLI produz o mesmo estado na UI quando o daemon estiver ativo.
- Rebuild iniciado pela UI impede outro rebuild pela MCP ou CLI no mesmo workspace.
- Rebuild iniciado pela MCP impede outro rebuild pela UI.
- Dois processos externos concorrentes nao executam dois embeddings completos para o mesmo workspace.
- Queda do processo executor nao deixa a UI permanentemente em rebuilding.
- Apos sucesso, a memory retorna ready e o indicador usa DatabaseCheck.
- Apos falha, o estado informa degraded ou stale de modo explicito.
- Workspaces distintos podem executar rebuild em paralelo.
- O daemon continua opcional para MCP e CLI.
- Nenhum conteudo Markdown e usado como estado de job.

## Fora de escopo

- Mudar corpus, modelo, provider, ranking, minScore, limit ou schema LanceDB.
- Criar controles de usuario para TTL do provider.
- Alterar a semantica de Connected ou Synced na UI.
- Transformar o daemon em requisito para usar a memory.

## Referencias

- marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4
- marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
- marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
