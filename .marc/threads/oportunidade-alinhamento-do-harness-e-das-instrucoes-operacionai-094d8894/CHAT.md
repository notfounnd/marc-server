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
