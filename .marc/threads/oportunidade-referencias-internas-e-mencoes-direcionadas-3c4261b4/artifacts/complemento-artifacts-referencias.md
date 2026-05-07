# Complemento - Referências para artifacts

## Nova referência interna

- Incluir artifacts no pacote de referências internas.
- Formato sugerido:
  - `marc://artifact/<threadId>/<artifactPath>`
  - `marc://thread/<threadId>/artifact/<artifactPath>`
- Para artifact da thread atual, considerar também uma forma curta se fizer sentido:
  - `marc://artifact/<artifactPath>`

## Comportamento no painel

- Clicar em artifact abre uma modal.
- A modal renderiza Markdown quando o artifact for `.md` ou conteúdo Markdown.
- Para outros tipos, a modal pode mostrar texto bruto, metadados ou uma ação de abrir/baixar conforme suporte futuro.
- A modal deve preservar navegação interna Markdown, incluindo links `marc://...`.

## Lista de artifacts na thread

- Ao acessar uma thread, o painel deve oferecer uma lista/menu de artifacts da thread.
- Essa lista pode aparecer como botão/ícone no cabeçalho da thread.
- Cada item deve exibir nome/path do artifact e abrir a mesma modal de visualização.
- Objetivo: evitar que artifacts fiquem acessíveis apenas pelo texto de mensagens.

## Relação com referências internas

- Threads, mensagens, agentes e artifacts passam a ser entidades navegáveis.
- Artifacts longos continuam fora das mensagens, mas ficam fáceis de descobrir e ler.
- Isso reforça o padrão: mensagem curta em bullets + artifact detalhado linkado.
