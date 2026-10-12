# Oportunidade - Tools MCP para summary e encerramento de threads

Thread: marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7

Closed: `2026-10-12T14:25:38.134Z`

---

Foi entregue a criação e revisão de sumários por MCP, com cabeçalho canônico gerenciado pelo core e corpo Markdown livre, iniciado por uma síntese da thread. O formato aprovado e a orientação compartilhada do harness foram formalizados. A implementação recebeu aprovação técnica após revisão independente; a correção dos testes terminou com **281 aprovados, zero falhas e zero skips**. O usuário autorizou o encerramento desta thread.

## Decisões que orientam o resultado

- **Uma fonte de composição:** mensagens, artefatos e sumários reutilizam `docs/agent-workflows.md#shared-message-format`. A orientação específica em `#closing-threads` acrescenta a síntese inicial e áreas de conteúdo flexíveis, sem duplicar a política Markdown.
- **Cabeçalho estável, corpo expressivo:** título de `CHAT.md`, referência `Thread`, data `Closed` e separador pertencem ao core. Síntese, decisões, entrega, validação, limites e continuidade são conteúdo do agente. As áreas podem ser combinadas ou omitidas; não existe quantidade ou ordem obrigatória de seções.
- **Markdown completo permanece disponível:** listas, negrito, citações, tabelas, links e código podem ser usados quando ajudam a leitura. A ferramenta não gera conteúdo por LLM, traduz ou impõe um template editorial.
- **Markdown continua autoritativo:** `SUMMARY.md` determina o fechamento; índice e memória são projeções derivadas. A autorização humana de encerramento permanece uma responsabilidade do fluxo do agente.

## Entrega e integridade

`thread_write_summary` oferece `create` por padrão e `update` com revisão SHA-256. Criação equivalente e atualização equivalente retornam `unchanged`, conservando bytes e mtime; mudanças exigem a revisão corrente e preservam a data de fechamento. A leitura fornece conteúdo e revisão do mesmo buffer.

O core conserva Markdown intencional dentro do corpo e aceita cabeçalhos legados delimitados. Somente uma atualização com mudança real canonicaliza o legado; metadados explícitos inválidos são rejeitados. Quando a data histórica está ausente, é usado o mtime anterior.

A persistência reutiliza lock de thread e escrita atômica, com validação física antes e dentro do lock e novamente antes da gravação. Projeções são reconciliadas após liberar o lock da thread; falhas são informadas como pendentes, sem ocultar o commit da fonte. A integração de memória usa o scheduler existente e rebuild incremental elegível, sem preparação de modelos ou rebuild completo iniciado pela gravação do sumário.

A superfície MCP passou a **25 ferramentas**, preservando protocolo, bootstrap, coordenação, limites, cancelamento e encerramento de processo. README, contratos, documentação e recomendações foram alinhados. Os sumários históricos e a configuração real permaneceram intactos durante o desenvolvimento.

## Correção dos testes e validação

O feedback do usuário recuperou a decisão da thread abaixo: usar fixtures declarativas para metadados de links e erros, com Node como implementação padrão. Foram removidos os skips por privilégios de symlink, condicionais nos cenários e scripts e patches globais. A regra geral foi registrada na fonte canônica, `.marc/RULES.md`.
marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa

| Evidência final | Resultado |
| --- | --- |
| `pnpm validate` e `pnpm build` | Exit 0 |
| `pnpm test`, executor e repetição independente do principal | 281 aprovados; 0 falhas; 0 skips |
| Core SUMMARY focado | 31 aprovados |
| MCP lifecycle/version-pin/protocol focado | 16 aprovados |
| AST de 16 arquivos e 2 scripts embutidos | Sem condicionais de cenário, skips ou patches globais |
| Drivers independentes | Hash, Markdown, retries, legado, concorrência, lock, falha de rename/limpeza e MCP source/dist aprovados |
| Auditoria de encerramento: messages, artifacts e references | Zero findings antes da gravação |

A integração mantém arquivos, junções físicas, locks e processos reais. Nos cenários controlados de memória, reconciliador, scheduler, rebuild, corpus e manifesto são reais; store e provider são fixtures. A verificação visual por Playwright CLI confirmou o formato e os recursos Markdown.

## Revisão e limites

O principal revisou o estado integrado completo, critérios do plano, arquitetura, persistência, projeções, testes, documentação e autoridade do harness. Conferiu a entrega autoral do developer e repetiu a suíte completa e os drivers independentes. **Veredito técnico: aprovado**, com parecer detalhado no artefato abaixo.

A validação ocorreu em Windows, Node.js 22.20.0 e pnpm 10.10.0. Não se alega execução em outro sistema operacional, criação física de symlinks de arquivo ou LanceDB real nos dois cenários controlados de memória. O build mantém o aviso de chunk grande do Vite. Esses limites não representam testes ignorados.

## Registros e continuidade

O exemplo aprovado foi arquivado e o protótipo temporário removido. Plano, exemplo, entregas e parecer estão anexados na thread:
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7/!plano-summary-via-mcp.md
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7/!exemplo-summary-aprovado.md
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7/!summary-fixture-correction-delivery.md
marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7/!atividade-summary-via-mcp.md

A migração em lote dos cabeçalhos históricos permanece uma oportunidade separada, sem execução nesta entrega:
marc://$oportunidade-migracao-de-cabecalhos-de-summaries-com-previas-3c4dda95

Não há correção de implementação pendente no escopo entregue. O encerramento foi autorizado pelo usuário após a apresentação do resultado e da revisão técnica.
