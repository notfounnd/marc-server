# Oportunidade - Gate de validação proporcional ao impacto da entrega

Thread: marc://$oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b

Closed: `2026-10-11T22:45:44.347Z`

---

## Objetivo

Eliminar a exigência indiscriminada de validate, build e testes em mudanças apenas documentais, sem dispensar a revisão final integrada ou reduzir os checks de entregas executáveis.

## Decisões

A validação depende do impacto real e da conclusão afirmada, não da extensão dos arquivos.

- Editorial, changelog e registros mARC recebem checks localizados de conteúdo, Markdown, links, referências e metadados.
- Harness acrescenta revisão de coerência das instruções, autoridade das fontes, cenários e preservação do fluxo.
- Exemplos executáveis recebem verificações específicas e seguras.
- Código, testes, tooling, dependências, configuração executável e mudanças nos contratos de parsing/persistência exigem `pnpm validate`, `pnpm build` e `pnpm test`.
- Declaração de release pronta exige a bateria completa. Entregas mistas usam o maior impacto. Incerteza deve ser esclarecida antes de dispensar checks.
- Relatórios registram classificação, checks reais, resultados e limites. Comandos não aplicáveis não são aprovações nem pendências.

## Implementação

Atualizados AGENTS.md, Custom Rules de .marc/RULES.md, docs/agent-workflows.md e docs/development.md. RULES permanece canônico e sua parte gerenciada foi preservada.

O handoff declara impacto e plano de validação. O dev reporta sua própria entrega e o principal confere classificação e suficiência das evidências na revisão integrada. Foram mantidas as regras de bootstrap independente, autorização antes da edição, perfis compartilhados, formato das mensagens, ausência de diário e aceite humano separado da aprovação técnica.

A solução ficou no harness. Não foram criados gates executáveis, scripts, hooks, configurações de cliente ou alterações de runtime.

## Validação e aceite

O principal revisou o resultado integrado e repetiu os checks após as correções de revisão.

- Parser Markdown e Prettier API read-only passaram nos quatro documentos.
- 32 links e âncoras locais passaram.
- Prefixo gerenciado de RULES permaneceu idêntico ao baseline.
- Cenários de aceitação e coerência entre os documentos foram conferidos.
- Auditorias estruturais de regras, mensagens e artefatos não tiveram achados.
- `pnpm validate`, `pnpm build` e `pnpm test` foram não aplicáveis nesta entrega documental, conforme plano aprovado.

Veredito técnico approved, seguido de autorização humana explícita para encerramento. A auditoria de mensagens do encerramento também passou. Não há pendências no escopo aprovado.

## Limites

A aprovação verifica o contrato documental, não adesão futura de agentes nem uma release do produto. Sessões já ativas precisam ler as instruções atualizadas. Não é necessário rebuild ou restart do produto por esta mudança.

Alterações concorrentes da atividade 1d4c0daa foram preservadas, sem incorporá-las ou aprová-las nesta revisão.

## Evidências

- [Plano aprovado](artifacts/plano-validacao-proporcional.md).
- [Entrega autoral do desenvolvedor](artifacts/relatorio-validacao-proporcional-entrega.md).
- [Avaliação integrada do principal](artifacts/atividade-validacao-proporcional.md).
