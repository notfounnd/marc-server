# Relatório consolidado — schema no rebuild incremental

## Escopo e resultado

Implementação executada no workspace `marc-dd422176e1` em `C:\Projetos\marc`, conforme o plano da thread e a autorização do principal. Perfil compartilhado: `codex-dev`. Runtime solicitado: `gpt-6-luna/xhigh`; configuração humana confirmada em `.marc/agents/codex-dev.md`. A configuração efetivamente exposta pelo runtime não pôde ser introspectada.

O rebuild incremental agora grava gerações LanceDB com schema Arrow explícito. As 14 colunas textuais são `Utf8 nullable=true`; `vector` é uma lista fixa anulável de `Float32`, com dimensão inferida dos vetores gerados e elemento anulável. Campos opcionais ausentes são persistidos como null e voltam como ausentes no domínio; strings vazias continuam vazias. Gerações sem registros não criam tabela. A publicação continua ocorrendo somente após a operação e validação da geração. A dependência direta `apache-arrow@18.1.0` foi adicionada.

A regressão usa LanceDB real em workspace temporário. Compara registros estáveis preservados por ID/ordem, texto, referência e vetores; confere tipos e nullability físicos; cobre campos opcionais inteiramente ausentes, mistura de null e string vazia, geração inicialmente vazia, remoção da última SUMMARY sem nova chamada de embedding e falha que preserva o manifesto ativo. O teste de reconciliação em background confere o retorno a ready, contagens de summaries, erro nulo, manifesto e linhas persistidas.

## Evidência red/green e validação

- **RED**, antes da correção. Context-mode, fonte `ctx_execute` / `execute:shell`; label “Confirm the expanded red regression still fails only at the incremental schema inference step”. Comando `node --test --import tsx test/core-memory-lancedb-hybrid.test.ts`, exit 1. Erro: `Failed to infer data type for field sectionTitle at row 0. Consider providing an explicit schema.`
- **Focused green**, após a colocação final das assertions no teste LanceDB real. Context-mode `ctx_execute`, execução Bash via `spawnSync`, JSON compacto sem intent, 2026-10-10T06:45:54.371Z. Comando `node --test --import tsx test/core-memory-lancedb-hybrid.test.ts test/core-memory-reconciliation.test.ts test/core-memory-background.test.ts`, exit 0, 18/18.
- O principal repetiu as verificações no estado final via context-mode/Bash, segundo os resultados registrados: focused 18/18 às 06:46:48Z; `pnpm test` 215/215 às 06:47:02Z; `pnpm validate` exit 0, sem arquivos formatados nem erros, às 06:47:28Z; `pnpm build` exit 0 às 06:48:01Z. O build exibiu apenas o aviso de chunk acima de 500 KB.
- Minha execução final de `pnpm run code:check` via context-mode terminou com exit 0. Sincronização de dependências: `pnpm install --offline --frozen-lockfile --ignore-scripts`, concluída sem rede; o importer da dependência Arrow no lockfile foi conferido.
- Probe independente somente-leitura do principal, 06:49:16Z: a geração incremental temporária respondeu às buscas title/summary/titlePrefix e vectorSearch (3 hits), não expôs null no domínio e passou `validateGeneration`.

## Arquivos e pontos de revisão

- `src/core/memory/lancedb-store.ts` — rebuild incremental e caminho da tabela inicial usam a tabela Arrow explícita (72–85, 203–212).
- `src/core/memory/lancedb-store-support.ts` — forma nullable dos opcionais e normalização null/ausente, schema Arrow e dimensão dos vetores (28–34, 88–125, 150–155).
- `test/core-memory-lancedb-hybrid.test.ts` — round-trip incremental e assertions físicas; null versus string vazia (78–160, 177–203).
- `test/core-memory-reconciliation.test.ts` — preservação em falha e geração vazia, população posterior e remoção da última SUMMARY sem novo embedding (118–221).
- `test/core-memory-background.test.ts` — reconciliação LanceDB real e assertions de health no teste correto (108–155).
- `docs/memory.md` — contrato de schema, null versus string vazia e geração vazia (105).
- `package.json` — dependência direta Arrow (55); `pnpm-lock.yaml` — importer e pacote Arrow (47, 1753, 4781).

A documentação foi atualizada; scripts de pacote foram preservados. Nota de hash: o hash inicial de `package.json` era `e6807b8b339c3bec72ea01b5c40e79ab301ae376b21fd16cbd61fb99a788e67e`. Remover a linha da dependência produz `33cd338234fd641f1d6722b99f0e283f3285bdae85033b3f599d6130752f2ca7`, ainda diferente do original. A comparação de bytes atribui o restante a quatro finais de linha CRLF convertidos para LF nas linhas 52–55 após a remoção; restaurar esses quatro CRLF reproduz o hash inicial. Nenhum ajuste adicional foi feito depois do congelamento do código solicitado pelo principal.

## Integridade dos alvos

SHA-256 por arquivo, calculado em 2026-10-10T06:49:29.479Z:

- `src/core/memory/lancedb-store.ts`: `24d668b01378d30b60fea08532c8f6f2734a5366143a1078eca69a27a4d64b68`
- `src/core/memory/lancedb-store-support.ts`: `18966a2a77397d81e7d42d25e584d24ab63ffdf123e9ec1a03f79e1f47178135`
- `test/core-memory-lancedb-hybrid.test.ts`: `b8862b0d3bf5807b0a10819b1b47e005c2f9f7d3c6a9e15fa6febfdaca931e96`
- `test/core-memory-reconciliation.test.ts`: `431903eb3b9ef3c791a3d5c30f4ac0bb6c63efe5c91b77537ba3ebc2152ec9de`
- `test/core-memory-background.test.ts`: `3eb709332d353c6c5971aef4731090d8ae3c0d96b06168308fa1623e2bf1edfe`
- `docs/memory.md`: `710002b34b606ca9e0a0f993ec0275412451ca7b45c6078a9d58ab827863bf71`
- `package.json`: `af8fa057c11481519caac640fe5daffeb8af0fae96c133d7fb9f641475282351`
- `pnpm-lock.yaml`: `31d120b4697601acd7867ef0038cbbbd478d884fee17ef9d833ac7ffbba244ec`

Hash agregado dos 8 alvos: `c83214624d2b21fef529f27d980289548f23e9a734f0e9376cf7411ec8b9af3f`, calculado como SHA-256 dos caminhos relativos ordenados, cada um seguido por NUL, bytes do arquivo e NUL. O principal informou que manifesto/configuração runtime permaneceram intactos. O hash externo agregado de bootstrap informado pelo principal foi `4fb1208fc4bd2c57862d690693b55ff27e6b617f912d876fb8e6b57c9780fa62`; o principal atribuiu a diferença observada fora dos alvos a um log de runtime preexistente em `.playwright-output`, não a alteração de UI deste trabalho.

## Estado da revisão

A revisão independente do principal aprovou em princípio schema, normalização e guards. A revisão integrada final permanece **pendente do principal**; este relatório registra evidência de execução e não declara aprovação final nem fechamento da thread.
