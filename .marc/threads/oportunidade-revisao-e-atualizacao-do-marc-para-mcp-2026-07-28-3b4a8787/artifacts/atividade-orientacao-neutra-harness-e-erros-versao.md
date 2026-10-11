# Entrega e revisão integrada — orientação neutra de harness e erros de versão

## Resultado e escopo

A melhoria aprovada para a task 3b4a8787 foi implementada nos quatro caminhos autorizados. A decisão anterior de suportar exclusivamente MCP 2026-07-28 foi preservada.

- `src/mcp/server.ts:22`: orientação em inglês derivada de `SUPPORTED_PROTOCOL_VERSIONS`.
- `src/mcp/server.ts:27`: transporte interno que complementa somente mensagens de erro JSON-RPC com código `-32022`.
- `src/mcp/server.ts:72`: adoção desse transporte na conexão existente.
- `docs/mcp-migration-2026-07-28.md:45`: seção de configuração neutra, dirigida à documentação oficial do harness.
- `test/mcp-protocol.test.ts` e `test/mcp-version-pin.test.ts`: cobertura da orientação, preservação do envelope e comportamento de recuperação.

O complemento informa:

> mARC supports MCP 2026-07-28 only. Check your agent harness documentation for protocol support and any required configuration or upgrade.

A alteração mantém a mensagem original e acrescenta essa orientação uma única vez. Preserva `jsonrpc`, `id`, `error.code`, `error.data` e demais campos. Não altera a classificação de entrada, a rejeição de clientes legados, notificações, validação de metadata, ciclo de vida ou execução de ferramentas.

A documentação explica que configuração só pode habilitar suporte já implementado pelo harness, orienta a consultar requisitos de configuração ou atualização e informa que falhas anteriores à exposição das ferramentas podem aparecer somente nos warnings ou logs do cliente.

Não houve alteração nos arquivos de configuração dos clientes, dependências, lockfile ou correção anterior de write lock. Os registros históricos de diagnóstico permanecem como evidência do contexto em que foram produzidos.

## Fontes e execução autorizada

O plano registrado antes do desenvolvimento foi `artifacts/plano-orientacao-neutra-harness-e-erros-versao.md`, associado à mensagem `msg_714a54075c5b4c0694`. A auditoria preflight desse plano não apresentou achados.

Foram considerados AGENTS.md, a skill marc-ops, o contrato completo de bootstrap, README, Agent Workflows, Harness Engineering, ADRs 0001/0003/0004/0007/0008, a thread e o plano, os quatro arquivos autorizados e o suporte de subprocessos MCP em `test/mcp-process.ts`. A consulta histórica em mARC não encontrou uma decisão adicional que alterasse o escopo.

O principal utilizou o perfil compartilhado `codex-software-architect`. O executor reutilizou `codex-dev`, runtime `/root/codex_modern_startup_trace`, configuração gpt-6-luna/xhigh previamente confirmada pelo humano para implementação delimitada. Não foi criado um novo runtime para esta entrega; foi mantido o ensaio sequencial com um desenvolvedor.

O executor realizou bootstrap independente, confirmou a identidade `marc-dd422176e1` em `C:\Projetos\marc`, fontes, regras, escopo e estado inicial. O principal verificou o OK_BOOTSTRAP e autorizou explicitamente a implementação pelo canal entre agentes antes das edições. A entrega do executor identificou os caminhos alterados, resultados e ausência de comandos ou aprovações pendentes.

Inspeção do repositório e revisão da saída de comandos usaram context-mode. Não foram executados comandos Git nem reinícios dos processos do usuário.

## Evidência de validação

Os resultados abaixo são da execução reportada pelo desenvolvedor, conferidos pelo principal na revisão:

