# Entrega: runner offline do estudo LFM350M

## Estado
- Classificação: ferramenta de estudo isolada; nenhum código produtivo, cache ou fixture foi alterado. Esta entrega e sua correção são registros MCP legítimos e ficam excluídos dessa afirmação.
- Escrita de código limitada a `C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/`.
- Perfil executor: `codex-dev`; configuração solicitada e efetiva confirmada pelo humano: `gpt-6-luna`, reasoning `xhigh`. Nenhum perfil foi criado ou alterado.
- Revisão independente do principal e autorização para inferência experimental permanecem pendentes. O smoke test `--validate-inputs` confirmou `pipelineLoaded:false`; nenhuma inferência experimental do runner foi executada.

## Implementação
Arquivos do runner:
- `runner.mjs` (44 linhas; CLI em 12): `--help`, `--validate-inputs`, `--phase pilot` e `--phase full --prompt A|B`.
- `runner-core.mjs` (251): composição de mensagens, remapeamento, provider, cobertura exata, métricas, gates e desempate. Baseline normal é byte-a-byte igual ao produtor. Reversão mapeia feedback semântico 0/1 coerentemente, preserva os índices canônicos e mantém saídas inválidas inválidas.
- `runner-frozen.mjs` (78): hashes congelados, união/reconciliação de casos e flags históricos suggestion-only.
- `runner-inputs.mjs` (104): importação e digest das fontes, resolução do cache/runtime e validação dos pesos locais.
- `runner-config.mjs` (20): configuração offline e carregador do pipeline.
- `runner-output.mjs` (12): extração do texto gerado.
- `runner-runtime.mjs` (283): identidade do experimento (47), records públicos (105), resumos (162/185), execução e descarte (226), validação de entrada (275) e orquestração (291).
- Testes: `runner.test.mjs` (232), `runner-gates.test.mjs` (121) e `runner-runtime.test.mjs` (95). Cada arquivo permanece dentro de 300 linhas não vazias.

O runner carrega o cache local do perfil baseline com Transformers.js 4.3.1 e LFM2.5-350M-ONNX Q4; não permite modelos remotos, usa `local_files_only`, CPU, 2 threads intra-op, 2 inter-op, `do_sample:false` e `max_new_tokens:4`. As opções A/B e os gates vêm do plano congelado. O runner usa apenas variantes congeladas e não recalcula candidatos do estudo a partir de gerações atuais. As chamadas são seriais e o pipeline é descartado em `finally`.

A identificação/checkpoint incorpora digests das entradas congeladas e módulos do runner, prompts, runtime, hashes dos assets, parâmetros, IDs/ordem dos casos e, no full, o fingerprint do piloto. Um checkpoint incompatível é rejeitado. Cada caso concluído é gravado atomicamente no diretório Temp da execução.

Fidelidade dos dados históricos verificada:
- 62 casos: 49 decisões congeladas e 13 no-call; todas as respostas históricas selecionaram índice 1.
- 23 flags suggestion-only derivadas das respostas antigas são cruzadas com a fixture; os 5 `expectedIndex:null` da evidência mantêm o valor histórico separado do gold da fixture. No-call não é contabilizado como acerto.
- Coorte natural: 25 = 23 históricos + controles C3/C5; baseline 0/23 históricos e 2/2 controles = 2/25.
- Piloto exige cobertura exata e única dos 16 IDs com status decision. Full exige cobertura exata/única dos 62 IDs e separa 49 decision / 13 no-call. Errors e inválidos são agregados também na condição reversed; o formato público mantém campo `invalid` normalizado.
- Testes de integração usam provider falso atravessando o evaluator produtivo e o formato real de record público até os resumos/gates.

## Verificações executadas
Comandos invocados via context-mode em processo sem janela (cwd `C:\Projetos\marc`):

1. `node --import tsx --test C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/runner.test.mjs C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/runner-gates.test.mjs C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/runner-runtime.test.mjs`
   Resultado final do principal: 22/22 testes aprovados, 0 falhas, 0 skipped. Cobrem bytes do baseline, remapeamento/reversão, saídas inválidas e erros, no-call/one-candidate, coerência do snapshot, fingerprint, cobertura faltante/duplicada para piloto e full, erro/invalid reversed, desempate e integração record público → resumo/gate.
2. `node --test --import tsx test/core-memory-query-interpretation.test.ts test/core-memory-query-interpretation-inference.test.ts`
   15/15 testes focados existentes passaram; não executam inferência experimental do runner.
3. `node --check` nos dez arquivos `.mjs`: exit 0.
4. `node --import tsx C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/runner.mjs --validate-inputs`
   Exit 0; 62 casos; `pipelineLoaded:false`; runtime Transformers.js 4.3.1, `onnxruntime-node` 1.30.0. O principal repetiu independentemente esse smoke test e confirmou hashes/runtime/arquivos. Cinco assets locais validados: config (1.443 bytes), tokenizer (3.297.793), tokenizer config (3.269), grafo Q4 (183.442) e dados externos Q4 (293.629.952; SHA-256 `71ec6ad38a4c463dcb3dba671d06a1d9861be3a23e51290d818b95c0b7d2a5db`). A validação leu e calculou hash do arquivo de dados, sem carregar os pesos no runtime.

## Execução reservada ao principal após autorização separada
Executar em processos distintos e sequenciais via context `spawnSync`, com `windowsHide:true`; não iniciar concorrência:
```text
node --import tsx C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/runner.mjs --phase pilot
node --import tsx C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/runner.mjs --phase full --prompt A
```
Usar B no segundo comando somente se o gate do piloto escolher B. Os checkpoints ficam em `C:/Users/junior/AppData/Local/Temp/marc-prompt-study-57488bab-20261013/runs/lfm350m-prompt-study-57488bab-20261013/` (`pilot-checkpoint.json`, `full-A-checkpoint.json` ou `full-B-checkpoint.json`).

Orçamento teórico: piloto, 16 IDs × 6 condições seriais, até 96 tentativas iniciais; full, 49 decisões × 3 condições = 147 gerações iniciais, até 294 contando uma repetição produtiva por decisão/condição. `max_new_tokens=4`; 13 no-call não exigem geração. São limites de desenho, não medições. Tempo, RAM e CPU efetivos não foram medidos; o principal planeja capturá-los durante a execução autorizada.

## Ressalvas
Uma chamada MCP de recuperação de contexto ocorreu durante a preparação; não foi repetida. Conforme orientação do principal, isso não invalida o piloto. Nenhum candidato do estudo foi recalculado; essa chamada ficou fora do fluxo e dos dados do runner. Também ocorreu anteriormente uma invocação acidental de PowerShell apenas para ler instruções de skill; não foi usada para editar ou operar no repositório e não se repetiu nesta validação.

A entrega não autoriza inferência experimental. Aguardar revisão final independente e autorização explícita do principal para o piloto.
