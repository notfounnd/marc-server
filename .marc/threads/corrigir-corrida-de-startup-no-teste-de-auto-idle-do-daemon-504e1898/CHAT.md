# Corrigir corrida de startup no teste de auto-idle do daemon

Thread: `corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898`
Created: `2026-10-09T20:19:11.553Z`

<!-- marc-message
id: msg_d836ad2ba56444dbb1
threadId: corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898
timestamp: 2026-10-09T20:21:42.309Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/analise-corrida-auto-idle.md
-->

Análise concluída: o teste de auto-idle exige uma resposta HTTP antes de um timer de 20 ms encerrar um daemon sem atividade. Em processo frio, a abertura/conexão pode consumir esse prazo; o trace confirmou server.close por leases.ts:76 antes da recepção da requisição, seguido de fetch failed/ECONNRESET.

O teste original sozinho falhou 8/8; com uma troca HTTP nativa anterior, passou 8/8. A reprodução não executa o teste novo de notificações. O grafo estático de 59 arquivos do daemon não inclui Toast/Base UI e tem hashes iguais ao baseline da migração. O problema pertence ao teste de ciclo de vida, fora da demanda de Toast.

Correção proposta: separar a prova de encerramento da exigência de primeira resposta em 20 ms, observar close antes de iniciar o servidor e evitar dependência de aquecimento, retry ou aumento arbitrário do prazo. O artefato contém mecanismo, comandos, controles, limitações e critérios. Correção pendente nesta thread.

Origem: marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb

<!-- /marc-message -->

<!-- marc-message
id: msg_c92a48a653a5474abb
threadId: corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898
timestamp: 2026-10-09T20:22:55.722Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/analise-corrida-auto-idle.md, artifacts/repro-auto-idle.md, artifacts/warm-http.md
-->

Evidências de reprodução preservadas como artefatos da thread: harness com trace de timer/close/request e preload de troca HTTP nativa. A análise consolida os resultados 8/8 de falha em processo frio e 8/8 de aprovação no controle, além dos critérios para corrigir o teste sem depender de aquecimento.

Revisão do principal aprova o diagnóstico e o encaminhamento. A correção permanece pendente nesta thread; o runtime e a implementação de Toast não foram alterados.

<!-- /marc-message -->

<!-- marc-message
id: msg_36c8398bbab940859d
threadId: corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898
timestamp: 2026-10-09T21:09:26.120Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-correcao-auto-idle.md, artifacts/atividade-correcao-auto-idle.md
-->

Plano aprovado registrado para execução. A correção fica restrita ao cenário de auto-idle: observar abertura e fechamento, remover a requisição que precisava vencer os 20 ms e garantir limpeza com timeout de teste de 5 segundos. O prazo de auto-idle e o runtime permanecem iguais.

A viabilidade foi verificada em memória: 8/8 processos novos aprovados e controle negativo com timeout/limpeza confirmados. A implementação seguirá bootstrap independente, validação completa e revisão integrada do principal. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_b0064690a8a44c1cbd
threadId: corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898
timestamp: 2026-10-09T21:24:59.500Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-correcao-auto-idle.md, artifacts/analise-corrida-auto-idle.md
-->

Correção implementada e aprovada tecnicamente após revisão integrada. Somente o cenário de auto-idle em test/daemon-runtime.test.ts mudou: observa abertura e fechamento sem exigir uma requisição HTTP dentro de 20 ms. O prazo do daemon foi preservado; o teste tem watchdog de 5 segundos e limpeza garantida.

O cenário passou em 8/8 processos novos. O principal executou o arquivo completo, 6/6, e um controle negativo derivado do código final: timeout, limpeza e saída do processo confirmados. pnpm validate, pnpm build e pnpm test passaram; suíte 210/210. Comparação de hashes e reconstrução do baseline confirmam que nenhum outro arquivo ou trecho do teste foi alterado. Documentação revisada, sem mudança necessária.

O relatório consolidado contém bootstrap/autorização, evidências delegadas e diretas, critérios e veredito. Resultado disponível para revisão humana. A thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_da76572ff1ba4507bb
threadId: corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898
timestamp: 2026-10-10T05:46:15.166Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-correcao-auto-idle.md, artifacts/plano-correcao-auto-idle.md, artifacts/analise-corrida-auto-idle.md
-->

Encerramento autorizado pelo usuário. A correção foi implementada apenas no cenário de auto-idle: observa abertura e close sem exigir uma primeira resposta HTTP dentro de 20 ms. O prazo do daemon foi preservado; o teste tem watchdog de 5 segundos e limpeza.

Revisão integrada aprovada: 8/8 processos novos, arquivo completo 6/6 e suíte 210/210; validate e build aprovados. Controles negativos confirmaram timeout, limpeza e término do processo. Documentação revisada, sem alteração necessária. Inspeção de fechamento via context-mode confirmou o arquivo igual ao estado tecnicamente aprovado.

O resumo executivo consolida a causa, a alteração restrita ao teste e as evidências. Esta demanda não alterou runtime, Toast ou dependências.

<!-- /marc-message -->
