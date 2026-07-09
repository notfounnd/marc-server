# Oportunidade - Mecanismo de busca sobre o conhecimento do projeto

Thread: `oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd`
Created: `2026-05-24T19:39:17.892Z`

<!-- marc-message
id: msg_d30cfddada7b4140b5
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-05-24T19:39:32.718Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada: mecanismo de busca sobre o conhecimento do projeto.

Relacionamento:
- Esta oportunidade tem fit com marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac.
- O mecanismo de busca é a experiência/contrato de recuperação; embeddings e índice estruturado são uma possível infraestrutura para elevar relevância e escala.

Objetivo:
- Permitir consultar threads, summaries, artifacts, ADRs, regras e agentes por termos, filtros e relevância, retornando fontes rastreáveis sem exigir leitura manual ampla.

Resultados esperados:
- Encontrar rapidamente decisões, bugs anteriores, mudanças e evidências do histórico.
- Apoiar navegação humana na UI e consumo direcionado por agentes/MCP.
- Reduzir reabertura de contexto irrelevante e tornar descobertas reproduzíveis por referências mARC.

Pontos para investigar:
- Escopo v1: busca textual/estruturada, sem depender da camada vetorial para ser útil.
- Evolução híbrida: combinar filtros, full-text e similaridade semântica quando o índice de embeddings existir.
- Fontes, permissões, filtros por tipo/thread/status/data/agente e ordenação de resultados.
- Forma de destacar trechos, retornar referência canônica e abrir o documento original na UI.
- API/MCP necessária, impacto no daemon/UI, cache derivado e atualização incremental após mudanças Markdown.

Critérios de sucesso:
- Resultados vinculam claramente trecho, fonte e referência navegável.
- A busca textual funciona independentemente de embeddings; a busca semântica pode ampliá-la depois.
- Índices continuam derivados e reconstruíveis; Markdown permanece fonte de verdade.
- Testes cobrem relevância mínima, filtros, referências e atualização após alteração das fontes.

<!-- /marc-message -->

<!-- marc-message
id: msg_acf0ad1bcf184a6cb3
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T00:22:22.977Z
agentId: ui-user
role: user
-->

Com a entrega da marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac , algumas coisas se tornam importante mencionar aqui:

- Essa thread trata sobre um sistema de busca na UI.
- A construção da base de conhecimento já estabeleceu o escopo que será indexado na base.
- A ferramenta de busca que fica disponível para o agente via MCP apresentou maturidade desde sua implementação inicial.

Um ícone de busca ficaria ao lado esquerdo do ícone que abre a área de agentes, na coluna do meio.

Idealmente, o fluxo para a ferramenta de busca via UI seria:

- Usuário clica no ícone.
- Coluna do meio se transforma em área de busca (apresenta ali uma caixa para o usuário inserir texto).
- Usuário faz a busca [1].
- Resultados aparecem [2].

Observações:

1. O card da thread é exibido como resulta. Junto dele um pequeno texto também aparece (solicite ao usuário imagem  de exemplo no momento do planejamento do desenvolvimento).

2. Uma decisão importante aqui é escolher em qual momento o resultado aparece.
- Tempo real enquanto o usuário digita.
- Após acionamento de um botão "buscar".
- Híbrido (campo faz a busca alguns segundos após identificar que usuário parou de digitar).

A escolha entre essas opções deve considerar performance.

A viabilidade desse desenvolvimento depende da possibilidade de que esse sistema exista sem um agente tenha tenha que ser conectado na interface (acredito que hoje a tool do MCP apenas consulta termos e retorna o resultado, sem que o agente precise processar tokens além do comando que dispara e consome a tool, ou sem que o modelo local que gera os embedings tenha que estar em funcionamento para isso).

<!-- /marc-message -->

<!-- marc-message
id: msg_e825f3890dd8488382
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T01:55:29.887Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-busca-ui-memory.md
-->

Plano detalhado registrado antes do desenvolvimento: artifacts/plano-busca-ui-memory.md

Escopo confirmado:

- A busca da UI vai reaproveitar o `memory_recall` existente.
- Nao sera criada busca textual paralela nesta entrega.
- A busca so fica acessivel quando a memory estiver `ready` ou `stale`.
- O modo `search` usara `RefreshCw.spin` no header durante o processamento.
- O corpo tera empty states simples, sem `Skeleton` ou `Progress`.
- O ultimo resultado sera preservado em um unico slot de `localStorage`, sobrescrito a cada busca.
- O lifecycle do provider/modelo nao sera alterado nesta thread.

Continuidade registrada separadamente para investigar provider aquecido com TTL curto: marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4.

<!-- /marc-message -->

<!-- marc-message
id: msg_155d643603fb4c6ea8
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T02:42:03.967Z
agentId: codex-dev
role: developer
-->

Desenvolvimento realizado para a busca de conhecimento via memory.

Implementado:
- endpoint daemon `POST /api/workspaces/:workspaceId/memory/recall`, reutilizando `memory_recall` sem depender de agente conectado;
- helpers de UI para disponibilidade da busca apenas quando memory estiver `ready` ou `stale`;
- persistencia compacta da ultima busca no `localStorage`, com sobrescrita por workspace e limite de resultados/texto;
- novo modo `search` na coluna central, com formulario, indicador de processamento, estado vazio, erro, indisponibilidade e cards de resultado navegaveis para threads;
- separacao de componentes/hooks para manter arquivos dentro dos limites do projeto;
- documentacao do fluxo em `docs/memory.md` e `docs/ui-and-daemon.md`;
- testes unitarios para rota daemon e comportamento dos helpers de busca.

