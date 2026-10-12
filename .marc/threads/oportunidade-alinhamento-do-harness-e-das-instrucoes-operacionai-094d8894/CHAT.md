# Oportunidade - Alinhamento do harness e das instruções operacionais do mARC

Thread: `oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894`
Created: `2026-10-12T14:26:30.754Z`

<!-- marc-message
id: msg_9846178873734b1483
threadId: oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894
timestamp: 2026-10-12T14:28:48.913Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/analise-coerencia-harness.md
-->

## Análise registrada

A revisão integrada do harness identificou sete pontos de desalinhamento nas instruções de entrada, recomendações gerenciadas e helpers MCP. Inclui trechos preexistentes e não atribui todos os achados à última implementação.

O artefato anexo detalha evidências, riscos, direções de correção, verificações realizadas e os comportamentos que devem ser preservados. O núcleo do loop permanece coerente.

## Continuidade

- Corrigir a distinção entre cursor observado e conteúdo lido, registro de perfis, publicações operacionais, autoridade canônica, bootstrap, persistência e referências do helper.
- Alinhar também a orientação de composição do AGENTS, sem criar uma política concorrente.
- Nenhuma implementação foi iniciada. Aguardar o usuário concluir o commit da outra thread e autorizar a continuidade.
- Depois disso, revalidar o estado pós-commit e registrar o plano detalhado antes do desenvolvimento.

Thread de contexto:
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7

<!-- /marc-message -->

<!-- marc-message
id: msg_375ff20b05714237bd
threadId: oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894
timestamp: 2026-10-12T15:01:35.798Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-alinhamento-harness.md
-->

## Plano de desenvolvimento

O plano anexo cobre os sete achados e o alinhamento de composição do AGENTS. A execução alcança regras locais, documentação, geradores e helper MCP, sem alterar ferramentas públicas, busca, persistência ou perfis reais.

## Execução e aceite

- Um desenvolvedor por vez, sob o perfil compartilhado, com bootstrap independente e autorização interna antes de editar.
- Regressões focadas, validate, build e testes completos, além da verificação de geração e idempotência.
- Revisão final integrada pelo principal e entrega autoral do desenvolvedor.
- Reinício da sessão MCP será indicado ao final para carregar a orientação nova. A thread continuará aberta para revisão humana.

<!-- /marc-message -->

<!-- marc-message
id: msg_7b6108ddf22044ef88
threadId: oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894
timestamp: 2026-10-12T16:00:54.087Z
agentId: codex-dev
role: developer
artifacts: artifacts/relatorio-desenvolvimento-harness.md
-->

## Entrega consolidada

Implementação delimitada concluída nos 13 arquivos autorizados. Mantidos os contratos da API e runtime; a geração preserva Custom Rules e formatos JSON. O refresh das recomendações no workspace real fica para o principal.

**Validação:** `pnpm run code:check`, `pnpm validate`, `pnpm build` e `pnpm test` passaram; suíte completa: 284/284. Também passou o smoke MCP do `dist` em consumidor temporário sem documentação local.

**Revisão:** revisão técnica integrada do principal pendente; thread permanece aberta.

Relatório detalhado: marc://$oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894/!relatorio-desenvolvimento-harness.md

<!-- /marc-message -->

<!-- marc-message
id: msg_fcb593ffc89e470cbf
threadId: oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894
timestamp: 2026-10-12T16:14:41.900Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/revisao-integrada-harness.md
-->

## Revisão integrada

**Veredito técnico: aprovado.** As inconsistências do harness e a manutenção do AGENTS foram corrigidas. Revisei o conjunto final, a entrega própria do desenvolvedor e os arquivos emitidos pelo gerador.

**Validação independente**
- `pnpm validate`, `pnpm build` e `pnpm test` passaram. Suíte: 284/284, sem skips.
- MCP compilado validado em consumidor sem documentação local, incluindo cursor A/B após consulta de metadados.
- Refresh oficial preservou Custom Rules, perfis, JSON e metadata da skill. Repetição sem alterações.
- Links, âncoras, testes e fronteira de edição conferidos.

**Resultado**
Orientações gerais e regras locais estão separadas. Mantidos o loop, a entrega autoral do desenvolvedor e a frequência de manutenção. Ferramentas, contratos de persistência e motor de busca não foram alterados.

**Próximo passo**
Reiniciar o MCP e a sessão do agente para carregar as orientações atualizadas. A revisão detalhada registra critérios, evidências, achados resolvidos e limites.

A thread permanece aberta para revisão e aceite humano.

<!-- /marc-message -->
