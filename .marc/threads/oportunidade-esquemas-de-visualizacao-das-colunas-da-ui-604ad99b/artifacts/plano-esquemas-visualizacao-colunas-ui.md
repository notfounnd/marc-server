# Plano - Esquemas De Visualizacao Das Colunas Da UI

## Summary

Implementar os ajustes da thread `604ad99b` na UI de tres colunas:

- modal fecha ao clicar fora;
- app de fundo nao rola enquanto modal esta aberta;
- Marckers vira um modo exclusivo da coluna do meio, igual ao arquivo;
- cada coluna tem sua propria rolagem;
- rodape da terceira coluna fica sempre visivel.

## Key Changes

- Modal:
  - Clique fora do painel fecha o modal.
  - Botao `X` continua fechando o modal.
  - Clique dentro do painel nao fecha.
  - Fundo/app nao rola enquanto modal esta aberta.
  - `Escape` nao entra como requisito novo.

- Coluna do meio:
  - Trabalhar em `src/ui/app-sidebar.tsx`, na area `<nav className="middle">`.
  - Remover a secao fixa de Marckers que hoje aparece abaixo de Threads.
  - Adicionar botao `Marckers` no cabecalho da coluna, a esquerda do botao de arquivo.
  - Controlar a coluna por modo: `threads`, `marckers`, `archive`.
  - Modo `threads`: mostra apenas threads abertas.
  - Modo `marckers`: mostra apenas agentes/Marckers e um botao de fechar.
  - Modo `archive`: mostra apenas threads arquivadas/fechadas e um botao de fechar.
  - Botao de fechar em `marckers` ou `archive` volta para `threads`.

- Marckers:
  - Marckers sao os agentes ja carregados pelo workspace.
  - Reaproveitar o visual/listagem atual dos agentes.
  - Selecionar um Marcker continua abrindo o agente na terceira coluna.
  - A lista de agentes nao aparece mais abaixo de threads.

- Rolagem:
  - Shell ocupa a altura da viewport.
  - Coluna de workspaces, coluna do meio e terceira coluna tem rolagem propria.
  - Thread longa rola so na terceira coluna.

- Rodape:
  - Rodape fica sempre visivel na terceira coluna.
  - Botao de atalhos permanece.
  - Adicionar texto ao lado esquerdo do botao: `Developed by Junior Sbrissa`.

## Implementation Notes

- `src/ui/app-sidebar.tsx`:
  - substituir `showClosedThreads` por `middleMode: "threads" | "marckers" | "archive"`;
  - renderizar botoes do cabecalho na ordem: `Marckers`, arquivo/fechar conforme modo;
  - usar o mesmo padrao visual e comportamental para `marckers` e `archive`;
  - remover a renderizacao da secao Marckers abaixo da lista de threads.

- `src/ui/main.tsx`:
  - trocar estado booleano por modo da coluna do meio;
  - abrir `marckers` ao clicar no botao Marckers;
  - abrir `archive` ao clicar no botao de arquivo;
  - voltar para `threads` ao clicar no fechar;
  - bloquear/desbloquear rolagem do documento quando modal estiver aberta.

- `src/ui/modals.tsx`:
  - fechar modal por clique na camada externa;
  - parar propagacao de clique no painel.

- `src/ui/styles.css`:
  - ajustar altura e overflow das colunas;
  - manter footer fora da area rolavel da terceira coluna.

- `public/locales/en_US/translation.json`:
  - adicionar textos para `Show Marckers`, `Close Marckers` e `Developed by Junior Sbrissa`.

## Test Plan

- Modal:
  - clique fora fecha;
  - clique no `X` fecha;
  - clique dentro nao fecha;
  - fundo/app nao rola com modal aberta.

- Coluna do meio:
  - `threads` mostra apenas threads abertas;
  - nao existe secao Marckers abaixo de threads;
  - botao Marckers fica a esquerda do botao de arquivo;
  - clicar Marckers mostra apenas agentes e botao fechar;
  - clicar arquivo mostra apenas arquivadas/fechadas e botao fechar;
  - fechar em qualquer modo volta para threads.

- Layout:
  - cada coluna tem rolagem propria;
  - thread longa nao desloca as outras colunas;
  - rodape da terceira coluna permanece visivel.

- Validacao final:
  - `pnpm run validate`
  - `pnpm test`
  - `pnpm build`

## Assumptions

- “Botao de arquivo” e o botao atual no cabecalho da coluna do meio.
- “Marckers” e a lista de agentes, agora exibida somente no modo exclusivo da coluna do meio.
- A mudanca e de UI/estado local; nenhum schema persistente sera alterado.
- Markdown permanece como fonte de verdade; UI e caches continuam derivados.
