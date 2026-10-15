# Estudo - Profundidade adaptativa e simplificacao do Deep Search

Thread: marc://$estudo-profundidade-adaptativa-e-simplificacao-do-deep-search-4f477d9f

Closed: `2026-10-15T14:57:21.976Z`

---

Estudo proposto para decidir se o Deep Search deveria continuar como interação progressiva na UI ou dar lugar a uma busca única com profundidade interna. A thread foi encerrada como superada, sem desenvolvimento: a pergunta foi respondida pela decisão D3 do humano no programa do motor de busca v2, e os critérios desta proposta seguem como hipótese H5 da etapa E3.

## Contexto

A proposta, em `proposta-estudo-profundidade-adaptativa-deep-search.md`, separava quatro controles com efeitos diferentes:

- profundidade da coleta de candidatos;
- elegibilidade semântica;
- ordenação;
- quantidade de resultados exibidos.

Ela comparava três alternativas: manter o fluxo atual, remover só o Deep da UI ou adotar profundidade fixa intermediária ou adaptativa.

## Decisão que respondeu ao estudo

Pela decisão D3, registrada em marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab/#msg_115345006d284a6dad/!registro-da-rota-do-motor-de-busca.md:

- o botão Deep sai da UI;
- `depth` continua no core e no MCP, agora como camadas de corpus: 0 é `SUMMARY.md`; 1 acrescenta artifacts, `RULES.md` e documentos configurados; 2 acrescenta `CHAT.md`.

## Continuidade

A hipótese H5 de marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8 herda os critérios desta proposta sem mudança:

- busca única que preserva ou melhora o Top 1;
- consultas implícitas sem perda de recall;
- falsos positivos sem aumento;
- expansão determinística e observável em diagnósticos.

O humano autorizou o encerramento das threads legadas que não são mais necessárias.
