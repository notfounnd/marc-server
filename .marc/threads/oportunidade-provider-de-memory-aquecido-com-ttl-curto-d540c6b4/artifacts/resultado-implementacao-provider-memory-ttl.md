# Resultado da implementacao - provider de memory aquecido com TTL curto

## Implementado

- Criado MemoryProviderManager em src/core/memory/provider-manager.ts.
- Cada processo mantem no maximo um provider quente por workspace.
- O provider e reutilizado em recalls consecutivos dentro de TTL interno de 30 segundos.
- Operacoes do mesmo workspace sao serializadas para impedir inferencia e descarte concorrentes no mesmo pipeline.
- O timer e unreferenced; uma chamada unica da CLI nao fica viva apenas pelo TTL.
- Provider e descartado apos inatividade e todos os providers quentes sao descartados quando o daemon fecha.
- recallMemoryInWorkspace deixou de chamar dispose() por request. Ele continua responsavel por status, embedding, LanceDB e ranking; o lifecycle agora pertence ao gerenciador.
- prepare e rebuild mantem o descarte explicito existente.
- memory_status permanece sem carregar o pipeline.
- Documentacao atualizada em docs/memory.md.

## Testes adicionados e ajustados

- Novo test/core-memory-provider-manager.test.ts:
  - reutilizacao no TTL;
  - isolamento por workspace;
  - serializacao de operacoes concorrentes;
  - descarte por timeout;
  - descarte global.
- FakeEmbeddingProvider passou a registrar disposeCalls.
- O teste de recall agora garante que recall nao acrescenta dispose() depois do lifecycle usado pelo rebuild.

## Benchmark

Linha de base anterior, tres recalls sequenciais no mesmo processo:

| Chamada | Tempo |
|---|---:|
| 1 | 4.216 ms |
| 2 | 2.068 ms |
| 3 | 1.571 ms |

Depois da implementacao:

| Chamada | Tempo |
|---|---:|
| 1 | 2.638 ms |
| 2 | 72,6 ms |
| 3 | 61,3 ms |

A reutilizacao elimina o reload de pipeline entre as chamadas 2 e 3. No benchmark, o RSS chegou a aproximadamente 948 MiB enquanto o provider ficou quente e caiu para aproximadamente 479 MiB apos disposeMemoryProviders().

Esse resultado confirma descarte parcial de recursos, mas nao deve ser interpretado como garantia de retorno imediato de todo RSS ao sistema operacional: Transformers.js/ONNX podem reter alocacoes nativas mesmo apos dispose(). O criterio funcional e que o pipeline recebe dispose(), nao fica residente por TTL indefinido e e liberado no encerramento do daemon.

## Preservado

- Corpus restrito a .marc/threads/*/SUMMARY.md.
- Markdown como fonte da verdade.
- Snapshot LanceDB derivada.
- Provider local Transformers.js e adapter existente.
- Ranking, candidate threshold, minScore, limit e formato de resultados.
- Contratos MCP, HTTP e CLI.
- Configuracao .marc/marc.config.json.
- Estado da memory: ready, 33 summaries e 33 summaries indexados.

## Validacao

- Teste focado de lifecycle e recall: 8/8 passou.
- pnpm run validate: passou.
- pnpm test: 118/118 passou.
- pnpm build: passou.
- workspace_audit preflight da thread: 0 achados.
- Build manteve apenas o aviso conhecido do Vite sobre chunk JavaScript acima de 500 kB.

## Acao necessaria para uso em runtime

Reiniciar o daemon e reiniciar a sessao MCP/agent que estiver usando o processo atual. O codigo de lifecycle fica carregado em memoria nesses processos persistentes; sem restart, eles continuam executando a versao anterior.

Nao e necessario rebuild da memory.
