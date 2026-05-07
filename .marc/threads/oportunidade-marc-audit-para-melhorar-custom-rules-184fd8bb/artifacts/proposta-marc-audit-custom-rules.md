# Proposta - marc_audit para melhorar Custom Rules

## Contexto

O mARC agora separa `INSTRUCTIONS.md` gerenciado pelo projeto e `RULES.md` como contrato de comportamento do workspace. `RULES.md` preserva `## Custom Rules` para orientações específicas do usuário/projeto.

Surge uma oportunidade para ajudar o usuário a manter essas regras customizadas claras, úteis, não redundantes e alinhadas ao padrão do mARC.

## Objetivo

Criar uma ferramenta `marc_audit` para analisar a qualidade das regras customizadas do workspace.

A ferramenta deve ser consultiva: sugerir melhorias, riscos e oportunidades, sem alterar automaticamente `RULES.md`.

## Escopo inicial

- Detectar regras vagas, ambíguas ou difíceis de executar por agentes.
- Apontar duplicidade entre regras customizadas e regras gerenciadas do mARC.
- Sugerir reescritas mais assertivas, preferencialmente com formato acionável.
- Identificar regras conflitantes entre si ou com o protocolo do mARC.
- Separar achados por severidade, por exemplo: `critical`, `warning`, `suggestion`.
- Retornar um relatório estruturado e amigável para o usuário revisar.

## Possível contrato de retorno

- `summary`: visão geral da saúde das Custom Rules.
- `findings`: lista de pontos encontrados com severidade, trecho afetado e sugestão.
- `recommendedRewrite`: opcional, com uma versão proposta do bloco `Custom Rules`.
- `noIssuesFound`: boolean para indicar quando não houver problemas relevantes.

## Critérios de aceitação iniciais

- `marc_audit` não modifica arquivos por padrão.
- A ferramenta diferencia regras gerenciadas de regras customizadas.
- O retorno ajuda o usuário a melhorar o texto sem esconder o conteúdo original.
- Deve haver testes cobrindo regras duplicadas, ambíguas, conflitantes e um caso sem achados.

## Relação com a thread encerrada

Esta oportunidade deriva da conclusão de marc://$oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486.

Ela complementa a decisão de manter customizações em `RULES.md` sob `Custom Rules`, oferecendo uma camada de qualidade para esse bloco.