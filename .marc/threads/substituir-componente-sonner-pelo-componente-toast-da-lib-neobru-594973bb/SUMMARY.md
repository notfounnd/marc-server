# Substituir componente sonner pelo componente toast da lib Neobrutalism

Thread: marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb

Closed: `2026-10-09T20:57:04.788Z`

---

Encerramento autorizado pelo usuário em 2026-10-09. Aprovação técnica do principal registrada na atividade consolidada.

## Entrega e decisões

Sonner foi substituído pelo componente local Neobrutalism baseado em Base UI. Um singleton compartilhado em toast-manager.ts evita ampliar o grafo TSX do adaptador. A API showNotification foi preservada, com sucesso padrão, três tipos e duração de 2400 ms. App monta um único Toaster e fornece rótulos do catálogo en-US.

Foram preservados Button e os tokens visuais existentes. O viewport usa camada acima dos overlays; o fechamento do toast interrompe pointerdown em bubble para não dispensar a Sheet. Documentação e teste público do adaptador foram atualizados. Não houve alteração de persistência, daemon, modais ou tsconfig.

## Validação e limites

Resultados finais revisados via context-mode: pnpm validate e pnpm build aprovados; repetição da suíte completa 210/210. Playwright CLI verificou tipos, fechamento, expiração, pausa por hover/foco, teclado, empilhamento, textos longos, viewport estreita e integração com Sheet real.

A checagem TSX adicional do Toast passou. Quatro diagnósticos preexistentes da App em content-header.tsx e thread-create-modal.tsx permanecem fora do escopo. O backlog de navegador foi atualizado; testes E2E duráveis continuam pendentes.

## Continuidade

A falha de auto-idle foi diagnosticada em investigação separada: o timer de 20 ms pode fechar o servidor antes da primeira conexão HTTP. O teste original sozinho falhou 8/8 e passou 8/8 após uma troca HTTP anterior; o caminho de daemon permaneceu igual ao baseline e não importa Toast/Base UI. Nenhum código de produto ou teste foi alterado por essa investigação.

Correção pendente em marc://$corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898.
Backlog E2E em marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a.
Plano e revisão detalhada estão nos artefatos anexados da thread. Auditoria de mensagens anterior ao resumo: zero findings.

