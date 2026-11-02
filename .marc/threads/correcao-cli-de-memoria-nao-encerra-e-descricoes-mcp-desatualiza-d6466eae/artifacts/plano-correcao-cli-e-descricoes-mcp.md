# Plano: CLI de memória não encerra e descrições MCP desatualizadas

## Resumo

A revisão da documentação de busca para a versão 0.4.0 deixou três pendências, todas tratadas aqui:

1. **Defeito:** comandos únicos do CLI de memória respondem, mas o processo não encerra.
2. **Texto desatualizado:** as descrições das ferramentas MCP de memória ainda descrevem a memória antiga, e os agentes leem esses textos.
3. **Validação pendente:** a suíte completa não rodou sobre o estado integrado que vai para a versão.

**Questões pendentes:** nenhuma de desenho. O desenvolvimento aguarda autorização do humano.

## Item 1: o CLI não encerra

### Evidência

Medido em 2026-11-02 com `node --import tsx src/cli.ts memory recall`:

| Consulta | Interpretador usado | Resposta | Saída do processo |
|---|---|---|---|
| `arquitetrua do projeto` (correção aplicada) | sim | 21 s | 305 s |
| `revisão de arquitetura do projeto` | sem confirmação, medição sem marca da resposta | não separada | 70 s |

O encerramento bate com os tempos ociosos de `src/core/memory/inference-manager.ts`: 30 s para embedding e reranking, 300 s para interpretação.

### Causa

Os workers são criados com `fork` e canal IPC (`inference-manager.ts:234`). O canal mantém o processo pai vivo. O `timer.unref()` da linha 154 solta só o timer, não o filho. O comando termina, e o pai espera o descarte por ociosidade.

### Histórico

- marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4 decidiu que uma chamada única de CLI não deve ficar viva por causa do tempo ocioso. Na época o provider rodava no mesmo processo. Com os workers separados, a decisão deixou de valer na prática.
- marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8 registrou o sintoma e o deixou para o backlog.

Esta correção restaura aquela decisão e não altera o tempo ocioso do daemon nem do MCP, que continuam reaproveitando os workers.

### Correção

O CLI passa a descartar os workers depois de imprimir o resultado, com a função que o daemon e o MCP já usam, `disposeMemoryProviders` (`src/core/workspace-memory.ts:180`).

Para testar sem carregar modelos, a sequência fica em um módulo novo, `src/cli-memory-command.ts`:

```ts
type MemoryCommandSteps = {
  run: () => Promise<unknown>;
  print: (result: unknown) => void;
  dispose: () => Promise<void>;
};

/** A one-shot command releases its workers, whose IPC channels would keep this process alive. */
export async function runMemoryCommand(steps: MemoryCommandSteps): Promise<void> {
  try {
    steps.print(await steps.run());
  } finally {
    await steps.dispose();
  }
}
```

Em `handleMemoryCommand` (`src/cli.ts:162`), a última linha passa a ser:

```ts
await runMemoryCommand({
  run: () => handler(parsed, workspaceRoot),
  print: printResult,
  dispose: disposeMemoryProviders
});
```

A assinatura real de `printResult` deve ser respeitada. Se ela não couber em `(result: unknown) => void`, adaptar só o tipo de `print`.

## Item 2: descrições das ferramentas MCP

Em `src/mcp/memory-tools.ts`, usar exatamente estes textos:

| Ferramenta | Descrição |
|---|---|
| `memory_prepare` | `Prepare the local memory query interpretation, retrieval, and reranking model caches without rebuilding the committed memory index.` |
| `memory_status` | `Read memory index health without loading local interpretation, retrieval, or reranking models.` |
| `memory_rebuild` | `Reconcile the committed memory index by default. Pass mode full to explicitly rebuild every indexed source.` |
| `memory_recall` | `Interpret a development intent when requested and recall relevant history before proposing or changing behavior. It reads closed-thread summaries by default; depth 1 adds artifacts, rules, and documents, and depth 2 adds chat messages. Each result has a heuristic confidence band (high, medium or low) that only orders results relative to each other; it is not a probability. abstained is true only when the search ran and admitted no thread; it does not prove that no decision exists.` |

Em `memory_deep`, trocar apenas `In the E4 measurement` por `In the marc-deep measurement`.

## Item 3: documentação e validação

Depois da correção do CLI:

