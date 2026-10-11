# Diagnóstico do opt-in stdio do Codex 0.162.1

## Resultado e correção de orientação anterior

O usuário habilitou a feature global e reiniciou o Codex em um terminal novo. O primeiro aviso confirmou a feature carregada; o segundo manteve a falha de initialize com revisão 2025-06-18. A feature, sozinha, não resolveu a conexão.

Este relatório corrige a seção de diagnóstico em artifacts/atividade-correcao-lock-stale-e-diagnostico-codex.md: no Codex CLI 0.162.1, a conexão stdio exige a feature global mcp_2026_07_28 e um marcador explícito no env do servidor. CODEX_MCP_PROTOCOL_VERSION é um seletor real do cliente, além de aparecer em fixtures de conformidade. A conclusão anterior de que seria somente configuração do fixture estava incorreta.

A correção do teste de lock e a aprovação da migração modern-only permanecem válidas. Não foi introduzida compatibilidade legada no mARC.

## Causa raiz e fonte fixa

O developer leu a implementação oficial do tag rust-v0.162.1. O principal conferiu independentemente os trechos e o comportamento do executável nativo instalado.

- [protocol_mode.rs](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/rmcp-client/src/protocol_mode.rs): o modo global moderno, sem marcador de stdio, é convertido para Legacy; o valor 2026-07-28 mantém V20260728.
- [rmcp_client.rs](https://github.com/openai/codex/blob/rust-v0.162.1/codex-rs/rmcp-client/src/rmcp_client.rs): new_stdio_client_with_protocol_mode extrai e remove CODEX_MCP_PROTOCOL_VERSION do env configurado e usa stdio_mode para selecionar o lifecycle. No conteúdo bruto conferido pelo principal, isso ocorre nas linhas 477 a 491.
- A feature global permite o modo moderno, mas não substitui esse opt-in por servidor.

Legacy inicia initialize com revisão 2025-06-18. O modo moderno inicia descoberta automática com preferência por 2026-07-28. Assim, o caso reportado não foi fallback após uma descoberta moderna: a seleção inicial já era Legacy. O daemon mARC não decide esse lifecycle.

## Reprodução e prova nativa do principal

O executável utilizado foi o binário nativo da instalação local do Codex, identificado pelo launcher do pacote: vendor/x86_64-pc-windows-msvc/bin/codex.exe. O app-server reportou userAgent de versão 0.162.1.

O teste usou um home temporário apenas para o processo filho, sem alterar a configuração real do usuário. Configurações foram passadas por overrides de execução; nenhuma sessão de modelo, thread/start ou turn/start foi iniciada. O principal chamou somente a inicialização da API do app-server e mcpServerStatus/list. Essa inicialização do app-server é distinta do handshake MCP que foi observado no canal separado.

Um proxy em memória registrou somente os métodos, revisões, chaves de metadata, erros e campos estruturais das respostas. Credenciais reais do daemon não foram fornecidas; não foram publicados tokens, argumentos sensíveis ou catálogos completos.

Controle com feature ativa e sem marcador:
- Primeira e única requisição MCP: initialize, protocolVersion 2025-06-18, sem metadata moderna.
- Resposta mARC: -32022, requested 2025-06-18, supported 2026-07-28.
- Inventário nativo: zero ferramentas.

Mesmo teste, adicionando somente o marcador ao env configurado de mcp-marc:
- Primeira requisição MCP: server/discover, com metadata 2026-07-28, clientInfo e clientCapabilities.
- Resposta: supportedVersions 2026-07-28, identidade marc 0.3.0.
- tools/list também usa metadata 2026-07-28.
- Inventário nativo: 24 ferramentas, toolsError null.
- App-server termina com exit 0.

O cliente também sondou resources/list e resources/templates/list; o servidor respondeu Method not found porque não oferece essas capacidades. Isso não impediu a conexão nem o carregamento do catálogo. Não foi ampliado o escopo para adicionar recursos opcionais.

O aviso sobre helper binaries no diretório temporário pertence ao isolamento do teste. O teste moderno concluiu com êxito apesar dele; não foi confundido com o warning observado na sessão humana.

## Ajuste humano concreto

A feature global já está ativa. O único complemento necessário para este diagnóstico é acrescentar a tabela abaixo à configuração de projeto .codex/config.toml, preservando command, args, workspace, URL e token existentes:

```toml
[mcp_servers.mcp-marc.env]
CODEX_MCP_PROTOCOL_VERSION = "2026-07-28"
```

O principal verificou que o arquivo local não tem tabela env existente. Esse marcador é específico do cliente Codex e não será adicionado automaticamente aos arquivos do Claude ou VS Code.

O usuário aplica o ajuste e reinicia o Codex, conforme o acordo anterior. Não é necessário reiniciar o daemon mARC para mudar a seleção de protocolo do cliente. O aviso informativo de feature experimental pode continuar aparecendo.

## Escopo, execução e limites

Plano: artifacts/plano-documentacao-opt-in-stdio-codex.md, mensagem msg_c1a0ada6370d4956aa; preflight sem achados.

Developer compartilhado codex-dev, runtime /root/codex_modern_startup_trace, gpt-6-luna/xhigh, configuração humana previamente confirmada e reutilizada. Limite sequencial de um developer. Bootstrap independente confirmou marc-dd422176e1 em C:\Projetos\marc, contrato completo e fontes do task. Após o diagnóstico somente leitura, o developer leu o novo plano e o guia, confirmou o escopo e seu hash, e recebeu nova autorização explícita antes da edição.

A única alteração de projeto autorizada neste complemento é docs/mcp-migration-2026-07-28.md, para documentar os dois opt-ins do Codex CLI verificado. Os três arquivos de configuração local e o global não foram editados pelo agente.

O sucesso no teste nativo isolado demonstra a correção da seleção e do startup com o executável instalado. Ainda não substitui a confirmação da sessão humana depois de aplicar a configuração e reiniciar. O warning de context7 é independente e não recebeu diagnóstico neste escopo.


## Validação do estado final

O developer executou os três checks obrigatórios pelo context-mode. Não houve repetição concorrente dos comandos. O principal conferiu os trechos exatos de saída retornados pelo executor no cell 48 (exit_code=0 para os três comandos, 226 pass, 0 fail, ALL_REQUIRED_CHECKS=passed, Changed files since pre-validation baseline: none) e o hash final do documento, além de comparar independentemente os alvos sensíveis com o baseline anterior à edição.

- pnpm validate: exit 0; lint, formatação e typecheck aprovados.
- pnpm build: exit 0; warning existente de chunk JavaScript de 671,12 kB acima de 500 kB, sem falha.
- pnpm test: exit 0; 226 testes aprovados, zero falhas.
- Snapshot do executor: 868 arquivos, excluindo .git, node_modules, dist e .marc/cache; os checks não produziram alterações adicionais ao documento já editado.
- Conferência independente do principal: apenas docs/mcp-migration-2026-07-28.md mudou entre os alvos comparados. src/mcp/server.ts, src/core/write-coordination.ts, test/core-write-coordination.test.ts, .codex/config.toml, .mcp.json, .vscode/mcp.json, package.json e pnpm-lock.yaml mantiveram seus hashes.
- SHA-256 final do guia: 6588b01e1f48681bf7d73218ab29b6bee91f452291cd1eb1f55c85420466f7d8.

## Revisão final integrada do principal

Escopo revisto: guia completo de migração, plano deste complemento, diagnóstico anterior que está sendo corrigido, fontes oficiais fixadas no tag rust-v0.162.1, registros da captura nativa A/B, resultado dos checks e comparação de escopo. A revisão considera o estado final integrado deste complemento com a migração modern-only e a correção de lock já aprovadas; não reabre essas decisões nem muda seus alvos de código.

A exigência de explicar por que a feature não resolveu o caso está atendida nas linhas 45 a 61 do guia e no seletor stdio_mode do cliente. O controle nativo enviou initialize legado apesar da feature ativa; mudar somente o marcador produziu server/discover 2026-07-28 e 24 ferramentas, com toolsError null. Essa diferença estabelece a causa do erro observado e evita atribuí-lo ao daemon ou a fallback posterior.

A orientação operacional está atendida nas linhas 54 a 63: preserva command e args, fornece o complemento exato por servidor e pede reinício somente do Codex para este ajuste. A feature já ativa não deve ser duplicada em outra tabela. O marcador é consumido pelo cliente; não altera o contrato do mARC. O guia distingue a versão e o transporte verificados e não prescreve esse seletor a Claude, VS Code ou versões futuras.

A integração preserva a decisão humana de não manter compatibilidade. Nenhum código, teste, dependência ou configuração real foi alterado neste complemento. O texto técnico está em en-US e os registros conversacionais em pt-BR. Não houve alteração de guards, branches ou persistência. O guia anterior continua coerente: o reinício após upgrade descarta processos antigos, enquanto o complemento explica que a escolha do lifecycle é do cliente.

Não foram encontrados impedimentos no estado final. A evidência nativa confirma a correção para o executável instalado; os checks obrigatórios aprovam o estado do repositório. Permanecem dois limites explícitos: a sessão humana só estará confirmada depois da edição e reinício feitos pelo usuário, e o warning separado de context7 não foi diagnosticado.

Veredito: APROVADO tecnicamente o diagnóstico e a documentação deste complemento, com base na seleção de protocolo comprovada, orientação restrita à versão verificada, preservação do escopo e validação concluída. A configuração da sessão humana continua pendente; aprovação técnica não constitui aceitação do usuário nem autorização de fechamento da thread.
