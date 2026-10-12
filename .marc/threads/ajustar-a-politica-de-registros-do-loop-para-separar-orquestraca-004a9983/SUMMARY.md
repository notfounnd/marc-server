# Ajustar a política de registros do loop para separar orquestração e mensagens de desenvolvimento

Thread: marc://$ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983

Closed: `2026-10-09T14:24:04Z`

---

## Resultado

Thread concluída com aprovação técnica após revisão final integrada do principal e autorização humana explícita de encerramento. A alteração ficou restrita à documentação, regras do fluxo, responsabilidades dos perfis existentes e registros da atividade. Nenhum código, teste ou comportamento do produto foi alterado.

## Objetivo e decisões

- Separar o controle interno do loop dos registros relevantes de desenvolvimento. Handoffs, bootstrap, autorização, comandos rotineiros e devolutivas ficam no canal de agentes e na evidência consolidada, não em comentários por etapa.
- Preservar bootstrap independente e autorização explícita antes da edição, com evidência recuperável após perda de contexto.
- Permitir que desenvolvedores publiquem suas próprias contribuições relevantes com o perfil compartilhado existente. Administração do catálogo permanece com o principal, sem cadastro ou atualização por spawn.
- Exigir revisão final independente de todo o desenvolvimento integrado antes da aprovação técnica. Relatórios de tarefas, quantidade de loops, checks e auditorias não substituem essa avaliação.
- Registrar critérios, evidências, achados, limites e veredito. Devolver achados ao desenvolvedor e reavaliar após correções ou mudanças posteriores.
- Manter aprovação técnica, aceite humano e autorização de encerramento distintos. O contrato permanece agnóstico de fornecedor e não cria gate em mensagem, ferramenta, UI ou hook.

## Entrega

AGENTS.md, docs/agent-workflows.md, Custom Rules de .marc/RULES.md e responsabilidades dos dois perfis de agentes foram alinhados. Metadados e configurações dos perfis, perfil humano, trecho gerenciado, skill e instruções gerenciadas foram preservados.

O desenvolvedor executou a tarefa documental e publicou sua entrega com o perfil compartilhado. O principal revisou o conjunto, devolveu dois achados e conferiu as correções: evidência de formatação que antes contabilizava arquivos ignorados pelo CLI e apresentação da mensagem autoral. O registro consolidado contém a avaliação final substantiva e o veredito aprovado.

## Validação

- pnpm validate, pnpm build e pnpm test aprovados em sequência; 199 testes passaram, sem falhas ou testes ignorados.
- Checagem efetiva de Markdown pela API do Prettier e 22 links locais aprovados.
- Integridade dos 194 arquivos de src, test e scripts e dos arquivos protegidos confirmada contra o baseline.
- Auditorias estruturais de regras, artefatos e mensagens sem achados. Auditoria de mensagens do encerramento executada após a publicação e associação dos anexos.

## Limites e continuidade

Correção posterior solicitada pelo usuário: o principal ajustou diretamente os três documentos e os dois perfis para impedir diário também nos artefatos. Handoff/handover pontual continua permitido; coordenação e iterações permanecem no canal interno, e a evidência é consolidada na entrega e revisão final. Não é permitido atualizar documentos a cada achado, check ou ajuste. A correção passou em Markdown, links, pnpm validate, pnpm build e pnpm test, com 210 testes aprovados no workspace compartilhado. A avaliação técnica da correção está no artefato específico; o desenvolvimento independente de Toast não foi alterado nem aprovado por esta atividade.

Sem pendências de implementação neste escopo. A política orienta agentes, mas não garante obediência de qualquer modelo ou cliente. A execução observou partes do fluxo; não substitui observar uma sessão nova que descubra o contrato atualizado. Não foram simulados todos os cenários de falha ou aprovação pendente. O aviso não bloqueante de bundle superior a 500 kB permanece fora do escopo desta alteração documental.

## Referências

- [Plano e critérios de aceite](artifacts/plano-politica-registros-loop.md).
- [Execução, correções e revisão final integrada](artifacts/execucao-e-revisao-politica-loop.md).
- [Relatório do desenvolvedor](artifacts/relatorio-implementacao-politica-registros-loop.md).
- [Correção direta da política de registros pontuais](artifacts/correcao-politica-registros-pontuais.md).
