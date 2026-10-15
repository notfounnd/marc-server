# Entrega: Transformers.js 4.3.1 e identidade experimental v3

## Escopo e resultado

Perfil executor: `codex-dev`; configuração confirmada pelo humano: `gpt-6-luna`, reasoning `xhigh`. Workspace `marc-dd422176e1`, raiz `C:\\Projetos\\marc`.

Alterei somente os seis caminhos autorizados:
- `package.json`: dependência direta `@huggingface/transformers` em `^4.3.1`.
- `pnpm-lock.yaml`: regenerado pelo pnpm, sem edição manual.
- `scripts/memory-interpreter-benchmark-support.ts`: estratégia da assinatura passa a `offline-local-v3`; resultados e checkpoints v2 são recusados. Marcador e cache dos modelos não foram versionados nem invalidados.
- `scripts/memory-interpreter-benchmark-worker.ts`: metadado do provider é obtido de `env.version` do módulo Transformers efetivamente importado; nenhum override ou mudança de geração/prompt.
- `test/memory-interpreter-benchmark.test.ts` e `test/memory-interpreter-benchmark-contract.test.ts`: cobrem versão do provider e rejeição da assinatura antiga.

## Resolução efetiva

Verificação local confirmou Transformers.js `4.3.1`; o manifesto instalado declara `onnxruntime-node` `1.30.0`, e a resolução transitiva a partir do pacote HF aponta para essa versão. O lockfile mantém outras versões do ONNX Runtime para consumidores independentes; o resolvedor efetivo do Transformers é 1.30.0. A instalação normalizada de `package.json` reproduziu o hash original observado pelo principal.

Runtime verificado: Node `v24.3.0`. `onnxruntime-node@1.30.0` declara suporte a Node 16+ e recomenda Node 20+; o requisito do projeto é Node 22+, portanto o runtime atual satisfaz ambos.

## Verificações da entrega inicial

- Testes focados: 15/15 aprovados, sem skips.
- Typecheck ampliado: passou incluindo os dois entrypoints de script e os dois testes autorizados.
- ESLint scoped: passou nos quatro arquivos TypeScript autorizados.
- Prettier scoped: passou em `package.json` e nos quatro arquivos TypeScript. O lockfile permaneceu gerado pelo pnpm.
- Testes declarativos: ambos abaixo de 300 linhas não vazias (298 e 291); AST sem if, ternário, switch, skip ou todo.
- Importação pública de `env.version` retornou `4.3.1`, sem carregar modelo.

## Correção após revisão

O teste da versão do provider agora chama `benchmarkWorker.createGenerationProvider` diretamente pela importação de namespace já tipada, sem cast por `Record<string, unknown>` nem assinatura redeclarada. Casts antigos usados por outros testes, incluindo `pipelineSourceForAction`, foram preservados.

Checks focados reexecutados após essa correção:
- Testes do benchmark: 15/15 aprovados, zero falhas e zero skips.
- Typecheck ampliado incluindo support, worker e ambos os testes: passou.
- ESLint scoped no teste alterado: passou.
- Prettier scoped no teste alterado: passou.
- O arquivo do teste ficou com 293 linhas não vazias (antes: 298).

Não rodei `pnpm validate`, build ou suíte global, nem download, prepare, smoke, benchmark ou inferência. Esses passos ficam com o principal.

## Bloqueio/limite de ambiente

O pnpm ignorou o script de build de `onnxruntime-node` por política de aprovação de scripts. Não executei aprovação nem contornei a política. Importação/metadata e resolução do pacote foram verificadas, mas inicialização do binding nativo e smoke ainda não foram verificados nesta entrega. O principal deverá tratar eventual pedido de aprovação do script nativo no fluxo autorizado antes do smoke; não há processo/comando meu aguardando aprovação.

## Integridade e hashes finais

Nenhum Git foi executado. Nenhum modelo, prompt, gold, configuração produtiva ou arquivo fora do escopo foi alterado. O hash do teste abaixo reflete a correção posterior à entrega inicial.

- `package.json`: `e6a42c981fe0bac77bf6a6eeee8cbd6e8d1ab43a3491adde1a750320bbdf4a56`
- `pnpm-lock.yaml`: `354709449deed2c7a52c1d69a062bedd20adc8fb181bae801606d2cbf70d3426`
- `scripts/memory-interpreter-benchmark-support.ts`: `b928481efb25d690e8417310c3e28b5ac4171203de84d72b0a0c64e88e88713c`
- `scripts/memory-interpreter-benchmark-worker.ts`: `eb64f819a7c79bbaff6a0a4ace60e14335891041a8460ba6eee873dac896c82d`
- `test/memory-interpreter-benchmark.test.ts`: `53c3e6c480ade5c014e1b502ba2b1ba6d25bc893045ba3f4933abca14452e0c4`
- `test/memory-interpreter-benchmark-contract.test.ts`: `9995649062f1036592006263de14856d3c09575f58fa0e4e3db1bcbaca96dfae`

## Estado da revisão

Entrega do executor concluída; revisão integrada e checks globais permanecem com o principal. A única limitação conhecida é a aprovação do script nativo do ONNX Runtime, não solicitada por mim.