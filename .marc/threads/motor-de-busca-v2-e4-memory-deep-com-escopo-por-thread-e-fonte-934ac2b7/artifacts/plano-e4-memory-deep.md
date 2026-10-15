# Plano da E4: `memory_deep` com escopo por thread e fonte

## Resumo

A E4 cria a ferramenta MCP `memory_deep` e o comando de CLI equivalente. O `memory_recall` responde **"qual thread?"**; o `memory_deep` responde **"onde, dentro das fontes fechadas, está o trecho que explica isso?"**.

A ferramenta devolve passagens, e não threads agrupadas. Cada passagem vem com a proveniência completa da E1, e o escopo pode ser restrito por `threadId` e por tipo de fonte.

Esta thread substitui marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae, que é encerrada como superada. O artifact daquela thread cita `paraphrase-multilingual-MiniLM` e `minScore`, que não existem mais. As diferenças em relação a ele estão na seção "Mudanças em relação à proposta original". Rota: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md.

## Gate de entrada

- E3 (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8) aceita pelo humano, com rebuild produtivo de todas as camadas.
- Referências de linha conferidas pelos aprovadores no handoff.

## Fontes obrigatórias

- regras, registro da rota, ADRs 0010 a 0012 e relatórios da E3;
- `oportunidade-memory-deep.md` da thread `f04c7cae`, como contexto histórico;
- `src/mcp/memory-tools.ts`, `src/cli.ts` (`memoryCommandHandlers`), `src/core/workspace-memory.ts` e `src/core/memory/operations.ts`;
- a função que resolve id de thread por sufixo de 8 caracteres hex, usada por `thread_read`. O desenvolvedor a localiza e a cita no `OK_BOOTSTRAP`;
- `src/core/marc-ops-skill.ts`.

## Desenho

### 1. Entrada

```ts
type MemoryDeepInput = {
  query: string;
  threadId?: string;            // id completo ou sufixo de 8 hex
  sourceTypes?: MemorySourceType[];
  queryMode?: "auto" | "literal";
  limit?: number;               // padrão 5, máximo 20
};
```

**Erros**, como resultado da ferramenta e não como exceção não tratada:

| Situação | Mensagem |
|---|---|
| Thread inexistente | `Thread not found.` |
| Thread aberta | `memory_deep only covers closed threads.` (D4) |
| `sourceTypes` vazio ou com tipo inválido | Lista dos tipos válidos |
| `limit` fora de 1 a 20 | Faixa permitida |

### 2. Busca

1. Interpretação igual à do `memory_recall` (D7).
2. Candidatos de todas as camadas (depth 2), filtrados pelo escopo antes da pontuação.
3. As passagens do escopo são ordenadas pelo score do reranker. Quando o número de passagens no escopo passa de 60, os finalistas são escolhidos antes pelo cosseno, para limitar o custo.
4. Cada passagem recebe `groupBand`, a faixa do grupo dela calculada pelo modelo da E3.
5. **Admissão:**
   - **com `threadId`:** o agente pediu para aprofundar aquela thread, então as melhores passagens voltam mesmo que o grupo não tenha faixa, com `groupBand` ausente;
   - **sem `threadId`:** só voltam passagens cujo grupo foi admitido (D6 continua valendo).

### 3. Saída

```ts
type MemoryDeepHit = {
  sourceType: MemorySourceType;
  authority: MemoryAuthority;
  threadId?: string;
  reference: string;          // mesma tabela da E3
  sourcePath: string;
  lineStart: number;
  lineEnd: number;
  messageId?: string;
  agentId?: string;
  artifactFileName?: string;
  sectionTitle?: string;
  matchedText: string;        // texto da passagem
  score: number;              // score do reranker
  groupBand?: "high" | "medium" | "low";
};
```

A resposta também traz `interpretation`, `indexStatus` e `nextActions`. As ações sugeridas seguem uma tabela por `authority`:

| `authority` | Ação sugerida |
|---|---|
| `decision` | Ler a thread |
| `rule` | Revisar o arquivo de regras na linha indicada |
| `artifact` | Abrir o artifact |
| `document` | Abrir o documento |
| `conversation` | Tratar como contexto intermediário e confirmar no `SUMMARY.md` ou na mensagem final |

As linhas são as da seção de origem (limite registrado na E1). A ferramenta não promete precisão de linha dentro da seção.

### 4. Interfaces

