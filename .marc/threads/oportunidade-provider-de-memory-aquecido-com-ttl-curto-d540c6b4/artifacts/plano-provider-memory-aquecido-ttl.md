# Plano detalhado - provider de memory aquecido com TTL curto

## Objetivo

Reduzir a latencia de consultas consecutivas a memory sem manter o pipeline de embeddings permanentemente residente. O provider local sera reutilizado por workspace durante uma janela curta de inatividade e descartado automaticamente depois dela.

## Evidencia que justifica a mudanca

Benchmark executado antes da implementacao, com a memory deste workspace em estado ready e modelo ja preparado:

| Chamada sequencial de memory_recall | Tempo | RSS apos a chamada |
|---|---:|---:|
| 1 | 4.216 ms | 439,0 MiB |
| 2 | 2.068 ms | 462,0 MiB |
| 3 | 1.571 ms | 507,2 MiB |

O processo partiu de 73,9 MiB RSS. O provider atual e criado em cada recallMemory, carrega o pipeline sob demanda e recallMemoryInWorkspace chama dispose() ao final. A melhoria e justificada pela diferenca de custo entre buscas proximas e pelo uso futuro de retries da busca; ela nao promete que dispose() reduza imediatamente o RSS do processo, pois Transformers.js/ONNX pode reter alocacoes no runtime mesmo apos liberar o pipeline.

## Decisoes

