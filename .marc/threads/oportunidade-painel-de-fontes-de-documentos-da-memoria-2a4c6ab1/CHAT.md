# Oportunidade - Painel de fontes de documentos da memória

Thread: `oportunidade-painel-de-fontes-de-documentos-da-memoria-2a4c6ab1`
Created: `2026-11-14T17:51:18.950Z`

<!-- marc-message
id: msg_ec29af4edf2d433fb6
threadId: oportunidade-painel-de-fontes-de-documentos-da-memoria-2a4c6ab1
timestamp: 2026-11-14T17:51:58.616Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/proposta-inicial.md
-->

## Abertura da oportunidade

**Problema:** `memory.documentSources` só se edita à mão no `marc.config.json`, então o usuário não descobre o recurso.

**Proposta acordada com o humano em 14/11/2026:**
- uma árvore de arquivos no painel, lida pelo daemon a partir da raiz, que mostra só o que é indexável e grava caminhos relativos;
- caixas de três estados, e uma pasta marcada vira uma fonte só;
- um resumo das fontes com a autoridade;
- uma ferramenta MCP em que o agente só registra `reference`.

Os detalhes, as referências visuais e a nota de licença estão no artefato. A implementação usa os primitivos da lib neobrutalism.

**Depende de** marc://$oportunidade-painel-de-configuracoes-em-accordion-c04f04a9.

**Estado:** registrada, não autorizada a começar.

<!-- /marc-message -->
