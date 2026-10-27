# Handoff da T5: documentação, ADR 0012 e latência de ponta a ponta

## Contexto

- **T3 reduzida:** aprovada (entrega marc://msg_8b34ae9d5d12405ca5). DEPTH0 é não inferior ao M0 congelado nos dois corpora.
- **Decisão:** coaprovada, em `decisao-e3.md`. A UI fica em depth 0, o funil e a expansão adaptativa ficam fora da produção, e as camadas 1 e 2 são acessíveis pelo `depth` do MCP e da CLI, com reranqueamento completo.
- **Máquina de referência:** é esta (confirmação do humano em marc://msg_ce80a9b59c26469bb1).

## Entregas

1. **ADR 0012** (`docs/adrs/0012-memory-depth-as-corpus-layers.md`), sobre depth como camadas de corpus:
   - camadas 0, 1 e 2;
   - a depth d busca as camadas ≤ d;
   - a interpretação lê só a camada 0;
   - o contrato do hit (`groupId`, `groupKind`, `reference` e `nextActions` por tipo, `layersSearched`);
   - a decisão da E3: UI em depth 0; funil e expansão adaptativa avaliados e reprovados no marc (H4 e H5, com os números de `decisao-e3.md`); camadas pelo MCP e pela CLI, com reranqueamento completo; reavaliação depois do estudo de modelos.
   
   Atualize também `docs/adrs/README.md`.
2. **ADR 0011:** acrescente uma nota de continuidade. As faixas continuam vindo da eligibility; a E3 mediu a faixa alta saturada perto de 1; os cortes por fold estão no relatório da T2.
3. **Docs:** `docs/memory.md` (camadas, depth, rebuild com as três camadas depois da aceitação, `INDEXED_LAYERS`), `docs/mcp-tools.md` (depth de 0 a 2, a mensagem para o 3, `layersSearched`, `reference` e `nextActions` por tipo) e `docs/ui-and-daemon.md`, se ainda houver algo a ajustar depois da T4.
4. **Latência de ponta a ponta**, nesta máquina, na mesma execução de `latency`:
   - caminho da UI (DEPTH0 de produção) contra o M0 de antes da E3, com o reranker na ordem `input`; critério: mediana do caminho da UI ≤ 1,2 × a mediana do M0;
   - reporte também o p95 e a referência de 5 s;
   - caminho do MCP com depth 2, só reportado. Como o índice de produção tem só a camada 0, meça-o numa cópia temporária do workspace reconstruída com as camadas [0, 1, 2], como no rebuild da T2, nunca em `.marc/memory`;
   - informe o número de consultas, os comandos e os PIDs iniciados e encerrados.
5. **Busca no repositório:** nenhuma ocorrência de `Deep retry`, `searchRetryDepth` ou depth 3 como opção válida em `src/**`, `docs/**` e `public/**`. A mensagem que rejeita o 3 é permitida.

## Escopo de escrita

- **Autorizado:**
  - `docs/memory.md`, `docs/mcp-tools.md` e `docs/ui-and-daemon.md`;
  - `docs/adrs/0011-memory-confidence-bands.md`, `docs/adrs/0012-memory-depth-as-corpus-layers.md` e `docs/adrs/README.md`;
  - `scripts/memory-eval/**`, só se a medição de latência exigir;
  - `test/**`, só se a busca do item 5 virar teste.
- **Excluídos:** `src/**`, a UI, datasets, capturas, `.marc/memory/**`, `pnpm-lock.yaml` e Git.
- Documentação em en-US.

## Checks

- Para a entrega documental: checks localizados de Markdown, links e âncoras.
- Se `scripts/` ou `test/` mudarem: `pnpm validate`, `pnpm build` e `pnpm test`.
- O relatório de latência.

## Loop

- **Configuração:** claude-dev, com Haiku 5.5 em xhigh, sequencial.
- **Antes de editar:** OK_BOOTSTRAP, seguido de autorização.
- **Ao terminar:** a entrega consolidada (a Entrega 2 da E3) publicada pelo desenvolvedor na thread e o relatório interno.
