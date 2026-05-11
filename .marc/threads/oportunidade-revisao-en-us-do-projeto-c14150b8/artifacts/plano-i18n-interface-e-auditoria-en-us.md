# Plano: i18n da Interface + Auditoria en-US do Código

## Summary

Tratar a thread `c14150b8` em dois eixos separados:

1. i18n somente para a interface web: textos que o usuário vê no painel.
2. auditoria en-US em todo o código do produto: corrigir qualquer identificador, comentário, texto técnico, mensagem literal, template ou documentação do projeto que esteja fora de inglês americano.

MCP/backend/core/CLI continuam em en-US literal. Eles entram na auditoria de idioma, mas não entram no i18n.

## Key Changes

- Manter `i18next`, `react-i18next` e `i18next-http-backend` para preparar a interface para idiomas futuros.
- Usar `public/locales/en_US/translation.json` com JSON plano chave/valor, sem arrays.
- Configurar i18n apenas no frontend: `src/ui/i18n.ts` e `src/ui/main.tsx`.
- Auditar o restante do código para garantir en-US literal: `src/**`, `test/**`, `docs/**`, `README.md` e templates gerados pelo produto.
- Não internacionalizar contratos técnicos: MCP tool names/descriptions/schemas, backend/daemon/CLI/core errors, `INSTRUCTIONS.md` e baseline de `RULES.md` ficam em inglês literal.

## Implementation

- Interface i18n:
  - inicializar `react-i18next` com HTTP backend;
  - usar `useTranslation()` apenas em componentes React;
  - migrar labels, botões, placeholders, tooltips, modais, empty states e status visíveis da UI para `t("English text")`;
  - usar interpolação `{{value}}`;
  - não traduzir dados vindos do workspace: threads, messages, artifacts, summaries, agent profiles e RULES renderizado.
- Auditoria en-US:
  - buscar sinais de pt-BR e textos fora de en-US em `src`, `test`, `docs`, `README.md` e arquivos base do mARC;
  - corrigir textos de código/produto para en-US literal quando não forem interface;
  - manter conteúdo histórico/autoral de threads e artifacts fora da normalização.
- Catálogo:
  - remover qualquer chave que pertença exclusivamente a MCP/backend/core/CLI se ela não aparece na UI;
  - manter somente textos que a interface renderiza.
- Strategy/early return:
  - usar early return para reduzir aninhamento;
  - usar strategy quando houver variação real de resolução/comportamento, como carregamento de catálogo.

## Tests

- `test/i18n.test.ts`:
  - locale inicial `en_US`;
  - catálogo plano sem arrays/objetos;
  - lookup de texto UI;
  - interpolação `{{time}}`;
  - fallback para a própria chave.
- Teste estático:
  - i18n só pode ser importado por `src/ui/**` e testes i18n;
  - falha se `src/core`, `src/daemon`, `src/mcp` ou `src/cli.ts` importarem i18n.
- Auditoria:
  - busca final por pt-BR em `src`, `test`, `docs`, `README.md`, `.marc/RULES.md`, `.marc/INSTRUCTIONS.md`;
  - ignorar nomes próprios e conteúdo autoral/histórico do workspace.
- Rodar `pnpm test`, `pnpm typecheck` e `pnpm build`.

## Documentation And Thread

- Atualizar documentação do projeto para explicar:
  - i18n é da interface;
  - código/produto deve estar em en-US;
  - backend/MCP/core/CLI não usam i18n, mas devem permanecer em inglês;
  - conteúdo do workspace é livre e não deve ser normalizado.
- Ao final, postar na thread o que foi feito, arquivos principais alterados, validações executadas e confirmação explícita dos dois eixos: i18n da UI e auditoria en-US do código.
- Não encerrar a thread; aguardar feedback.
