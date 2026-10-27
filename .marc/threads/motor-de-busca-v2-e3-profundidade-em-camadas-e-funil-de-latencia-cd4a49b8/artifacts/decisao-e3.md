# Decisão da E3: proposta do principal

Base: a entrega revisada da T2 em marc://msg_9c2f4550754e4ae9a8 (`entrega-t2-e3-revisao.md`), aplicada aos critérios da tabela "Avaliação e decisão" do plano (revisão 8). A latência de ponta a ponta (H4, latência) é medida na T5 e não entra aqui.

## Revisão técnica da T2

**Veredito: aprovada como entrega de medição.**

O que verifiquei:
- **Cobertura:** sem nenhuma pendência.
- **Congelamento da auditoria:** provado com os julgados de antes do merge.
- **Referência comum:** segue o texto literal da revisão 8. As lacunas de camada aparecem como diagnóstico: 30 de 332 grupos relevantes no marc e 2 de 103 no ledgerline.
- **Recuo de evidência:** aplicado uma única vez (cosine-fts), como previsto.
- **Folds:** K e cortes escolhidos só no treino.
- **Determinismo:** sem divergência nas duas execuções.
- **Checks:** validate, build e test verdes (1.009 testes).

Limites registrados:
- **Curva de K acima de 30:** não pode ser calculada sem novas pontuações do reranker, porque a captura foi dimensionada para B = 232.
- **Corte da faixa alta:** fica perto de 1 em todos os folds. A meta de precisão 0,9 só é atingida na cauda saturada do reranker.
- **Efeito do `pnpm validate`:** a reformatação fora do escopo não foi verificada por diff, já que não usamos Git.

## Resultado por critério

| Critério | marc | ledgerline-en |
| --- | --- | --- |
| H4 recall dos finalistas (margem −0,02), K = 30 | −0,063 [−0,091; −0,037]: **falha**. K = 30 é o K_max, então a regra de K não é atendida em nenhum fold | 0,000: passa (K = 20) |
| H4 sobrevivência da evidência ≥ 0,90 | 0,727 (cosine) e 0,773 (cosine-fts, o recuo): **falha** | 29/29: passa |
| H4 Top1 FUNNEL contra ALL_PASSAGES | Não inferior nos dois modos | Não inferior |
| H5 ADAPTIVE contra DEPTH0, Top1-alvo | +0,122 [0,022; 0,223]: melhora | +0,342: melhora |
| H5 recall (implicit e layer) | implicit +0,183 e layer +0,520: melhora | Melhora |
| H5 exposição incidental | **Piora**: −0,163 [−0,296; −0,049] no total e piora também em implicit | Não inferior |
| H5 abstenção nos negativos | −0,214, com IC [−0,429; 0,000] no escopo negative (cosine) e [−0,462; 0,000] no total: inconclusiva, o que reprova pela regra da E0 | Não inferior |
| H5 armadilhas (≤ 1 parada antes da evidência) | 2 de 8 (J01 e J07, paradas na camada 0 por um resultado de grau 1 com score 1,0): **falha** | 0 de 8: passa |
| Faixas (precisão da faixa alta, ADAPTIVE contra DEPTH0) | Melhora | Melhora |
| Rebuild com três camadas ≤ 15 min | 177 s, com pico de 2,7 GB. O humano confirmou em 2026-10-25 que esta máquina, a mesma da T0, é a de referência: **passa**. A latência da T5 também é medida nela | — |
| `layersSearched` determinístico | 0 divergências | 0 divergências |

## Consequências pré-registradas

- **H5 falha no marc** por exposição incidental, armadilhas e abstenção, e não só por latência. Pela linha H5 do plano, isso leva à **busca única em depth 0 na UI**, com as camadas acessíveis só pelo MCP e pela E4. A rodada única de ampliação não salva H5, porque a exposição piora com o IC inteiro abaixo de zero.
- **H4 recall e sobrevivência falham no marc**, mesmo depois do recuo. Pela linha H4 do plano, isso vai ao humano (D10).
- **O funil existe para caber a expansão por camadas na latência.** Com a UI em depth 0, a busca de produção usa o algoritmo do M0 e não precisa do funil. Desde a revisão 6, DEPTH0 não tem garantia de identidade histórica com o M0, porque o BM25 e alguns vetores da camada 0 mudam com o índice misto. Por isso continua valendo o aceite de **não inferioridade de DEPTH0 contra o M0 congelado** (1b68a7e3f4e6), nos casos comuns, pela regra da E0. H5 não o substitui, e ele entra na T3. A falha de H4 deixa de afetar a UI. No MCP, a busca com depth 1 ou 2, pedida pelos agentes, pode reranquear todos os candidatos, sem funil, porque não está sob o limite de latência da UI.

## Proposta

1. **UI:** busca única em depth 0, igual ao M0 atual. O Deep sai da UI (T4, mantida) e o snapshot vai para v7.
2. **Camadas 1 e 2:** indexadas no rebuild e acessíveis pelo `depth` do MCP e da CLI, com reranqueamento completo, sem funil, e pela E4.
3. **Funil e expansão adaptativa:** ficam fora da produção. O código do harness permanece para reavaliação depois do estudo de modelos, porque a exposição incidental e a parada precoce são problemas de ranking que um reranker melhor pode resolver.
4. **T3 reduzida:**
   - as camadas no MCP e na CLI, com reranqueamento completo;
   - o aceite de não inferioridade de DEPTH0 contra o M0 congelado.
5. **T5:** latência medida na máquina de referência, na mesma execução:
   - caminho da UI, comparado ao M0 de antes da E3 com a ordem `input`, mediana ≤ 1,2 × M0;
   - caminho do MCP com depth 2, só reportado;
   - p95 e alvo de 5 s como informação.

Revisão (2026-10-24): ajustes da coaprovação do Codex (marc://msg_045816d10190469682) aplicados ao IC da abstenção, ao status da medição de rebuild e ao aceite de DEPTH0 contra o M0 congelado.

## D10 para o humano

A regra pré-registrada leva à proposta acima. A única escolha do humano é aceitá-la ou sobrepô-la, adotando a busca adaptativa na UI apesar das reprovações. Nesse caso, os ganhos seriam:
- no marc, +12 pontos de Top1 e +16 de recall;
- no ledgerline, +34 de Top1.

Os custos seriam:
- mais resultados incidentais;
- pior abstenção nas consultas fora do projeto;
- 6% de recall perdido no funil;
- 27% das evidências descartadas antes do reranker.

**Recomendação do principal: seguir a regra pré-registrada.**