| Verificação | Resultado |
| --- | --- |
| RED: `pnpm exec node --test --import tsx test/mcp-protocol.test.ts test/mcp-version-pin.test.ts` antes da implementação | Exit 1; 12 testes, 7 passaram, 5 falharam por ausência da nova orientação |
| GREEN: mesma seleção após implementação e rebuild | 12/12 passaram; zero falhas e zero skips |
| `pnpm validate` | Exit 0; lint, Prettier e typecheck aprovados |
| `pnpm build` | Exit 0 |
| `pnpm test` | Exit 0; 226/226 passaram; zero skips |

As cinco falhas RED cobriram a descoberta inicial sem revisão e a matriz source/dist, com e sem abertura legada. A seleção GREEN utilizou o build atualizado.

Como `pnpm validate` aplica correções, foi conferido o snapshot de arquivos: somente os dois testes autorizados receberam ajustes de formatação; não houve alteração fora do escopo por esse comando.

O principal também executou uma prova independente no CLI compilado, com JSON-RPC real por stdio:

1. Descoberta inicial sem revisão: `-32022`, orientação única e dados de versões suportadas preservados.
2. Abertura legada `initialize` com 2025-06-18: `-32022`, orientação única e dados supported/requested preservados.
3. Descoberta moderna válida após as rejeições: sucesso.
4. `tools/list` com revisão incompatível: `-32022`, orientação única e envelope preservado.
5. `tools/call` com revisão incompatível: mesmo comportamento, sem execução da ferramenta.
6. Descoberta com revisão moderna e capacidades ausentes: `-32602`, sem orientação de versão.
7. `tools/list` válido após os erros: 24 ferramentas.

Todas as asserções dessa prova passaram; o subprocesso terminou com exit 0. Essa verificação complementa a evidência do executor sem repetir a suíte completa.

## Revisão final integrada do principal

### Escopo e análise

A revisão independente cobriu o estado final completo do servidor, guia e dois testes, incluindo a formatação final. Também conferiu as declarações e a implementação pública do SDK instalado e o contrato de erros JSON-RPC da especificação MCP 2026-07-28.

O SDK aceita transporte fornecido em `serveStdio` e expõe `send` como extensão pública. A rejeição inicial passa por esse envio; o callback `onerror` apenas reporta o problema. Por isso, o transporte escolhido alcança tanto a rejeição inicial do SDK quanto os erros posteriores do mARC sem reimplementar o handshake ou interceptar mensagens de entrada.

A reconstrução do servidor anterior, removendo apenas a nova constante, a classe e a substituição da instância, coincidiu exatamente com o hash de baseline. Isso limita a mudança de produção às adições autorizadas. A inspeção confirmou guard clauses com early returns, sem else e sem if aninhado; são precondições simples, sem necessidade de Strategy.

### Critérios vinculados à implementação e evidência

| Critério | Avaliação integrada |
| --- | --- |
| Guia independente de fornecedor | A seção de Codex foi substituída por instrução neutra; mantém a revisão exigida e distingue suporte implementado de configuração. Não cria receitas ou campos de cliente. |
| Orientação nas duas origens de erro | O transporte único complementa `-32022` antes do envio. Testes source/dist e a prova independente demonstram abertura legada, descoberta inicial e requisições posteriores. |
| Preservação do contrato wire | Spread do envelope e objeto error altera somente message. Asserções conferem IDs, código e dados; erros `-32602` permanecem sem complemento. |
| Ausência de duplicação e efeitos sobre outras mensagens | Guardas passam adiante mensagens sem error, códigos diferentes e orientação já presente. Casos testados conferem ocorrência única; recuperação e catálogo de 24 ferramentas continuam funcionais. |
| Modern-only e comportamento de domínio | Rejeição legada e validação de metadata permanecem; chamadas incompatíveis são interrompidas antes do domínio. A matriz existente também verifica que chamada ou notificação inválida não cria thread. |
| Escopo, manutenção e documentação | Classe interna pequena, sem novo export público ou dependência. Guia atualizado; configurações e correção de locks preservadas. O escopo cobre o pedido integralmente. |
| Validação e regras | RED comprovou a lacuna; GREEN e os três comandos obrigatórios passaram. A revisão técnica e a prova própria sustentam a aprovação além de testes ou auditoria estrutural. |

