# Quebras de linha nos perfis de agentes

Exceção autorizada pelo humano para edição direta pelo principal, sem subagente.

- Preservar quebras simples de parágrafo apenas no MarkdownPanel usado pela visualização de agentes.
- Usar propriedade opt-in e CSS white-space pre-line. Manter quebra automática de texto longo.
- Não modificar perfis, parsers, metadados, Markdown de threads, artefatos ou regras.
- Adicionar regressão antes da correção. Conferir renderização real de agente nos viewports desktop e mobile.
- Executar pnpm validate, pnpm build e pnpm test, registrar evidências e manter a thread aberta.