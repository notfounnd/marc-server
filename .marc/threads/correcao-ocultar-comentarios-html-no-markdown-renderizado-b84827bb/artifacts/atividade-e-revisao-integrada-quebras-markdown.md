# Atividade consolidada e revisão integrada: quebras no Markdown renderizado

## Resultado

Os comentários continuam visíveis e respeitam as quebras da origem. O caso de Custom Rules agora apresenta o segundo comentário em uma nova linha, inclusive quando o primeiro sofre wrapping pela largura disponível. Linhas internas e linhas vazias entre comentários também são preservadas.

A decisão humana substitui o aceite inicial de ocultar comentários. O escopo implementado é apresentação textual escapada. A evolução para HTML renderizado está registrada separadamente em marc://$evolucao-avaliar-convivencia-de-markdown-com-html-renderizado-ce4a7cbe

Plano aprovado: marc://#msg_e9ed4a471edd490abb
Entrega própria do developer verificada: marc://#msg_e941c353dfd04eae9a

## Escopo e fontes revisados pelo principal

Revisei o estado integrado dos seis arquivos autorizados: plugin local, MarkdownPanel, estilo localizado, dois testes e documentação de UI. Conferi o plano revisado, a mensagem e o relatório publicados pelo developer, AGENTS.md, contrato completo do bootstrap, README, docs de workflows/desenvolvimento/UI/arquitetura/harness e ADRs aplicáveis de fonte Markdown, bootstrap, roteamento, regras gerenciadas e localização.

A implementação está em src/ui/markdown-html-source.ts:18, com agrupamento em :50, recuperação de linhas em :115 e construção textual em :137; o registro no renderer está em src/ui/markdown-panel.tsx:42. O estilo está em src/ui/styles/thread-content.css:384 e a documentação em docs/ui-and-daemon.md:72.

## Revisão técnica independente

| Critério | Implementação e evidência verificada |
| --- | --- |
| Comentários em linhas distintas | O plugin agrupa raw e somente os separadores entre raw. O span textual usa pre-wrap. No navegador, o início do segundo comentário ficou uma linha abaixo do término do primeiro, com delta de 19 px; o baseline em largura ampla os colocava na mesma linha. |
| Multilinha e linhas vazias | Posições HAST recuperam o número de quebras perdido na normalização entre blocos; ausência de posições usa o separador HAST. SSR cobre três newlines e fallback. No navegador, o delta foi uma linha dentro do comentário e três linhas entre os comentários separados por duas linhas vazias. |
| Integração e layout | O processamento recursivo alcança comentários dentro de parágrafos. Ele não absorve separadores junto de outros elementos Markdown. CSS fica restrito ao texto escapado; parágrafos comuns mantêm white-space normal e preserveLineBreaks continua com seu contrato anterior. |
| Segurança e fonte original | O wrapper contém nó de texto, sem interpretar HTML. SSR e navegador mantêm tags literais; a fixture com script não criou elemento script nem executou código. Markdown de origem permanece autoridade, sem mudança de persistência, API ou configurações. |
| Recursos existentes | SSR e browser preservaram títulos, listas, tabelas, referências mARC, links e exemplos inline/fenced/indented. O processamento ocorre após o parser, sem filtro textual sobre o Markdown original. |
| Arquitetura e manutenção | Helper isolado e sem dependências novas. Guardas simples mantêm o fluxo sem else ou if aninhado; a transformação única de raw não requer uma matriz de estratégias. Testes declarativos não escolhem cenários por branches ou skips. O carregamento SSR tipado por URL respeita a separação existente entre NodeNext e browser. |

A mudança usa a árvore derivada de apresentação e mantém os registros Markdown intactos. Hashes independentes confirmaram preservação de RULES.md, INSTRUCTIONS.md, marc-links.ts, package.json, pnpm-lock.yaml e tsconfig.json. Os três arquivos de runtime revisados permaneceram estáveis após a validação visual e através do validate; os assets construídos são posteriores a esse código.

## Verificações e limites

