# Plano de correção: preservar quebras nos comentários renderizados

## Resumo e decisão humana

A thread começou com a proposta de ocultar comentários HTML. Após examinar a captura de Custom Rules e discutir as alternativas, o usuário mudou o aceite: manter a apresentação textual existente, respeitando as quebras de linha da origem. O usuário aprovou a implementação deste plano. O Markdown original permanece intacto; não habilitar interpretação de HTML, não usar skipHtml e não remover comentários.

Fonte inicial: marc://#msg_acd3ffe5a7fd4346bc
Thread: marc://$correcao-ocultar-comentarios-html-no-markdown-renderizado-b84827bb

## Diagnóstico verificado

Inspeção via context-mode de src/ui/markdown-panel.tsx, src/ui/marc-links.ts e src/ui/styles/thread-content.css, documentação oficial de react-markdown 10.1.0 consultada via Context7 e reprodução com ReactDOMServer confirmaram:
- MarkdownPanel é compartilhado por regras, mensagens, resumos e artifacts.
- react-markdown converte nós raw em texto escapado. Dois comentários isolados produzem nós raw separados por texto de newline na raiz.
- O navegador colapsa essas quebras. O estilo existente preserveLineBreaks só alcança parágrafos e é usado em perfis de agentes; não resolve comentários na raiz.
- skipHtml removeria nós raw, podendo apagar um bloco HTML inteiro com seu conteúdo. Essa alternativa foi descartada.
- linkifyMarcReferences e transformMarkdownUrl permanecem com seus contratos atuais.

## Correção autorizada

Adicionar um plugin local de árvore de renderização ao rehypePlugins de MarkdownPanel. Percorrer os contêineres existentes e agrupar sequências de nós raw consecutivos, incluindo somente separadores de whitespace entre esses nós. Converter a sequência em span de classe markdown-html-source contendo apenas texto. Preservar o valor de cada nó e os separadores internos; não absorver whitespace antes/depois de outros elementos Markdown. Aplicar white-space: pre-wrap e overflow-wrap: anywhere à classe. Um raw isolado, incluindo comentário multilinha, recebe o mesmo tratamento.

Usar elementos de texto React/AST seguros; não interpretar HTML nem usar dangerouslySetInnerHTML. Não adicionar dependências. Não usar filtro regex no Markdown original. O processamento deve permanecer na árvore, preservando inlineCode/code, formatação Markdown e links. Nós HTML inline continuam em fluxo inline e com tags literais visíveis. Manter a prop preserveLineBreaks e seu comportamento atual.

## Unidade de desenvolvimento e caminhos

Uma tarefa atômica, um developer por vez, sem paralelismo. Principal: codex-software-architect, gpt-6.1-sol, reasoning high humano-confirmado no perfil atual; developer compartilhado: codex-dev, gpt-6-luna, reasoning xhigh humano-confirmado no perfil atual, solicitado explicitamente no spawn. Configuração humana persistente é a fonte de confirmação; não alegar introspecção de reasoning em runtime.

Escrita autorizada:
- src/ui/markdown-panel.tsx;
- src/ui/markdown-html-source.ts, novo helper/plugin;
- src/ui/styles/thread-content.css, somente estilo da apresentação textual escapada;
- test/ui-markdown-html-source.test.ts e test/ui-markdown-panel.test.ts, novos testes necessários;
- docs/ui-and-daemon.md, documentação curta do comportamento.
- test/memory-eval-capture.test.ts, exclusivamente a formatação Prettier revisada e autorizada expressamente pelo usuário durante a execução: quebras de linha e separador de tipo, sem mudança lógica. Verificar o hash aprovado antes da escrita global.
- Artifacts e própria entrega do developer nesta thread, pelos tools oficiais.

Preservar arquivos e alterações preexistentes. Não editar RULES.md, arquivos gerenciados, perfis, outros módulos, package.json ou lockfile. A única exceção adicional é a formatação do teste de captura explicitamente autorizada acima. Não executar Git; não há autorização humana para comandos Git. Não criar hooks/configurações de cliente, branches, commits ou worktrees. Não expandir o escopo sem relatar o motivo ao principal. A política local de Git e os limites deste handoff prevalecem sobre rotinas genéricas de skills.

## Fontes e fluxo

O developer lê AGENTS.md, .agents/skills/marc-ops/SKILL.md, workspace_bootstrap e contrato integral, README.md, docs/agent-workflows.md (loop e shared message format), docs/development.md, docs/ui-and-daemon.md, ADRs 0001/0003/0004/0007/0008 e esta thread/plano. Antes de qualquer edição, retorna OK_BOOTSTRAP pelo canal interno, com identidade/caminho, fontes, regras críticas, modelo/reasoning solicitado e confirmação disponível, escopo e estado dos alvos. Espera autorização explícita do principal.

Regras essenciais: PowerShell conforme ambiente informado pelo usuário; context-mode para inspeção/validação; apply_patch para edição manual; código/testes/docs en-US e comunicação pt-BR; sem else, if aninhado ou cenários de teste condicionais; guardas com early return; estratégias somente quando a variação justificar. Markdown continua autoridade; persistência e APIs não mudam.

## Aceite e testes

1. Dois comentários reais de Custom Rules permanecem visíveis e em linhas distintas. O fechamento do primeiro não se junta ao início do segundo.
2. Comentários multilinha e sequências com linhas vazias conservam suas linhas.
3. Texto anterior/posterior, títulos, listas, tabelas, links, referências mARC e parágrafos comuns mantêm comportamento existente.
4. Exemplos em código inline, fenced e indentado continuam literais. Comentários inline mantêm texto em volta correto.
5. Tags HTML continuam texto literal; scripts/event handlers não são habilitados. Não alterar conteúdo-fonte.
6. Testes verificam transformação e integração real de MarkdownPanel/renderização, com cenários explícitos, determinísticos e sem branches. Usar ReactDOMServer com createElement em testes .ts. Carregar o componente TSX real por import dinâmico de URL em variável, com fronteira tipada, para respeitar a separação existente entre o grafo de tipos NodeNext e o código browser.
7. Playwright CLI, nunca MCP, verifica geometria/linhas no navegador, largura reduzida, regras e superfícies de mensagens/resumo/artifact. Usar fixture isolada para conteúdo de teste; não poluir a thread ou editar RULES.md para fixtures. O principal executa a validação de navegador e verifica a integração final.

Impacto executável: o developer executa testes focados, pnpm validate, pnpm build e pnpm test. validate tem escrita global: capturar inventário/hashes antes, inspecionar alterações, preservar trabalho preexistente e relatar conflitos, sem reversões amplas. Se formatadores exigirem mudança fora do escopo, reportar ao principal antes de expandir. Não apresentar check não executado como aprovado. Não repetir suítes completas sem nova mudança/falha que justifique.

## Entrega, revisão e registros

O developer entrega relatório interno com caminhos/linhas, mudanças, testes e resultados reais, limites, documentação, configuração e bootstrap/autorização consolidados. Publica sua própria entrega consolidada sob codex-dev, pendente de revisão do principal, anexando relatório pelos tools oficiais e retornando o message ID. Bloqueio real de publicação deve ser informado; o principal não retransmite como autoria própria.

O principal faz revisão independente de todo estado integrado, critérios, arquitetura, segurança, evidências e escopo. Retorna achados ao mesmo developer; mudanças posteriores invalidam o parecer anterior. Ao concluir, anexa artifact de atividade com revisão final substantiva, fontes, vínculo entre critérios e evidências, achados/limites e veredito explícito. Roda auditorias estruturais aplicáveis, incluindo mensagens após metadados prontos. Aprovação técnica não equivale a aceite humano. Não fechar a thread.

A evolução para HTML renderizado será registrada em thread própria, sem implementação neste escopo. Não há perguntas de produto pendentes.
