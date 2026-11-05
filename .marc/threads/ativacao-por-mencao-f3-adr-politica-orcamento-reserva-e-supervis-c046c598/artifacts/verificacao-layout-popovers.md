# Verificação do layout das popovers do cabeçalho

Escopo: correção de layout pedida no aceite da F3c. Popovers do cabeçalho da thread: Artifacts, Activation policy (⚡) e Thread sessions.

## Medições

Lidas no DOM com getComputedStyle, em janela headless (1280 x 800 e 390 x 844 px). A altura máxima efetiva é 560 px nas três.

| Popover | Largura | Largura do conteúdo com gutter | Rolagem (scrollHeight / clientHeight) | Linha sob o cabeçalho |
|---|---|---|---|---|
| Ativação (1280) | 380 px | 361 px | 673 / 556 | 1 px no cabeçalho; 0 px na primeira seção; 1 px entre seções |
| Artifacts (1280) | 420 px | 401 px | 1240 / 556 | 1 px no cabeçalho |
| Sessions (1280) | 380 px | 361 px | 605 / 556 | 1 px no cabeçalho |
| Ativação (390) | 342 px | 323 px | 693 / 556 | 1 px no cabeçalho; 0 px na primeira seção |
| Artifacts (390) | 342 px | 323 px | 1240 / 556 | 1 px no cabeçalho |
| Sessions (390) | 342 px | 323 px | 605 / 556 | 1 px no cabeçalho |

- As três têm overflow-y auto e scrollbar-gutter stable.
- A largura do conteúdo é a mesma com e sem barra (361 px em 1280), então nada se desloca quando a barra aparece.
- No ⚡, o rodapé fica fixo: com a rolagem em 0 e no fim (117 px), a borda inferior do rodapé fica na mesma posição (749 px). O botão Save fica visível nos dois casos.
- Em 390 px, o rodapé e o Save também ficam visíveis no fim da rolagem.

## Varredura de blocos duplicados (src/ui/styles)

- Antes da consolidação, três blocos repetiam declarações que eu tinha criado: largura de 380 px (ativação e sessions), corpo em grid (activation-scroll e sessions-body) e seção em grid (activation-section e sessions-group/sessions-section). Foram unificados em popover-panel.css, com seletores combinados.
- Resultado final: 346 blocos com declarações e 32 grupos repetidos. Todos já existiam antes desta tarefa (cores de estado, position relative, gap 6px, outline de foco e similares) e ficaram fora do escopo.

## Checagens

- pnpm typecheck: exit 0.
- pnpm code:check: exit 0.
- pnpm build: exit 0.
- pnpm test: exit 0, 2493 testes, 2493 aprovados, 0 falhas.
- pnpm validate: não executado, por decisão do principal (efeitos de escrita do lint e da formatação). Registrado como limite.

## Limites

- Holds e participantes reais não entraram na instância temporária. O conteúdo longo do ⚡ veio de seções reais clonadas no DOM. Ativar a política numa cópia poderia acionar a supervisão, por isso não fiz isso.
- A barra de rolagem não aparece em captura headless. Ela foi vista em janela visível durante a validação, mas as capturas desse teste não foram guardadas. A evidência reprodutível é a medição de overflow e de gutter acima.
