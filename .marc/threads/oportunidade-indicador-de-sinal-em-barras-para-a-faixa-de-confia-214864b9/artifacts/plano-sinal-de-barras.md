# Plano - Sinal de barras para a faixa de confiança

## Resumo

O plano troca o rótulo textual da faixa ("High confidence", "Medium confidence" e "Low confidence") dos cards da busca de memória na UI por um ícone de sinal numa linha própria abaixo do texto do card, alinhado à direita. O texto da faixa continua como tooltip e como nome acessível. A busca, o cálculo da faixa, o bloco recolhido da faixa baixa e a ausência de score não mudam.

Não há questões pendentes. O plano foi aprovado pelo humano em 30/10.

**Revisão de 31/10:** ao ver a primeira entrega, o humano corrigiu o layout. O slot `trailing` criava uma terceira coluna e apertava o texto. O ícone passou para uma linha horizontal abaixo do texto. Este documento já traz o desenho corrigido.

## Decisões

- **Ícones:** o humano escolheu `SignalHigh`, `SignalMedium` e `SignalLow` do lucide-react, que já está instalado na versão 1.23. Não entra dependência nova.
- **Cor:** uma só nos três níveis, `--ink-muted` (`#637083`), o mesmo cinza do trecho casado no card. O nível se lê pela quantidade de barras. Verde, âmbar ou vermelho leriam como nota de qualidade, e a faixa é força relativa e heurística (ADR 0011).
- **Tooltip:** o `title` nativo do navegador, como no resto da barra lateral. Aparece só com o mouse sobre o ícone. No resto do card continua o tooltip atual, com o trecho casado.
- **Acessibilidade:** `role="img"` e `aria-label` com o texto da faixa.
- **Faixa inválida na resposta ao vivo:** o card fica sem ícone. Hoje ele mostra um rótulo vazio.
- **Fora do escopo:** o ícone de tipo de fonte e a busca nas camadas 1 e 2, como a mensagem de abertura já registrava.

## Desenho

1. **Componente novo:** `src/ui/memory-search-signal.tsx` exporta `MemorySearchBandSignal({ band, t })`.
   - Tem uma tabela de despacho `BAND_SIGNALS: Record<MemoryBand, { Icon, labelKey }>`: high → `SignalHigh`, medium → `SignalMedium` e low → `SignalLow`. As chaves de tradução são as atuais.
   - Uma guarda por early return devolve `null` quando a faixa não está na tabela.
   - Renderiza um `span.memory-search-signal-row` em volta de `<span className="memory-search-signal" role="img" aria-label title data-band>`, com o ícone de 16 px marcado com `aria-hidden`. Com faixa inválida, nem a linha aparece.
2. **Painel:** `src/ui/memory-search-panel.tsx` renderiza o componente como filho do `NavItem`, depois do trecho casado, e remove o span textual e `BAND_LABEL_KEYS`. O `NavItem` não muda.
3. **CSS:** `src/ui/styles/shell-navigation.css` ganha duas regras:
   - `.memory-search-signal-row`, com `display: flex`, `justify-content: flex-end` e `margin-top: 6px`;
   - `.memory-search-signal`, com `display: inline-flex` e `color: var(--ink-muted)`.
4. **Docs:** a seção "UI search" de `docs/memory.md` descreve o ícone, o tooltip e o nome acessível.

## Escopo de escrita

- **Código:**
  - `src/ui/memory-search-signal.tsx` (novo);
  - `src/ui/memory-search-panel.tsx`;
  - `src/ui/styles/shell-navigation.css`.
- **Testes:**
  - `test/ui-memory-search-signal.test.ts` (novo);
  - `test/ui-memory-search-panel.test.ts`.
- **Docs:** `docs/memory.md`.

**Exclusões:** `.marc/**`, `package.json`, `pnpm-lock.yaml`, locales, `NavItem`, `memory-search.ts`, tipos, core e daemon.

## Testes

Os testes são declarativos, sem if, else, switch ou ternário.

- **Render**, por `renderToStaticMarkup`, no padrão de `test/ui-markdown-panel.test.ts`:
  - cada faixa gera a classe `lucide-signal-*` correta e traz `aria-label`, `title`, `role="img"` e `data-band`;
  - faixa inválida gera markup vazio;
  - nenhum dígito, `%` ou "score".
- **Painel:**
  - renderiza `MemorySearchBandSignal` como filho do card, sem `trailing=`, e não usa mais `memory-search-band` nem `BAND_LABEL_KEYS`;
  - o CSS contém as duas regras novas e não contém `.memory-search-results .nav-trailing`.

## Execução e validação

1. **Desenvolvimento:** marc://@claude-dev, em modo sequencial com um desenvolvedor. Checks: `pnpm validate`, `pnpm build` e `pnpm test`. O desenvolvedor publica a própria entrega.
2. **UI:** o principal valida com o Playwright CLI, com recall interceptado nas três faixas, em desktop e em 390×844:
   - ícone e posição;
   - tooltip e nome acessível;
   - bloco recolhido abrindo e fechando;
   - nenhum score;
   - nenhum erro de console.
3. **Backlog:** a seção "Memory Confidence Bands" de marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a é revisada.
4. **Revisão final:** revisão final integrada, depois a aceitação do humano. Sem encerramento nem Git sem autorização.
