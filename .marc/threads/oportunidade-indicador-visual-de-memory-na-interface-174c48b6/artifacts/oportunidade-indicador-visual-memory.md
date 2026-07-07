# Oportunidade - Indicador visual de memory na interface

## Origem

Esta oportunidade nasceu no fechamento da evolução de memory registrada em marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac.

Durante a validação, a interface mostrava dois indicadores existentes:

- `Connected`, no painel do daemon token: indica conexão/autenticação com o daemon.
- `Synced HH:mm:ss`, no topo do conteúdo: indica a última sincronização da UI com o daemon.

Esses indicadores não representam o estado da memory. A pergunta do usuário foi se já existia algum indicador visual para o estado de memory. A resposta técnica atual é: não existe indicador visual dedicado para memory.

## Estado atual observado

A implementação atual já expõe estado de memory no core/MCP:

- `workspace_status` inclui `modules.memory` no core.
- `memory_status` retorna estados como `ready`, `missing`, `stale`, `model_missing` e `incompatible`.
- `memory_status` não carrega o modelo; ele apenas compara o estado da snapshot com os `SUMMARY.md` e checa se o cache local do modelo existe.

A UI/daemon ainda não usa esse estado:

- `/api/status` do daemon agrega apenas `threadIndex` por workspace.
- `src/ui/types.ts` modela `DaemonStatus.modules.threadIndex`, mas não modela `memory`.
- `src/ui/app-sync.ts` consome apenas `daemonStatus.modules?.threadIndex?.workspaces`.
- `src/ui/app-content.tsx` renderiza badges para `Index rebuilding` e `Index degraded`, mas não renderiza badge de memory.

## Ponto importante de UX

O usuário comentou que já tem uma ideia para a solução visual, mas quer contar no momento certo. Portanto, esta oportunidade deve preservar espaço para discussão de design antes da implementação.

## Objetivo

Criar um indicador visual de estado da memory na interface do mARC, deixando claro para humanos e agentes quando a base semântica compartilhada está pronta, ausente, stale, incompatível, sem modelo preparado, ou em rebuild caso a oportunidade async seja implementada.

## Perguntas de produto

- O indicador deve aparecer sempre que `memory` estiver `ready`, ou apenas quando houver ação necessária?
- O estado `ready` deve ser discreto, próximo de `Synced`, ou omitido para reduzir ruído visual?
- O indicador deve ficar no topo do conteúdo, junto dos badges de sync/index, ou no painel do workspace?
- A UI deve oferecer ação direta, como `Prepare memory` ou `Rebuild memory`, ou apenas informar o estado?
- Como distinguir estado da conexão (`Connected`), estado de sync (`Synced`) e estado da memory sem confundir o usuário?

## Estados candidatos

- `Memory ready`: snapshot atual, modelo preparado, summaries indexados.
- `Memory stale`: algum `SUMMARY.md` mudou, sumiu ou apareceu depois do último rebuild.
- `Memory missing`: índice commitável ainda não foi construído.
- `Memory model missing`: modelo local ainda não foi preparado em `.marc/cache/memory-models`.
- `Memory incompatible`: snapshot foi gerada com provider/modelo/contrato diferente.
- `Memory rebuilding`: se a oportunidade de processamento em background for implementada.
- `Memory degraded`: se existir erro persistente no rebuild async ou leitura da snapshot.

## Escopo técnico provável

1. Expor memory no status do daemon:
   - adicionar `modules.memory.workspaces[workspaceId]` em `/api/status`.
   - reaproveitar o estado já calculado por `readWorkspaceStatus(workspace.rootPath).modules.memory`.

2. Atualizar tipos da UI:
   - criar `MemoryIndexHealth` em `src/ui/types.ts` compatível com o retorno do core.
   - adicionar `DaemonStatus.modules.memory?.workspaces`.

3. Sincronizar estado no app:
   - adicionar estado `memoryHealthByWorkspace` em `src/ui/main.tsx`.
   - preencher em `src/ui/app-sync.ts` a partir de `/api/status`.
   - calcular `selectedMemoryHealth` para o workspace selecionado.

4. Renderizar indicador:
   - passar `selectedMemoryHealth` para `AppContent` ou outro componente definido após discussão de design.
   - renderizar badge/estado seguindo o design escolhido.

5. Atualizar i18n/testes/docs:
   - manter product text em en-US no catálogo.
   - adicionar testes UI/core quando o formato final for definido.
   - atualizar docs se o indicador virar parte do fluxo operacional esperado.

## Critérios de aceite iniciais

- A UI mostra estado de memory do workspace selecionado sem confundir com `Connected` ou `Synced`.
- Quando a memory está `ready`, o indicador não cria ruído excessivo.
- Quando a memory está `stale`, `missing`, `model_missing` ou `incompatible`, o estado fica visível o bastante para orientar ação.
- O estado visual é alimentado por `/api/status`, não por leitura direta de arquivos no frontend.
- A UI continua funcional se o campo `modules.memory` estiver ausente por compatibilidade com daemon antigo.
- O texto de produto novo permanece em en-US.

## Fora de escopo inicial

- Definir a experiência final antes do usuário apresentar a ideia visual.
- Implementar rebuild async; isso pertence a marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa.
- Implementar tuning de ranking; isso pertence a marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb.

## Dependências e ordem sugerida

Esta oportunidade pode ser discutida antes das demais, mas a implementação completa pode depender da oportunidade async se o design final incluir `Memory rebuilding`.

Ordem técnica sugerida:

1. Discutir a ideia visual do usuário.
2. Decidir se a UI precisa mostrar apenas health ou também ações.
3. Se houver estado `rebuilding`, implementar ou pelo menos desenhar junto com marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa.
4. Implementar indicador visual.

## Referências

- Evolução base da memory: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac
- Padrão de status/rebuild em background do thread index: marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186
- Oportunidade de background memory: marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
- Oportunidade de tuning de recall/ranking: marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb
