# Correção - Ocultar comentários HTML no Markdown renderizado

Thread: `correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb`
Created: `2026-10-15T17:05:14.972Z`

<!-- marc-message
id: msg_acd3ffe5a7fd4346bc
threadId: correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb
timestamp: 2026-10-15T17:05:32.581Z
agentId: codex-software-architect
role: architect
-->

## Problema observado

O renderizador de Markdown está exibindo comentários HTML fora de blocos de código. Na captura fornecida pelo usuário, a seção Custom Rules mostra os comentários de manutenção do RULES.md como texto visível.

Exemplo afetado: `<!-- Keep project-specific custom rules below this line. -->`.

## Comportamento esperado

- Comentários HTML válidos fora de código não aparecem na visualização renderizada.
- Comentários usados como exemplo dentro de blocos de código ou código inline continuam visíveis.
- O Markdown original permanece intacto. Os comentários de manutenção não devem ser removidos dos arquivos para contornar a falha.
- A correção não habilita execução de HTML arbitrário nem reduz as proteções existentes do renderizador.

## Escopo para planejamento

Investigar o pipeline compartilhado de Markdown e seus consumidores. Identificar se a exibição vem do tratamento de HTML, de escape prévio ou de outra transformação, sem presumir a causa antes da análise.

Corrigir na camada adequada, preservando títulos, listas, links, referências mARC e demais recursos existentes. Evitar filtros textuais que removam exemplos legítimos em código.

## Critérios de aceite

- Reproduzir o caso do RULES.md e validar comentários de uma linha, multilinha e entre trechos de conteúdo.
- Confirmar que o texto antes e depois do comentário permanece correto, sem renderizar o comentário.
- Cobrir exemplos em código inline e blocos de código.
- Executar testes de regressão do renderizador e Playwright CLI nas superfícies afetadas, além de pnpm validate, pnpm build e pnpm test.

Thread registrada para desenvolvimento posterior. Nenhuma correção implementada neste registro.

<!-- /marc-message -->

<!-- marc-message
id: msg_e9ed4a471edd490abb
threadId: correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb
timestamp: 2026-10-15T17:50:16.308Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/plano-preservar-quebras-html.md
-->

## Decisão e proposta aprovada

Após a discussão com o usuário, o aceite inicial de ocultar comentários foi substituído: os comentários permanecem visíveis, respeitando as quebras de linha da origem. No trecho Custom Rules, cada comentário começa em uma linha própria, com quebra adicional conforme a largura disponível.

O plano anexo detalha a correção no renderizador compartilhado, os limites de escrita, os testes e a revisão integrada. Os arquivos Markdown permanecem intactos e HTML continua escapado como texto.

Execução autorizada pelo usuário: um developer por vez, perfil marc://@codex-dev, gpt-6-luna com reasoning xhigh conforme confirmação humana registrada no perfil. Principal: marc://@codex-software-architect. A evolução para HTML renderizado fica em thread separada. Nenhum comando Git foi autorizado.

<!-- /marc-message -->

<!-- marc-message
id: msg_e941c353dfd04eae9a
threadId: correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb
timestamp: 2026-10-15T18:39:03.823Z
agentId: codex-dev
role: developer
artifacts: artifacts/relatorio-entrega-preservar-quebras-html.md
-->

Implementei a preservação visível das quebras nos comentários HTML renderizados. O plugin agrupa nós raw consecutivos e o whitespace entre eles, restaura quebras com posições de origem e usa o separador HAST como fallback; converte o conteúdo em texto escapado sem interpretar HTML. Comentários isolados também recebem wrapper. Código Markdown, separadores junto a outros elementos, `preserveLineBreaks` e apresentação de code blocks permanecem cobertos. Atualizei o CSS e a documentação e acrescentei testes da transformação e do SSR real.

Validação: foco Markdown 11/11; `pnpm validate` e `pnpm build` passaram. A execução paralela exclusiva de `pnpm test` terminou 325/327, com dois deadlines de subprocessos MCP; a execução completa serial passou 328/328, sem skips. O build manteve o aviso de bundle acima de 500 kB. O relatório anexado registra comandos, labels context-mode, hashes e limites. A verificação Playwright CLI independente do principal foi reportada como aprovada; revisão integrada do principal continua pendente.

Relatório detalhado: marc://$correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb/#msg_e941c353dfd04eae9a/!relatorio-entrega-preservar-quebras-html.md

<!-- /marc-message -->

<!-- marc-message
id: msg_ef8f5bc1286e4969be
threadId: correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb
timestamp: 2026-10-15T18:43:18.660Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/atividade-e-revisao-integrada-quebras-markdown.md
-->

## Revisão integrada: aprovada para o escopo do renderizador

Os comentários permanecem visíveis e respeitam as quebras da origem. Conferi a implementação completa, documentação, testes e a entrega própria de marc://@codex-dev em marc://#msg_e941c353dfd04eae9a.

Playwright CLI confirmou o resultado em regras, mensagens, resumos e artifacts, incluindo largura reduzida, linhas vazias, código literal e tags inertes. Os arquivos-fonte de regras e as configurações ficaram intactos.

pnpm validate e pnpm build passaram; o foco independente passou 16/16. A suíte completa serial passou 328/328, sem skips. A execução paralela padrão teve dois timeouts MCP; essa limitação está explicitada no parecer anexo e não foi tratada como sucesso.

A evolução para HTML renderizado está registrada em marc://$evolucao-avaliar-convivencia-de-markdown-com-html-renderizado-ce4a7cbe.

Resultado disponível para revisão humana. A thread permanece aberta.

<!-- /marc-message -->
