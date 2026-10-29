# Revisão final integrada da E4

## Escopo e fontes

Esta revisão cobre o estado integrado de toda a E4, depois da última mudança autorizada:
- T1: `memory_deep` no core, MCP e CLI;
- T2: harness `marc-deep`;
- a correção do `merge-judgments`;
- T3: latência, descrição, skill, docs e ADR 0013;
- o ajuste de revisão final no teste de adoção.

**Fontes:**
- o plano rev 4.1 (plano-e4-memory-deep.md);
- a revisão da Entrega 1 (revisao-entrega-1-e4.md) e o parecer do Codex sobre ela;
- a Entrega 2 (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_3dd0848cfb874710b8);
- o resultado do marc-deep (resultado-deep-e4.md);
- o consenso (consenso-julgamento-e4.md);
- os pareceres do Codex sobre o consenso e o resultado (marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_40ccfdb574d042e792 e marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7/#msg_d3f71d591a2b439c80).

**Código lido nesta revisão:**
- `deep-latency.ts`, `deep-latency-paths.ts`, `deep-latency-math.ts` e `deep-latency-report.ts`;
- a guarda `isEntrypoint` de `t0-funnel-prestudy.ts`;
- `commitMerge` e `printMergeReport`;
- `memory-tools.ts:91` e `marc-ops-skill.ts:50-52`;
- a ADR 0013, `docs/memory.md` (seção `memory_deep`), `docs/mcp-tools.md` (seção `memory_deep`) e o índice de ADRs;
- os testes novos de latência, de merge e de adoção.

T1 e T2 foram lidas e aprovadas na revisão da Entrega 1. Nesta revisão, conferi que nada nelas mudou depois disso, exceto o ajuste no teste de adoção.

Toda a inspeção e as checagens foram feitas via context-mode. Nenhum comando Git foi executado.

## Critérios de aceite

| Critério do plano | Evidência no estado integrado | Resultado |
|---|---|---|
| 1. 100% dos resultados dentro do escopo | O replay do `deep-run` dá conformidade de escopo de 100% no `DEEP`. Os testes de escopo do core (`core-memory-deep-scope`, `core-memory-deep-source-types`) cobrem a thread e os tipos pedidos e nunca devolvem a identity | Passa |
| 2. Success@5 ≥ 12/14, sem incompletos, cada falha classificada uma vez | `DEEP` com B = 232: 13/14, 0 incompletos e protocolo completo (4 casos sem escopo, 10 com escopo, 2 acima de 232). D03 é ordering: a evidência do CHAT ficou em 10º na saída do `DEEP` e a do SUMMARY não entrou no pool. O Codex recalculou o relatório e chegou ao mesmo resultado | Passa |
| 3. Sem escopo, nenhum grupo não admitido aparece | O teste de pool usa um grupo reprovado com trecho de score maior, que fica fora. A paridade com a depth 2 mostra os mesmos documentos e pares | Passa (revisão da Entrega 1) |
| 4. Latência: as duas medianas até 1,2 × M0 na mesma execução | Uma execução de 64 min, com 1 aquecimento e 3 rodadas por caso e a ordem dos caminhos rotacionada:<br>- com escopo: mediana de 11,5 s contra o limite de 33,8 s (1,2 × M0 das 10 consultas com escopo);<br>- sem escopo: mediana de 26,5 s contra o limite de 36,6 s (1,2 × M0 das 14).<br>Pares iguais aos do replay. O B' = 212 foi calculado e não foi usado | Passa |
| 5. `validate`, `build` e `test`, com as regras de estilo e de teste | Desenvolvedor, rodada final: `pnpm validate` exit 0, com hashes do manifest e dos datasets inalterados. Principal, no estado final: `pnpm build` exit 0 e `pnpm test` 1.170/1.170 | Passa |
| 6. Docs, ADR 0013 e `SKILL.md` | A ADR 0013 segue a estrutura da 0012 e registra as posições 10 e 15 do D03 com a definição de cada uma, mais a taxa de 6,74 pares/s contra os ~11,7 da E3. As docs e a descrição do MCP usam o mesmo texto de latência. A fonte da skill (`marc-ops-skill.ts:50-52`) está revisada. O `SKILL.md` gerado está pendente: veja Limites | Passa na fonte; regeneração pendente |

**Exclusões do plano:** `semantic-ranking.ts`, `hybrid-ranking.ts`, `operations.ts`, `scoring/**`, `src/ui/**`, `src/daemon/**` e `pnpm-lock.yaml` não foram modificados depois da E3 (conferido pelas datas de modificação). O manifest de `.marc/memory` continua com sha256 `ae070d9a…`. Nenhuma dependência nova.

## Comportamento e arquitetura

- **`memory_recall` inalterado:** a paridade P1 e a de ponta a ponta continuam na suíte. O replay M0,DEPTH2 das capturas E3 manteve o sha256 (revisão da Entrega 1).
- **Medição:**
  - a M0 reaproveita a preparação da E3 (`openReferenceContext`, extraída sem mudar o comportamento do t0);
  - o caminho com escopo é comparado com a M0 das mesmas 10 consultas, uma comparação mais justa que a M0 das 14;
  - a aritmética do gate, do overhead, da taxa e do B' está em funções puras, com 10 testes.
- **Valores absolutos:** a máquina estava cerca de 1,7× mais lenta que na E3. O gate relativo não é afetado, porque é intercalado. A descrição do MCP cita o p95 de cerca de 35 s como medição da E4, sem prometer mediana. A ADR exige repetir a medição antes de um release.
- **Correção do merge:** `commitMerge` conta os graus de trecho. Antes, um merge só de trechos dava `committed=false` em silêncio. Há 3 testes, e o merge real gravou os 101 graus.
- **Estilo:** sem `else` e sem `if` aninhado no código novo (`deep*.ts`, `thread-resolution.ts`, `judgments.ts`), conferido por busca. Os testes da E4 ficaram sem if, else, switch ou ternário depois do ajuste abaixo.

## Achados desta revisão

1. **Ternários em fixture de teste** (`memory-eval-deep-adoption.test.ts`, vindos da T2 e não pegos na revisão da Entrega 1). A regra Test Design proíbe ternário também em fixtures.
   - **Correção:** tabelas declaradas `ROW_SCORES` e `ROW_GRADES`, tipadas com `RelevanceGrade`, com os mesmos valores testados.
   - **Checagem depois da correção:** busca limpa nos testes da E4, `validate` 0 e `test` 1.170/1.170, tanto do desenvolvedor quanto meu.
2. **Relato do D03** (posições 29/67 eram da matriz, não da saída). Corrigido no resultado e na ADR depois do parecer do Codex.

Não há achados abertos no código.

## Limites

- **`SKILL.md`:** o servidor mcp-marc carregou o código anterior à mudança da skill, e o `workspace_update_recommendations` respondeu `alreadyCurrent`. A fonte está aprovada. A regeneração depende de reconectar o mcp-marc, e a conferência do arquivo gerado fica registrada no fechamento.
- **Descrição do MCP:** a nova descrição só vale nos clientes depois da reconexão. O texto no código está revisado.
- **Amostra:** uma execução de latência em uma máquina, e 14 casos de qualidade num corpus. Um novo corpus, uma nova máquina ou uma mudança no reranker ou na segmentação exigem nova medição (ADR 0013).
- **D03:** vai ao estudo de modelos como ordering. A classe, sozinha, não prova que trocar o modelo resolve o caso.

## Veredito

**Aprovado tecnicamente** no estado integrado, com B = 232 adotado: qualidade e os dois gates de latência passam na mesma etapa.

O único passo restante é mecânico: regenerar o `SKILL.md` a partir da fonte já revisada e conferir o arquivo gerado. Ele não muda código nem testes.

A aceitação do usuário e a autorização de encerramento são separadas desta aprovação.
