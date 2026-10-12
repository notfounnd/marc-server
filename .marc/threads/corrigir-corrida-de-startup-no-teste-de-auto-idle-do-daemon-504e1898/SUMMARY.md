# Corrigir corrida de startup no teste de auto-idle do daemon

Thread: marc://$corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898

Closed: `2026-10-10T05:46:49.398Z`

---

Encerramento autorizado pelo usuário em 2026-10-10. Implementação e revisão técnica aprovadas em 2026-10-09.

## Causa e decisão

O teste exigia uma resposta HTTP antes de um daemon sem atividade encerrar por auto-idle de 20 ms. Em processo frio, a abertura/conexão consumia esse prazo. A reprodução confirmou close antes da requisição, sem participação de Toast/Base UI.

Foi escolhida uma correção restrita ao teste, preservando a política do daemon e a cobertura HTTP existente em outro cenário.

## Entrega

Somente o cenário de auto-idle em test/daemon-runtime.test.ts foi alterado. Registra close com once antes de listen, verifica listening true e depois false, e remove a requisição HTTP desse cenário. Mantém autoIdleMs 20, modo detached e porta 0. Timeout de teste de 5000 ms e context.after garantem falha limitada e limpeza.

Runtime, Toast, dependências e demais trechos do arquivo não mudaram. Comparação de hashes e reconstrução do baseline comprovaram o escopo.

## Validação

- RED original: fetch failed em processo novo.
- Cenário corrigido: 8/8 processos novos aprovados, sem warmup.
- Arquivo completo executado pelo principal: 6/6.
- pnpm validate e pnpm build aprovados; pnpm test: 210/210.
- Controles negativos do executor e principal: timeout esperado, cleanup e close confirmados, processo encerrou sem kill externo.
- README e documentação do daemon revisados, sem mudança necessária.
- Antes do fechamento, context-mode confirmou o hash igual ao estado aprovado; auditoria de mensagens retornou zero findings.

Nenhum achado bloqueante ou correção pendente identificada nesta demanda. Evidências e avaliação integrada permanecem nos artefatos anexados.

Origem: marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb.

