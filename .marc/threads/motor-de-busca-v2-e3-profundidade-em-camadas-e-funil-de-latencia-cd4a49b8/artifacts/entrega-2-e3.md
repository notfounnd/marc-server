# Entrega 2 da E3: documentação, ADR 0012 e latência de ponta a ponta (claude-dev)

Escopo do handoff-t5.md. Sem `src/**`, UI, datasets, capturas, `.marc/memory/**`, `pnpm-lock.yaml` ou Git. Docs em en-US.

## 1. Documentação

- **ADR 0012** (`docs/adrs/0012-memory-depth-as-corpus-layers.md`, novo): depth como camadas de corpus (0 a 2); a interpretação lê só a camada 0; contrato do hit (`groupId`, `groupKind`, `reference` e `nextActions` por tipo, `layersSearched`, `rerankPairs`); decisão da E3 com os números de `decisao-e3.md`; funil e expansão adaptativa fora da produção; `INDEXED_LAYERS = [0]` até o rebuild aceito pelo humano; DEPTH0 não inferior ao M0 congelado (1b68a7e3f4e6 e 5ae0f660527c, casos comuns, regra da E0); consequências com a latência medida.
- **Correção pedida pelo coordenador**: depths 1 e 2 reranqueiam o pool consolidado do M0 das camadas buscadas (registro de identidade do grupo e até três passagens), sem funil e sem orçamento. Aplicada no ADR 0012, em `docs/memory.md` (tabela de profundidade) e em `docs/mcp-tools.md`.
- **ADR 0011**: nota de continuidade no fim, sem alterar o texto original. Corrige a frase sobre a sequência automática de profundidade, que saiu com a T4.
- **`docs/adrs/README.md`**: entrada 0012.
- **`docs/memory.md`**: "UI search depth" virou "UI search" (busca única em depth 0, snapshot schema 7, sem `Deep retry` nem `searchRetryDepth`); nova seção "Depth and corpus layers" (tabela 0 a 2, rejeição do 3, `layersSearched`, `rerankPairs`); painel de settings sem profundidade; `INDEXED_LAYERS = [0]` explicitado na seção de rebuild.
- **`docs/mcp-tools.md`**: depth de 0 a 2, mensagem para o 3, `groupId`, `groupKind`, `reference`, `nextActions`, `layersSearched` e `rerankPairs`.
- **`docs/ui-and-daemon.md`**: revisado; já estava ajustado na T4.

## 2. Latência de ponta a ponta (máquina de referência, uma só execução)

Protocolo: as 30 primeiras consultas por id do corpus marc (o mesmo subconjunto da T0); um aquecimento e três recalls cronometrados por caminho em cada caso; os caminhos intercalados por caso (aquecimento de cada um, depois três rodadas em que cada caminho roda uma vez). Total de 90 amostras por caminho. Comando: `t0-funnel-prestudy.ts latency e2e`, extensão do `latency` da T0. Saída: `.marc\cache\memory-eval-e3\t0\latency-e2e-t5.json`.

| Caminho | Configuração | Mediana | p95 |
|---|---|---|---|
| UI | depth 0, ordem `length`, índice com a camada 0 | 11.814 ms | 12.905 ms |
| M0 de antes da E3 | depth 0, ordem `input`, índice com a camada 0 | 18.221 ms | 19.574 ms |
| MCP depth 2 (só reportado) | depth 2, ordem `length`, índice com camadas 0, 1 e 2 | 18.131 ms | 22.327 ms |

- **Razão UI/M0 (medianas): 0,648. Critério de 1,2 vezes o M0: aprovado.**
- Referência de 5 s: não atingida por UI (11.814 ms) nem por MCP depth 2 (18.131 ms). É informativa e fica para o estudo de modelos; não decide nenhum gate.
- Pares enviados ao reranker: em todos os 30 casos, UI e M0 enviaram o mesmo número de pares do replay.
- O caminho do MCP foi medido só nesta máquina e não decide o contrato.
- Dois workspaces temporários (copias do corpus, com índice `[0]` e `[0, 1, 2]`), removidos pelo harness ao fim. `.marc/memory` não foi tocado.

## 3. Código

- `scripts/memory-eval/t0-funnel-prestudy.ts`: modo `latency e2e` dentro de `runLatency`, pelo argumento `process.argv[3]`. `instrumentedProviders` recebe a ordem do reranker e `probedRecall` recebe a profundidade. O comando `latency` da T0 não mudou. Não há comando paralelo.

## 4. Checks

- `pnpm validate`: código 0.
- `pnpm build`: código 0.
- `pnpm test`: 1020 passam, 0 falham.
- Links e âncoras dos seis documentos alterados: 20 verificados, nenhum quebrado (script em `scratchpad`).
- Busca em `src`, `docs` e `public`: nenhum `Deep retry`, `recallMemorySearchDepths` ou depth 3 como opção válida. A única menção a `searchRetryDepth` é a nota de descarte da chave antiga em `docs/ui-and-daemon.md`.

## 5. Processos e riscos

- O processo da medição (PID 385742) terminou sozinho, com código 0. Nenhum processo meu segue ativo. Os cinco processos protegidos do ecossistema e o daemon da porta 4187 (PID 27740) não foram tocados.
- A medição rodou com cerca de 19 processos `node` na máquina, inclusive os protegidos; a carga de fundo pode afetar os números absolutos. A intercalação por caso reduz o viés entre caminhos, mas não o elimina.
- O M0 com ordem `input` reproduz a ordem do reranker de antes da E3, mas não é o código pré-E3 em si; sem Git não há como recuperá-lo. É a aproximação do plano.
- Não verifiquei a documentação com um verificador de Markdown além dos links e âncoras; `pnpm validate` roda formatação em modo de escrita, e sem Git não verifiquei por diff se algum arquivo fora do escopo foi reformatado.
