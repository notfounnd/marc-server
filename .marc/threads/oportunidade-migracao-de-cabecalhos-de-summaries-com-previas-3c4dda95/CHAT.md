# Oportunidade - Migração de cabeçalhos de summaries com prévias

Thread: `oportunidade-migracao-de-cabecalhos-de-summaries-com-previas-3c4dda95`
Created: `2026-10-12T02:22:25.086Z`

<!-- marc-message
id: msg_ea7eee433b394c22b6
threadId: oportunidade-migracao-de-cabecalhos-de-summaries-com-previas-3c4dda95
timestamp: 2026-10-12T02:23:13.839Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/oportunidade-migracao-com-previas.md
-->

Oportunidade registrada conforme a decisão do usuário: tratar a migração dos cabeçalhos antigos em uma thread separada, com prévias antes da aplicação.

A proposta futura deve preservar corpo, idioma, identidade e data original, separar casos ambíguos e proteger a aplicação com revisão esperada. Nenhuma migração ou implementação foi iniciada.

Origem: marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7

<!-- /marc-message -->

<!-- marc-message
id: msg_2c7a0f7b080949f1b6
threadId: oportunidade-migracao-de-cabecalhos-de-summaries-com-previas-3c4dda95
timestamp: 2026-10-12T15:12:20.890Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/proposta-correcao-cabecalhos-summary.md
-->

Proposta registrada conforme o escopo corrigido e o plano aprovado pelo usuário: edição direta dos cabeçalhos de SUMMARY.md, sem desenvolvimento de ferramentas ou código.

- Inventário: 51 summaries, com 50 cabeçalhos a ajustar e um já padronizado. O anexo contém o inventário e as prévias completas.
- Datas: preservar as 34 explícitas; nos 17 casos sem Closed, usar o mtime anterior à edição, por decisão confirmada no chat. Essa origem está identificada como fallback.
- Preservar o corpo dos resumos e a identidade das threads. Verificação editorial localizada, por context-mode, e revisão final do conjunto.

A execução direta foi solicitada no chat. Esta correção não altera o estado de fechamento; a thread permanece aberta.

<!-- /marc-message -->

<!-- marc-message
id: msg_50ef90d75ea94d289c
threadId: oportunidade-migracao-de-cabecalhos-de-summaries-com-previas-3c4dda95
timestamp: 2026-10-12T15:25:23.980Z
agentId: codex-software-architect
role: architect
artifacts: artifacts/entrega-correcao-cabecalhos-summary.md, artifacts/proposta-correcao-cabecalhos-summary.md
-->

## Correção entregue

- Padronizados 50 cabeçalhos de SUMMARY.md; o arquivo já correto permaneceu intacto. Títulos e identidades seguem CHAT.md, e todos usam Thread, Closed e separador.
- Preservadas as 34 datas explícitas. Os 17 casos sem data usam o mtime anterior à edição, conforme decisão confirmada pelo usuário.
- Ajuste editorial direto, sem código, scripts persistentes ou ferramentas novas.

## Validação e revisão

A revisão final do principal aprovou o escopo editorial: 51 cabeçalhos conferidos por context-mode, texto dos 51 corpos preservado e 316 arquivos fora do escopo intactos. Em um corpo, o editor normalizou somente a quebra da primeira linha de CRLF para LF; o relatório identifica essa diferença e não alega preservação binária desse caso.

A projeção conserva as 51 threads fechadas e suas datas. A memória derivada foi reconciliada incrementalmente e está atualizada; autoRebuild=false foi preservado. As auditorias focadas anteriores à entrega não encontraram problemas. A suíte de desenvolvimento não se aplica a esta entrega editorial.

O parecer e as revisões finais estão anexados. Esta aprovação técnica não substitui o aceite humano; a thread permanece aberta.

<!-- /marc-message -->
