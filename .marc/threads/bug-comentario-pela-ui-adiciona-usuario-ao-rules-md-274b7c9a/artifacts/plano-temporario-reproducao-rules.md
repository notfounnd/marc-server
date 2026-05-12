# Plano temporario - reproducao do bug em RULES.md

Objetivo: tentar reproduzir o bug antes de alterar codigo.

Contexto obrigatorio:

- Thread relacionada: `oportunidade-organizar-agentes-registrados-no-rules-md-734062bc`.
- ADR relacionada: `docs/adrs/0007-rules-managed-baseline-and-custom-rules.md`.
- Contrato vigente: `.marc/agents/*.md` e as tools `agent_list` / `agent_read_profile` sao a fonte da verdade para agentes. `RULES.md` nao deve manter inventario de agentes.
- Resiliencia aceita: headings `###` ou mais profundos que ficarem acima de `## Custom Rules` podem ser migrados para baixo da fronteira preservada.
- Regras customizadas devem ser preservadas por posicao abaixo dos comentarios de `## Custom Rules`.

Hipoteses a validar:

- `workspace_bootstrap` / `workspace_update_recommendations` pode mover ou perder conteudo customizado do `RULES.md`.
- O fluxo de comentario pela UI pode registrar `ui-user` em `.marc/agents`, mas nao deveria alterar `RULES.md`.
- O comportamento pode depender da versao carregada em `dist` vs `src`.
- Existe um bug separado ja observado por probe: headings `##` abaixo de `## Custom Rules` podem ser perdidos, contrariando a ADR 0007.

Procedimento planejado:

1. Capturar snapshot do `RULES.md` antes/depois de `workspace_bootstrap` ou `workspace_update_recommendations`.
2. Testar workspace temporario com `RULES.md` correto e rodar update repetidas vezes.
3. Testar workspace temporario com `### Flow Rules` antes de `## Custom Rules` para validar a resiliencia aceita.
4. Testar workspace temporario com `##` abaixo de `## Custom Rules` para validar preservacao posicional.
5. Testar POST de mensagem pela UI/daemon com `ui-user` e confirmar se `RULES.md` muda.
6. Comparar comportamento via `src` e via `dist`.
7. Registrar snapshots e so entao decidir a correcao.

Evento observado nesta sessao:

- A chamada real de `workspace_bootstrap` ja reproduziu uma falha: retornou `updated: ["RULES.md"]` e o `rules` retornado perdeu o bloco customizado `### Flow Rules` que estava abaixo de `## Custom Rules`.
- Isso indica que a reproducao nao depende inicialmente do POST pela UI; o problema esta no caminho de manutencao de recomendacoes/bootstrap.
