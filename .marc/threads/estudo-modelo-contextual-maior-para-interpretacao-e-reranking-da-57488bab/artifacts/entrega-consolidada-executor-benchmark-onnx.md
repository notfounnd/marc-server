# Entrega consolidada: executor isolado de benchmark ONNX

## Escopo e autoria

- Thread: estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab.
- Implementação sob o perfil compartilhado `codex-dev`; workspace `marc-dd422176e1`, raiz `C:/Projetos/marc`.
- Modelo solicitado: `gpt-6-luna`; reasoning `xhigh`, confirmado pelo humano para este loop.
- Escopo final: quatro scripts de benchmark, fixtures e três arquivos de teste. A correção de max-lines alterou apenas os testes; os quatro scripts permaneceram intocados nesta correção.
- Nenhum Git, instalação, alteração de configuração produtiva ou escrita no cache `.marc`.

## Implementação e referências

- [scripts/memory-interpreter-benchmark.ts](scripts/memory-interpreter-benchmark.ts:113) oferece CLI para `--prepare`, `--smoke` e `--run`; leitura do snapshot/geração e hidratação dos casos em 194, 239 e 310; seleção declarativa de ações em 341; validação de identidade do cache em 425; execução isolada do worker em 542. Workspace info, manifest e rows são consultados sem inicialização/rebuild/purge/configuração produtiva.
- [scripts/memory-interpreter-benchmark-support.ts](scripts/memory-interpreter-benchmark-support.ts:24) fixa duas threads por perfil e geração determinística de quatro tokens; captura de saída com logs limitados a 4.000 caracteres preservando o payload completo em 43; perfis/revisões fixados em 187; fingerprint dos casos hidratados e configuração em 222/245; contrato de inferência e avaliação em 304/315; proteção de caminhos Temp e checkpoints em 397/445/462.
- [scripts/memory-interpreter-benchmark-worker.ts](scripts/memory-interpreter-benchmark-worker.ts:189) carrega o pipeline uma vez por processo/perfil; casos sequenciais e provider em 217/253; marcador e identidade do cache em 335/362; checkpoints retomáveis com fingerprint em 387/401. O worker encerra o pipeline em `finally`, mede duração/RSS quando disponível e usa apenas os grafos textuais Qwen.
- [scripts/memory-interpreter-benchmark-cases.ts](scripts/memory-interpreter-benchmark-cases.ts:30) preserva 30 consultas históricas; controles em 443; matriz declarativa congelada em 531; guards naturais em 953; registro da revisão gold em 982 e suites em 988.
- [test/memory-interpreter-benchmark.test.ts](test/memory-interpreter-benchmark.test.ts:12) mantém interpretação, seleção/sugestão-only, erros/fallbacks, no-call e candidatos gerados a partir das rows fornecidas.
- [test/memory-interpreter-benchmark-contract.test.ts](test/memory-interpreter-benchmark-contract.test.ts:21) contém pins/revisões, fingerprint, logs, gold aprovado, preservação do replay e contrato de prompt/geração.
- [test/memory-interpreter-benchmark-storage.test.ts](test/memory-interpreter-benchmark-storage.test.ts:20) cobre checkpoints e isolamento com filesystem Temp real.

Os perfis fixam baseline `onnx-community/LFM2.5-350M-ONNX` local/read-only, Qwen `onnx-community/Qwen3.5-0.8B-ONNX-OPT` na revisão `969350d5f4647ec9ac277110f8974c65d8c10e4b`, e LFM `LiquidAI/LFM2.5-1.2B-Instruct-ONNX` na revisão `10f72e70abf67ac0fd7ebf15bc5854726891d864`. O Qwen usa somente `embed_tokens` e `decoder_model_merged`, sem vision. Os perfis compartilham a mesma geração/prompt/export e feedback/retry do harness. A correção de fallback não pontua como resposta correta do modelo.

## Gold e testes

A matriz previamente revisada não foi alterada após aprovação: 24 pares, 12 positivos/12 negativos, oito por idioma (en/es/pt), incluindo typo contextual legítimo, accent-only rejeitado, vizinhos semânticos, identificadores, números, negação, gramática, termos técnicos, invoice/involve e suggestion-only. O replay preserva as 30 consultas originais e os 8 controles: os naturais exigem ausência de sugestão; C3 é suggestion-only em `toogle`; C5 aplica `brutalismp`; controles literais não fazem chamada.

