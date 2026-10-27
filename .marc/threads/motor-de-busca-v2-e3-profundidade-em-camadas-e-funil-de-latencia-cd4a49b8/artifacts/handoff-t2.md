# Handoff da T2: métricas, folds e relatório de decisão

## Objetivo

Produzir, nas capturas congeladas da E3 e com os julgamentos já consolidados nos datasets, os números da tabela "Avaliação e decisão" do plano (revisão 8). Para H4 (recall, evidência), H5 e faixas, cada critério sai com o IC pela regra da E0. A latência de ponta a ponta fica para a T5.

A T2 não altera produção (`src/**`). Ela entrega métricas, folds, relatórios e as correções de harness já identificadas.

## Fontes obrigatórias

- O plano `plano-e3-profundidade-em-camadas-e-funil.md` (revisão 8), em especial:
  - seção 4, sobre o funil, o orçamento, a escolha de K e P e a sobrevivência;
  - seção 5, sobre as faixas;
  - "Escopo do julgamento (revisão 8)";
  - "Avaliação e decisão";
  - a linha T2 de "Tarefas do desenvolvedor".
- O consenso do julgamento: msg_0a78b65afde64621b3 e os anexos `consenso-julgamento-e3*.md`.
- O artifact `casos-e-poder-e3.md` (revisão 3), para a regra de decisão e as unidades das métricas.
- RULES.md completo, AGENTS.md, a skill marc-ops, `docs/memory.md` e o código atual de `scripts/memory-eval/**`.

## Insumos congelados

| Corpus | Captura | Dataset |
| --- | --- | --- |
| marc | `.marc/cache/memory-eval/marc/87cd2e4d96f7` | `scripts/memory-eval/datasets/marc.json`, com os graus por camada já incorporados |
| ledgerline-en | `.marc/cache/memory-eval/ledgerline-en/0d31bd4afd3f` | `scripts/memory-eval/datasets/ledgerline-en.json` |

Os graus e as capturas não podem ser alterados. Se uma métrica exigir célula sem grau ou par sem score, o caso fica `incomplete` e é reportado; nunca vira zero.

## Entregas

1. **Cobertura antes das métricas:** rodar o julgamento incremental (`worksheet --variants`) para todas as variantes da grade, nos dois corpora.
   - Se houver qualquer célula pendente ou score ausente, parar e reportar a lista.
   - Se não houver pendência, registrar "0 pendentes" no relatório.
2. **Referência comum (H4 e H5):**
   - o conjunto de relevantes de cada caso é fixado pelo maior grau julgado entre as camadas no universo comum das duas variantes comparadas;
   - o denominador é o mesmo para as duas;
   - o numerador conta só a evidência acessível na depth da variante.
   
   Esta é a pendência registrada para a T2.
3. **Métricas:**
   - recall de grupos de grau ≥ 2 entre os finalistas contra `ALL_CANDIDATES`, no universo julgado U;
   - sobrevivência da evidência por `passageId` nos casos `layer` e `adaptive-trap`;
   - Top1-alvo de `FUNNEL` contra `ALL_PASSAGES`;
   - para H5, `ADAPTIVE` contra `DEPTH0`: Top1-alvo, recall nos casos `implicit` e `layer`, exposição incidental e abstenção correta nos negativos;
   - nas armadilhas: contagem das paradas antes da camada da evidência, e Top1-alvo e Top3-alvo de `ADAPTIVE` contra `DEPTH2`;
   - `layersSearched` idêntico em duas execuções;
   - `ADAPTIVE_HM` só como referência.
4. **Folds:** K e os cortes de faixa são escolhidos só nos folds de treino, com folds externos por família como na E0 e na E2.
   - **Regra de K:** o menor K da grade viável (8, 10, 12, 15, 20, 25, 30) com perda de recall ≤ 0,02 no treino.
   - **P:** sai do saldo de B = 232 pela regra da seção 4.
   - **Cortes:** pelo procedimento `fallbackCuts`.
   - **Regra de produção à parte:** todos os folds.
   - O relatório traz o K, o P e os cortes de cada fold e os de produção.
5. **Regra de decisão:** a da E0, com δ 0,05, IC da métrica real por bootstrap por família e inconclusivo reprovando. A margem de H4 no recall é −0,02. Também:
   - critério de faixas da seção 5, com precisão externa da faixa alta de `ADAPTIVE` não inferior à de `DEPTH0`;
   - correção do `decisionTerm`, para que não diga "piora" quando `nonInferior` for verdadeiro.
6. **Relatório por corpus** em `.marc/cache/memory-eval/<corpus>/`, em JSON e Markdown, com:
   - a tabela de decisão, com valor, IC e veredito por critério;
   - seleção, cobertura da matriz e evidência sobrevivente;
   - cada perda de evidência, com caso, grupo, número de passagens e posição em `FUNNEL` contra `ALL_PASSAGES`;
   - admissão por tipo de grupo (thread, rules, document);
   - o pool da auditoria: tamanho externo, amostra e achados (3/274 no marc, 0/158 no ledgerline);
   - `fullRecall10` e `fullMrr10` como diagnóstico, com "não calculável" quando houver lacuna.
7. **Correção do `report`:** o comando passa a carregar os vetores da captura.
8. **Rebuild (critério "Rebuild ≤ 15 min"):** medir o rebuild completo do marc com as camadas [0, 1, 2] numa cópia temporária do workspace, nunca em `.marc/memory/**`, e reportar o tempo e o pico de memória.
   - Encerrar só os PIDs que você iniciou.

## Testes declarados

- Determinismo do funil.
- Alterar os graus de um fold externo não muda K, P nem os cortes que predizem esse fold.
- Sobrevivência por `passageId`: numa seção com duas passagens, selecionar só a passagem sem a citação produz falha.
- `ADAPTIVE` continua com resultado médio e para com resultado alto.
- Referência comum: o mesmo denominador para as duas variantes; o numerador limitado à depth.
- `decisionTerm` com `nonInferior` verdadeiro.
- Fixtures e testes sem `if`, `else`, `switch`, ternário ou skip.

## Escopo de escrita

- **Autorizado:** `scripts/memory-eval/**` e `test/**`.
- **Excluídos:** `src/**`, os datasets (os graus estão fechados), as capturas, `.marc/memory/**` e `pnpm-lock.yaml`. Também não há Git.
- Se alguma correção exigir mexer em `src/**`, reporte antes de editar.

## Checks

- `pnpm validate`, `pnpm build` e `pnpm test`.
- Além disso, o relatório real gerado nos dois corpora.

## Configuração e loop

- **Desenvolvedor:** claude-dev, com Haiku 5.5 em xhigh, configuração confirmada pelo humano.
- **Modo:** sequencial, com um desenvolvedor.
- **Antes de editar:** OK_BOOTSTRAP com workspace, fontes lidas, regras críticas, configuração, escopo e estado dos alvos, seguido de autorização pelo canal interno.

## Entregáveis do desenvolvedor

1. Relatório interno ao principal, com os caminhos e linhas alterados, os checks e resultados, os números das duas tabelas de decisão, os riscos e o messageId da entrega.
2. Entrega consolidada publicada na thread pelo próprio desenvolvedor, sob claude-dev, com a revisão do principal pendente.
