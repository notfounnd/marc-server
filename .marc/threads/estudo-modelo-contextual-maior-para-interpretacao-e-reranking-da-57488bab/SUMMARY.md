# Estudo - Modelo contextual maior para interpretacao e reranking da memory

Thread: marc://$estudo-modelo-contextual-maior-para-interpretacao-e-reranking-da-57488bab

Closed: `2026-10-15T14:57:40.567Z`

---

Estudo para decidir se um modelo contextual maior melhoraria a interpretação da consulta e o reranking da memory. Nenhum modelo maior foi adotado:

- o Qwen3-Reranker-0.6B foi descartado pelos critérios do estudo 4 e pelo tamanho;
- o LFM2.5-350M segue como interpretador até a decisão H3;
- o E5-small e o mMARCO MiniLM continuam.

A única mudança implementada foi a atualização do Transformers.js para 4.3.1. A thread terminou com uma nova rota para o motor de busca, aprovada pelo humano e desdobrada nas etapas E0 a E4.

## Objetivo e contexto

O ponto de partida foi a dúvida se a qualidade da busca estava limitada pelos modelos pequenos. A thread mediu o baseline e executou estudos controlados de ordenação e descarte, de conteúdo indexado, de interpretação e de reranker. Os estudos usaram capturas congeladas e critérios declarados antes de cada rodada.

## Resultados dos estudos

- **Baseline:** em 30 consultas históricas, o alvo ficou em primeiro em 27/30. Os casos sem Top 1 foram 3P, 6I e 9I. O modo automático aplicou correções gramaticais indevidas em 2I e 9P.
- **Estudo 1, pontuação, ordenação e descarte:** nenhuma alternativa (M1 a M5) trouxe melhora segura. Ele separou dois problemas: alvos candidatos descartados pela elegibilidade e alvos aceitos mal ordenados.
- **Estudo 2, sumários e evidências da conversa:** indexar o `CHAT.md` junto com os sumários piorou os casos históricos (Top 1 de 26/30 para 24/30) e melhorou pouco os controles. Também mostrou que a elegibilidade de uma thread depende dos demais candidatos.
- **Estudo 3 e estudos do LFM:** nem decisão estruturada, nem duas etapas, nem nova apresentação do prompt, nem configuração de geração melhoraram o interpretador. O LFM350M corrige os typos válidos, mas também aceita propostas indevidas. O LFM 1,2B preservou melhor as consultas, mas reconheceu poucos typos.
- **Estudo 4, reranker Qwen:** nas 38 consultas positivas distintas, o Top 10 subiu de 32 para 35, mas o Top 1 caiu de 31 para 29. A substituição foi rejeitada pelos critérios de promoção.

## Entrega implementada

- `@huggingface/transformers` atualizado para `^4.3.1`, com a identidade dos providers alinhada e o rebuild incremental protegido contra provider incompatível.
- Revisão integrada aprovada, com 289/289 testes. Scripts experimentais removidos na preparação do encerramento.
- As mudanças ficaram no stage sem commit; o commit depende de autorização explícita do humano.

## Rota do motor de busca v2

O registro marc://#msg_115345006d284a6dad prevalece sobre a análise original onde divergirem. Ele contém:

- **decisões do humano D1 a D10:** pipeline separado, contrato único de faixas, profundidade como camadas, só threads fechadas, documentos externos opt-in, regra do acerto literal mantida, interpretação transparente, modelos atuais e governança técnica delegada aos aprovadores;
- **hipóteses H1 a H6:** cada uma com critério de aceite e recuo.

O registro incorporou as objeções do arquiteto Codex em marc://#msg_e54bf642b9944616a6:

- a causalidade do platô ainda não está provada;
- os rótulos sintéticos são incompletos;
- o acerto literal na admissão reabriria uma restrição do humano;
- é preciso medir a incerteza;
- os tempos da análise original estavam errados.

## Continuidade

Cada etapa tem plano detalhado anexado e roda em sequência:

- **E0:** marc://$motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b
- **E1:** marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
- **E2:** marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2
- **E3:** marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8
- **E4:** marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7

O desenvolvedor ainda será definido pelo humano, e cada plano depende do veredito conjunto dos aprovadores marc://@claude-software-architect e marc://@codex-software-architect.

As threads `4f477d9f` e `f04c7cae` foram encerradas como superadas. marc://$oportunidade-grafo-de-evolucao-e-proveniencia-historica-do-proje-b84711a0 continua aberta, fora do programa.

O humano autorizou o encerramento desta thread.
