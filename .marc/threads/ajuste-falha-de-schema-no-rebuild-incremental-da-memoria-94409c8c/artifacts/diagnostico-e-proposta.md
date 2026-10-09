# Diagnóstico e proposta — falha de schema no rebuild incremental

## Estado e escopo

Diagnóstico confirmado em 2026-10-09. Correção pendente de desenvolvimento. O usuário pediu avaliação e, se necessária, registro de uma thread de ajuste. Informou também que a entrega de criação de threads pela UI ainda não foi commitada. Esta investigação preservou esse desenvolvimento: nenhum arquivo-fonte, dependência, configuração ou histórico Git foi alterado; nenhum novo rebuild, purge ou restart foi disparado.

O principal usou o perfil codex-software-architect. A investigação seguiu marc-ops e systematic-debugging, com inspeção e reprodução por context-mode; find-docs/Context7 foi usado para consultar o contrato oficial de LanceDB. O bootstrap conhecido é marc-dd422176e1, C:\Projetos\marc. Recomendações já atuais. Não houve delegação de implementação.

## Relato e evidência operacional

O usuário clica para gerar a memória incremental com batch 4. A UI exibe processamento e, ao terminar, passa a degraded; nenhuma request aparece como erro no Network do navegador.

GET autenticado /api/status no daemon em http://127.0.0.1:4187 retornou HTTP 200, daemon ready e PID 30284. O módulo de memória desse mesmo daemon retornou:

- status: degraded;
- rebuilding: false;
- embeddingBatchSize: 4;
- summaryCount: 44;
- indexedSummaryCount: 43;
- lastError: Failed to infer data type for field sectionTitle at row 0. Consider providing an explicit schema.

O erro foi confirmado novamente após as reproduções em memória. A geração comprometida continuou 20261009143846983_6fe5aae1. A summary da entrega recém-encerrada não foi incorporada; a geração anterior continua disponível. O daemon não caiu.

As tools memory_status/workspace_status chamadas pelo processo MCP mostraram stale sem lastError, enquanto a API do daemon mostrou degraded. O erro do background é mantido no reconciliador do processo que executou o trabalho; a leitura direta do daemon foi decisiva para observar a falha real da UI.

## Causa confirmada

1. A reconciliação lê os registros da geração existente e preserva aqueles das summaries sem alterações.
2. A primeira linha real consultada na geração comprometida tem kind identity e sectionTitle null. A coluna existente é Utf8 anulável.
3. memoryVectorRecordFromStored copia sectionTitle sem normalizar o null vindo do Arrow, embora o contrato TypeScript seja opcional string.
4. A nova geração junta os registros preservados com os registros alterados e chama LanceDB createTable sem schema explícito.
5. LanceDB 0.31.0 tenta inferir o tipo a partir da primeira linha; null não fornece um tipo para sectionTitle. A conversão de dados falha antes da publicação do manifest.

Referências inspecionadas:

- src/core/memory/lancedb-store-support.ts:109 — cópia de sectionTitle da linha persistida;
- src/core/memory/lancedb-store.ts:61 — readRows;
- src/core/memory/lancedb-store.ts:81 — createTable recebe mode overwrite, sem schema;
- src/core/memory/rebuild-operations.ts:65 — preservação de linhas existentes;
- src/core/memory/rebuild-operations.ts:73 — união de linhas preservadas e novas;
- src/core/memory/rebuild-operations.ts:97 e 105 — store antes da publicação de manifest;
- src/core/memory/background.ts:191 e 130 — captura de lastError e projeção degraded;
- src/daemon/memory-routes.ts:140 — aceitação HTTP 202 do trabalho em background.

O tamanho do batch controla as chamadas de embeddings. O erro observado ocorre depois, na conversão/publicação da tabela, e foi reproduzido sem executar embeddings. Reduzir o batch não resolve esta causa.

## Reprodução isolada

Foi chamada a função makeArrowTable da versão instalada de LanceDB, somente em memória, sem criar tabelas ou alterar o índice:

- Primeira linha com sectionTitle null, seguida de uma string: reproduz exatamente o erro do daemon.
- Primeira linha com sectionTitle undefined, seguida de uma string: passa e infere Utf8 anulável.
- Primeira linha com string, seguida de null: passa.
- Primeira linha com null e schema explícito Utf8 anulável: passa, preservando o null e as duas linhas.

