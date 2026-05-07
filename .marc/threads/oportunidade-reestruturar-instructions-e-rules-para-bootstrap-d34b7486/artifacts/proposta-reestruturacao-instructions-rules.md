# Proposta - Reestruturar INSTRUCTIONS.md e RULES.md para bootstrap

## Contexto

Antes de implantar os guards de bootstrap nas tools mARC, a separacao entre `INSTRUCTIONS.md` e `RULES.md` precisa estar clara.

Hoje os dois arquivos possuem alguma sobreposicao: instrucoes operacionais, regras de estilo, leitura incremental e manutencao aparecem em ambos. Isso aumenta risco de divergencia e dificulta transformar `workspace_bootstrap` na porta de entrada obrigatoria.

## Objetivo

Definir `INSTRUCTIONS.md` como protocolo operacional estavel do mARC e `RULES.md` como contrato de comportamento do workspace.

## Modelo desejado

### INSTRUCTIONS.md

`INSTRUCTIONS.md` deve ser curto, estavel e procedural.

Responsabilidades:

- Dizer que a primeira acao mARC em uma sessao/workspace deve ser `workspace_bootstrap`.
- Explicar que, apos bootstrap bem-sucedido, o agente deve enviar `bootstrapConfirmed: true` nas tools gated.
- Dizer que `workspace_bootstrap` atualiza recomendacoes e le `RULES.md`.
- Orientar o agente a reler bootstrap se o contexto de bootstrap foi perdido por compactacao, retomada ou delegacao para subagente.
- Referenciar `RULES.md` como fonte das regras do workspace.

Nao deve concentrar regras de estilo, preferencias do projeto ou regras customizadas.

### RULES.md

`RULES.md` deve ser a fonte principal das regras do workspace.

Responsabilidades:

- Regras de estilo de mensagem.
- Regras de leitura/contexto, quando forem comportamento do workspace.
- `## Custom Rules` preservado para regras especificas do projeto.
- Regras de colaboracao e preferencias que podem evoluir com o workspace.

Nao deve duplicar o protocolo operacional base do bootstrap, exceto se houver uma referencia curta para reforcar comportamento.

## Implicacao para workspace_update_recommendations

- Deve manter `INSTRUCTIONS.md` minimo e atualizado com o protocolo de bootstrap.
- Deve atualizar secoes gerenciadas de `RULES.md` sem apagar `## Custom Rules`.
- Deve evitar duplicar o mesmo conteudo nos dois arquivos.
- Deve preservar regras customizadas abaixo do comentario de `## Custom Rules`.

## Relacao com guards de bootstrap

Esta reestruturacao deve acontecer antes da implementacao dos guards.

Motivo:

- `workspace_bootstrap` precisa retornar `INSTRUCTIONS.md` e `RULES.md` com responsabilidades claras.
- O agente precisa aprender o protocolo em `INSTRUCTIONS.md` antes de usar `bootstrapConfirmed`.
- `RULES.md` precisa conter regras do workspace, nao instrucoes mecanicas duplicadas.

## Criterios de aceitacao

- `INSTRUCTIONS.md` fica curto e referencia `RULES.md`.
- `RULES.md` concentra regras de workspace e `## Custom Rules`.
- `workspace_update_recommendations` aplica essa separacao de forma idempotente.
- Testes cobrem a migracao de um workspace com conteudo duplicado para a nova estrutura.
- O fluxo futuro de `workspace_bootstrap` consegue retornar os dois arquivos sem sobreposicao confusa.
