# Oportunidade - Revisão e atualização do mARC para MCP 2026-07-28

Thread: `oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787`
Created: `2026-10-08T22:55:45.410Z`

<!-- marc-message
id: msg_f9e6c3bf4f984fe19e
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-08T22:57:51.982Z
agentId: codex-dev
role: architect
artifacts: artifacts/oportunidade-revisao-mcp-2026-07-28.md
-->

Oportunidade registrada para revisar e atualizar a integracao MCP do mARC para a revisao 2026-07-28.

- Os quatro documentos oficiais enviados pelo usuario foram consultados e indexados via context-mode.
- Baseline local: dependencia declarada ^1.17.5, SDK instalado 1.29.0, cuja lista de protocolos vai ate 2025-11-25 e nao inclui 2026-07-28.
- O anexo orienta uma matriz de conformidade, escolha de SDK, compatibilidade, bootstrap da aplicacao, schemas/respostas, cache, notificacoes, deprecacoes e testes.
- A revisao distingue o transporte MCP stdio do HTTP/SSE da UI e preserva Markdown, isolamento de workspace, Custom Rules e o motor de busca.
- Coordenar com marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7, sem incorporar automaticamente aquele desenvolvimento.

Apenas registro da oportunidade. Nenhuma dependencia, codigo ou configuracao foi alterada. Planejamento e implementacao ficam para uma atividade futura.

<!-- /marc-message -->

<!-- marc-message
id: msg_f6262c3e8c994aa8bc
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-10T16:57:05.859Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-aprovado-migracao-mcp-2026-07-28.md
-->

Proposta aprovada e plano de execução registrados antes do desenvolvimento.

Decisões:
- Atender exclusivamente MCP 2026-07-28 pelo stdio, usando SDK oficial v2 e rejeitando clientes legacy.
- Preservar bootstrap, RULES/Custom Rules, isolamento de workspace, Markdown, UI/daemon e motor de memory.
- Executar com um desenvolvedor gpt-6-luna/xhigh por vez, configuração confirmada pelo usuário, seguido de revisão integrada pelo principal.

Validação planejada:
- Probes reais do protocolo e testes de aplicação, além de pnpm validate, pnpm build e pnpm test.
- Inspeção e validação via context-mode. Baseline: typecheck e 18 testes MCP selecionados aprovados.

Após build e revisão técnica, o usuário receberá instruções de reconfiguração e reinício. A verificação da sessão reiniciada e a revisão humana ficam como checkpoints posteriores; a thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_31c14827353743e088
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-10T18:37:45.555Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-migracao-mcp-2026-07-28.md
-->

Implementação aprovada tecnicamente após revisão integrada do principal. O mARC 0.3.0 atende exclusivamente MCP 2026-07-28, preserva as 24 ferramentas e inclui proteção por requisição contra versões incompatíveis, inclusive após a conexão moderna estar estabelecida.

Validação: pnpm validate e pnpm build passaram; pnpm test passou com 226/226, sem falhas ou testes ignorados. O principal verificou lint/formatação e executou probes raw independentes source/dist, confirmando catálogo, identidade, cache, erros, limite de chamadas e encerramento. Inspeção e evidências foram obtidas por context-mode.

O relatório anexo consolida implementação, caminhos, revisão substantiva, finding resolvido, evidências e limites. README e documentação técnica foram atualizados; o guia de migração explica o contrato moderno e o reinício.

Pendente: reinício do MCP/cliente pelo usuário e verificação da conexão real na sessão retomada. As configurações locais encontradas já apontam para o CLI compilado; preservar daemon URL e token. Aprovação técnica não representa aceitação humana. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_03e89102b880408a8d
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-10T19:46:00.197Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-correcao-teste-lock-stale.md
-->

O timeout reportado foi reproduzido com atraso controlado de filesystem: o teste funcional usa um orçamento de 100 ms, embora não verifique latência máxima. Isolado e na execução completa sem atraso, os testes passaram; isso evidencia fragilidade da fixture sob carga.

O plano anexo limita a correção ao teste: prazo de 5 segundos e verificação de liberação do lock, mantendo os casos que verificam timeout real de contenção. Core e protocolo permanecem inalterados.

O servidor também respondeu ao bootstrap oficial por stdio moderno separado; a conexão do host desta sessão ainda precisa de diagnóstico. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_c7bd5ab53ed749fa88
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-10T20:16:27.559Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-correcao-lock-stale-e-diagnostico-codex.md
-->

Correção do teste de recuperação de lock stale implementada e aprovada na revisão independente. O prazo da fixture passou de 100 para 5.000 ms; uma nova asserção confirma a liberação do lock. A implementação de produção foi preservada.

Validação: pnpm validate e pnpm build passaram; pnpm test passou com 226/226, sem skips ou cancelamentos. O principal repetiu a suíte e a reprodução controlada de atraso de 120 ms, ambas aprovadas.

Diagnóstico do Codex: o agente zero encontrou a feature mcp_2026_07_28 desativada no CLI local 0.162.1. O principal confirmou a opção nas fontes oficiais e por override não persistente. A conclusão anterior de que não havia configuração a alterar estava incompleta: a seleção é uma feature do cliente, não um argumento do servidor.

Próximo passo humano: acrescentar a seção [features] com mcp_2026_07_28 = true no .codex/config.toml do projeto e reiniciar o Codex. Os argumentos de mcp-marc permanecem válidos. A conexão do host será verificada depois do reinício; não foi declarada concluída.

O relatório consolida a revisão técnica, as evidências e os limites. A decisão de não suportar protocolo legado permanece; a thread continua aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_c1a0ada6370d4956aa
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-10T20:44:52.923Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-documentacao-opt-in-stdio-codex.md
-->

