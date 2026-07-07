# Oportunidade - Processamento em background para gerar memory

## Origem

Esta oportunidade nasceu no fechamento da evolução de memory registrada em marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac.

Durante a validação real via MCP, o tempo percebido foi relevante:

- `memory_prepare` levou aproximadamente dezenas de segundos para preparar o modelo local pela primeira vez.
- `memory_rebuild` levou cerca de 40 a 50 segundos para gerar a memory de 27 summaries no ambiente atual.

O usuário observou corretamente que esse tempo tende a crescer conforme o histórico aumenta. Portanto, executar rebuild de memory de forma síncrona pode se tornar ruim para UI e agentes.

## Contexto técnico atual

A v1 implementada funciona assim:

- `memory_prepare`: prepara o modelo local em `.marc/cache/memory-models`, sem gerar a snapshot.
- `memory_status`: checa saúde da memory sem carregar o modelo.
- `memory_rebuild`: executa o rebuild de forma síncrona.
- `memory_recall`: consulta a snapshot LanceDB se o índice estiver pronto.

A snapshot commitável fica em `.marc/memory`:

- `manifest.json` descreve schema, provider/modelo e os summaries indexados.
- `summary_embeddings.lance` contém a tabela LanceDB.

O modelo local não é commitável e fica em cache:

- `.marc/cache/memory-models/...`

## Decisão histórica relevante

Existe uma thread anterior que resolveu problema equivalente para `thread-index.json`:

marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186

Resumo do padrão definido naquela thread:

- `thread_list` no MCP permaneceu fresh por padrão.
- Daemon/UI usam stale-while-revalidate: servem último snapshot conhecido e disparam rebuild em background.
- `/api/status` expõe módulos de health.
- UI mostra badges como `Index rebuilding` e `Index degraded`.
- Rebuild pesado não bloqueia listagens.

Essa oportunidade deve reaproveitar criticamente esse padrão, adaptando para memory.

## Objetivo

Evitar que geração/rebuild da memory bloqueie a UI ou a sessão do agente, mantendo a snapshot anterior utilizável quando possível e expondo estado operacional claro para humanos e agentes.

## Hipótese de arquitetura

Criar um reconciler de background para memory, análogo ao `BackgroundThreadIndexReconciler`, mas considerando diferenças importantes:

- Memory depende de modelo local e embeddings, não apenas parsing de Markdown.
- Rebuild pode ser muito mais caro que o thread index.
- Rebuild pode falhar por modelo ausente, backend ONNX, permissões, cache parcial ou provider incompatível.
- A snapshot `.marc/memory` é commitável, então o rebuild altera arquivos versionados.

## Estados candidatos

A modelagem atual de `MemoryStatus` contém:

- `ready`
- `missing`
- `stale`
- `model_missing`
- `incompatible`

Para background, provavelmente será necessário expandir ou complementar com:

- `rebuilding`: rebuild em andamento.
- `degraded`: snapshot anterior existe, mas último rebuild falhou.
- `queued`: opcional, caso exista fila por workspace.
- `lastRebuildAt`: data/hora do último rebuild concluído.
- `lastError`: erro do último rebuild, se houver.

## Fluxos possíveis

### Fluxo A - MCP continua explícito, daemon/UI async

- `memory_rebuild` MCP continua síncrono para agentes que pedem explicitamente rebuild e aceitam aguardar.
- UI/daemon usam reconciler em background.
- `memory_status` mostra `rebuilding`/`degraded` quando aplicável.

Vantagem: menor quebra de contrato MCP.

Risco: há dois modos de rebuild, síncrono e assíncrono.

### Fluxo B - `memory_rebuild` também enfileira

- `memory_rebuild` MCP apenas agenda rebuild e retorna status.
- Um novo campo indica `rebuilding: true`.
- Agente acompanha por `memory_status`.

Vantagem: nunca bloqueia agente.

Risco: muda a expectativa de que `memory_rebuild` saiu com snapshot pronta.

### Fluxo C - Duas operações

- `memory_rebuild`: síncrono, como hoje.
- `memory_rebuild_async` ou `memory_schedule_rebuild`: agenda background.

