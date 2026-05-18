# Plano 01 - Custom Rules deterministicas

## Objetivo

Reformular a recomendacao de `Custom Rules` para que regras criticas sejam escritas como instrucoes operacionais, com gatilho claro, acao esperada e evidencia minima. A ideia e manter `RULES.md` como contrato principal do workspace mARC e reduzir interpretacoes vagas por agentes.

## Principios

- `RULES.md` continua sendo o contrato da workspace.
- `Custom Rules` continua sendo a area preservada para orientacoes especificas do projeto.
- Regras livres existentes continuam validas para compatibilidade.
- Regras criticas passam a ter formato recomendado mais deterministico.
- O formato se inspira no funcionamento operacional do Napkin, mas nao adiciona compatibilidade, deteccao, migracao ou integracao com Napkin.

## Formato recomendado

Regras criticas devem preferir este formato:

```md
### Required Preflight

1. **Thread development proposal**
   Trigger: before proposing, designing, planning, or developing thread work.
   Do instead: read `README.md`, all files in `docs/`, the target thread, and referenced artifacts before presenting a plan.
   Evidence: state the exact sources used in the plan or thread comment.
   Severity: critical.
```

Campos:

- `Trigger`: quando a regra deve ser aplicada.
- `Do instead`: acao concreta que o agente deve executar.
- `Evidence`: evidencia minima esperada quando a regra for critica.
- `Severity`: `critical`, `warning` ou `suggestion`.

## Exemplos iniciais

### Leitura antes de proposta

```md
1. **Project documentation before proposals**
   Trigger: before proposing, designing, planning, API changes, tool changes, or development in `@notfounnd/marc-server`.
   Do instead: read `README.md`, `docs/*.md`, `docs/adrs/*.md`, the target mARC thread, and referenced thread artifacts.
   Evidence: list the exact sources used before or inside the plan.
   Severity: critical.
```

### Referencias de projeto

```md
1. **mARC asset references**
   Trigger: when writing messages that mention agents, threads, messages, or artifacts.
   Do instead: use the reference format expected by mARC, such as `marc://$thread-id`, `marc://#message-id`, `marc://@agent-id`, or artifact references.
   Evidence: include the concrete `marc://` reference in the message when applicable.
   Severity: warning.
```

### Artifacts antes de comentario

```md
1. **Attach artifacts before posting references**
   Trigger: before posting a message that says a plan, review, log, benchmark, or detailed analysis is attached.
   Do instead: create the artifact first and include the returned artifact path in `message_post.artifacts`.
   Evidence: message metadata includes the artifact path.
   Severity: critical.
```

## Compatibilidade

- Workspaces existentes com regras livres nao quebram.
- A auditoria futura pode sugerir conversao para o formato operacional.
- A ausencia do novo formato nao bloqueia tudo automaticamente.
- Quando a regra for critica e exigir evidencia, o preflight pode reportar falha se a evidencia estiver ausente.

## Documentacao esperada

Atualizar a documentacao para explicar:

- quando usar regras livres;
- quando usar regras operacionais;
- como escrever `Trigger`, `Do instead`, `Evidence` e `Severity`;
- como a skill local e a auditoria usam esse formato para reduzir falhas recorrentes.

## Criterios de aceite

- `RULES.md` continua preservando `Custom Rules`.
- O formato recomendado e documentado.
- Testes cobrem parsing e avaliacao basica de regras operacionais.
- Regras livres continuam aceitas.
- Nenhuma automacao altera regras customizadas sem pedido explicito.