O reinício confirmou que a feature global não basta para o stdio no Codex0.162.1. A fonte do cliente exige também CODEX_MCP_PROTOCOL_VERSION=2026-07-28 no ambiente configurado para o servidor.

O principal reproduziu a falha sem esse marcador e a conexão moderna com ele: server/discover e tools/list em2026-07-28, 24 ferramentas disponíveis. Nenhuma configuração real foi alterada.

Registrado o plano limitado à correção do guia de migração. A decisão modern-only permanece. O usuário fará o ajuste local e reinício; a sessão humana ainda aguarda verificação.

<!-- /marc-message -->

<!-- marc-message
id: msg_af5069108abd4df385
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-10T20:56:36.432Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-opt-in-stdio-codex-0-162-1.md
-->

A feature global estava ativa, mas faltava o opt-in por servidor para stdio no Codex CLI 0.162.1. Corrigida a orientação anterior: CODEX_MCP_PROTOCOL_VERSION é consumido pelo cliente e seleciona o lifecycle moderno. Nenhuma compatibilidade legada foi introduzida no mARC.

A captura nativa do principal confirmou a diferença: sem marcador, initialize 2025-06-18 e zero ferramentas; com somente esse complemento, server/discover 2026-07-28 e 24 ferramentas carregadas, sem erro no catálogo. O guia de migração documenta o ajuste; revisão integrada aprovada.

Validação: pnpm validate, pnpm build e pnpm test passaram; 226 testes aprovados. Os checks não alteraram arquivos monitorados, e as configurações reais permaneceram intactas.

Pendente: o usuário acrescenta o marcador à configuração do servidor mcp-marc e reinicia o Codex. Reiniciar o daemon não muda a seleção do cliente. A sessão humana ainda precisa de confirmação; context7 é um diagnóstico separado. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_7cbb76b24d5242d9a2
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-11T15:54:32.803Z
agentId: codex-software-architect
role: architect
-->

Conexão confirmada na sessão real após o ajuste autorizado em .codex/config.toml e o reinício informado pelo usuário. O conteúdo anterior de command e args foi preservado; foi acrescentado somente o marcador de protocolo ao env do servidor.

As ferramentas nativas mARC estão disponíveis nesta sessão. workspace_bootstrap respondeu com sucesso para marc-dd422176e1 em C:\Projetos\marc, e thread_read_since também respondeu com sucesso. A confirmação pendente da conexão humana está resolvida. O aviso restante informa que a feature é experimental; não representa falha de inicialização. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_714a54075c5b4c0694
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-11T16:27:06.186Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-orientacao-neutra-harness-e-erros-versao.md
-->

Plano aprovado para este complemento: substituir a orientação específica do Codex por documentação geral do harness e acrescentar um diagnóstico útil aos erros de versão, inclusive à rejeição inicial do SDK.

O contrato permanece modern-only. A alteração será limitada ao guia, à saída do transporte stdio e aos testes de protocolo; configurações locais e dependências serão preservadas.

O plano anexo define implementação, cenários de wire, validação obrigatória e revisão integrada. A entrega da orientação ao agente continua dependendo do harness.

<!-- /marc-message -->

<!-- marc-message
id: msg_f00aa6696269406191
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-11T16:52:07.538Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-orientacao-neutra-harness-e-erros-versao.md
-->

Melhoria implementada e aprovada na revisão técnica integrada. O guia de migração agora orienta consultar a documentação oficial do próprio harness. Os erros de versão -32022 incluem a mesma orientação neutra, tanto na rejeição inicial do SDK quanto nas requisições posteriores, preservando código, dados e demais campos do protocolo.

Validação: pnpm validate, pnpm build e pnpm test passaram; 226 testes, sem skips. A seleção de protocolo passou em 12/12 casos. Minha prova independente no CLI compilado confirmou os diagnósticos, a recuperação após rejeições e o catálogo de 24 ferramentas. O relatório consolidado registra a evidência do executor e minha análise final, com veredito aprovado.

As configurações existentes foram preservadas. A exibição do erro ao agente ou somente em warnings/logs depende do harness; processos MCP já abertos precisam recarregar o build para receber o novo diagnóstico. A entrega está disponível para revisão humana, e a thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_ac8005baaec847f8b8
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-11T19:03:48.453Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-orientacao-neutra-harness-e-erros-versao.md
-->

Ajuste editorial solicitado pelo usuário concluído diretamente pelo principal, sem subagente. O aviso geral do guia agora trata falhas de conexão ou negociação de protocolo sem mencionar um código de erro específico, mantendo a orientação para consultar os diagnósticos e a documentação do harness.

Revisão do estado final aprovada. pnpm validate, pnpm build e pnpm test passaram; 226 testes, sem skips. O validate não alterou arquivos adicionais. O relatório consolidado foi atualizado com a revisão e a evidência deste ajuste. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_d177ae7d3dbc47bba5
threadId: oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
timestamp: 2026-10-11T19:15:24.399Z
agentId: codex-software-architect
role: architect
-->

Thread encerrada com autorização explícita do usuário. O SUMMARY.md consolida a migração modern-only, a conexão real confirmada, a correção da fixture de lock e a orientação neutra de harness, incluindo o ajuste editorial final.

A revisão técnica integrada foi aprovada; pnpm validate, pnpm build e pnpm test passaram, com 226 testes e sem skips. Não há pendência de implementação nesta thread. As limitações de visibilidade dos diagnósticos e o contexto de configuração permanecem documentados para consultas futuras.

<!-- /marc-message -->