Vantagem: contrato explícito.

Risco: mais tools e maior superfície operacional.

## Questões de decisão

- O rebuild MCP deve continuar síncrono ou virar async?
- A UI deve iniciar rebuild automaticamente quando `memory_status` estiver `stale`, ou só indicar ação necessária?
- O daemon deve iniciar rebuild ao detectar stale no watcher, como faz para thread index?
- A ausência de modelo (`model_missing`) deve bloquear qualquer rebuild automático?
- `memory_prepare` pode ser chamado automaticamente pelo daemon, ou deve continuar ação explícita para evitar download inesperado?
- Se a snapshot anterior está `stale`, `memory_recall` deve consultar mesmo assim e marcar resultado como stale, ou deve pedir rebuild antes?

## Recomendação inicial

Começar conservador:

- Não baixar modelo automaticamente.
- Não preparar modelo automaticamente.
- Permitir rebuild em background apenas quando o modelo já está preparado.
- Usar stale-while-revalidate quando já existe snapshot anterior.
- Manter `memory_status` barato e sem carregar modelo.
- Expor estado no daemon para a UI.
- Decidir separadamente se MCP `memory_rebuild` continua síncrono.

## Escopo técnico provável

1. Core:
   - criar `BackgroundMemoryIndexReconciler`.
   - controlar lock/rebuild por workspace.
   - preservar snapshot anterior durante rebuild.
   - registrar `lastRebuildAt`, `lastError`, `rebuilding`.

2. Store/status:
   - atualizar `MemoryStatus` ou criar `MemoryIndexHealth` operacional.
   - garantir que `memory_status` não carrega modelo.
   - garantir que leitura de status não bloqueia por rebuild em andamento.

3. Daemon:
   - agregar memory health por workspace em `/api/status`.
   - considerar watcher/refresh throttled para agendar rebuild quando summaries mudarem.

4. UI:
   - permitir visualização de `Memory rebuilding` e `Memory degraded`, possivelmente em conjunto com marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6.

5. MCP:
   - decidir contrato de `memory_rebuild` síncrono vs async.
   - garantir que agentes recebam instruções claras quando rebuild estiver em andamento.

6. Testes/performance:
   - testar que status continua rápido durante rebuild.
   - testar que snapshot anterior permanece consultável quando rebuild falha.
   - adicionar benchmark semelhante ao de thread index, com corpus sintético de summaries.

## Critérios de aceite iniciais

- Um rebuild de memory não bloqueia a UI por dezenas de segundos.
- A UI consegue exibir estado de rebuild/degradação quando aplicável.
- `memory_status` continua rápido e não carrega o modelo.
- Se existir snapshot anterior, `memory_recall` pode continuar operando de forma controlada durante rebuild ou estado stale, conforme decisão explícita.
- Falhas de rebuild não corrompem `.marc/memory`.
- O sistema não baixa modelo local automaticamente sem decisão explícita.
- Há teste cobrindo concorrência/rebuild simultâneo por workspace.
- Há validação de que `.marc/memory` continua derivado dos `SUMMARY.md` e Markdown segue como fonte de verdade.

## Riscos

- Rebuild parcial pode deixar arquivos LanceDB inconsistentes se não houver escrita atômica ou diretório temporário.
- Rebuild assíncrono pode confundir agentes se `memory_rebuild` retornar antes da snapshot estar pronta.
- Download/preparo de modelo local em background pode surpreender usuário e consumir rede/disco.
- Rebuild de embeddings pode consumir CPU/memória e afetar experiência local.
- Snapshot stale pode gerar resposta útil, mas com contexto desatualizado; isso precisa ser sinalizado.

## Relação com outras oportunidades

- O indicador visual depende deste trabalho se quiser mostrar `Memory rebuilding`/`Memory degraded`: marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6
- O tuning de ranking pode aproveitar métricas/benchmarks criados aqui: marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

## Referências

- Evolução base da memory: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- Padrão anterior de background rebuild: marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
- Oportunidade de indicador visual: marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6
- Oportunidade de tuning: marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
