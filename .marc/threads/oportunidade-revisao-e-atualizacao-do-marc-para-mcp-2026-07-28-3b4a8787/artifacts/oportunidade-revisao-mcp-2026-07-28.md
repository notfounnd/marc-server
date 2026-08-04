# Oportunidade: revisar e atualizar o mARC para MCP 2026-07-28

## Objetivo e limite deste registro

Revisar a conformidade e atualizar a integracao MCP do mARC para a revisao 2026-07-28, mantendo interoperabilidade, seguranca e os contratos arquiteturais do projeto.

Registro solicitado pelo usuario apos um hiato de desenvolvimento. Nao houve implementacao, atualizacao de dependencias ou mudanca de configuracao. Este anexo orienta a analise e o futuro planejamento; nao e um plano de execucao aprovado.

## Fontes oficiais consultadas

Os quatro documentos foram efetivamente consultados e indexados por context-mode em 2026-10-08:

- [Especificacao 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- [Changelog da revisao](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [Registro de funcionalidades deprecated](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
- [Arquitetura](https://modelcontextprotocol.io/specification/2026-07-28/architecture)

No planejamento, ler tambem as secoes normativas especificas e o schema autoritativo indicado pela especificacao. Diferenciar MUST/MUST NOT, SHOULD/SHOULD NOT e MAY; nao transformar toda novidade em requisito para o produto.

## Baseline local verificada

Inspecao de package.json, SDK instalado, src/mcp/server.ts, src/mcp/bootstrap.ts e docs/architecture.md via context-mode:

- Dependencia declarada: @modelcontextprotocol/sdk ^1.17.5.
- SDK instalado nesta verificacao: 1.29.0.
- LATEST_PROTOCOL_VERSION do SDK instalado: 2025-11-25.
- SUPPORTED_PROTOCOL_VERSIONS desse SDK: 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05 e 2024-10-07. Nao lista 2026-07-28.
- Servidor usa McpServer e StdioServerTransport, com workspace vinculada ao processo.
- Catalogo observado: 24 tools MCP. Esta quantidade e um retrato, nao um limite ou requisito futuro.
- Daemon local HTTP serve a UI, APIs proprias e SSE para o navegador; nao e o transporte MCP stdio.
- workspace_bootstrap aplica recommendations, le RULES.md e retorna contexto da workspace e agentes.

A versao declarada no package.json nao e a mesma coisa que a versao resolvida. Os dados acima comprovam uma diferenca a investigar; nao substituem um probe do protocolo efetivamente utilizado por processos de producao ou uma auditoria completa do SDK.

## Mudancas normativas que orientam a revisao

A revisao remove initialize/notifications/initialized, leva versao e capabilities para _meta por requisicao e exige server/discover. Tambem altera subscriptions, registro de capabilities/extensions, erros e semantica de cache de listagens/recursos, incluindo ttlMs e cacheScope. Catalogo deterministico e recomendado. Os impactos precisam ser classificados por transporte e por recursos usados pelo mARC. [Changelog oficial](https://modelcontextprotocol.io/specification/2026-07-28/changelog)

A arquitetura permanece host-client-server, com fronteiras entre servidores e responsabilidades distintas de host e servidor. Stateless no protocolo nao significa apagar arquivos, indices ou caches da aplicacao depois de cada chamada. [Arquitetura oficial](https://modelcontextprotocol.io/specification/2026-07-28/architecture)

Roots, Sampling, Logging e Dynamic Client Registration constam no registro de deprecacao. Deprecated nao significa removido imediatamente: planejar migracoes conforme o ciclo oficial e nao adicionar uso novo sem necessidade. [Registro oficial](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)

Estas notas sao pontos iniciais, nao uma alegacao de que todas essas funcionalidades estao implementadas no mARC ou de que todas precisam ser adicionadas.

## Trabalho de analise antes do plano de desenvolvimento

### 1. Matriz de conformidade

Inventariar as superficies realmente usadas: core JSON-RPC/MCP, stdio, tools, schemas, conteudo de resposta, erros, notificacoes, progresso/cancelamento, identificacao do servidor, dependencias e testes.

Para cada requisito, registrar:

- fonte normativa exata e grau de obrigatoriedade;
- aplicabilidade ao transporte e ao perfil atual do mARC;
- comportamento atual e evidencia de codigo/probe;
- gap confirmado, responsabilidade do SDK ou da aplicacao;
- correcao proposta, risco, compatibilidade e teste de aceite.

Evitar uma simples lista de novidades ou uma atualizacao de pacote sem demonstrar conformidade.

### 2. SDK e compatibilidade

Consultar documentacao, releases e suporte oficial do SDK TypeScript, usando Context7 quando ajudar a validar APIs. Escolher a versao que realmente suporte o contrato alvo e verificar Node, TypeScript, Zod, packaging e plataformas do projeto.

Nao presumir que o ultimo pacote disponivel implementa toda a revisao, nem desenvolver transporte/JSON-RPC proprio antes de avaliar suporte oficial.

Definir a politica para clientes antigos e novos: quais revisoes serao mantidas, fallback permitido e comportamento para versao nao suportada. Validar com clientes de teste reais do protocolo, sem hooks ou adapters exclusivos de CLIs comerciais.

Atualizar package.json e lockfile de forma coerente somente na implementacao aprovada. Verificar tambem a identidade name/version anunciada pelo servidor contra a versao real do produto.

### 3. Protocolo e bootstrap da aplicacao

Separar o lifecycle do protocolo do onboarding mARC.

A mudanca no handshake nao autoriza remover workspace_bootstrap, RULES.md, Custom Rules, marc-ops ou bootstrapConfirmed automaticamente. Avaliar o comportamento da aplicacao no modelo novo e como ele funciona com clientes independentes e apos restart.

Se houver estado necessario entre chamadas, definir contrato explicito, escopo e ownership adequados; nao criar dependencia oculta de conexao ou de um agente anterior ter feito onboarding.

Protocol _meta e capabilities nao podem funcionar como autorizacao para acessar outra workspace ou pular validacoes de negocio. Preservar a raiz configurada do servidor e os controles de paths existentes.

### 4. Catalogo, schemas e respostas

Revisar registro das tools, descriptions, input/output schemas, annotations, resultados estruturados e erros. Determinar o que o SDK fornece e o que o mARC deve emitir.

Tratar ordem de catalogo, frescor e escopo de cache com evidencias. Nao compartilhar dados privados da workspace por erro de configuracao de cache.

TTL de catalogo/recurso do protocolo nao e TTL dos modelos de inferencia. Manter as duas responsabilidades separadas.

Verificar o que deve acontecer em processos novos, processos reiniciados e clientes com capabilities diferentes, sem fazer catalogos dependerem acidentalmente de uma conexao.

### 5. Notificacoes, operacoes longas e extensoes

Auditar usos atuais antes de escolher mecanismos novos. Estudar as secoes normativas sobre mudancas de catalogo, notificacoes, progresso, cancelamento e requisitos de input adicional apenas onde houver aplicabilidade.

Operacoes de memory e manutencao devem conservar seus locks, batches e respostas de estado. Uma extensao de tasks so deve ser adotada se resolver uma necessidade comprovada, nao por existir no ecossistema.

Evitar enfileiramento duplicado, encerramento indevido de workers e confusao entre retorno da tool e trabalho derivado em background.

### 6. Transporte e seguranca

O alvo imediato e a integracao MCP stdio existente. Classificar requisitos exclusivos de Streamable HTTP como nao aplicaveis ou trabalho separado, quando apropriado.

A deprecacao de um transporte MCP HTTP+SSE nao torna o SSE de atualizacao da UI obsoleto por associacao. Nao refatorar o daemon HTTP do mARC apenas por compartilhar a sigla SSE.

Se a analise demonstrar necessidade real de transporte MCP HTTP, planejar explicitamente seu escopo, autorizacao, headers, limites e compatibilidade antes de implementar. Nao assumir que o token da API da UI equivale automaticamente ao modelo de autorizacao MCP.

Manter stdout do stdio reservado ao protocolo e tratar logs/diagnosticos conforme o contrato aplicavel. Nao expor tokens, paths sensiveis ou conteudo privado em logs ou caches compartilhados.

### 7. Deprecacoes

Mapear uso real de cada funcionalidade deprecated, inclusive uso transitivo pelo SDK e pelos clientes de teste. Registrar ausencia de uso quando comprovada.

Planejar retirada/migracao conforme notices normativos, distinguindo prazo de elegibilidade para remocao de remocao efetiva. Nao adicionar Roots, Sampling ou Logging como dependencia nova por conveniencia de onboarding.

Nao substituir o motor local de busca nem integrar um novo provider LLM em nome da migracao MCP.

### 8. Documentacao e fluxo de agentes

Revisar README, docs/mcp-tools.md, docs/architecture.md, docs/agent-workflows.md, docs/harness-engineering.md e ADRs pertinentes.

Atualizar managed instructions/recommendations, bootstrap e skill apenas onde o novo contrato realmente exigir, preservando texto e diretrizes existentes sem reescrita indiscriminada.

Codigo, schemas, documentacao do produto e descriptions em en-US. Comunicacao e planos operacionais em pt-BR. Manter mARC agnostico ao cliente: sem hooks proprietarios ou codigo para ferramentas externas.

## Dependencias e contexto de outras threads

Coordenar o contrato com marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7. A nova superficie de summaries deve seguir o perfil MCP escolhido, mas esta oportunidade nao incorpora automaticamente sua implementacao.

Historico consultado:

- marc://$bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a: preservacao de Custom Rules, idempotencia de recommendations e verificacao de processos fresh.
- marc://$bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7: contratos de descoberta/re-registro e preservacao de conteudo autoral.

Preservar essas garantias. Implementacoes antigas de teste e protocolo sao contexto historico, nao prova de conformidade com 2026-07-28.

## Criterios de aceite da futura implementacao

- Matriz normativa completa e revisada, sem confundir obrigatorio, recomendado, opcional e nao aplicavel.
- SDK escolhido com suporte demonstrado ao alvo, ou gaps restantes explicitamente tratados no plano.
- Probes e testes de contrato exercitam o novo fluxo de descoberta/versao/capabilities, tanto sucesso quanto falhas.
- Politica de compatibilidade aprovada e testada com clientes antigos/novos previstos, sem dependencias de um host especifico.
- Catalogo, schemas, respostas, cache e erros verificados contra o contrato aplicavel.
- Bootstrap da aplicacao, preservacao de RULES/Custom Rules e isolamento de workspace continuam funcionando apos restart e com clientes independentes.
- Tools mutantes mantem escrita atomica, locks, idempotencia e protecao contra efeitos colaterais em erros.
- Cancelamento/desconexao/falhas nao corrompem arquivos nem deixam operacoes duplicadas ou recursos abandonados.
- UI, daemon, eventos locais e memory nao sofrem regressao por confusao de transportes.
- Tests/probes usam workspaces temporarias e nao fazem download, purge ou rebuild da base real sem necessidade/autorizacao.
- pnpm run validate, pnpm test e pnpm build aprovados, com revisao independente de qualidade.
- Smoke test com processos atualizados, versionamento real conferido e aviso claro ao usuario sobre restart necessario.
- Documentacao/recommendations alinhadas ao contrato efetivamente implementado.
- Registros via MCP, com plano detalhado anexado antes do desenvolvimento e auditoria depois dos registros completos.
- Caso haja desenvolvimento, aplicar o loop vigente: arquiteto planeja/revisa, subagentes gpt-6-luna/xhigh implementam tarefas atomicas, bootstrap confirmado antes de editar e ajuste ate aceite tecnico.
- Feedback do usuario antes do fechamento efetivo.

## Fora de escopo sem nova justificativa

Mudancas de relevancia, modelos, corpus, schemas de memory, redesign da UI, integracoes proprietarias de clientes, geracao automatica de summaries e implementacao indiscriminada de todas as features opcionais do MCP.

## Proxima etapa

Ao iniciar a atividade, confirmar a baseline instalada e os documentos da revisao alvo novamente, elaborar a matriz de conformidade e apresentar a proposta de migracao com impactos, compatibilidade e plano de testes. Registrar o plano aprovado na thread antes de desenvolver.

Nenhuma implementacao iniciada neste registro.
