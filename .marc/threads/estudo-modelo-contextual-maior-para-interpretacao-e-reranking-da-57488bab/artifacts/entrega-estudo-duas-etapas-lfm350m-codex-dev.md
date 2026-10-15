# Entrega: Estudo LFM350M em Duas Etapas

## Estado e escopo

Implementação isolada e validação fake concluídas no root autorizado:
`C:/Users/junior/AppData/Local/Temp/marc-two-stage-study-57488bab-20261013/`.

Os 19 arquivos (10 módulos e 9 testes) pertencem somente a esse root. Repositório, .marc/memory/cache, pesos e root do estudo anterior foram usados apenas como fontes de leitura. Nenhum Git, edição produtiva, alteração de prompt/gold/gates ou recálculo de candidatos do estudo foi feito. O workspace audit preflight retornou zero findings.

Nenhuma inferência experimental, pipeline ou worker foi executado. O memory_recall pre-study realizado pelo principal é o já declarado no handoff; não foi repetido. Perfil executante: codex-dev, gpt-6-luna/xhigh confirmado pelo humano.

## Implementação

- `protocol.mjs` e `role-runner.mjs`: três contratos congelados, parsing trim+uppercase/exato, no máximo um retry format-only, mensagens e cada tentativa/raw label/erro/duração preservados. Nenhum output de spelling é enviado à intenção.
- `study-matrix.mjs`: baseline fresh e três papéis normais para cada decisão; três papéis invertidos nos 16 stress cases; recomposição das três abordagens sem regenerar respostas ou memoizar entre casos. A guarda exige `variants[0] === query` antes de baseline ou geração. Bypass preserva os 13 no-calls com score nulo.
- `evaluation.mjs` e `study-analysis.mjs`: reutilização do evaluator produtivo, efeitos por caso versus baseline fresh, veto útil/prejudicial e comparação de positivos por caseId, incluindo IDs positivos perdidos contra cada controle.
- `study-inputs.mjs`: fingerprint cobre plano, snapshot, fontes, pesos, runtime, parâmetros, prompts e código novo; SHA do plano fixado em `c2c9507b47b8288bd78ed783e2409ad7204c4ab46894b72aa3c8fdc16b985c77`; modelo e geração congelados; hashes dos helpers antigos runner-core/config/inputs/output/runtime/frozen/runner. Sem import OLD_CONFIG não usado.
- `study-checkpoint.mjs`: escrita atômica sob o root novo e recusa de fingerprint incompatível, duplicatas, IDs ausentes/fora de ordem.
- `study-worker.mjs`: worker sequencial, uma pipeline; checkpoint por caso, recursos/RSS/CPU duráveis, amostras start/after-load/interval/after-dispose, disposal antes do marcador final. Falha antes da pipeline ou em checkpoint/finalização persiste metadata failed para o fingerprint esperado.
- `runner-launcher.mjs` e `runner.mjs`: lock exclusivo por fingerprint com `open(..., "wx")`, recusa de worker ativo/concluído, spawn direto detached com `windowsHide: true`, PID/metadata persistidos, CLI `--help`, `--validate-inputs`, `--launch`.

A matriz física conserva 244 chamadas iniciais (49 baseline + 49×3 papéis + 16×3 stress), acrescidas dos retries realmente feitos. A contagem lógica condicional de intenção é reportada separadamente. A gate usa coortes 12 positivos, 12 negativos, 25 naturais (inclui C3/C5 e 23 históricos) e 13 no-calls; normal e stress entram na verificação de erro/invalid e estabilidade. Critérios e prompts não foram alterados.

## Validação executada

- Node 22.20.0, suíte determinística: **34/34**, sem falhas nem skips, incluindo integração raw roles → evaluator produtivo → records → métricas/gates; retry inválido recuperado continua contando e vetando a gate; casos de positivo perdido por ID; lock com duas tentativas concorrentes; falha de startup persistida; lifecycle clear → dispose → complete; amostra fake after-load.
- `node --check`: 19/19 módulos.
- AST: 9 arquivos de teste sem if/else/switch/ternário/skip/todo; código de produção sem else/nested-if. Todos os 19 arquivos abaixo de 300 linhas não-brancas.
- CLI real `--validate-inputs`: exit 0, `pipelineLoaded: false`, 62/49/13, modelo `onnx-community/LFM2.5-350M-ONNX`, Transformers 4.3.1, onnxruntime-node 1.30.0, CPU 2+2, q4, remoto off/local-only, `do_sample: false`, `max_new_tokens: 4`; cinco assets locais identificados. Nenhuma inferência.

## Arquivos e referências

- `study-inputs.mjs:17, 86-96` — hashes dos sete helpers, snapshot/modelo/plano e identidade.
- `study-matrix.mjs:14-18, 50-66, 105-122` — mapping original/proposed, ordem/calls e custos.
- `evaluation.mjs:182` (`evaluatePromisingGate`), `:203` (`compareControl`, com `lostPositiveCaseIds` em `:206`) e `:211` (`evaluateTwoStageComparison`) — gates normal+stress e perdas positivas por ID.
- `study-analysis.mjs:35-58` — resumos, comparação e efeitos por caso.
- `study-checkpoint.mjs:18-62` — atomicidade e compatibilidade.
- `study-worker.mjs:12-37, 67-72, 86-224` — cleanup, after-load, execução e persistência de falhas.
- `runner-launcher.mjs:32-54, 56-120` — lock e spawn/PID.
- `runner.mjs:6-43` — saída de validação e CLI.
- Testes correspondentes: `protocol.test.mjs`, `role-runner.test.mjs`, `evaluation.test.mjs`, `study-analysis.test.mjs`, `study-inputs.test.mjs`, `study-matrix.test.mjs`, `study-checkpoint.test.mjs`, `study-worker.test.mjs`, `runner-launcher.test.mjs`.

## Comandos e caminhos

Validação já executada:
```bash
C:/nvm4w/nodejs/node.exe --import tsx C:/Users/junior/AppData/Local/Temp/marc-two-stage-study-57488bab-20261013/runner.mjs --validate-inputs
```

Após revisão integrada do principal e autorização experimental separada:
```bash
C:/nvm4w/nodejs/node.exe --import tsx C:/Users/junior/AppData/Local/Temp/marc-two-stage-study-57488bab-20261013/runner.mjs --launch
```

Fingerprint validado: `cd2e9ff7652f7076d1cd7d3d3d6b205c8fcb830d13465a7c970a9fae5908ae4d`.
O launcher deve retornar o PID sem aguardar o estudo. Resultado, checkpoint, metadata e amostras ficam em:
`C:/Users/junior/AppData/Local/Temp/marc-two-stage-study-57488bab-20261013/runs/cd2e9ff7652f7076d1cd7d3d3d6b205c8fcb830d13465a7c970a9fae5908ae4d/`.

## Pendências e limites

Revisão integrada do principal e autorização explícita de execução continuam pendentes. Não há resultados experimentais, RAM/RSS real, latência real ou gate de run para reportar.

Duas pastas de fixture fake `runs/test-launcher-30816-e58b03f6-d5ef-4bd5-8eb1-f9b775c423e3` e `runs/test-launcher-35544-6b240e6d-cb64-40ff-9370-0a5afdc0ee7d` sobraram de testes cuja asserção falhou antes do hook de cleanup. A tentativa de remoção recursiva foi recusada pelo sandbox; não houve nova tentativa. São nomes distintos do diretório de fingerprint final e não representam processos ou inferência. Qualquer remoção requer autorização separada.
