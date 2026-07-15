# Plano detalhado - Coordenacao global de rebuild da memory

## Objetivo

Garantir que exista no maximo um rebuild da memory por workspace, independentemente da origem:

- UI/daemon;
- auto rebuild do daemon;
- tool MCP `memory_rebuild`;
- CLI `marc memory rebuild`.

Durante uma operacao externa, a UI deve mostrar o mesmo estado `rebuilding` que ja apresenta para uma operacao iniciada pelo daemon. O indicador atual `DatabaseZap` sera reutilizado; nao sera criada uma camada visual paralela.

## Diagnostico confirmado

Hoje ha duas coordenacoes diferentes:

1. O daemon mantem um `BackgroundMemoryReconciler` por workspace e deduplica chamadas concorrentes apenas no seu proprio processo por meio de `rebuildPromise`.
2. MCP e CLI chamam `rebuildMemory` diretamente. Essa funcao chega em `rebuildMemoryInWorkspace` sem participar do `BackgroundMemoryReconciler` do daemon.

Consequencias:

- quando MCP/CLI reconstrui a memory, o daemon enxerga apenas o manifest ainda stale; ele nao enxerga uma promessa local ativa;
- o endpoint `/api/status` retorna stale durante a reconstrucao externa e somente ready ao fim;
- a UI ja sabe renderizar rebuilding, mas recebe stale;
- o watcher do daemon ignora deliberadamente `.marc/cache/`, portanto a criacao e a liberacao de um lock em cache nao produzem `workspace-changed`;
- a UI sincroniza status por carga inicial, foco e SSE. Uma operacao MCP/CLI externa nao emite SSE por conta propria.

Portanto, mudar apenas o mapeamento visual nao resolveria o problema. A lacuna e de coordenacao operacional entre processos e de propagacao de mudanca para a UI.

## Invariantes

1. No maximo um rebuild pode executar por workspace em qualquer instante.
2. A segunda solicitacao nao espera o primeiro rebuild para executar outro. Ela termina como operacao ja em andamento.
3. A existencia de um rebuild e derivada de um lock vivo, nao de novo arquivo de estado, Markdown ou flag visual.
4. O lock permanece em `.marc/cache/`, logo continua descartavel e nao se torna fonte de verdade.
5. O lock renova sua liveness durante trabalhos longos e locks abandonados por processo interrompido sao recuperaveis pela regra de staleness ja existente.
6. Workspaces diferentes continuam independentes.
7. O status `rebuilding` precisa ficar observavel tanto no daemon/UI quanto nas superficies MCP/CLI que consultam status.
8. Nenhum caminho deve carregar o modelo para executar uma reconstrucao concorrente que ja se sabe desnecessaria.

## Arquitetura proposta

### 1. Reaproveitar a coordenacao cooperativa existente

Evoluir `src/core/write-coordination.ts` em vez de criar outro formato de lock.

A extensao tera duas capacidades genericas:

- tentativa nao bloqueante de executar um trabalho sob lock de workspace;
- consulta se um recurso possui lock vivo.

A tentativa usa a mesma aquisicao atomica por diretorio, `owner.json`, renovacao de mtime, recuperacao atomica de lock stale e liberacao com verificacao de ownership ja usadas pelos writers do projeto.

A diferenca semantica e essencial:

- `withWorkspaceWriteLock` continua adequado para escritas que devem aguardar sua vez;
- o novo caminho de tentativa retorna imediatamente quando o recurso esta ocupado;
- nenhum rebuild fica enfileirado para rodar depois de outro rebuild.

A consulta de atividade tambem aplica a recuperacao de stale lock antes de responder. Assim, um processo morto nao deixa o workspace permanentemente em rebuilding apenas ate que alguem tente uma nova escrita.

### 2. Centralizar o recurso de rebuild da memory

Criar uma fronteira pequena no dominio de memory para evitar que o nome do recurso e a regra de leitura do lock se espalhem pelos chamadores.

Responsabilidades:

- definir o recurso estavel `memory-rebuild`;
- executar a operacao de rebuild sob tentativa nao bloqueante;
- expor se ha rebuild global em curso para um `WorkspaceInfo`;
- converter o snapshot de status para `rebuilding` quando o lock de memory estiver vivo.

O lock ficara em `.marc/cache/write-locks/` pelo caminho deterministico ja usado pela infraestrutura de coordenacao. Ele nao sera commitado e nao altera o manifest, o LanceDB nem os summaries.

### 3. Cobrir todos os caminhos de rebuild

`rebuildMemoryInWorkspace` passara a executar a escrita do indice sob a coordenacao global e retornara se o trabalho foi executado ou se ja havia outro processo ativo.

O chamador que encontrou o lock ocupado:

- nao abre uma segunda reconstrucao;
- nao aguarda para reconstruir depois;
- devolve o estado de rebuild em andamento.

A verificacao de modelo ausente permanece uma guarda antecipada. A operacao que efetivamente adquiriu o lock conserva o fluxo atual de leitura, escrita do LanceDB/manifest e tratamento de erro.

### 4. Unificar o health do daemon com o lock global

`BackgroundMemoryReconciler` mantera sua promessa local para deduplicar agendamentos do mesmo processo. Ela nao sera removida.

O seu metodo de health passara a considerar:

- promessa local de prepare;
- promessa local de rebuild;
- lock global vivo de `memory-rebuild`;
- falha local anterior;
- snapshot derivado do indice.

Um lock obtido por MCP ou CLI tera precedencia operacional equivalente a uma `rebuildPromise` local: o health retornara `status: "rebuilding"`, `rebuilding: true` e `ready: false`.

