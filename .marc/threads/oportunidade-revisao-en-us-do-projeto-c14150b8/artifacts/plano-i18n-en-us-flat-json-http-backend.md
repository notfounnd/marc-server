# Plano: i18n en-US com JSON plano e backend HTTP

## Summary

Implementar a base i18n do mARC com `en_US` como único idioma disponível agora, mas já preparada para seleção futura de idioma e inclusão simples de novos locales. A normalização vale para textos do produto mARC; conteúdo autoral do workspace continua livre em qualquer idioma.

## Key Changes

- Adicionar dependências runtime:
  - `i18next`
  - `react-i18next`
  - `i18next-http-backend`
- Criar traduções em JSON plano chave/valor, sem arrays:
  - `public/locales/en_US/translation.json`
  - exemplo: `"Synced {{time}}": "Synced {{time}}"`
- Configurar i18next com:
  - `lng: "en_US"`
  - `fallbackLng: "en_US"`
  - `supportedLngs: ["en_US"]`
  - `keySeparator: false`
  - `returnNull: false`
  - `backend.loadPath: "/locales/{{lng}}/translation.json"`
  - `interpolation.escapeValue: false`
  - `react.useSuspense: false`
- Não implementar seletor de idioma agora, mas deixar a inicialização compatível com `i18n.changeLanguage(...)`.

## Implementation

- UI React:
  - inicializar i18n no entrypoint;
  - usar `useTranslation()` em componentes;
  - trocar textos de interface por `t("same English text")`;
  - manter listas ordenadas no código, com cada item chamando uma chave textual própria.
- Core/MCP/daemon/CLI:
  - para runtime não-React, usar um helper síncrono simples baseado no mesmo JSON ou um wrapper i18next inicializado de forma compatível;
  - centralizar mensagens de produto: erros, status, tool descriptions, bootstrap/gate e templates gerados.
- Workspace:
  - `INSTRUCTIONS.md` e baseline gerenciado de `RULES.md` seguem en-US via textos do produto;
  - threads, messages, artifacts, summaries e custom rules não são normalizados.
- Documentação:
  - documentar a convenção de i18n:
    - JSON plano;
    - chave é a frase em inglês;
    - interpolação `{{value}}`;
    - não usar arrays no arquivo de tradução;
    - novos idiomas devem copiar o contrato de chaves;
    - backend HTTP já está preparado para carregar novos locales.

## Tests

- TDD para o helper i18n:
  - resolve `t("Cancel")`;
  - interpola `t("Synced {{time}}", { time: "10:30:00" })`;
  - cobre comportamento de chave ausente.
- Atualizar testes existentes que validam strings de workspace/MCP/daemon.
- Rodar:
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
- Fazer busca final por sinais de pt-BR em `src`, `test`, `docs`, `README.md`, `.marc/RULES.md` e `.marc/INSTRUCTIONS.md`, ignorando nomes próprios e conteúdo autoral do workspace.

## Finalização

- Antes de reportar conclusão, revisar documentação e atualizar quando necessário.
- Atualizar a thread Playwright `f742659a` somente se algum comportamento visual/browser testável entrar no escopo.
- Ao final, comentar na thread `c14150b8` o que foi implementado, arquivos principais afetados e validações executadas.
- Não encerrar a thread; aguardar feedback do usuário.
