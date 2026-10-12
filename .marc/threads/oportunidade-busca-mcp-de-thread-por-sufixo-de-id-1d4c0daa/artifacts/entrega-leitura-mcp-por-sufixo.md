# Relatório de entrega: leitura MCP por sufixo

## Classificação, contexto e autorização

Entrega de código, testes e documentação. A Flow Rule atual “Select validation by delivery impact” exige `pnpm validate`, `pnpm build` e `pnpm test` para este impacto. A revisão técnica integrada do principal ainda está pendente; não solicitei fechamento da thread.

Workspace confirmado no bootstrap renovado: `marc-dd422176e1`, raiz `C:\\Projetos\\marc`. Execução sob o perfil compartilhado `codex-dev` (runtime delegado `/root/thread_suffix_dev`). Configuração solicitada e confirmada pelo despacho/perfil: `gpt-6-luna/xhigh`; introspecção independente do reasoning efetivo não está disponível nesta sessão.

A implementação segue o plano `plano-leitura-mcp-por-sufixo.md` na thread oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa e preserva a decisão histórica modern-only da migração MCP concluída na thread oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787. A autorização do principal foi dada após meu `OK_BOOTSTRAP`. Revisei AGENTS.md, RULES.md e INSTRUCTIONS.md completos, a skill local marc-ops, a skill TDD, README, docs/agent-workflows.md, docs/harness-engineering.md, docs/mcp-tools.md e os ADRs aplicáveis 0001, 0003, 0004, 0007 e 0008.

## Alterações

- `src/mcp/thread-resolution.ts` (novo): resolução por ID completo existente com prioridade; caso contrário, aceita somente sufixo hexadecimal de exatamente 8 caracteres e compara o segmento final após o último hífen. A comparação do sufixo ignora caixa. Procura apenas no workspace atual, incluindo threads abertas e fechadas, exige diretório real e arquivo regular `CHAT.md`, usa `lstat` para excluir links simbólicos e não consulta índice derivado. Filtra nomes pelo sufixo antes de verificar candidatos; um ID completo exato não verifica diretórios não relacionados.
- `src/mcp/thread-tools.ts`: aplica bootstrap antes da resolução nos quatro readers e retorna `result.threadId` canônico em `thread_read`, `thread_read_since`, `thread_info` e `thread_tail`, preservando `thread_info.id` e o envelope existente. `cursor_not_found` também conserva o ID canônico. Erros previstos usam `toolError`, `isError: true` e os códigos `thread_not_found`, `ambiguous_thread_id` (candidatos canônicos ordenados em `details.candidates`) e `invalid_thread_id` para separadores/traversal. Falhas inesperadas continuam para sanitização existente do coordinator.
- `src/mcp/helper.ts`, `README.md` e `docs/mcp-tools.md`: documentam o sufixo de leitura e a exigência de ID completo para escrita; descrições e schemas dos quatro readers refletem o contrato. Nenhuma ferramenta, alias, formato de protocolo ou catálogo foi adicionado.
- `test/mcp-thread-resolution.test.ts` (novo) e `test/mcp-threads.test.ts`: cobrem prioridade do ID completo, sufixos em maiúsculas, comprimentos inválidos, isolamento por workspace, threads fechadas, diretórios/arquivos elegíveis, links simbólicos, erros de filesystem em candidatos não relacionados, missing/ambiguous/invalid em todos os readers, bootstrap, resultado vazio, cursor inválido, ID canônico e rejeição de escrita por sufixo.

As mudanças de código mantêm guard clauses e condicionais sem `else` ou blocos `if` aninhados. Código, schema, testes e documentação técnica permanecem em en-US.

## Evidência TDD e validação

TDD RED/GREEN foi aplicado. Antes da implementação, os testes focados falharam pela ausência do resolvedor e pelo comportamento de resolução ausente. Depois, acrescentei regressões para EACCES em diretório não relacionado: RED reproduziu a falha e GREEN confirmou que lookup exato e busca filtrada por sufixo não inspecionam esse diretório. A movimentação do caso de erro MCP entre os dois arquivos de teste preservou a integração dos quatro readers e respeitou o limite ESLint de 300 linhas.

Fontes de validação via context-mode:

- Testes focados: `ctx_execute` com `pnpm exec node --test --import tsx test/mcp-threads.test.ts test/mcp-thread-resolution.test.ts`: 13 testes, 12 passaram, 0 falharam e 1 foi ignorado.
- `pnpm validate`: execução capturada com `ctx_execute` + `spawnSync`; exit code 0. Lint, Prettier e typecheck passaram.
- `pnpm build`: `ctx_execute` + `spawnSync`; exit code 0. `tsc -p tsconfig.build.json` e Vite concluíram (2.391 módulos transformados).
- `pnpm test`: execução capturada com `ctx_execute` + `spawnSync`; exit code 0; 238 testes, 237 passaram, 0 falharam, 1 ignorado e 0 cancelados.

O único skip foi a criação de symlink para arquivo no Windows, que retornou `EPERM`; o teste o limita a falhas de capacidade/permissão permitidas. O teste de diretório simbólico/junction passou. O teste de CHAT não regular também passou.

`pnpm validate` roda lint-fix e Prettier write mode. Comparei hashes de 212 arquivos monitorados em `src/`, `test/` e `eslint.config.js` com o snapshot imediatamente anterior à validação: apenas os quatro alvos de código/teste autorizados mudaram; nenhum outro arquivo desse conjunto mudou. As alterações concorrentes de instruções identificadas pelo principal em AGENTS.md, docs/agent-workflows.md, docs/development.md e .marc/RULES.md foram preservadas; não afirmo que o workspace global permaneceu igual ao início. O build recriou a saída gerada em `dist/`, conforme o script do projeto.

## Riscos e próximo passo

A criação de symlink de arquivo não pôde ser exercitada neste Windows por `EPERM`; a verificação de código usa `lstat` e os testes de exclusão de diretório simbólico/junction passaram. Não há outra pendência técnica conhecida pelo executor. Aguardo revisão técnica integrada independente do principal, que avaliará o estado final e emitirá seu próprio parecer.