- **MCP:** `memory_deep`, protegida por `workspace_bootstrap` como as outras ferramentas de memory.
- **CLI:** `marc memory deep --query <text> [--thread <id>] [--source summary,artifact,rules,document,chat] [--limit <n>] [--query-mode auto|literal]`, como nova entrada em `memoryCommandHandlers`.
- **HTTP e UI:** fora do escopo.
- **Skill `marc-ops`:** `src/core/marc-ops-skill.ts` ganha, depois do passo do `memory_recall`, a orientação de usar `memory_deep` com `threadId` quando uma thread fechada relevante precisar de detalhe, antes de ler o `CHAT.md` inteiro. O `SKILL.md` gerado é atualizado pelo `workspace_update_recommendations`, nunca editado à mão.

## Mudanças em relação à proposta original da `f04c7cae`

| Proposta original | Agora |
|---|---|
| Snapshot de índice separada | O mesmo índice por camadas da E1 e da E3, sem custo de um segundo rebuild |
| Três ferramentas (`memory_deep_status`, `memory_deep_rebuild`, `memory_deep_recall`) | Só `memory_deep`. Status e rebuild são os da memory |
| `minScore` | Removido; a confiança vem de `groupBand` |
| Modelo `paraphrase-multilingual-MiniLM` | Modelos atuais (D8) |
| Sem documentos externos | Documentos configurados (D5) entram como `sourceType: "document"` |

## Escopo de escrita autorizado

| Caminho | Uso |
|---|---|
| `src/core/memory/deep.ts` (novo) | Busca por passagens com escopo |
| `src/core/memory/types.ts`, `src/core/workspace-memory.ts` | Tipos e exposição |
| `src/mcp/memory-tools.ts`, `src/cli.ts` | Interfaces |
| `src/core/marc-ops-skill.ts` | Orientação da skill |
| `scripts/memory-eval/**`, `test/**` | Variante `DEEP` e testes |
| `docs/memory.md`, `docs/mcp-tools.md` | Documentação |

**Exclusões:** `src/ui/**`, `src/daemon/**`, `src/core/memory/scoring/**` (só leitura), `.marc/memory/**` e `pnpm-lock.yaml`.

## Avaliação

Os aprovadores acrescentam ao `marc.json` as 4 consultas da proposta original como casos com `style: "deep"`. A E4 adiciona esse estilo ao tipo `EvalCaseStyle` e aceita o efeito no `validate`. Também entram 10 casos novos com escopo por thread, com julgamento por grupo.

A variante `DEEP` do harness mede:

- se um grupo de grau ≥ 2 aparece entre as 5 primeiras passagens;
- a proporção de resultados dentro do escopo, que precisa ser 100%.

## Tarefas do desenvolvedor

| Tarefa | Entrega | Testes |
|---|---|---|
| T1 | `deep.ts`, tipos, MCP e CLI | Escopo por thread completo e por sufixo; thread aberta e inexistente; filtro de tipos; limites; `nextActions` por autoridade em tabela declarada; linhas da seção conferidas no arquivo |
| T2 | Variante `DEEP`, casos e avaliação | Harness |
| T3 | Skill e docs | Teste existente da skill atualizado |

## Critérios de aceite

1. 100% dos resultados dentro do escopo pedido, em teste e no harness.
2. Grupo de grau ≥ 2 entre as 5 primeiras passagens em pelo menos 3 das 4 consultas originais. Os casos novos são reportados, sem meta.
3. Sem `threadId`, nenhuma passagem de grupo não admitido aparece. Coberto por teste.
4. Mediana de latência ≤ 5 s nas consultas com escopo, na máquina de referência.
5. `pnpm validate`, `pnpm build` e `pnpm test` passam, com as regras de estilo e de teste respeitadas.
6. Docs atualizados. O `SKILL.md` foi regenerado pelo `workspace_update_recommendations` e revisado como mudança de harness: coerência das instruções, autoridade da fonte e preservação do fluxo.

## Riscos

- **Ruído do chat no escopo sem thread:** é mitigado pela admissão por grupo e pela orientação de `conversation`.
- **Agentes usando `memory_deep` no lugar do `memory_recall`:** a skill orienta a ordem, e a descrição da ferramenta repete essa orientação.

## Pendências antes do dispatch

- desenvolvedor e configuração confirmados pelo humano;
- veredito conjunto dos aprovadores sobre este plano, depois da aceitação da E3.
