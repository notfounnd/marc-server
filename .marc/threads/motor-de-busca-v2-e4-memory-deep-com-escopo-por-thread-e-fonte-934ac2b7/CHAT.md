# Motor de busca v2 - E4 memory_deep com escopo por thread e fonte

Thread: `motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7`
Created: `2026-10-15T14:43:21.007Z`

<!-- marc-message
id: msg_dd1b6836101a4219a5
threadId: motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7
timestamp: 2026-10-15T14:55:57.958Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-e4-memory-deep.md
-->

## Abertura da E4

Última etapa do programa do motor de busca v2. O plano anexado define a ferramenta `memory_deep`:

- devolve passagens com proveniência completa, e não threads agrupadas;
- aceita escopo por `threadId` e por tipo de fonte;
- usa o mesmo índice por camadas da E1 e da E3, sem snapshot separada.

Esta thread substitui marc://$oportunidade-memory-deep-para-aprofundamento-em-threads-fechadas-f04c7cae, por decisão do humano de começar do zero em vez de reaproveitar a thread antiga. O plano tem uma tabela com as diferenças em relação à proposta original, cujo artifact citava `paraphrase-multilingual-MiniLM` e `minScore`.

## Gate e pendências

- **Gate:** a E3 (marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8) aceita pelo humano, com rebuild produtivo de todas as camadas.
- **Antes do dispatch:** desenvolvedor confirmado pelo humano e veredito conjunto dos aprovadores.

<!-- /marc-message -->