- O principal executou independentemente os testes do renderizador junto às regressões existentes de links/perfis: 16/16, sem skips, exit 0.
- O developer executou o foco final após ajustar a fronteira SSR: 11/11. Revisei os testes e o carregamento do componente real; não há mock do renderer nem supressão de erros TypeScript.
- pnpm validate passou, incluindo lint, Prettier e TypeScript. O preflight final não previa edições, e os hashes controlados permaneceram iguais após o comando.
- pnpm build passou. O build emitiu aviso de chunk JS acima de 500 kB; não foi feita otimização de bundle neste escopo.
- A rodada padrão final de pnpm test terminou em 325/327, com dois timeouts de subprocessos MCP em test/mcp-protocol.test.ts e test/mcp-write-drain.test.ts, no prazo de 5 segundos definido em test/mcp-process.ts:82. Rodadas anteriores também tiveram falhas intermitentes de memória/MCP. Não foram alterados lógica, asserts ou prazos desses testes.
- A suíte completa serial, pnpm exec node --test --test-concurrency=1 --import tsx test/**/*.test.ts, passou 328/328, sem skips, em 85,12 s. Conferi os totais no índice context-mode da fonte Serial full Node test output. Os dois casos de timeout passaram serialmente em 529 ms e 807 ms. A relação com contenção/deadlines é uma inferência sustentada pela diferença entre execuções; não se apresenta a execução paralela como aprovada.
- As contagens correspondem ao estado existente em cada rodada; alterações externas foram preservadas durante a sessão.

O principal usou Playwright CLI em uma fixture isolada servida pelo Vite, montando WorkspaceOverview, ThreadView e ArtifactViewerModal reais com o CSS da aplicação. Foram verificadas regras a 1280 e 420 px, mensagem, resumo e artifact. Todos mantiveram comentários separados, código literal, tags inertes, tabela/lista/título e label mARC; não houve overflow horizontal nem page errors. Esse ensaio verifica os componentes de apresentação, sem exercitar autenticação ou APIs do daemon. O servidor e as duas sessões de navegador criados para o ensaio foram encerrados.

Capturas locais de apoio: C:\Users\junior\AppData\Local\Temp\marc-markdown-lines-wide.png, C:\Users\junior\AppData\Local\Temp\marc-markdown-lines-narrow.png e C:\Users\junior\AppData\Local\Temp\marc-markdown-lines-artifact.png.

## Controle de escopo e autoria

Principal: codex-software-architect, gpt-6.1-sol com reasoning high humano-confirmado no perfil. Developer runtime: /root/fix_markdown_lines, perfil compartilhado codex-dev, gpt-6-luna com xhigh solicitado no spawn e confirmado humanamente pelo perfil para este modo; sem alegação de introspecção de reasoning. Um developer por vez. Verifiquei seu OK_BOOTSTRAP independente, identidade marc-dd422176e1, fontes, hashes e limites, e autorizei edição internamente antes das mudanças.

O usuário autorizou somente formatação adicional de test/memory-eval-capture.test.ts. Esse arquivo mudou externamente durante a execução e já estava formatado no preflight final. O developer e validate o preservaram no hash cf2222ed5ad9188759062fcde288e7feea855258fb668618f0ebb837d9eeec3e; essa alteração externa não é atribuída à entrega.

Conferi a autoria codex-dev e a consistência da mensagem/relatório com os arquivos e evidências. Uma referência editorial no corpo da própria entrega foi corrigida pelo mesmo developer, preservando sua identidade e metadados. A entrega original foi publicada pelas ferramentas oficiais; a correção pontual usou o editor nativo sobre o Markdown autoritativo porque não há tool de edição de mensagem. Nenhum comando Git, hook ou configuração de cliente foi adicionado.

## Parecer final do principal

**Aprovado tecnicamente para o escopo de preservação de quebras no renderizador.** Os critérios funcionais estão ligados à implementação integrada, aos testes reais e à verificação visual independente. A mudança mantém fonte Markdown, comportamento de escape, interfaces e recursos existentes; a documentação corresponde ao resultado.

A limitação remanescente é a instabilidade dos prazos MCP na execução paralela padrão. A suíte completa serial cobre todos os cenários atuais e passou; esta aprovação do renderizador não transforma os resultados paralelos em sucesso nem constitui declaração de release-ready do repositório inteiro.

O resultado é apresentado ao usuário para revisão. Aceite humano e autorização de encerramento continuam separados deste parecer. A thread permanece aberta.

## Auditoria estrutural final

Após a publicação e associação dos artifacts por metadados, workspace_audit nos escopos artifacts, references e messages retornou zero achados em cada escopo. A oportunidade separada de HTML também foi verificada nos escopos messages e references, sem achados. Essas auditorias conferem estrutura e referências; o parecer técnico acima decorre da revisão independente e das evidências de comportamento.
