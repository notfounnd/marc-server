# Proposta inicial: painel de fontes de documentos da memória

Autor: marc://@claude-software-architect. Data: 14/11/2026. Natureza: registro de oportunidade, sem implementação.

## Problema

A lista `memory.documentSources` em `.marc/marc.config.json` só se edita à mão. A UI e a API de configurações não a editam (`docs/memory.md`), e o painel preserva a lista ao gravar. Na prática, o usuário não descobre que dá para indexar documentos.

A E1 do motor de busca deixou o recurso assim por escopo, não por uma decisão contra ter UI (marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3).

## Proposta acordada com o humano

1. **Um navegador de arquivos em árvore no painel, lido pelo daemon a partir da raiz da workspace.** O navegador não dá o caminho real de um arquivo, então quem lista os arquivos é o daemon, por uma rota só de leitura.
2. **A árvore mostra só o que é indexável.** Aparecem as pastas que contêm `.md` e os próprios `.md`. Ficam de fora:
   - tudo que está fora da raiz;
   - o `.marc/` e o `node_modules`;
   - os links, que não são seguidos.

   A árvore usa as mesmas regras da indexação, então não dá para escolher algo que a indexação depois rejeitaria.
3. **Só caminhos relativos.** O `marc.config.json` vai para o Git, e o índice `.marc/memory` também. Por isso o arquivo de configuração continua portátil, e o índice só traz conteúdo que já está no repositório. Para indexar um documento de fora, o usuário o traz para dentro do repositório, o que é uma escolha explícita.
4. **Caixas de três estados.** Marcar uma pasta grava a pasta como uma fonte só, não arquivo por arquivo. Assim um `.md` novo naquela pasta já entra sozinho, e a configuração fica curta. A caixa parcial aparece quando só alguns arquivos dentro da pasta estão marcados.
5. **Um resumo das fontes acima da árvore,** cada uma com a autoridade `normative` ou `reference`. A árvore serve para escolher, e o resumo mostra o que está valendo. A autoridade não aparece em cada linha da árvore.
6. **Carga e filtro:** os níveis da árvore carregam quando o usuário expande a pasta, e um campo de filtro fica no topo.
7. **Ferramenta MCP para o agente,** com a mesma validação. O agente só registra fontes como `reference`. Um documento `normative` vira regra no `memory_recall`, então essa promoção é decisão humana, feita no painel.
8. **Rebuild:** mudar as fontes deixa o índice defasado. O painel deve mostrar isso e oferecer o `memory_rebuild`.

## Inspiração visual, só como referência

- https://21st.dev/@halaska-studio/components/file-tree: uma hierarquia de pastas e arquivos que se recolhe. Licença MIT.
- https://21st.dev/@felipemenezes098/components/checkbox-07: uma árvore de caixas em que a pasta deriva dos filhos o estado marcado ou parcial. Licença AGPL-3.0.

O componente segue o estilo do projeto e usa os primitivos da lib neobrutalism. Não se copia código das referências, e isso vale ainda mais para o checkbox-07, por ser AGPL-3.0 enquanto o mARC é MIT.

## A decidir no plano

- **`.gitignore`:** se a árvore o respeita. Recomendo que sim, para esconder `dist/` e cópias locais.
- **Maquete com variantes,** porque o humano quer avaliar se a árvore fica confusa na UI.

## Dependências

- marc://$oportunidade-painel-de-configuracoes-em-accordion-c04f04a9: a seção de documentos nasceria dentro desse formato.
- marc://$oportunidade-migrar-componentes-da-ui-de-radix-para-base-ui-ed411583: a escolha dos primitivos.

## Estado

Registrada, não autorizada a começar.
