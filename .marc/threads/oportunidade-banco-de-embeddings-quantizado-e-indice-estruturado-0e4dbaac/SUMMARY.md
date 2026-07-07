# Resumo executivo

Thread: `oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac`
Closed: `2026-07-07T00:55:19.196Z`

## Objetivo

Criar uma memory semantica local e compartilhavel entre agentes a partir dos `SUMMARY.md` das threads do mARC, preservando Markdown como fonte da verdade e materializando apenas uma snapshot derivada em LanceDB.

## Contexto

A motivacao central foi permitir que agentes em diferentes ferramentas, CLIs e IDEs consultem rapidamente decisoes historicas do projeto sem depender de memoria proprietaria de um unico agente. O recurso implementado e uma camada de recuperacao semantica auxiliar ao harness mARC, nao uma reducao do mARC a RAG.

O exemplo usado para validar o fluxo foi uma solicitacao futura sobre rotacao de token da interface. A memory deve ajudar o agente a descobrir a decisao historica registrada em marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3 antes de propor uma mudanca que contradiga o rumo ja decidido.

## Decisoes

- A v1 indexa apenas `.marc/threads/*/SUMMARY.md`.
- `CHAT.md`, artifacts, docs e rules ficaram fora do corpus inicial.
- `.marc/memory` e uma snapshot derivada, commitavel e reconstruivel.
- O modelo local nao e commitado; ele fica em cache local sob `.marc/cache/memory-models`.
- O provider de embeddings nasceu atras de uma interface/adaptador para evitar lock-in.
- A implementacao concreta v1 usa provider local com Transformers.js e store LanceDB.
- `memory_prepare` prepara o modelo local explicitamente.
- `memory_status` nao carrega o modelo; apenas reporta estado.
- `memory_rebuild` gera a snapshot a partir dos summaries.
- `memory_recall` consulta historico semantico e orienta leitura da thread original antes de reabrir ou contradizer decisoes historicas.
- O `marc-ops` gerado passou a orientar agentes a usar `memory_recall` antes de propor ou desenvolver mudancas que possam sobrepor decisoes historicas.

## Implementacao

- Adicionado nucleo `src/core/memory/` com scanner de summaries, tipos, provider local, operacoes e store LanceDB.
- Adicionadas tools MCP `memory_prepare`, `memory_status`, `memory_rebuild` e `memory_recall`.
- Adicionados comandos CLI equivalentes em `marc memory status|prepare|rebuild|recall`.
- `workspace_status` passou a incluir health resumido de memory no core.
- `src/core/marc-ops-skill.ts` passou a gerar instrucoes de uso de `memory_recall`.
- Documentacao adicionada em `docs/memory.md`.
- README e `docs/mcp-tools.md` foram atualizados com o fluxo de memory.
- Testes adicionados em `test/core-memory.test.ts` e `test/mcp-memory.test.ts`.
- A snapshot `.marc/memory` foi gerada com 27 summaries indexados.

## Validacao

- `pnpm run validate`: passou.
- `pnpm test`: passou com 91/91.
- `pnpm build`: passou, mantendo apenas o aviso conhecido do Vite sobre chunk maior que 500 kB.
- `memory_prepare`: preparou o provider local `Xenova/paraphrase-multilingual-MiniLM-L12-v2`.
- `memory_rebuild`: retornou `ready` com 27 summaries e 27 registros indexados.
- `memory_status`: retornou `ready`, sem stale, com modelo preparado.
- `memory_recall` para `implementar rotacao de token da interface`: encontrou marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3 e orientou `thread_read` antes de reabrir ou contradizer a decisao.
- `workspace_audit` preflight da thread: 0 achados.

## Ajustes encontrados durante validacao real

- A busca LanceDB precisou usar `vectorSearch(...).distanceType("cosine")` para alinhar a metrica ao contrato do provider.
- O scanner de summaries passou a normalizar `Thread: marc://$...` para evitar referencias duplicadas como `marc://$marc://$...`.

## Continuidade

Tres novas oportunidades foram abertas para evoluir a v1:

- Indicador visual de memory na interface: marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6
- Processamento em background para gerar memory: marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa
- Tuning de recall e ranking da memory: marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

## Estado final

A thread foi concluida com a primeira versao funcional de memory semantica local sobre summaries, acessivel por MCP e CLI, validada com provider/store reais e com snapshot LanceDB commitavel em `.marc/memory`.
