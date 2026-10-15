# Entrega consolidada: carregamento offline-local-v2

## Handoff
Implementação do complemento concluída dentro dos sete caminhos autorizados, com alteração efetiva em seis: CLI, support, worker e os três testes. O arquivo de casos foi apenas verificado pelo Prettier e permaneceu inalterado. Nenhum outro arquivo foi editado.

Execução: perfil compartilhado codex-dev. Modelo gpt-6-luna e reasoning xhigh conforme confirmação humana anterior; a sessão não expôs introspecção independente desses controles. Workspace marc-dd422176e1 em C:/Projetos/marc. Autorização desta etapa: mensagem humana direta neste loop. O preflight mARC retornou zero achados.

## Implementação
- `--prepare` continua carregando pelo ID remoto e revisão fixada. `--run` e `--smoke` resolvem todos os perfis ao diretório local exato e passam esse caminho ao pipeline público com acesso remoto desabilitado, local_files_only, CPU, q4 e duas threads. A resolução está em scripts/memory-interpreter-benchmark-support.ts:262 e o despacho de origem em scripts/memory-interpreter-benchmark-worker.ts:267.
- Baseline não recebe revisão presumida: seu diretório é cache + `onnx-community/LFM2.5-350M-ONNX`. Qwen e LFM1.2B acrescentam a revisão fixada. Perfis declaram config, tokenizer e caminhos ONNX completos em scripts/memory-interpreter-benchmark-support.ts:188.
- O worker valida os arquivos obrigatórios dentro do diretório selecionado antes de run/smoke e após prepare. A verificação compara caminhos relativos, não basenames encontrados em qualquer lugar do cache: scripts/memory-interpreter-benchmark-worker.ts:105 e :391. Qwen exige somente embed_tokens e decoder_model_merged, incluindo seus arquivos de dados.
- O marcador experimental existente não ganhou versão ou estratégia nova. A validação preserva e confere profileId, modelId, revisão e cacheDirectory resolvido em scripts/memory-interpreter-benchmark-support.ts:276; parent e worker usam esse contrato. Checkpoint e resultado recebem a estratégia `offline-local-v2` na assinatura em scripts/memory-interpreter-benchmark-support.ts:29 e :238. Assim, resultados/checkpoints com fingerprint anterior são rejeitados sem invalidar ou migrar pesos/tokenizers.
- Smoke exige exatamente o fixture revisado, status `decision` e índice inteiro dentro de variants. Não exige modelCorrect: um resultado semântico incorreto ainda é uma decisão de execução válida para smoke. `invalid-output`, `provider-error`, `no-call` e decisões sem índice válido falham com mensagem explícita. Resultado/checkpoint é gravado antes da validação, e o gate também é aplicado ao retomar resultado já salvo: scripts/memory-interpreter-benchmark.ts:265, :299 e scripts/memory-interpreter-benchmark-support.ts:372, :393. As falhas avaliadas continuam registradas pelo worker; fallback não é pontuado como resposta correta.
- Prompts, feedback, retry, geração determinística de quatro tokens e gold não foram alterados.

## Evidência e validação
- TDD: as regressões novas falharam antes da implementação nos contratos ausentes de assinatura, caminhos, marcador, ativos e gate; depois passaram.
- Testes focados: 18/18, zero falhas, zero skips.
- ESLint nos sete caminhos autorizados: passou.
- Prettier `--ignore-path .gitignore --check` nos sete caminhos: passou.
- `pnpm run typecheck`: passou.
- Typecheck ampliado com CLI, support, worker, cases e os três testes como roots: zero diagnósticos.
- AST dos três testes: zero if, ternários, switch ou calls skip/todo. Linhas não vazias: 269/291/285, abaixo do limite 300.
- AST dos quatro scripts: zero else e zero if aninhados.
- CLI `--help`: exit 0 e exibiu ações/options, sem carregar modelo.
- Inspeção somente-leitura: o marcador Temp existente de LFM1.2B mantém exatamente profileId/modelId/revision/cacheDirectory anteriores e não contém versão de loader. O diretório baseline contém config, tokenizer e modelo q4; o diretório Qwen da revisão pinada contém apenas os dois gráficos textuais q4 e os respectivos arquivos de dados.

## Limites e próximo passo
Não executei download, prepare, smoke, benchmark nem inferência. Não rodei pnpm validate/build/test; o principal fará essas verificações globais e a execução real. Não usei Git. O cache produtivo baseline permaneceu somente-leitura. Nenhum documento foi alterado por causa do escopo fechado.

O impedimento nativo conhecido do Qwen (`com.microsoft:CausalConvWithState` ausente no onnxruntime-node 1.24.3) não é corrigido por esta mudança; carregar do diretório local resolve a descoberta do tokenizer, não a compatibilidade do operador.

Comandos locais para a fase principal, usando resultados separados em Temp:

```bash
pnpm exec tsx scripts/memory-interpreter-benchmark.ts --smoke --profiles baseline,lfm12 --cache-dir 'C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013/models' --result 'C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013/results/offline-local-v2-smoke.json' --workspace 'C:/Projetos/marc'

pnpm exec tsx scripts/memory-interpreter-benchmark.ts --run --profiles baseline,lfm12 --suite all --cache-dir 'C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013/models' --result 'C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013/results/offline-local-v2-all.json' --workspace 'C:/Projetos/marc'

pnpm exec tsx scripts/memory-interpreter-benchmark.ts --smoke --profiles qwen08b --cache-dir 'C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013/models' --result 'C:/Users/junior/AppData/Local/Temp/marc-interpreter-eval-57488bab-20261013/results/offline-local-v2-qwen-smoke.json' --workspace 'C:/Projetos/marc'
```

Entrega pendente de revisão integrada pelo principal.