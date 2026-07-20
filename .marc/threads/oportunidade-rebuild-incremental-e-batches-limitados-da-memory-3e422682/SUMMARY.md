# Sumario executivo

Closed: `2026-07-20T22:54:00.000Z`

## Resultado

A manutencao da summary memory passou a reconciliar alteracoes de forma incremental e com batches limitados. O rebuild full continua disponivel apenas por escolha explicita, compartilhando o mesmo lock global e o mesmo limite de memoria.

## Contexto

O rebuild anterior enviava todos os registros para uma unica inferencia ONNX. Em uma base de 27 summaries, isso levou a uma tentativa de alocacao de aproximadamente 2,67 GiB e falha por memoria insuficiente. O objetivo foi eliminar esse pico, evitar reembeddings desnecessarios e preservar um caminho de recuperacao full.

## Tratativa

- `incremental` e o modo padrao para UI, MCP e auto rebuild.
- `full` exige escolha explicita na UI ou `mode: "full"` na tool MCP.
- O executor processa batches sequenciais. `memory.embeddingBatchSize` tem default `4` e aceita valores pares de `2` a `16`.
- A reconciliacao usa hashes do manifest para embedar somente summaries novos ou alterados e remove vetores de summaries excluidos.
- O manifest e publicado apenas apos a operacao derivada do store concluir com sucesso.
- O provider de embedding e descartado ao terminar, falhar ou nao adquirir o lock.
- Rebuild manual e automatico compartilham o lock global por workspace. Requisicoes concorrentes observam `rebuilding` e nao entram em fila.
- Auto rebuild executa somente incremental para estados `missing` e `stale`. Estado `degraded` aguarda acao manual e nao entra em loop de retentativa.
- A UI ganhou slider de batch size e botoes distintos para `Rebuild incremental` e `Rebuild full`.
- O endpoint existente de rebuild recebe `mode`, sem criar uma rota paralela.
- `docs/memory.md`, `docs/mcp-tools.md` e `docs/ui-and-daemon.md` foram atualizados. As quebras fisicas indevidas em prose tambem foram removidas de `docs/memory.md` e `docs/mcp-tools.md`.

## Validacao

- Testes focados de reconciliacao, background, daemon, MCP e UI passaram com 24 testes.
- `pnpm run validate`: passou.
- `pnpm test`: passou com 131 testes.
- `pnpm build`: passou.
- Rebuild full real executado apos restart deixou a memory `ready`, com 36 summaries fonte e 36 indexados, sem itens missing, stale ou extras.
- Persistencia do slider e chamada incremental sem alteracoes foram validadas manualmente. A chamada incremental sem delta nao iniciou inferencia, como esperado.
- `pnpm run format:check`: passou apos a correcao documental.
- O backlog de Playwright foi atualizado em `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` para cobrir slider, modos incremental/full, lock e estado visual.

## Referencias

- Proposta: `artifacts/proposta-rebuild-incremental-e-batches-limitados.md`
- Plano: `artifacts/plano-rebuild-incremental-e-batches-limitados.md`
