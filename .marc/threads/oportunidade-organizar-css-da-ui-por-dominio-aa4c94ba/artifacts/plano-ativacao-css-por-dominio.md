# Plano de ativacao da separacao do CSS por dominio

## Objetivo

Ativar a separacao estrutural do stylesheet da UI a partir das copias integrais commitadas pelo usuario, preservando integralmente seletores, declaracoes, ordem efetiva da cascade e comportamento visual.

## Diagnostico confirmado

- O commit-base `962fd3ff41de9fc3c9d39f68ed0cea20cb466abd` criou seis arquivos sob `src/ui/styles/`.
- Cada arquivo novo e uma copia byte a byte de `src/ui/styles.css` (`20.672` bytes, mesmo hash abreviado `c255c0f895775034`).
- `src/ui/main.tsx` continua importando apenas `./styles.css`; os novos arquivos ainda nao participam do bundle.
- `docs/assets/logo-preview.html` tambem esta no commit-base e nao pertence ao escopo desta execucao.

## Decisao de implementacao

A execucao podara cada copia para o seu bloco contiguo de responsabilidade e convertera `src/ui/styles.css` em agregador. O bloco `@theme inline` ficara em `foundation.css`, junto de `:root`, porque imports CSS locais precisam ser declarados no entrypoint antes de regras normais; assim a expansao dos imports preserva a sequencia original do stylesheet.

## Alteracoes

1. Manter em `src/ui/styles.css` somente `@layer`, os tres imports externos atuais e seis imports locais, nesta ordem: `foundation.css`, `shell-navigation.css`, `thread-content.css`, `overlays.css`, `composer-footer.css`, `responsive.css`.
2. Manter em `foundation.css` o bloco `@theme inline` e as regras de `:root` ate a regra base de `button, input, textarea`.
3. Manter em `shell-navigation.css` as regras de `.shell` ate `.nav-detail-row em`.
4. Manter em `thread-content.css` as regras de `.content-header` ate `.artifact-link small`.
5. Manter em `overlays.css` as regras de `.modal-panel` ate `.overview h3`.
6. Manter em `composer-footer.css` as regras de `.composer` ate `@keyframes spin`.
7. Manter em `responsive.css` somente o bloco `@media (max-width: 1100px)`.

## Restricoes

- Nao alterar valores, seletores, especificidade, ordem relativa, tokens, tipografia, cores, sombras, bordas, scroll, foco, modais ou breakpoints.
- Nao renomear classes nem consolidar duplicidades existentes.
- Nao alterar `docs/assets/logo-preview.html` nesta execucao.
- Nao alterar contratos TypeScript, schemas, persistencia ou comportamento mARC.

## Verificacao

1. Antes da edicao, executar uma checagem estrutural que confirme o estado RED esperado: arquivos novos ainda contem blocos fora de seus dominios e o entrypoint ainda nao os importa.
2. Depois da edicao, concatenar programaticamente o conteudo efetivo dos seis arquivos na ordem importada e comparar com o stylesheet original do commit-base, comprovando preservacao exata da sequencia CSS.
3. Executar `pnpm run validate`, `pnpm test` e `pnpm build`.
4. Fazer verificacao visual da UI por Playwright CLI quando a aplicacao reconstruida estiver disponivel, cobrindo colunas, modos da coluna central, Markdown/artifacts, composer, modais e viewport reduzida.

## Comunicacao final

Registrar na thread os arquivos ativados, a evidencia de equivalencia estrutural, os resultados das validacoes e que nao ha atualizacao documental necessaria por se tratar de refactor interno sem alteracao de comportamento. Aguardar feedback antes do encerramento da thread.
