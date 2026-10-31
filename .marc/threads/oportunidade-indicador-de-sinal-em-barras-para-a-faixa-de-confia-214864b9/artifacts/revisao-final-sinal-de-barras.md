# Revisão final integrada - Sinal de barras para a faixa de confiança

## Veredito

**Aprovado na revisão técnica, na segunda revisão (31/10).** Aguarda a aceitação do humano.

A primeira aprovação (msg_a9e2d6f1d69f4da98f) deixou de valer. O humano viu que o ícone em coluna própria apertava o texto do card e pediu uma linha horizontal abaixo do texto. A minha primeira validação media só a posição do ícone e não a largura do texto, por isso o problema passou. Esta revisão substitui aquela e cobre o estado depois da correção.

## Escopo e fontes revisados

- O plano `plano-sinal-de-barras.md`, com a revisão de 31/10, e a entrega do desenvolvedor (msg_c60859acf3ef41fa83, `entrega-sinal-de-barras.md`).
- O estado integrado dos 6 arquivos, lidos por inteiro nos trechos alterados:
  - `src/ui/memory-search-signal.tsx` (novo);
  - `src/ui/memory-search-panel.tsx`;
  - `src/ui/styles/shell-navigation.css`;
  - `test/ui-memory-search-signal.test.ts` (novo);
  - `test/ui-memory-search-panel.test.ts`;
  - `docs/memory.md`.
- **Execução:** marc://@claude-dev, com Haiku 5.5 em xhigh por confirmação do humano, em modo sequencial com um desenvolvedor. O `OK_BOOTSTRAP` foi verificado antes da autorização.

## Critérios e evidência

| Critério do plano | Implementação | Evidência verificada pelo principal |
|---|---|---|
| Ícones `SignalHigh`, `SignalMedium` e `SignalLow` por faixa | Tabela de despacho `BAND_SIGNALS` em `memory-search-signal.tsx:7-13` | Teste de render por faixa. No browser, cada card tem a classe `lucide-signal-*` certa |
| Tooltip nativo e nome acessível com o texto da faixa | `role="img"`, `aria-label`, `title` e `data-band` no span interno (`:27-34`); ícone com `aria-hidden` | Teste de render. No browser, sobre o ícone o `title` mais próximo é a faixa, e sobre o trecho é o texto casado |
| Linha horizontal abaixo do texto, alinhada à direita | Componente como filho do `NavItem` (`memory-search-panel.tsx:266`) e `.memory-search-signal-row` (`shell-navigation.css:330-334`) | No browser, em todos os cards, o ícone fica 6 px abaixo do trecho e na mesma borda direita do texto (21 px da borda do card), a 12 px da base, em desktop e em 390×844 |
| Texto com a largura toda | Sem a prop `trailing`, a terceira coluna do grid fica vazia | Coluna de texto com 237 px em card de 307 px e 284 px em card de 354 px, igual nos cards com e sem ícone, nenhum `.nav-trailing` renderizado |
| Uma cor neutra nos três níveis | `.memory-search-signal { color: var(--ink-muted); }` | Cor computada `rgb(99, 112, 131)` nas três faixas |
| Faixa inválida não quebra | Guarda `if (!signal) return null;` (`:23`) | Teste com markup vazio. No browser, o card da faixa "bogus" aparece sem ícone |
| Bloco recolhido e ausência de score preservados | `splitMemorySearchBands` não mudou | No browser, a faixa baixa só aparece no bloco aberto, e não há `%` nem score no texto |
| Docs | `docs/memory.md:184` | Lido e coerente com o comportamento |

## Validação

Todos os números abaixo são do estado depois da correção.

- **Desenvolvedor:**
  - `pnpm validate` exit 0, com mtime estável em 503 arquivos;
  - `pnpm build` exit 0;
  - `pnpm test` 1173/1173.
- **Principal:**
  - testes focados de signal, panel e hits: 11/11;
  - `pnpm typecheck` ok.
- **Playwright CLI** (principal, recall interceptado, UI do daemon com o bundle novo):
  - três faixas, faixa inválida e bloco recolhido, que abre e fecha;
  - desktop e 390×844 sem rolagem horizontal;
  - 0 erros de console.
  - A exibição do tooltip nativo na tela não foi exercitada; foi verificado qual `title` vale em cada ponto do card.

## Achados e limites

- **Achado corrigido:** o ícone em terceira coluna apertava o texto. A correção veio do humano, e a validação agora mede também a largura do texto.
- **Sem achados bloqueantes no estado atual.**
- O `import * as React` no componente novo segue `markdown-panel.tsx`, porque o runner de teste usa JSX clássico. É coerente com o padrão existente.
- A coluna de texto termina a 21 px da borda do card, e não nos 12 px do padding, porque o grid do `NavItem` mantém o espaçamento da terceira coluna vazia. Isso já valia antes desta oportunidade para os cards sem `trailing`, e o `NavItem` está fora do escopo.
- Com faixa inválida, o card não tem a linha do ícone e fica mais baixo que os demais. É o comportamento esperado.
- O ícone é discreto, porque tem 16 px e usa o cinza do texto secundário. Isso é intencional pelo plano, e ajustar tamanho ou contraste é decisão visual do humano.
- O backlog marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a foi revisado (msg_14552439774445e79e). A cobertura E2E durável continua pendente.
- Nenhuma dependência nova, nenhuma mudança em core, daemon, tipos ou locales.
