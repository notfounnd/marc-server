# Handoff da T3 reduzida: camadas no MCP e na CLI, e DEPTH0 contra M0

## Contexto

A decisão está coaprovada (marc://msg_045816d10190469682; `decisao-e3.md` revisado). A UI fica em depth 0, e o funil e a expansão adaptativa ficam fora da produção. As camadas 1 e 2 servem aos agentes pelo `depth` do MCP e da CLI, com reranqueamento completo.

## Fontes obrigatórias

- `decisao-e3.md` (revisão de 2026-10-24) e o parecer `coaprovacao-decisao-e3-codex.md`.
- O plano (revisão 8): seções 2 e 3, linha T3 e escopo de escrita. A revisão 6 trata do aceite de DEPTH0 contra o M0.
- RULES.md completo, AGENTS.md, a skill marc-ops, `docs/memory.md` e `docs/mcp-tools.md`.

## Entregas

1. **Caminho de produção com depth 1 e 2 sem funil.** Verifique e, se preciso, ajuste o core para que uma busca com depth d em 1 ou 2:
   - busque as camadas ≤ d, conforme a T1;
   - reranqueie todas as passagens candidatas, como as variantes DEPTHd com reranqueamento completo;
   - não use `runFunnel`, `selectFinalists` nem orçamento B.
   
   `rerankPairs` reporta o total real. Depth 0 continua exatamente com o algoritmo atual do M0.
2. **Contrato no MCP, na CLI e no HTTP:**
   - `depth` de 0 a 2;
   - 3 rejeitado com a mensagem das camadas;
   - `reference` e `nextActions` por tipo de grupo;
   - `layersSearched` no resultado.
   
   A rota HTTP aceita `depth` para outros clientes; a UI não o envia (T4).
3. **`INDEXED_LAYERS` continua [0] em produção.** A troca para [0, 1, 2] só acontece no rebuild autorizado depois da aceitação humana. Não a faça nesta tarefa. Enquanto o índice tiver só a camada 0, depth 1 e 2 devem funcionar como depth 0, porque `layersForDepth` filtra as camadas presentes. Teste esse comportamento.
4. **Aceite de DEPTH0 contra o M0 congelado** (revisão 6, condição da coaprovação):
   - compare DEPTH0, nas capturas da E3 (marc 87cd2e4d96f7 e ledgerline-en 0d31bd4afd3f), com o M0 das capturas congeladas da E2: marc 1b68a7e3f4e6 e a captura correspondente do ledgerline-en, que você deve localizar nos registros da E2 e citar;
   - use os casos comuns e as métricas e a regra da E0 (δ 0,05, bootstrap por família, inconclusivo reprova);
   - use os comandos existentes (`compare`/`report`) e ajuste o harness só se precisar;
   - reporte a tabela por métrica, com IC e veredito.

## Testes declarados

- Busca com depth 1 e 2 numa fixture com as três camadas: hits de artifact e de chat com `reference` por tipo, sem funil e com `rerankPairs` igual ao total de passagens candidatas.
- Depth 1 e 2 com índice só da camada 0 iguais a depth 0.
- Depth 3 rejeitado nos três transportes.
- Depth 0 inalterado, com a mesma sequência admitida do M0 numa fixture.
- Testes sem `if`, `else`, `switch`, ternário nem skip.

## Escopo de escrita

- **Autorizado:**
  - `src/core/memory/**`, exceto `inference-*`, `model-config.ts` e `maintenance.ts`;
  - `src/core/types.ts` e `src/core/workspace-memory.ts`;
  - `src/mcp/memory-tools.ts`, `src/daemon/memory-routes.ts` e `src/cli.ts`;
  - `scripts/memory-eval/**`, só para o aceite do item 4;
  - `test/**`.
- **Excluídos:**
  - a UI;
  - datasets e capturas, que são somente leitura;
  - `.marc/memory/**` e `pnpm-lock.yaml`;
  - Git;
  - documentação, que fica para a T5.

## Checks

- `pnpm validate`, `pnpm build` e `pnpm test`.
- O relatório do item 4 gerado.
- Um probe pela CLI compilada (`dist/cli.js`) com depth 0 e depth 2 no workspace real, que tem só a camada 0, mostrando resultados iguais. Não rode rebuild produtivo.

## Loop

- **Configuração:** claude-dev, com Haiku 5.5 em xhigh, sequencial.
- **Antes de editar:** OK_BOOTSTRAP, seguido de autorização.
- **Ao terminar:** a entrega consolidada publicada pelo desenvolvedor na thread e o relatório interno com caminhos, linhas, checks, a tabela de DEPTH0 contra M0 e os riscos.
- Encerre só os processos que você iniciar.
