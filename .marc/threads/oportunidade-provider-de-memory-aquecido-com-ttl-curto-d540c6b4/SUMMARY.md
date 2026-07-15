# Resumo executivo

Thread: `oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4`
Closed: `2026-07-14T16:52:00.000Z`

## Objetivo

Reduzir o custo de recalls consecutivos da memory sem deixar o pipeline local de embeddings residente indefinidamente em memoria.

## Implementacao

- Criado `MemoryProviderManager` para reutilizar um provider de embeddings por workspace durante um TTL ocioso.
- O gerenciador serializa operacoes do mesmo workspace para evitar inferencia e descarte concorrentes no mesmo pipeline.
- O timer e `unref()` para que uma chamada unica de CLI nao mantenha o processo vivo apenas pelo TTL.
- Providers sao descartados apos inatividade e quando o daemon fecha.
- `recallMemoryInWorkspace` deixou de descartar provider por request; o lifecycle passou a pertencer ao gerenciador.
- `prepare` e `rebuild` preservaram seu descarte explicito ao final.
- `memory_status` continua verificando cache e manifest sem carregar o pipeline.
- `docs/memory.md` documenta o lifecycle e os limites de memoria nativa do runtime.

## Decisoes

- TTL definido em 30 segundos e reiniciado depois de cada recall.
- O TTL nao e configuravel nesta versao: e uma constante interna, sem opcao na UI ou em `.marc/marc.config.json`.
- O aquecimento e isolado por workspace; providers nao sao compartilhados entre projetos.
- Corpus, provider/adaptador, ranking, `minScore`, limites, schema LanceDB e contratos MCP/HTTP/CLI foram preservados.
- Markdown continua fonte da verdade; o lifecycle em memoria nao altera summaries, manifest ou snapshot LanceDB.

## Validacao

- Novo teste de lifecycle cobriu reutilizacao no TTL, isolamento por workspace, serializacao e descarte global.
- `pnpm run validate`: passou.
- `pnpm test`: passou com 118/118.
- `pnpm build`: passou, com apenas o aviso conhecido do Vite sobre chunk acima de 500 kB.
- `workspace_audit` preflight: 0 achados.
- Benchmark de core: recalls consecutivos passaram de 2.068 ms e 1.571 ms para 72,6 ms e 61,3 ms apos o primeiro carregamento.
- Validacao apos restart: daemon respondeu `200`; primeira busca da API levou 3,0 s, segunda imediata 325 ms e nova busca apos 32 s ociosos levou 2,4 s. Isso confirmou aquecimento e expiracao do TTL no processo real do daemon.
- A memory permaneceu `ready` com 33 summaries indexados antes do encerramento.

## Limite observado

Transformers.js/ONNX pode reter parte de alocacoes nativas mesmo apos `dispose()`. O contrato validado e o descarte do pipeline por timeout ou fechamento do daemon, nao a devolucao imediata de todo RSS ao sistema operacional.

## Estado final

A oportunidade foi concluida. O provider local fica quente apenas durante uma janela curta de uso, melhora recalls consecutivos e preserva o descarte automatico apos inatividade.
