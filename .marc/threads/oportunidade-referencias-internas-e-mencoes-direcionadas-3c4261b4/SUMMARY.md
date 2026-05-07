# Resumo executivo

Thread: `oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4`
Closed: `2026-05-06T05:01:27.248Z`

## Objetivo

Implementar referências internas navegáveis e menções direcionadas na UI do mARC, usando uma gramática canônica `marc://` para agentes, threads, mensagens e artifacts vinculados a mensagens.

## Resultado

A oportunidade foi tratada com implementação completa da primeira versão do fluxo:

- Parser core para referências `marc://`.
- Renderização de links internos em Markdown.
- Navegação por agente, thread, mensagem e artifact.
- Leitura de artifact vinculado a mensagem via API.
- Modal Markdown para artifacts.
- Menu flutuante de artifacts no cabeçalho da thread.
- Exibição de IDs de mensagens nos cards.
- Cópia de referências prontas para agente, mensagem e thread.
- Toast transitório para feedback de cópia.

## Gramática implementada

- Agente: `marc://@agent-id`.
- Mensagem da thread atual: `marc://#message-id`.
- Thread: `marc://$thread-id`.
- Mensagem em outra thread: `marc://$thread-id/#message-id`.
- Artifact de mensagem atual: `marc://#message-id/!artifact-file.md`.
- Artifact de mensagem em outra thread: `marc://$thread-id/#message-id/!artifact-file.md`.

## Decisões

- Artifact pertence à mensagem, não diretamente à thread.
- Links `marc://...` preservam o `href` canônico, mas exibem labels curtos e consistentes.
- Links Markdown com texto customizado, como `[texto](marc://@agent-id)`, são renderizados com label canônico.
- O menu de artifacts fica no header da thread e lista anexos na ordem das mensagens.
- Feedback de cópia usa toast no canto inferior direito no desktop e largura responsiva em telas estreitas.
- A thread Playwright separada deve registrar apenas cenários E2E futuros, não validações unitárias da implementação atual.

## Testes e validação

Foram adicionados testes puros para contratos de link em `test/ui-marc-links.test.ts`, com lógica extraída para `src/ui/marc-links.ts`.

Cobertura adicionada:

- Labels canônicos para agente, mensagem, thread e artifact.
- Labels cross-thread exibindo somente o alvo curto.
- Autolink de referências `marc://...`.
- Preservação de inline code, fenced code e destinos Markdown existentes.
- Preservação de URLs `marc://...` no transform do Markdown.
- Bloqueio padrão para URL perigosa como `javascript:`.
- Correção do bug de pontuação final em autolink.

Validação final registrada:

- `pnpm test`: 27 testes, 27 pass.
- `pnpm typecheck`: exit 0.
- `pnpm build`: exit 0.

## Continuidade

Os cenários Playwright pendentes foram registrados em `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a`, no artifact `artifacts/playwright-test-scenarios.md`.

## Estado final

A oportunidade foi concluída e encerrada. Novos refinamentos de UI ou cobertura Playwright devem seguir em threads próprias ou na thread de backlog Playwright.
