# Resumo - Política de concorrência e escritas no Markdown SoT

Thread: `oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f`
Closed: `2026-05-24T19:23:28.258Z`

## Resultado

- Implementada política de coordenação para writers Markdown gerenciados pelo mARC.
- Mantido Markdown como fonte de verdade; `thread-index.json` e locks em `cache/` permanecem controles derivados e reconstruíveis.
- Encerramento autorizado pelo usuário após validação pós-restart.

## O que mudou

- Criado coordenador interno de escrita com locks cooperativos por recurso e substituição atômica dos arquivos regravados.
- Integrados transcript/artifacts de thread, perfis de agentes e recomendações gerenciadas à coordenação de escrita.
- Serializado o rebuild/publicação do índice derivado para evitar snapshots concorrentes fora de ordem.
- Adicionados testes de concorrência, incluindo writers em processos Node distintos na mesma thread.
- Adicionado ADR da decisão e atualizada a documentação arquitetural para distinguir Markdown autoritativo de cache e locks derivados.

## Validação

- `pnpm run validate`: passou.
- `pnpm test`: passou, 84 testes.
- `pnpm build`: passou.
- Validação pós-restart: `workspace_bootstrap` passou sem atualizar recomendações; `workspace_status` informou índice `ready`; `workspace_audit` com escopo `preflight` não encontrou achados.

## Risco residual

- A criação de um artifact e a publicação do vínculo em `CHAT.md` não formam uma transação multi-arquivo; uma interrupção entre essas etapas pode deixar um artifact órfão detectável por auditoria, sem apagar mensagens.
