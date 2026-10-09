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
