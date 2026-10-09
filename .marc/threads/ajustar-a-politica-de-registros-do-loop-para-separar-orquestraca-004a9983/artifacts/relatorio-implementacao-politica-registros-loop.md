# Relatório de implementação e verificações

## Escopo e resultado

Implementação documental concluída somente em `AGENTS.md`, `docs/agent-workflows.md` e na seção `Custom Rules` de `.marc/RULES.md`. O prefixo gerenciado de `RULES.md` foi preservado byte a byte. Não alterei perfis, código, testes, scripts, skills, configurações nem outros documentos.

Na correção solicitada pelo principal, ajustei somente a indentação de dois espaços do placeholder `<criterion>` no bloco `md` cercado de `docs/agent-workflows.md:169`. Não reformatei o documento inteiro nem alterei wrapping de prosa. Reestruturei o corpo da mensagem autoral existente em seções e bullets; ID, timestamp, autor, role e caminho do artefato permaneceram intactos.

## Mudanças

- `AGENTS.md`: linhas 31-35 distinguem coordenação interna, evidência consolidada e mensagens substantivas; linhas 32 e 44 separam administração de perfis de autoria direta; linha 53 exige evidência e autorização explícita antes de editar; linhas 59-61 instruem a revisão final integrada, seu veredito, retorno ao loop e reavaliação após mudanças.
- `docs/agent-workflows.md`: linhas 24-43 delimitam o uso de perfis existentes no loop; linhas 58-71 definem os três destinos de comunicação; linha 89 descreve publicação direta sem administração de perfil; linhas 119-139 situam bootstrap e autorização no canal interno e no artefato; linhas 141-152 tratam o relato de tarefa como distinto da aprovação da thread; linhas 156-164 definem momento, cobertura e evidência da revisão final; linha 169 contém o placeholder com indentação corrigida; linhas 168-198 orientam o registro e o uso do artefato.
- `.marc/RULES.md`: somente `Custom Rules`, itens 4-8, linhas 182-210, operacionaliza bootstrap/autorização, revisão iterativa e final integrada, separação entre aprovação e aceite, perfis compartilhados com autoria direta e filtro de publicações.

## Verificações

- `pnpm exec prettier --check AGENTS.md docs/agent-workflows.md .marc/RULES.md` retornou saída de sucesso, mas isso não validou os arquivos: `prettier.getFileInfo` com o caminho de `.prettierignore` confirmou `ignored: true` nos três. A afirmação anterior de que o CLI havia validado a formatação foi incorreta.
- Verificação efetiva via API Prettier 3.8.3 com `parser: "markdown"` e `proseWrap: "preserve"`: `prettier.check` e comparação com `prettier.format` passaram nos três documentos. Para a análise, normalizei CRLF em memória apenas: 73 ocorrências em `AGENTS.md`, 213 em `docs/agent-workflows.md`, nenhuma em `.marc/RULES.md`. Após corrigir a única divergência de indentação em `docs/agent-workflows.md:169`, os três estão iguais à saída do parser; nenhum wrapping de prosa foi alterado.
- Parser Markdown AST: 22 links/imagens verificados, todos locais, sem destinos ou âncoras ausentes.
- `workspace_audit`, escopo `rules`: zero achados. O preflight anterior à implementação também retornou zero achados.
- Hash do prefixo gerenciado de `.marc/RULES.md`, até antes de `## Custom Rules`: `d8fece9a56dd8c460cb23df377151ea6a42db05871b58805bdc63cc3809b670d`, igual ao baseline.
- O principal informa que `pnpm validate` e `pnpm build` passaram; `pnpm test` está em andamento. Não executei essas validações globais como desenvolvedor.

## Documentação, riscos e estado

README, harness engineering, Agent Workflows e ADRs aplicáveis foram revisados; a alteração ficou nos três caminhos autorizados. A política orienta o comportamento do harness, mas não instala enforcement por ferramentas ou hooks.

A entrega documental do desenvolvedor está pronta. A validação global permanece parcialmente em andamento até o resultado de `pnpm test`. A revisão final independente de todo o desenvolvimento integrado e o veredito de aprovação técnica permanecem pendentes do principal. Aceite humano e fechamento não são declarados; a thread permanece aberta.
