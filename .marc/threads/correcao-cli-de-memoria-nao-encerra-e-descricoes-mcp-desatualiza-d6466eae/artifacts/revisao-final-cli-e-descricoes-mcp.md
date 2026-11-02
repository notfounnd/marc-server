# Revisão final: CLI de memória e descrições MCP

## Veredito

**Aprovado na revisão técnica**, aguardando a aceitação do humano. O critério 4 só pode ser conferido depois do reinício do ecossistema.

## Escopo revisado

- Entrega do desenvolvedor: msg_6fc82a5450f24487a1.
- Estado integrado da árvore de trabalho: as mudanças da entrega, a revisão de documentação de busca (`README.md`, `CHANGELOG.md` e `docs/`) e a versão `0.4.0` no `package.json`, feita pelo humano.
- Fontes: `artifacts/plano-correcao-cli-e-descricoes-mcp.md`, `src/cli-memory-command.ts`, `src/cli.ts`, `src/mcp/memory-tools.ts`, `test/cli-memory-command.test.ts`, `test/mcp-memory.test.ts`, `docs/memory.md` e `CHANGELOG.md`, lidos diretamente.

## Critérios

| # | Critério | Evidência | Resultado |
|---|---|---|---|
| 1 | Processo sai em até 10 s depois da resposta | Com `arquitetrua do projeto`: resposta aos 25 s e saída aos 25 s, contra 21 s e 305 s antes da correção | Aprovado |
| 2 | Recall devolve o mesmo resultado, com `exit=0` | Correção aplicada para `arquitetura do projeto`, primeiro resultado fe4a1cb2, `abstained: false`, `exit=0` | Aprovado |
| 3 | Daemon e MCP mantêm os tempos ociosos | `src/core/memory/inference-manager.ts` sem alteração nesta thread (arquivo de 2026-10-09) | Aprovado |
| 4 | Descrições visíveis na lista de ferramentas após o reinício | Teste em `test/mcp-memory.test.ts` lê a lista real de um servidor novo; o texto está em `dist/mcp/memory-tools.js` | Pendente do reinício |
| 5 | `pnpm validate`, `pnpm build` e `pnpm test` passam | Rodados pelo principal no estado integrado: `validate` 0, `build` 0, `test` 1181/1181, sem falhas nem testes ignorados | Aprovado |

A medição usa uma única execução com modelos reais. A suíte não carrega modelos, então essa é a única prova da saída real do processo.

## Revisão técnica

- **Comportamento:** o CLI descarta os workers depois de imprimir, com a mesma função do daemon e do MCP. O `finally` também cobre a falha do comando. Comandos que não abrem workers não são afetados, porque o descarte sem workers não faz nada.
- **Arquitetura:** `handleMemoryCommand` continua fino, e a sequência ficou testável sem carregar modelos.
- **Testes:** cobrem a ordem no sucesso, a falha com o erro original preservado, o uso real em `src/cli.ts` e as descrições pela lista real de ferramentas. Não têm `if`, `else`, `switch` nem ternário.
- **Regras:** en-US no código, nas descrições e na documentação; sem `else` ou `if` aninhado novos; escopo restrito aos sete caminhos autorizados. O `git --version` da fase de bootstrap não tocou no repositório.
- **Documentação:** `docs/memory.md` voltou a descrever o CLI corretamente, sem outra afirmação sobre o comportamento antigo em `docs/` ou no `README.md`. As descrições das ferramentas batem com `docs/mcp-tools.md`. O `CHANGELOG.md` registra a correção em `Bug Fixes`.

## Achados

Nenhum achado bloqueante.

- `.marc/cache/thread-index.json` e um log em `.playwright-output/` mudaram durante a execução do desenvolvedor. Ambos são ignorados pelo Git e nenhum foi escrito por ele, então não entram na entrega.
- Se o próprio descarte falhar depois de um comando com erro, a falha do descarte substitui o erro original. O risco é baixo, e o processo termina com código de erro do mesmo jeito.

## Limites

- A busca por intenção continua fora desta thread, em pausa por decisão do humano.
- Uma busca ampla como "arquitetura" continua podendo voltar vazia. Esse limite agora está documentado em `docs/memory.md` e avisado na descrição de `memory_recall`.

## Depois do encerramento autorizado

O principal faz só o stage. O humano faz o commit, reinicia o ecossistema e cria a tag `0.4.0`. Depois do reinício, o principal confere o critério 4.