Validacao executada:
- `pnpm run validate`
- `pnpm test` (99 testes passando)
- `pnpm build`

Observacao: como houve alteracao de endpoint daemon e bundle da UI, os recursos precisam ser reiniciados para validar a experiencia no navegador. A thread fica aguardando feedback para orientar a finalizacao.

<!-- /marc-message -->

<!-- marc-message
id: msg_95816cfe8d9349d685
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T03:07:05.789Z
agentId: codex-dev
role: developer
-->

Feedback de validacao visual aplicado.

Ajustes realizados:
- botão de submit da busca alinhado à altura do input (`40px`), sem alterar os demais botões compactos de ícone;
- cards de resultado corrigidos para respeitar o contêiner: texto com `white-space` local, `min-width: 0`, overflow controlado, título limitado a 2 linhas, slug com ellipsis e snippet limitado;
- preservada a ordenação por ranking de busca retornada por `memory_recall`; a UI não reordena por criação ou encerramento;
- teste reforçado para garantir que a camada de UI/storage preserve a ordem rankeada recebida.

Validação executada:
- `node --test --import tsx test/ui-memory-search.test.ts`
- `pnpm run validate`
- `pnpm test` (99 testes passando)
- `pnpm build`

Observação: precisa reiniciar/atualizar a UI para conferir visualmente o CSS novo no navegador.

<!-- /marc-message -->

<!-- marc-message
id: msg_5b75d3b668664065a0
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T03:15:39.178Z
agentId: codex-dev
role: developer
-->

Novo feedback visual aplicado nos cards de resultado da busca.

Ajuste realizado:
- o card de resultado agora declara `height: auto`, `box-sizing: border-box` e padding inferior maior (`16px 16px 22px`);
- o contêiner do card deixou de cortar conteúdo com `overflow: hidden`; o truncamento fica restrito aos textos internos que usam clamp/ellipsis;
- objetivo: preservar margem inferior visível mesmo quando título e snippet ocupam várias linhas.

Validação executada:
- `pnpm run format:check`
- `pnpm build`
- `pnpm run validate`
- `pnpm test` (99 testes passando)

Observação: precisa atualizar/reiniciar a UI para ver o CSS novo no navegador.

<!-- /marc-message -->

<!-- marc-message
id: msg_b69547c1f55b4be889
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T03:48:59.607Z
agentId: codex-dev
role: developer
-->

Ajuste aplicado conforme refinamento aprovado.

Realizado:
- resultado da busca voltou a reutilizar o `NavItem`, preservando o visual do card normal de thread;
- `NavItem` recebeu extensoes opcionais e retrocompativeis: `children`, `disabled` e `tooltip`;
- o trecho `matchedText` agora entra apenas como conteudo extra abaixo do titulo/detalhe existentes;
- CSS customizado que transformava o card de busca foi removido, mantendo apenas `.memory-search-match` para truncar o trecho extra;
- tooltip agora usa `hit.matchedText.trim()` quando existir e cai para o titulo da thread quando nao houver trecho;
- `hit.reason` deixou de aparecer no tooltip visual;
- teste adicionado para proteger a regra de tooltip.

Validacao executada:
- `node --test --import tsx test/ui-memory-search.test.ts` (5 testes passando)
- `pnpm run typecheck`
- `pnpm run validate`
- `pnpm test` (100 testes passando)
- `pnpm build`

Observacao: precisa atualizar/reiniciar a UI para conferir o novo bundle/CSS no navegador.

<!-- /marc-message -->

<!-- marc-message
id: msg_e79671688a2849418c
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T04:23:31.977Z
agentId: codex-dev
role: developer
-->

Refinamento visual aplicado aos resultados da busca.

Realizado:
- resultados de memory search agora usam semantica visual de thread encerrada quando o hit vem de summary fechada;
- card encontrado usa icone `Archive` e recebe `closed`, mantendo o titulo tachado como na coluna de arquivo;
- resultado sem thread correspondente continua usando alerta e disabled;
- adicionado helper `isMemorySearchClosedHit` e teste para proteger essa regra.

Validacao executada:
- `node --test --import tsx test/ui-memory-search.test.ts` (6 testes passando)
- `pnpm run typecheck`
- `pnpm run validate`
- `pnpm test` (101 testes passando)
- `pnpm build`

Observacao: precisa atualizar/reiniciar a UI para conferir o novo bundle no navegador.

<!-- /marc-message -->

<!-- marc-message
id: msg_ab2bcf542ef544e6b6
threadId: oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd
timestamp: 2026-07-09T04:33:16.320Z
agentId: codex-dev
role: developer
-->

Ultimo ajuste visual aplicado no formulario de busca.

Realizado:
- formulario de busca passou de grid horizontal para layout vertical;
- input ocupa a largura total;
- submit virou botao textual `Search` em largura total, abaixo do input;
- removido uso de `button-icon` e do icone `Search` nesse submit;
- mantido comportamento existente de disabled/loading/submissao;
- adicionado teste para proteger o contrato visual do submit textual em largura total.

Validacao executada:
- `node --test --import tsx test/ui-memory-search-panel.test.ts` (1 teste passando)
- `pnpm run typecheck`
- `pnpm run validate`
- `pnpm test` (102 testes passando)
- `pnpm build`

Observacao: precisa atualizar/reiniciar a UI para conferir o novo bundle/CSS no navegador.

<!-- /marc-message -->