A suíte foi distribuída sem mudar os cenários:
- Original: 5 testes semânticos/fallback.
- Contract: 6 testes de configuração, identidade, logs, gold, replay e prompt.
- Storage: 2 testes de persistência e isolamento Temp.

## Validação executada

- `pnpm exec tsx --test test/memory-interpreter-benchmark.test.ts test/memory-interpreter-benchmark-contract.test.ts test/memory-interpreter-benchmark-storage.test.ts`: 13/13 passaram; zero falhas/skips.
- ESLint scoped nos três arquivos: passou.
- `pnpm exec prettier --ignore-path .gitignore --check` nos três arquivos: passou.
- `pnpm run typecheck`: passou sem diagnósticos.
- TypeScript program com roots do projeto mais os quatro scripts e três testes: zero diagnósticos, incluindo explicitamente o entrypoint worker.
- AST e tamanho: original 170 linhas não vazias; contract 254; storage 104. Todos abaixo do limite 300. Nos três arquivos: zero `if`, `else`, `switch`, ternário ou skip.
- `--help` da CLI já havia terminado com exit 0; não carrega modelo.

## Limites, riscos e revisão pendente

- O `pnpm validate` independente anterior falhou exclusivamente pelo limite max-lines no teste original de 519 linhas não vazias. O split agora passa no ESLint scoped; não rodei novamente o formatter/lint global, nem `pnpm validate`, `pnpm build` ou `pnpm test` completos. Esses checks ficam para o principal, conforme combinado.
- Não baixei pesos nem executei prepare, smoke ou benchmark real. O principal informou que iniciou somente o prepare do cache Qwen isolado, sem casos ou outputs de modelo; esta entrega não executou nem verificou esse processo. Não iniciar outro prepare concorrente.
- A revisão integrada anterior do principal não encontrou achados nos cinco arquivos então revisados. Como esta correção posterior moveu testes para dois arquivos novos, a revisão técnica do estado final e os checks globais ainda dependem do principal. Não há bloqueio para receber esta entrega, mas a autorização para avaliação real continua condicionada à revisão/checks finais.
- Identidade dos assets ONNX, sucesso dos downloads, comportamento runtime e memória/peak RSS em modelos reais continuam não verificados. Execução é sequencial, dois CPU threads por perfil; não há timeout curto automático. A preparação de LFM e sua avaliação aguardam autorização própria.
- O plano oficial atualizado autorizou estes dois novos caminhos de teste. O snapshot/hash de arquivos preexistentes protegido pelo principal não foi tocado; não rodei Git.

## Comandos para a fase do principal

Usar Bash e caminhos exclusivos em Temp. Cada ação deve ter arquivo `--result` distinto. O cache baseline permanece apenas leitura. O cache Qwen abaixo é o informado pelo principal; não repetir o prepare se o processo dele ainda estiver ativo.

```bash
ROOT='C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013'

pnpm validate
pnpm build
pnpm test

pnpm exec tsx scripts/memory-interpreter-benchmark.ts --run --profiles baseline --suite all --result "$ROOT/baseline-run.json"

pnpm exec tsx scripts/memory-interpreter-benchmark.ts --prepare --profiles qwen08b --cache-dir "$ROOT/models" --result "$ROOT/qwen-prepare.json"
pnpm exec tsx scripts/memory-interpreter-benchmark.ts --smoke --profiles qwen08b --cache-dir "$ROOT/models" --result "$ROOT/qwen-smoke.json"
pnpm exec tsx scripts/memory-interpreter-benchmark.ts --run --profiles qwen08b --suite all --cache-dir "$ROOT/models" --result "$ROOT/qwen-run.json"

pnpm exec tsx scripts/memory-interpreter-benchmark.ts --prepare --profiles lfm12 --cache-dir "$ROOT/lfm12/models" --result "$ROOT/lfm12-prepare.json"
pnpm exec tsx scripts/memory-interpreter-benchmark.ts --smoke --profiles lfm12 --cache-dir "$ROOT/lfm12/models" --result "$ROOT/lfm12-smoke.json"
pnpm exec tsx scripts/memory-interpreter-benchmark.ts --run --profiles lfm12 --suite all --cache-dir "$ROOT/lfm12/models" --result "$ROOT/lfm12-run.json"
```

A preparação de Qwen já foi iniciada pelo principal; os comandos de inferência e as fases LFM ficam para depois dos checks/revisão e das autorizações aplicáveis. Manter um único processo de perfil por vez.
