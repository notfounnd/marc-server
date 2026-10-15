# Entrega consolidada: identidade e compatibilidade do runtime 4.3.1

## Escopo e contexto

Executor: perfil `codex-dev`; configuração confirmada pelo humano: `gpt-6-luna` / reasoning `xhigh`. Workspace `marc-dd422176e1`, raiz `C:\\Projetos\\marc`.

A execução comparada pelo principal observou que Transformers.js 4.2.0 reproduziu exatamente os 338 vetores persistidos, enquanto 4.3.1 diferiu em todos (similaridade cosseno mínima 0,9954012463639351; diferença absoluta máxima 0,014543144963681698). Para tornar incompatibilidade explícita, a entrega consolida a identidade do provider e a proteção do reconcile incremental.

## Alterações

Somente os três caminhos autorizados foram alterados:
- `src/core/memory/model-config.ts:12`: `MEMORY_MODEL_VERSION` agora é `transformers-js-4.3.1`; os três providers continuam derivando a metadata da mesma constante.
- `src/core/memory/rebuild-operations.ts:16`: importa o comparador existente `memoryProvidersMatch`.
- `src/core/memory/rebuild-operations.ts:56`: após o schema/retrieval-contract gate existente, `reconcileMemory` rejeita provider incompatível com erro que exige full rebuild explícito. Esse early throw ocorre antes de materializar fontes, retornar no-op, ler linhas, embutir ou publicar geração.
- `test/core-memory-runtime-version.test.ts`: regressões para metadata dos três providers e `env.version`; comparação da identidade antiga/atual; incompatibilidade em no-op e em fonte alterada; preservação do manifesto, geração e linhas, sem chamadas a readRows/materialização/embedding na rejeição; e recuperação por full rebuild explicitamente chamada no fixture Temp, com nova versão, nova geração e todos os record IDs re-embutidos.

A alteração não converte incremental em full automaticamente. `status.ts`, dispatcher, operações full, modelos, pesos, recipes, manifestos e produção não foram modificados.

## Evidência RED/GREEN

Com os testes de incremental adicionados e antes do guard, os dois cenários de mismatch falharam por ausência da rejeição; o teste de full explícito passou. Depois do guard, os cinco testes passaram. Os fixtures usam workspace temporário, providers/reranker fakes e store em memória, com limpeza do workspace temporário pelo próprio teste.

## Verificações

- Focado: `pnpm exec tsx --test test/core-memory-runtime-version.test.ts` — 5/5 aprovados, zero skips.
- Typecheck scoped passou incluindo `model-config.ts`, `status.ts`, `rebuild-operations.ts` e o teste.
- ESLint scoped passou nos três arquivos autorizados.
- Prettier scoped passou nos três arquivos autorizados.
- AST do teste: 215 linhas não vazias, zero if/else, switch, ternário ou skips.
- O teste confirma `env.version === 4.3.1`.

Não rodei validate/build/test globais, rebuild/prepare/purge produtivos, download, inferência de modelos ou Git. Full rebuild foi exercitado somente no fixture temporário com doubles determinísticos.

## Hashes finais

- `src/core/memory/model-config.ts`: `ab8140a11a28d13c06cbad2918a48b6217c5941619a33f54539f8c3c375c47ea`
- `src/core/memory/rebuild-operations.ts`: `96937c65291999e36509778fc7cc7a386021a11acf761c63fe7e3a2457f9b327`
- `test/core-memory-runtime-version.test.ts`: `8133b37480bf2eb878f09309d4ef1714b5e10c361676c7a96ca793f3f150de61`

## Revisão e operação

Revisão integrada, checks globais e conferência do guard diante da base real continuam com o principal. A alteração protege novas reconciliações; não migra dados existentes. O restart e full rebuild produtivo permanecem ações explícitas do operador, após revisão e coordenação humana.