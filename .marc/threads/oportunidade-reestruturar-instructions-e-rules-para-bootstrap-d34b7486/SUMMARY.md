# Resumo executivo

Thread: `oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486`
Closed: `2026-05-06T05:54:55.283Z`

## Objetivo

Preparar a base de `INSTRUCTIONS.md` e `RULES.md` para a futura implementação de `workspace_bootstrap` e `bootstrapConfirmed`, separando protocolo operacional estável de regras comportamentais do workspace.

## Resultado

- `INSTRUCTIONS.md` passou a ser gerado e mantido pelo mARC como arquivo curto de protocolo de bootstrap.
- O comentário de arquivo gerenciado deixa explícito que usuários e agentes não devem editar nem estender `INSTRUCTIONS.md`.
- O protocolo informa que `workspace_bootstrap` atualiza recomendações, incluindo o próprio `INSTRUCTIONS.md`, e lê `RULES.md`.
- `RULES.md` concentra o contrato de comportamento do workspace, incluindo manutenção, agentes, regras de conversa, estilo de mensagem, leitura de contexto e `Custom Rules`.
- `Workspace Maintenance` foi movido para o topo de `RULES.md`, antes de `Agents`.
- As seções gerenciadas de `RULES.md` foram padronizadas com linha em branco após cada heading.
- `Custom Rules` segue preservado no final para orientações específicas do projeto.
- `marc_helper` passou a explicar a separação entre `INSTRUCTIONS.md` e `RULES.md`, preparando o uso futuro de `workspace_bootstrap` e `bootstrapConfirmed`.

## Validação

- `pnpm test` passou com 28 testes.
- `pnpm typecheck` passou.
- `pnpm build` passou.
- `workspace_update_recommendations` foi executado no workspace real e aplicou o formato final esperado.

## Continuidade

- A thread `oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686` pode avançar com a implementação do bootstrap obrigatório nas tools.
- A auditoria de qualidade das `Custom Rules` foi registrada como oportunidade separada para evitar misturar melhoria de conteúdo customizado com geração dos arquivos base.

## Estado final

Thread encerrada. A separação entre instruções geradas pelo mARC e regras customizáveis do workspace está definida, validada e aplicada no projeto.
