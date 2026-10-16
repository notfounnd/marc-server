# Entrega do indicador de versão no rodapé

## Resultado

A UI agora exibe `v<versão>` logo após o crédito de desenvolvimento no rodapé, antes do atalho de teclado. `package.json` continua sendo a única fonte da versão: a configuração Vite lê o arquivo por caminho relativo ao próprio config e define `__MARC_VERSION__` com `JSON.stringify`. A declaração global tipa a constante. O rodapé permite quebra e truncamento do crédito em larguras estreitas.

O indicador identifica a versão da UI carregada. Ele não consulta o daemon, token ou workspace. Não foram adicionadas dependências nem valor de versão literal nos fontes autorizados. Uma varredura PowerShell final encontrou zero ocorrências duplicadas do literal de versão nos alvos autorizados.

## Arquivos e critérios

- `vite.config.ts:7,13`: lê a versão de `package.json` usando `new URL("./package.json", import.meta.url)` e injeta `__MARC_VERSION__`.
- `src/ui/vite-env.d.ts:1`: declaração global `string`.
- `src/ui/app-content.tsx:99-103`: mantém o crédito, acrescenta `v{__MARC_VERSION__}` e preserva o divisor e o atalho na ordem solicitada.
- `src/ui/styles/composer-footer.css:144-173`: permite flex-wrap, encolhimento e elipse do crédito e mantém a versão sem quebra.
- `test/ui-version.test.ts:20-92`: teste funcional usa Vite SSR real, importa o conteúdo TSX dinamicamente, renderiza com React e i18next, obtém o valor esperado de `package.json` e verifica a presença e ordem do crédito/versão. A asserção final verifica também que o crédito existe.
- `test/i18n.test.ts:71`: acrescenta apenas o teste novo à allowlist de testes que podem importar i18next. A integração revelou que a regra existente falhava sem esta entrada; o teste de i18n foi preservado.
- `docs/ui-and-daemon.md:115`: documenta que a versão representa o bundle UI e não a versão de um processo daemon.

`public/locales/en_US/translation.json` permaneceu inalterado; não foi necessário criar rótulo localizado.

## TDD e validação

O primeiro teste funcional falhou pelo motivo esperado: o markup ainda não continha a versão (RED). Depois da implementação, o teste focado passou. A execução combinada com i18n identificou inicialmente a violação da allowlist; após a expansão mínima autorizada, a execução focada combinada passou. Com a asserção de existência do crédito adicionada, a rodada final de versão+i18n passou **9/9**.

- Preflight final somente leitura: `pnpm run lint:check` e `pnpm run format:check`, ambos exit 0.
- `pnpm validate`: exit 0 no estado final, incluindo lint, formatação e typecheck. A rodada inicial de format-check apontou apenas `test/ui-version.test.ts`, dentro do escopo; validate write-mode foi então seguro. A execução de validate formatou o arquivo de teste autorizado.
- `pnpm build`: exit 0 após as alterações de runtime/configuração. Vite 7.3.2 transformou 2392 módulos e emitiu os assets de produção. Permaneceu o aviso já apresentado pelo Vite de chunk JavaScript acima de 500 kB; o bundle JS teve 672.35 kB.
- `pnpm test`: exit 0, 395/395, sem falhas, cancelamentos ou skips. Esta execução integral ocorreu imediatamente antes da asserção final de existência do crédito. Por ser uma mudança adicional restrita à asserção do teste, não repetimos build nem suíte integral conforme coordenação do principal; a rodada final focada 9/9 e validate cobriram o estado de teste final.

Os resultados acima foram conservados no relatório de execução, mas os blocos originais de stdout não estão disponíveis após a compactação desta sessão. Por isso, os dados reportados se limitam aos resultados/status e métricas preservados; não transcrevo linhas de saída que não posso verificar.

O principal reportou validação independente no browser do build de produção em 1280/420/320 px: versão visível, sem overflow horizontal, largura de documento igual à viewport, atalho abre/fecha, sem erros de página e sem requisições `/api` no cenário verificado. Essa evidência é do principal, não uma execução deste developer.

## Escopo e integridade

Não usei Git nem alterei arquivos fora do escopo autorizado. O thread paralelo `bc45139b` permaneceu fora desta tarefa. O locale permaneceu intacto. O plano original foi mantido; a única ampliação foi a inclusão de `test/i18n.test.ts` aprovada pelo principal para permitir explicitamente o novo teste na allowlist.

Hashes SHA-256 finais:

| Caminho | Hash final |
| --- | --- |
| `vite.config.ts` | `D0F07F0C525EC5EB7160351A060B2253832AF1075FE69F414071F633A3E8C785` |
| `src/ui/vite-env.d.ts` | `0FDBE2E97433D6A2A429F8E6C2C39D2F0AF9506F3F7F19D721D87846A32C137C` |
| `src/ui/app-content.tsx` | `38D209585889193A045B7BD3553727A07945C93CF57A5CBEE9E482103FC1903D` |
| `src/ui/styles/composer-footer.css` | `95D8D4603D911E8CECAE18DD9D775353CC63FC6E55E686D7E136EA01C9BC3EFB` |
| `test/ui-version.test.ts` | `A883734F79FB91978EC31B792B3DF610B6AD6ED19AEBB853544EE8430AFB2296` |
| `test/i18n.test.ts` | `9321CD677CF255A2C977672D5794DB621DFEEF33B623B431CE0FB4DCB8BBA806` |
| `docs/ui-and-daemon.md` | `9616409DCC2D2AB42D143DFA8C99A23FA9B7EF2F6B67B449C20B6AFA9F3BAA8F` |
| `public/locales/en_US/translation.json` (inalterado) | `1FF97D5D674B6D96BEFC7ECDC7EACBB1B6AD49E4F7CAF6DBAE3AB52A814516EA` |

## Estado de revisão

Implementação e validações do escopo delegado concluídas. A revisão técnica integrada do principal permanece pendente; esta entrega não declara aprovação final nem estado release-ready. A thread fica aberta para revisão humana.