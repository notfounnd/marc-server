# Plano detalhado - Processamento em background para gerar memory

## Resumo

Implementar rebuild assincrono da memory para a UI/daemon, com configuracao por workspace, preparo explicito do modelo pela UI e sem alterar o contrato sincrono atual de MCP/CLI. O rebuild automatico ficara ligado por padrao, mas so executara quando o modelo local ja estiver preparado; a ausencia de modelo nunca dispara download/preparo automatico.

Ao final, o agente deve postar comentario na thread com o que foi feito, validacao executada e aguardar feedback para orientar o encerramento.

## Mudancas principais

- Criar configuracao persistida por workspace em `.marc`, com `memory.autoRebuild: true` como default para workspaces novos e existentes sem configuracao explicita.
- Adicionar painel de configuracoes no detalhe da workspace, aberto por botao contextual na terceira coluna, no mesmo padrao visual do botao de artifacts da thread.
- No painel, incluir secao `Memory` com:
  - toggle `Automatic memory rebuild`;
  - botao `Prepare model`, sempre visivel;
  - botao manual `Rebuild memory`;
  - status atual da memory, incluindo erro quando houver.
- Estados do `Prepare model`:
  - habilitado quando `modelPrepared === false`;
  - ocupado enquanto prepara;
  - desabilitado quando `modelPrepared === true`;
  - reabilitado se o preparo falhar.
- Manter o card da workspace apenas como navegacao + indicador visual de health; sem botao clicavel dentro do card.
- Reutilizar os estados visuais ja previstos:
  - `DatabaseZap` para rebuild em andamento;
  - `DatabaseBackup` para stale/missing/model missing;
  - `DatabaseCheck` para ready;
  - `DatabaseX` para incompatible/degraded.

## Backend e contratos

- Manter `memory_rebuild` MCP/CLI sincrono e compativel.
- Adicionar endpoint daemon explicito para preparo do modelo:
  - `POST /api/workspaces/:workspaceId/memory/prepare`.
- Adicionar endpoint daemon para iniciar rebuild manual em background:
  - `POST /api/workspaces/:workspaceId/memory/rebuild`.
- Adicionar trava/coordenador por workspace para `prepare` e `rebuild`:
  - deduplicar chamadas simultaneas;
  - impedir rebuild enquanto prepare estiver em andamento;
  - impedir prepare concorrente com rebuild;
  - expor `preparing`, `rebuilding`, `lastPreparedAt`, `lastRebuildAt` e `lastError`.
- O daemon deve agendar rebuild automatico quando:
  - `memory.autoRebuild === true`;
  - modelo preparado;
  - status `missing` ou `stale`.
- O rebuild manual pela UI deve:
  - funcionar mesmo com autoRebuild desligado;
  - exigir modelo preparado;
  - aceitar `missing`, `stale` e `incompatible`;
  - retornar imediatamente com estado `rebuilding`.
- O prepare manual pela UI deve:
  - nunca ser disparado automaticamente;
  - reutilizar `memory_prepare`;
  - retornar imediatamente com estado `preparing`;
  - liberar auto rebuild somente depois de concluido, se o toggle estiver ligado.
- Se rebuild falhar, status deve virar `degraded` com `lastError`; snapshot anterior, se existir, permanece preservada.
- Se prepare falhar, status deve continuar `model_missing` com `lastError`.
- `memory_status` continua barato e nao carrega modelo.
- `.marc/memory` continua snapshot derivada e rebuildavel a partir de `.marc/threads/*/SUMMARY.md`; Markdown segue fonte de verdade.

## API e UI

- Adicionar endpoint de settings por workspace para ler/atualizar `memory.autoRebuild`.
- Expandir `/api/status` e tipos da UI para memory health com:
  - `status`;
  - `ready`;
  - `stale`;
  - `modelPrepared`;
  - `summaryCount`;
  - `indexedSummaryCount`;
  - `preparing`;
  - `rebuilding`;
  - `lastPreparedAt`;
  - `lastRebuildAt`;
  - `lastError`;
  - `autoRebuild`.
- O painel de workspace settings deve usar o mesmo posicionamento visual do botao de artifacts da thread, mas com icone de configuracao.
- Atualizar a UI para refletir prepare/rebuild via refresh/evento do daemon, sem bloquear a coluna nem a busca existente.
- A busca da memory continua disponivel apenas quando a base estiver `ready` ou `stale`.

## Testes e validacao

- TDD antes de producao:
  - teste de settings por workspace: default ligado, persistencia e leitura por workspace isolada;
  - teste de prepare em background: estado `preparing`, dedupe de chamadas simultaneas, erro preservado e modelo nao preparado ainda reportado;
  - teste de rebuild em background: estado `rebuilding`, dedupe de chamadas simultaneas e `lastError` em falha;
  - teste de trava: prepare e rebuild nao executam em paralelo no mesmo workspace;
  - teste de daemon API: update do toggle, prepare manual e rebuild manual;
  - teste de `/api/status`: health de memory inclui `preparing/rebuilding/degraded/autoRebuild`;
  - teste de UI: botao de settings aparece no detalhe da workspace, toggle chama API, `Prepare model` muda estado corretamente, botao manual dispara rebuild e indicador usa `DatabaseZap`.
- Validacao final obrigatoria:
  - `pnpm run validate`;
  - `pnpm test`;
  - `pnpm build`;
  - `workspace_audit` na thread alvo.
- Nao executar comandos git.

## Premissas

- Default aprovado: `Automatic memory rebuild` ligado.
- `Prepare model` fica sempre visivel no painel de configuracao.
- Rebuild automatico nunca chama `memory_prepare` nem baixa modelo.
- A oportunidade de provider aquecido com TTL curto continua separada; esta entrega nao mantem modelo carregado entre chamadas.
- A busca existente na UI e `memory_recall` nao mudam ranking, corpus, provider ou contrato publico.