O controle de schema explícito usou o Apache Arrow já instalado como peer de LanceDB. Uma tentativa inicial de resolver esse peer pelo caminho do symlink não funcionou no sandbox; a resolução pelo caminho real do pacote pnpm permitiu executar o controle. Essa dificuldade foi apenas do script de diagnóstico e não é a falha do produto.

Consulta de leitura à tabela real confirmou as três primeiras linhas: identity/null, passage/Resultado e passage/Objetivo e decisões. Nenhum conteúdo autoral precisou ser alterado para reproduzir a falha.

Documentação oficial consultada via Context7: [makeArrowTable com schema explícito](https://github.com/lancedb/lancedb/blob/main/docs/src/js/functions/makeArrowTable.md).

## Por que o Network não mostra erro

O endpoint valida e aceita o pedido de background com 202. A operação assíncrona falha posteriormente; BackgroundMemoryReconciler captura a exceção e expõe lastError e degraded nas leituras de status. As requests continuam bem-sucedidas porque o transporte está funcionando. O estado mostrado pela UI corresponde a uma falha real do rebuild, não a um erro HTTP que a UI ocultou.

## Lacuna de testes

test/core-memory-reconciliation.test.ts usa InMemoryMemoryVectorStore e providers fake; não reproduz a conversão Arrow de um registro persistido com null. test/core-memory-lancedb-hybrid.test.ts usa LanceDB real, mas só cria a tabela com registros novos que têm sectionTitle undefined nas identidades, sem round trip seguido de reconciliação. A combinação que falha ficou descoberta.

## Proposta de ajuste

Estabilizar o contrato dos campos opcionais na fronteira de armazenamento, para a publicação não depender do valor ou da ordem da primeira linha. Avaliar schema explícito compatível com a geração atual e a normalização de valores null lidos para o contrato opcional do domínio. A decisão concreta deve preservar a semântica dos registros e o schema persistido vigente; não trocar null por texto de conteúdo apenas para contornar a inferência.

Escopo candidato da correção:

- src/core/memory/lancedb-store.ts;
- src/core/memory/lancedb-store-support.ts;
- test/core-memory-lancedb-hybrid.test.ts;
- test/core-memory-reconciliation.test.ts;
- docs/memory.md, somente se o contrato de armazenamento exigir esclarecimento.

Antes de implementar, preparar o handoff delimitado, confirmar alvos/estado atual e executar preflight. Preservar o trabalho ainda não commitado de criação de threads; não usar Git, limpeza de gerações, migração, reset ou rebuild full como efeito lateral do ajuste. Manter SUMMARY.md como fonte de verdade e o manifest publicado somente após validação da nova geração.

## Critérios de aceite e validação futura

- Teste com LanceDB real: criar geração com identity sem sectionTitle, ler de volta null, alterar/adicionar uma summary e reconciliar com batch 4 mantendo linhas preservadas antes das novas.
- Publicação deve passar independentemente de a primeira linha ter metadado opcional ausente; preservar textos, referências, vetores e índices lexicais existentes.
- Testar reconciliação sem delta, mudança, inclusão e remoção; embeddings somente para summaries alteradas.
- Em falha de publicação, preservar manifest e geração anterior; não reportar ready falsamente.
- Validar incremental após correção, observando transição rebuilding para ready, sem lastError, e contagens fonte/indexada iguais. Uma execução no workspace real deve ser coordenada como validação operacional, após testes isolados e revisão.
- Executar pnpm validate, pnpm build e pnpm test no desenvolvimento, inspecionando os efeitos de code:fix sem reverter trabalho do usuário. Esses checks não foram executados nesta investigação, que não alterou código.

## Histórico preservado

memory_recall literal retornou decisões fortes; os resumos referenciados foram lidos antes da proposta. A correção deve manter processamento incremental, batches sequenciais, lock global por workspace, geração/manifest transacionais e lifecycle dos providers.

marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682

marc://$oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99

marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4

Entrega anterior a preservar: marc://$oportunidade-criacao-de-threads-pela-ui-0845d0bb