- Preservar a v1: corpus apenas em .marc/threads/*/SUMMARY.md, snapshot LanceDB derivada e Markdown como fonte da verdade.
- Preservar provider/adaptador existente: a implementacao concreta continua LocalEmbeddingProvider com Transformers.js.
- Manter memory_status sem carregar o modelo. Ele continuara criando apenas um provider leve para verificar cache/manifest.
- Aplicar o aquecimento somente ao fluxo de recall. Prepare e rebuild mantem seu lifecycle explicito e descarte ao final.
- Usar TTL interno conservador de 30 segundos, constante de codigo nesta etapa. Nao criar configuracao de usuario antes de evidencia de que ela e necessaria.
- Isolar providers por workspace, usando o caminho canonico do workspace como chave. Cinco workspaces terao no maximo um provider quente cada, sem compartilhamento de modelo entre elas.
- Serializar o uso de um mesmo provider para evitar corrida entre inferencias simultaneas e impedir dispose() enquanto uma consulta ainda esta usando o pipeline.
- Descartar no timeout ocioso e solicitar descarte de todos os providers quando o servidor daemon for fechado.
- Nao alterar schemas MCP/HTTP/CLI, ranking, minScore, limite, formato LanceDB ou configuracao .marc/marc.config.json.

## Arquitetura proposta

~~~text
memory_recall (MCP / daemon UI / CLI)
  -> recallMemory(workspaceRoot)
  -> MemoryProviderManager.run(workspace, callback)
       -> slot por workspace
       -> provider reutilizado enquanto houver atividade ou TTL
       -> fila por slot para uma inferencia por vez
  -> recallMemoryInWorkspace(info, provider)
       -> status sem carregar pipeline
       -> embedQuery
       -> LanceDB search e reranking atual
  -> release
       -> agenda dispose() apos 30 s ocioso

daemon server close
  -> disposeMemoryProviders()
  -> cancela timers e descarta todos os providers ainda quentes
~~~

A responsabilidade de lifecycle sai de recallMemoryInWorkspace: essa operacao continuara responsavel por status, embedding, busca e ranking. O gerenciador passa a ser dono do descarte do provider usado no recall. Isso elimina o dispose() por request que hoje impede reutilizacao.

## Implementacao

- [ ] Criar src/core/memory/provider-manager.ts.
  - Exportar MEMORY_PROVIDER_IDLE_TIMEOUT_MS = 30_000.
  - Implementar MemoryProviderManager com factory injetavel para testes.
  - Manter Map<workspaceKey, slot>; cada slot possui provider, contador de uso, fila de operacoes e timer ocioso.
  - Expor run(info, callback), que cancela o timer anterior, entra na fila do workspace, executa a callback com o provider e agenda descarte apenas quando nao houver operacoes pendentes.
  - Expor disposeAll(); cancelar timers, remover slots e chamar dispose() de cada provider.
  - Usar timer com unref() quando disponivel, para um recall de CLI nao manter o processo vivo apenas pelo TTL.
  - Usar guard clauses e retornos antecipados; sem else e sem if aninhado.

- [ ] Atualizar src/core/memory/operations.ts.
  - Remover o await options.provider.dispose() de recallMemoryInWorkspace.
  - Manter rebuildMemoryInWorkspace como fluxo de lifecycle proprio, com descarte ao final.
  - Manter resultados, ranking, next actions, limit e minScore inalterados.

- [ ] Atualizar src/core/workspace-memory.ts.
  - Criar um gerenciador de providers de processo para os recalls publicos.
  - Executar recallMemoryInWorkspace dentro de MemoryProviderManager.run(...).
  - Exportar disposeMemoryProviders() para shutdown coordenado.
  - Nao usar o gerenciador em readMemoryStatus, prepareMemory ou rebuildMemory.

- [ ] Atualizar src/core/memory/index.ts.
  - Reexportar MemoryProviderManager e a constante de TTL para testes e para manter o boundary de memory discoverable.

- [ ] Atualizar src/daemon/server.ts.
  - No evento close do servidor, disparar disposeMemoryProviders() junto do encerramento de eventos.
  - O shutdown nao deve alterar o status persistido, a configuracao do workspace nem a snapshot de memory.

- [ ] Atualizar testes.
  - Em test/memory-test-helpers.ts, registrar disposeCalls no fake provider.
  - Criar test/core-memory-provider-manager.test.ts.
  - Cobrir reutilizacao do mesmo provider em recalls dentro do TTL.
  - Cobrir isolamento: workspaces distintos recebem providers distintos.
  - Cobrir concorrencia: duas operacoes do mesmo workspace nao permitem descarte enquanto a primeira ainda esta ativa.
  - Cobrir descarte apos timeout ocioso, com TTL curto injetado no teste.
  - Cobrir disposeAll(): timers sao cancelados e cada provider ativo recebe um unico dispose().
  - Manter os testes de recallMemoryInWorkspace existentes para assegurar que ranking e resultados nao mudaram.

- [ ] Atualizar docs/memory.md.
  - Explicar que recalls em processos persistentes podem reutilizar o pipeline por uma janela curta de inatividade.
  - Explicar que o TTL e por workspace e que o daemon descarta providers ao encerrar.
  - Reforcar que memory_status continua sem carregar o modelo e que CLI de uma unica chamada nao passa a reter processo por causa do timer.

## Validacao

1. Executar o novo arquivo de teste focado e a suite de memory.
2. Executar pnpm run validate, pnpm test e pnpm build.
3. Repetir o benchmark de tres recalls sequenciais; registrar tempos e memoria como comparacao, sem exigir reducao imediata de RSS como criterio de sucesso.
4. Verificar por tool MCP que memory_status continua ready sem carregar o modelo.
5. Encerrar/reiniciar o daemon e confirmar que o fluxo de busca continua funcional apos novo recall.
6. Rodar workspace_audit preflight na thread antes de reportar conclusao.

## Riscos e mitigacoes

- O runtime de ML pode reter memoria nativa apos dispose(). Mitigacao: documentar que o criterio do TTL e liberar o pipeline e evitar residencia indefinida; validar por chamadas a dispose() e lifecycle, nao apenas por RSS.
- Concorrencia pode provocar uso/descarte simultaneo. Mitigacao: fila por workspace e contador de uso no slot.
- Timer pode impedir encerramento de CLI. Mitigacao: unref() no timer e limpeza explicita no daemon.
- Uma falha durante recall nao pode manter lease preso. Mitigacao: release e agendamento do TTL em finally.

## Fora de escopo

- Alterar o modelo, provider, adaptador, corpus, schema LanceDB, ranking ou threshold de recall.
- Implementar a configuracao de retries profundos da UI; esta thread apenas fornece a reutilizacao que essa evolucao podera aproveitar.
- Persistir estado de provider no workspace ou exibir estado de aquecimento na UI.