O estado de base continua sendo lido do manifest e dos summaries. O lock so sobrepoe o estado enquanto a operacao existe.

### 5. Tornar MCP e CLI explicitos sobre concorrencia

O contrato de `MemoryStatus` sera ampliado com o estado `rebuilding`.

- `memory_status` devolvera rebuilding quando encontrar o lock global vivo, sem carregar o modelo.
- `memory_rebuild` e `marc memory rebuild`, se encontrarem um rebuild ativo, devolvem rebuilding em vez de aguardar e repetir o trabalho.
- quando o solicitante adquiriu o lock, esses caminhos preservam o comportamento atual de aguardar a propria reconstrucao e retornar o estado final.

A mudanca so adiciona um valor de estado e nao exige parametros novos em MCP ou CLI.

### 6. Propagar mudancas externas para UI

A UI nao sera alterada para manter polling permanente nem para interpretar arquivos de cache.

O `UiEventBus` do daemon recebera um monitor leve de locks de rebuild:

- ele acompanha os workspaces ja registrados;
- inicia apenas enquanto ha ao menos um cliente SSE conectado;
- consulta somente a atividade do lock de memory de cada workspace, sem carregar o modelo nem reconstruir indice;
- emite `workspace-changed` apenas na transicao inactive -> active ou active -> inactive;
- para o monitor quando nao houver clientes SSE;
- limpa os estados ao desregistrar workspace ou fechar o event bus.

A UI ja responde a `workspace-changed` com refresh de `/api/status`; por isso o fluxo existente atualizara o card para `DatabaseZap` no inicio e para ready/stale/degraded no fim. O filtro atual para `cache/` no watcher de threads permanece intacto, evitando que locks causem rebuilds de thread index.

## Arquivos previstos

- `src/core/write-coordination.ts`: tentativa nao bloqueante e consulta de lock vivo.
- `src/core/memory/rebuild-coordination.ts`: recurso de memory e adaptacao do estado.
- `src/core/memory/operations.ts`: proteger o rebuild efetivo com a coordenacao global.
- `src/core/memory/background.ts`: combinar promessa local e lock global no health.
- `src/core/memory/types.ts`: incluir `rebuilding` no contrato de status.
- `src/core/memory/index.ts`: exportar a fronteira de coordenacao necessaria.
- `src/core/workspace-memory.ts`: refletir rebuild global em `memory_status` e no retorno de chamadas diretas.
- `src/daemon/events.ts`: monitorar transicoes do lock somente com UI conectada.
- testes de coordenacao, core memory, background memory, daemon/event bus e MCP quando o contrato publico for afetado.
- `docs/memory.md` e, se necessario, `docs/ui-and-daemon.md`: documentar exclusao mutua, resposta para solicitacao concorrente e visibilidade da UI.

Nenhuma alteracao de componente React e esperada. O componente de indicador existente continua sendo a unica apresentacao visual do estado.

## Casos de teste

1. Um lock de `memory-rebuild` ativo impede nova execucao imediatamente; o callback concorrente nunca roda.
2. Apos liberar o lock, uma nova solicitacao executa normalmente.
3. Um lock stale e removido com seguranca antes de uma nova tentativa ou consulta de status.
4. Dois reconciliadores do mesmo processo continuam deduplicados pela promessa local.
5. Um reconciliador cujo lock foi obtido por outra instancia reporta rebuilding, mesmo sem `rebuildPromise` local.
6. MCP/CLI observam `rebuilding` em vez de stale quando outra origem ja esta reconstruindo.
7. O caminho concorrente nao chama o trabalho de rebuild, logo nao reprocessa embeddings nem escreve manifest/LanceDB.
8. O monitor SSE emite uma mudanca ao adquirir e outra ao liberar o lock; nao emite repetidamente enquanto o estado nao muda.
9. O monitor nao executa quando nao ha cliente UI e limpa estado ao desregistrar workspace.
10. O comportamento de cache ignorado pelo watcher de threads permanece inalterado.
11. Workspaces distintos podem reconstruir em paralelo.

Quando for viavel no harness atual, a exclusao sera exercitada tambem a partir de tentativas independentes contra o mesmo diretorio de workspace, pois esse e o limite que interessa entre daemon e MCP/CLI.

## Validacao

- Testes focados dos modulos alterados durante TDD.
- `pnpm run validate`.
- `pnpm test`.
- `pnpm build`.
- `workspace_audit` preflight antes do comentario final.
- Smoke operacional apos restart: iniciar rebuild pela tool MCP, manter UI aberta e confirmar a sequencia stale/ready -> rebuilding -> estado final sem disparar segundo rebuild.

## Riscos controlados

- O monitor consulta apenas metadado de lock e somente com SSE conectado; nao faz polling de embeddings, memoria ou corpus.
- Existe uma janela transitoria natural entre a tentativa de aquisicao e a criacao do lock, mas ela e resolvida pela operacao atomica de aquisicao.
- O timeout de stale permanece o contrato ja centralizado da coordenacao de escrita; esta evolucao nao introduz configuracao nova.
- O resultado final pode ser ready, stale ou degraded. O monitor nao decide esse resultado; ele apenas notifica que o lock mudou para que a UI recalcule o health derivado.

## Reinicio esperado

Nao ha acao necessaria nesta fase de planejamento. Apos o build, sera necessario reiniciar daemon e reconectar/reiniciar o cliente MCP para carregar as novas rotas e tools compiladas. Isso sera sinalizado explicitamente antes da validacao operacional.
