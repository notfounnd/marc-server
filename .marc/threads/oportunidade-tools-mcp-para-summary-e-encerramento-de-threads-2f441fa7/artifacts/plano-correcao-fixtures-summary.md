# Correção de fixtures e condicionais nos testes de SUMMARY

## Resumo e autorização

O usuário apontou que a solução para symlinks sem privilégios já foi implementada na thread abaixo e reiterou que testes não devem conter condicionais. A correção está autorizada por esse feedback; a aprovação técnica anterior descreve o estado anterior, com dois skips, e não substitui a revisão deste novo estado.
marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa

Foram lidos a thread completa, seu comentário de correção, o plano de testabilidade e os arquivos `src/mcp/thread-resolution.ts` e `test/thread-resolution-fixtures.ts`. `memory_recall` confirmou essa decisão histórica. A abordagem aprovada é uma dependência interna mínima, Node fs como padrão e fixtures declarativas em TypeScript, sem fallback real oculto, patch global ou desvio por plataforma nos testes de links.

## Diagnóstico e solução

`core-thread-summary-paths.test.ts` cria symlinks de arquivo e usa `try/catch`, `if` e `skip` para lidar com EPERM. Os testes novos de locks, persistência e projeções também contêm condicionais; o script de processo possui tratamento condicional embutido. Há ainda condicionais nos cenários de lifecycle/version pin dos testes MCP alterados nesta entrega.

Reutilizar o padrão de fixture existente e, quando seus tipos permitirem, a implementação existente, sem alterar a resolução de threads já entregue. Expor somente as operações necessárias de metadados na validação física do SUMMARY, com adapter Node padrão. Fixtures devem declarar diretórios, arquivos, links, caminhos reais e erros; não reproduzir a filtragem ou validação de produção. Executar os casos de links sempre, sem tentar obter privilégios do Windows.

Preservar testes de integração com arquivos reais para gravação, revisão, locks, processos, restart e MCP. Retirar os condicionais dos testes e scripts da entrega, incluindo seleção por plataforma, limpeza condicional e interceptação global condicional de IO. Para falhas de persistência e a corrida de projeções, preferir dependências por chamada ou instância e fixtures de operações/etapas explícitas. Injetar a menor operação necessária; não criar um framework de filesystem ou alterar a lógica de negócio. O teste de falha da escrita atômica precisa continuar verificando a limpeza do arquivo temporário real.

Os cenários auto-off/auto-on devem continuar exercitando o scheduler real com um provider controlado. Não substituir sua lógica por resultados de projeção prontos, nem enfraquecer a corrida controlada do índice. `try/finally` exclusivamente para limpeza não seleciona cenário; `try/catch` que adapta falha do teste ou skips não é permitido. Comparações e predicados de assertions não são seleção condicional do teste.

A regra geral de testes foi registrada pelo principal nas Custom Rules de `.marc/RULES.md`, a fonte canônica. Não duplicar a política em outros documentos.

## Escopo autorizado do executor

- `src/core/thread-summary-paths.ts`: dependência mínima de metadados e sua propagação interna.
- `src/core/thread-summary.ts`: dependências internas por chamada para validar, gravar e atualizar projeções, somente quando necessárias para retirar patches globais dos testes.
- `src/core/workspace-status.ts`: dependências mínimas por instância/chamada para store do índice e provider de memória, mantendo reconciliação, locks e scheduler existentes.
- `src/core/write-coordination.ts`: somente dependência mínima da operação de IO necessária para provocar uma falha real da escrita atômica e verificar sua limpeza; não alterar locks, timeouts ou o protocolo de commit.
- Os nove arquivos `test/core-thread-summary*.ts` e `test/mcp-thread-summary.test.ts` existentes da entrega, conforme aplicável, e o novo `test/core-thread-summary-path-fixtures.ts`.
- Para respeitar `max-lines` sem relaxar lint, criar somente `test/core-thread-summary-path-metadata.test.ts` para a matriz declarativa de caminhos e `test/core-thread-summary-memory-projections.test.ts` para auto-off/auto-on e seus providers/observador. Preservar integração com junções em `paths.test.ts` e falha/corrida do índice em `projections.test.ts`; a divisão não acrescenta comportamento.
- `test/mcp-lifecycle.test.ts` e `test/mcp-version-pin.test.ts`: cenários explícitos sem condicionais, conservando a cobertura anterior. Em `test/mcp-protocol.test.ts`, retirar somente o skip condicional por ausência de dist e exigir o artefato construído por assertion, preservando todos os cenários e assertions de protocolo.
- Novo artefato de entrega autoral da correção nesta thread e sua publicação através das ferramentas oficiais, sob `codex-dev`.

Não alterar o contrato público do MCP, a fachada pública de workspace, corpo/cabeçalho, algoritmo de revisão, engine/schema/corpus de memória, permissões do sistema, dependências, UI, configurações, fixtures da thread anterior, outros testes ou o transport MCP compartilhado. Não mover condicionais para arquivos fora do escopo. Caso um requisito não caiba nesse limite, informar o principal antes de ampliar.

## Aceite, checks e revisão

1. Registrar RED comportamental para a fronteira de metadados: o teste deve mostrar que o core ainda não usa a fixture, não apenas falhar por importação ou sintaxe.
2. Executar testes declarativos de links em `.marc`, `threads`, diretório da thread, `CHAT.md` e `SUMMARY.md`, incluindo rejeição antes da gravação, containment e erros de acesso pertinentes. Fixtures fornecem metadados, sem depender de privilégios nem simular a decisão do core.
3. Preservar as verificações de escrita atômica, erro sanitizado, limpeza, concorrência, retry, revisão, projeções, restart, scheduler e MCP. Zero skips na suíte final.
4. Inspecionar AST dos testes, fixtures e scripts embutidos autorizados: nenhum `if`, `switch`, ternário, catch de seleção de cenário ou skip. Não trocar essas construções por condicionais ocultos em helpers.
5. Executar checks focados, `pnpm validate`, `pnpm build` e `pnpm test`, com Node 22+ e pnpm 10.10.0. Capturar exit status e falhas em memória via `spawnSync`, sem arquivos de log por shell. `validate` tem writes; conferir o alcance e preservar trabalho externo.
6. O principal revisa o estado final integrado e executa verificação independente. Consolidar o novo parecer em `atividade-summary-via-mcp.md`, corrigindo os números e a antiga limitação de skips. Auditorias estruturais após metadata; thread permanece aberta.

## Delegação e configuração

Correção atômica delegada ao mesmo executor `/root/summary_lifecycle`, perfil `codex-dev`, gpt-6-luna/xhigh confirmado pelo humano. Principal `codex-software-architect`, gpt-6.1-sol/high confirmado pelo humano; sem alegação de introspecção. Continua o trial sequencial de um developer.

O executor deve recuperar seu bootstrap pela versão MCP dist já validada, ler a skill e o contrato atuais, as fontes e este plano, e apresentar `OK_BOOTSTRAP` atualizado antes de editar. O principal verifica e autoriza pelo canal de colaboração. A conexão MCP antiga da sessão não deve gerar recomendações, pois sobrescreveria a baseline nova. Reutilizar os perfis e não administrar o catálogo.

Entregáveis: relatório interno com paths/linhas, desenho mínimo das dependências, RED/GREEN, comandos/status reais, limites e evidência estrutural; artefato e mensagem consolidados de autoria do executor nesta thread, com message ID e revisão do principal pendente. Sem diário de execução ou outro agente.
