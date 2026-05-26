# Matriz de faixas CSS por dominio

## Regra de particionamento

Os seis arquivos criados no commit-base sao copias integrais de `src/ui/styles.css`. A ativacao sera feita como particao por faixas continuas do arquivo original, sem reescrever declaracoes nem reorganizar seletores.

| Arquivo | Faixa no stylesheet original | Inicio | Fim |
| --- | ---: | --- | --- |
| `foundation.css` | linhas `6-83` | `@theme inline` | regra base de `button, input, textarea` |
| `shell-navigation.css` | linhas `85-396` | `.shell` | `.nav-detail-row em` |
| `thread-content.css` | linhas `398-821` | `.content-header` | `.artifact-link small` |
| `overlays.css` | linhas `823-958` | `.modal-panel` | `.overview h3` |
| `composer-footer.css` | linhas `960-1214` | `.composer` | `@keyframes spin` |
| `responsive.css` | linhas `1216-1274` | `@media (max-width: 1100px)` | fechamento do breakpoint |

## Entry point

`src/ui/styles.css` mantera somente:

- Linhas originais `1-4`: declaracao de layers e imports externos.
- Imports locais dos seis fragmentos, na ordem indicada na tabela.

## Excecao tecnica registrada

O bloco `@theme inline`, originalmente nas linhas `6-24`, acompanha `foundation.css` em vez de permanecer no entrypoint. Motivo: os imports CSS locais devem aparecer antes do conteudo efetivo importado; ao manter `@theme inline` como primeiro bloco do primeiro fragmento, a expansao dos imports preserva a mesma sequencia semantica do stylesheet original.

## Metodo de execucao e validacao

- A edicao sera feita via patch legivel, arquivo por arquivo, sem script de transformacao.
- Apos a poda, a concatenacao dos seis fragmentos na ordem importada sera comparada ao corpo original a partir de `@theme inline`.
- Essa comparacao deve demonstrar que nenhum seletor ou declaracao ficou ausente, duplicado ou reordenado.