### Achados, limites e veredito

Não foram identificadas correções necessárias na implementação integrada. O texto fornece uma ação útil ao usuário, preserva os dados do diagnóstico e respeita a responsabilidade do harness sobre configuração e apresentação de erros.

O mARC não controla se o harness mostra o erro ao agente ou somente em seu painel/log. Não foi feita certificação de configuração para cada harness, pois esse escopo foi deliberadamente removido do guia. Processos MCP que já estavam em execução precisam recarregar o build para usar o novo diagnóstico; não foram reiniciados nesta entrega.

**Veredito técnico: APROVADO.** O estado final satisfaz os critérios autorizados, tem integração pequena e verificável com o SDK e foi validado com testes do executor e comunicação stdio independente pelo principal. A aprovação foi comunicada ao executor. Não houve mudança de implementação depois dessa revisão.

A aceitação humana permanece separada da aprovação técnica. A thread permanece aberta.

## Integridade dos arquivos

Hashes SHA-256 finais dos quatro arquivos alterados:

- `src/mcp/server.ts`: `8cd8b0a084bb042eff584c80c9d84142857137ff1f60413d53b6e3d39c46a034`
- `docs/mcp-migration-2026-07-28.md`: `210fdd7c0b610a58a3bddfdea14a6d87bd84ab4a23d50d056e7dc8584c71c26e`
- `test/mcp-protocol.test.ts`: `a22d19a24bcdf095664a9db3fa5f353fc1c86a1148677f31d031439d776ce891`
- `test/mcp-version-pin.test.ts`: `35b48d9bae39d4018c2ac86f5f1515bc311bfcc378a08825917e165f2ee9076b`

O principal conferiu que `.codex/config.toml`, `.mcp.json`, `.vscode/mcp.json`, `package.json`, `pnpm-lock.yaml`, `src/core/write-coordination.ts` e `test/core-write-coordination.test.ts` mantêm seus hashes anteriores.

A publicação usa artefato associado aos metadados da mensagem. As auditorias de artifacts e messages verificam a estrutura dos registros; não substituem a avaliação técnica acima.

## Ajuste editorial solicitado pelo usuário e revisão do estado final

O usuário solicitou diretamente a remoção do código específico de erro do aviso geral sobre visibilidade dos diagnósticos, com execução pelo principal sem subagente. Foi substituído apenas esse parágrafo do guia. O texto agora abrange falhas de conexão MCP ou negociação de protocolo e orienta consultar warnings/logs e a documentação do harness quanto a suporte, configuração e atualização.

A conferência por context-mode reconstruiu o guia anterior substituindo o novo parágrafo pelo original e obteve exatamente o hash previamente aprovado. Assim, a única mudança deste ajuste é a substituição autorizada, sem alterar a documentação técnica dos códigos do contrato nem a implementação do transporte.

Após o ajuste, o principal executou pnpm validate, pnpm build e pnpm test: todos exit 0; 226 testes passaram, sem falhas ou skips. O snapshot anterior e posterior ao validate não mostrou alterações adicionais. O build emitiu o aviso de tamanho do bundle JavaScript de 671,12 kB, sem impedir sua conclusão.

Revisão final do ajuste: o parágrafo conserva a orientação prática e a limitação de visibilidade, amplia o diagnóstico para conexão/negociação e remove a dependência textual de um código específico. A integração com as demais seções permanece coerente: a revisão MCP exigida e os detalhes técnicos do protocolo continuam documentados em seus próprios contextos. **Veredito técnico do estado final: APROVADO.** A análise de código e evidências anteriores permanece aplicável; os três checks foram atualizados para este estado da documentação. A aceitação humana e o fechamento continuam pendentes de autorização do usuário.
