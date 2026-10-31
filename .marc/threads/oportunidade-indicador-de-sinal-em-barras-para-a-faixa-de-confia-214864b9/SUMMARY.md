# Oportunidade - Indicador de sinal em barras para a faixa de confiança nos cards da busca

Thread: marc://$oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9

Closed: `2026-10-31T04:14:46.366Z`

---

Os cards da busca de memória na UI deixaram de mostrar o rótulo textual da faixa ("High confidence", "Medium confidence" e "Low confidence") e passaram a mostrar um ícone de sinal do lucide numa linha própria abaixo do texto, alinhado à direita. O humano aceitou o resultado e autorizou o encerramento em 31/10.

## Decisão

- **Ícones:** o humano escolheu `SignalHigh`, `SignalMedium` e `SignalLow` do lucide-react, já instalado. O nível se lê pela quantidade de barras: três em high, duas em medium e uma em low. Não entrou dependência nova.
- **Layout:** o ícone fica numa linha horizontal abaixo do texto. A primeira versão usava o slot `trailing` do `NavItem`, que criava uma terceira coluna e apertava o texto. O humano rejeitou essa versão, e a aprovação técnica anterior foi anulada.
- **Cor:** uma só nos três níveis, `--ink-muted`, porque a faixa é força relativa e heurística (ADR 0011), não nota de qualidade.
- **Tooltip e acessibilidade:** o `title` nativo e o `aria-label` trazem o nome da faixa. Sobre o ícone vale a faixa, e no resto do card continua o tooltip com o trecho encontrado.
- **Faixa inválida na resposta ao vivo:** o card fica sem a linha do ícone.
- **Fora do escopo:** o ícone de tipo de fonte e a busca nas camadas 1 e 2 continuam para depois do estudo de modelos, como a abertura da thread registrava.

## Entrega

- `src/ui/memory-search-signal.tsx` (novo): `MemorySearchBandSignal`, com a tabela de despacho `BAND_SIGNALS` e a guarda para faixa inválida.
- `src/ui/memory-search-panel.tsx`: o componente entra como filho do `NavItem`, depois do trecho. Saíram o span textual e `BAND_LABEL_KEYS`.
- `src/ui/styles/shell-navigation.css`: regras `.memory-search-signal-row` e `.memory-search-signal`.
- `test/ui-memory-search-signal.test.ts` (novo) e `test/ui-memory-search-panel.test.ts`.
- `docs/memory.md`: seção "UI search".

A busca, o cálculo da faixa, o bloco "Show less likely results", a ausência de score, o `NavItem`, os tipos, o core, o daemon e os locales não mudaram. Nenhuma persistência mudou, e o Markdown continua sendo a fonte dos registros.

## Validação

- **Desenvolvedor** (marc://@claude-dev, Haiku 5.5 em xhigh, sequencial), no estado final: `pnpm validate` e `pnpm build` com exit 0 e `pnpm test` com 1173/1173.
- **Principal:** testes focados 11/11 e `pnpm typecheck` ok.
- **Playwright CLI,** com recall interceptado na UI do daemon, em desktop e em 390×844:
  - ícone certo por faixa, 6 px abaixo do trecho e na borda direita do texto;
  - coluna de texto com a mesma largura nos cards com e sem ícone;
  - faixa inválida sem linha de ícone, bloco recolhido abrindo e fechando, sem rolagem horizontal e 0 erros de console.
- **Auditorias:** `artifacts`, `references` e `messages` sem achados.
- A revisão final está em `revisao-final-sinal-de-barras.md`, e o plano com a correção de layout em `plano-sinal-de-barras.md`.

## Limites e continuidade

- A exibição do tooltip nativo na tela não foi exercitada. Foi verificado qual `title` vale em cada ponto do card.
- A coluna de texto termina a 21 px da borda do card, e não nos 12 px do padding, porque o grid do `NavItem` mantém o espaçamento da terceira coluna vazia. Isso afeta os itens da barra lateral sem `trailing` e ficou fora do escopo.
- O ícone é discreto, com 16 px e cor de texto secundário. Contraste ou tamanho podem ser ajustados só no CSS.
- O backlog marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a foi revisado antes do encerramento (msg_14552439774445e79e e msg_d4a646c94f6c402aa9). A cobertura E2E durável continua pendente.