- `docs/memory.md`, seção `Provider lifecycle`: trocar a frase que começa em `A one-shot CLI command prints its result` por `A one-shot CLI command disposes its workers after it prints its result, so its process exits without waiting for the idle window.`
- `CHANGELOG.md`, seção 0.4.0, `Bug Fixes`: acrescentar `* Made one-shot \`marc memory\` commands exit when they finish instead of waiting for the idle timeout of the inference workers.`

As demais alterações da revisão de documentação já estão na árvore de trabalho, assim como a versão `0.4.0` no `package.json` feita pelo humano. Elas entram na revisão integrada e no stage desta thread, e o desenvolvedor não deve alterá-las.

## Escopo de escrita (desenvolvedor)

| Caminho | Uso |
|---|---|
| `src/cli-memory-command.ts` (novo) | Sequência do comando único |
| `src/cli.ts` | Usar `runMemoryCommand` |
| `src/mcp/memory-tools.ts` | Descrições do item 2 |
| `test/cli-memory-command.test.ts` (novo) | Testes do item 1 |
| `test/mcp-memory.test.ts` | Testes do item 2 |
| `docs/memory.md` | Somente a frase do item 3 |
| `CHANGELOG.md` | Somente a linha do item 3 |

**Exclusões:** `.marc/**`, `.agents/**`, `.claude/**`, `package.json`, `pnpm-lock.yaml`, o restante da documentação e qualquer outro arquivo. Sem dependências novas.

## Testes declarados (sem if/else/switch/ternário)

`test/cli-memory-command.test.ts`, com cenários explícitos e dependências falsas tipadas:

- sucesso: `run` resolve, e a ordem registrada é `run`, `print`, `dispose`;
- falha: `run` rejeita, `print` não é chamado, `dispose` é chamado e o erro original chega ao chamador;
- `src/cli.ts` usa `runMemoryCommand` com `disposeMemoryProviders`, por regex no código, como em `test/ui-memory-search-panel.test.ts`.

`test/mcp-memory.test.ts`:

- as descrições de `memory_prepare`, `memory_status`, `memory_rebuild` e `memory_recall` não contêm `summary-memory`;
- a de `memory_rebuild` não contém `every closed thread summary`;
- a de `memory_deep` não contém `E4`;
- a de `memory_recall` cita `depth 1` e `does not prove that no decision exists`.

A suíte não carrega modelos, por isso a saída real do processo é verificada pelo principal.

## Critérios de aceite

1. Com `arquitetrua do projeto`, o processo sai em até 10 s depois da resposta, contra 284 s medidos hoje.
2. O recall continua devolvendo o mesmo resultado com `exit=0`.
3. Daemon e MCP mantêm os tempos ociosos: `src/core/memory/inference-manager.ts` não muda.
4. As descrições do item 2 aparecem na lista de ferramentas depois do reinício do ecossistema.
5. `pnpm validate`, `pnpm build` e `pnpm test` passam no estado integrado, com a documentação e a versão `0.4.0`.

## Execução

1. **Autorização do humano** para iniciar o desenvolvimento.
2. **Desenvolvimento:** claude-dev (Haiku 5.5, xhigh), em modo sequencial com um desenvolvedor, `OK_BOOTSTRAP` e autorização no canal entre agentes. O desenvolvedor publica a própria entrega nesta thread.
3. **Revisão integrada do principal:** código, testes, os critérios 1 a 3 e 5, e toda a revisão de documentação, comparada outra vez com o código final.
4. **Aceite do humano.** O encerramento depende de autorização explícita.
5. **Depois do encerramento:** o principal faz só o stage. O humano faz o commit, reinicia o ecossistema e cria a tag. O critério 4 é conferido depois do reinício, e as tags existentes não têm "v", então o nome que segue o padrão é `0.4.0`.

**Coaprovação do Codex:** não é necessária, porque é uma correção pequena, com causa medida. Fica disponível se o humano quiser.

## Fora do escopo

- Busca por intenção: está em pausa por decisão do humano e depende das decisões sobre o reranker. Isso inclui o texto de estado vazio da UI, `Try different terms or rebuild memory if recent summaries are missing.`, que deve ser revisto junto com essa frente.
- ADRs: são registro histórico e já têm notas de continuidade.
- Comentários internos com `M0`, `E0` e `E1` no código: não chegam a quem usa o produto.
