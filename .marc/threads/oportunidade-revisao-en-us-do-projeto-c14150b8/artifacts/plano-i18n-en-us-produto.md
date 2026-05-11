# Plano: i18n en-US e revisão de textos do produto

## Summary

Implementar a base inicial de i18n do mARC com `en-US` como único locale ativo agora, mas com estrutura preparada para adicionar novos locales no futuro. A normalização linguística vale apenas para o produto: código, interface, daemon/MCP/CLI, templates e documentação. Conteúdo autoral do workspace continua livre em qualquer idioma.

## Key Changes

- Criar `src/i18n` com locale inicial `en_US` e um contrato simples para futura adição de locales.
- Usar `translation.ts` em vez de JSON neste primeiro passo, mantendo tipagem forte e evitando ajuste de import JSON no build NodeNext.
- Expor helper tipado `t(key, vars?)` e manter o locale ativo centralizado, hoje fixo em `en_US`.
- Preparar a arquitetura para futuro suporte multi-locale, sem implementar seletor de idioma, persistência de preferência ou autodetecção agora.
- Preservar threads, mensagens, artifacts, summaries, custom rules e registros operacionais no idioma em que forem escritos.

## Implementation Changes

- Antes de iniciar a thread, executar o fluxo das rules: chamar `workspace_update_recommendations` e ler `RULES.md` como contrato de trabalho.
- Migrar textos de produto para tokens i18n:
  - UI React: labels, títulos, empty states, tooltips, botões, status, modals, composer e mensagens de erro/status.
  - Daemon/MCP/CLI: erros HTTP, usage da CLI, bootstrap/gate, tool descriptions e conteúdo do `marc_helper`.
  - Templates gerados: `INSTRUCTIONS.md` e baseline gerenciado de `RULES.md`.
- Manter fora do i18n:
  - conteúdo de threads, artifacts, summaries, custom rules do usuário e qualquer mensagem que represente conversa real do workspace.
- Documentar a convenção de i18n:
  - `en_US` é o único locale entregue agora;
  - novos locales devem replicar o contrato de chaves;
  - textos de workspace não devem ser normalizados;
  - o design deve se alinhar à oportunidade de arquitetura referenciada em `marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2`.

## Tests

- Adicionar testes unitários para o helper i18n:
  - resolve chave existente;
  - interpola variáveis;
  - falha de forma previsível para chave ausente.
- Atualizar testes que validam strings geradas por workspace/MCP/daemon para refletir textos centralizados.
- Rodar:
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
- Fazer busca final por sinais de pt-BR em `src`, `test`, `docs`, `README.md`, `.marc/RULES.md` e `.marc/INSTRUCTIONS.md`, ignorando nomes próprios como `Júnior`.

## Finalização

- Antes de reportar conclusão, revisar documentação e atualizar ou expandir quando necessário.
- Como esta não é uma implementação UI/browser, não atualizar a thread Playwright `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a`, salvo se algum ajuste visual entrar no escopo durante a execução.
- Ao final, postar na thread `c14150b8` o que foi implementado, arquivos principais afetados e validações executadas.
- Não criar `SUMMARY.md`; aguardar feedback do usuário para orientar o encerramento.

## Assumptions

- `translation.ts` é o formato inicial mais seguro para tipagem e build atual.
- `en-US` é o idioma do produto, não uma regra para o conteúdo escrito pelos usuários/agentes.
- O trabalho entrega o caminho arquitetural para localização futura, mas não entrega multi-idioma funcional nesta etapa.
