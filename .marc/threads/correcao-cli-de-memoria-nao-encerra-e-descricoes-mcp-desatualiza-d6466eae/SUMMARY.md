# Correção - CLI de memória não encerra e descrições MCP desatualizadas

Thread: marc://$correcao-cli-de-memoria-nao-encerra-e-descricoes-mcp-desatualiza-d6466eae

Closed: `2026-11-02T05:08:01.274Z`

---

## Objetivo

Corrigir as pendências da revisão de documentação de busca para a versão 0.4.0: o CLI de memória que não encerrava, as descrições desatualizadas das ferramentas MCP e a validação completa do estado que vai para a versão.

## Decisões

- O CLI descarta os workers de inferência ao terminar um comando único, com `disposeMemoryProviders`, a mesma função usada pelo daemon e pelo MCP.
- A correção restaura a decisão de marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4: uma chamada única de CLI não fica viva pelo tempo ocioso. A decisão deixou de valer quando os workers viraram processos filhos, porque o canal IPC mantém o processo pai vivo e `timer.unref()` solta só o timer.
- `src/core/memory/inference-manager.ts` não mudou, então daemon e MCP mantêm os tempos ociosos de 30 s e 300 s.
- A coaprovação do Codex não foi usada, por ser uma correção pequena com causa medida.

## Implementação

- `src/cli-memory-command.ts` (novo): `runMemoryCommand`, com `try/finally`, roda o comando, imprime o resultado e descarta os workers.
- `src/cli.ts`: `handleMemoryCommand` usa `runMemoryCommand`.
- `src/mcp/memory-tools.ts`: descrições das cinco ferramentas de memória atualizadas. A de `memory_recall` explica as camadas de `depth` e avisa que uma busca sem resultado não prova que a decisão não existe.
- `test/cli-memory-command.test.ts` (novo) e `test/mcp-memory.test.ts`: cobrem a ordem no sucesso, a falha com o erro original preservado, o uso em `src/cli.ts` e as descrições pela lista real de ferramentas.
- `docs/memory.md`: a frase do ciclo de vida do CLI.

A delivery também leva a revisão de documentação de busca feita antes desta thread: `README.md`, `docs/architecture.md`, `docs/development.md`, `docs/mcp-migration-2026-07-28.md`, `docs/mcp-tools.md`, `docs/memory.md` e `docs/ui-and-daemon.md`. Entre outras correções, ela atualizou o schema e o contrato da memória, a contagem de 26 ferramentas e os números de casos de avaliação, juntou as duas seções "UI search" e criou a seção "Search limits".

Os arquivos de release ficam fora da delivery e do stage, no commit de release do humano: a seção 0.4.0 do `CHANGELOG.md`, incluindo a linha desta correção em `Bug Fixes`, e a versão `0.4.0` no `package.json`.

## Validação

- Medição real com `arquitetrua do projeto`: saída aos 25 s, junto com a resposta, contra resposta aos 21 s e saída aos 305 s antes da correção.
- Recall preservado: correção para `arquitetura do projeto`, primeiro resultado fe4a1cb2 e `exit=0`.
- `pnpm validate` e `pnpm build` passaram, e `pnpm test` fechou 1181/1181, rodados pelo principal no estado integrado, com os arquivos de release presentes na árvore de trabalho.
- `workspace_audit`: `preflight`, `artifacts`, `references` e `messages` sem achados no estado final.

Entrega do desenvolvedor: msg_6fc82a5450f24487a1. Revisão final: msg_48600eb781a548d290, com o artifact `revisao-final-cli-e-descricoes-mcp.md`.

## Limites e continuidade

- A saída real do processo foi medida uma vez, no `recall`. `marc memory deep` usa o mesmo caminho e não foi medido, porque a suíte não carrega modelos.
- Se o descarte falhar depois de um comando com erro, essa falha substitui o erro original. O risco é baixo, e o processo termina com código de erro do mesmo jeito.
- Depois do reinício do ecossistema, falta conferir as novas descrições na lista de ferramentas.
- O humano faz o commit de desenvolvimento e o de release, reinicia o ecossistema e cria a tag `0.4.0`, sem "v", como as anteriores.
- A busca por intenção segue em pausa e fora desta thread. Isso inclui o texto de estado vazio da UI, `Try different terms or rebuild memory if recent summaries are missing.`, que deve ser revisto junto com essa frente.
