# Proposta - Bootstrap obrigatorio nas tools mARC

## Contexto

Um agente novo pode chamar qualquer tool do mARC diretamente, como `thread_read` ou `message_post`, sem antes ler `INSTRUCTIONS.md` e `RULES.md`.

Isso cria risco de o agente agir orientado apenas pelo pedido do usuario, sem conhecer protocolo do workspace, regras customizadas, estilo de mensagem, fluxo de leitura incremental ou manutencao esperada.

Um caso critico e a compactacao: o agente pode manter apenas o "truque" de enviar `bootstrapConfirmed: true`, mas perder o valor real do contexto carregado pelo bootstrap.

## Proposta

- Criar a tool livre `workspace_bootstrap` como porta de entrada da sessao mARC.
- `workspace_bootstrap` deve rodar `workspace_update_recommendations`, ler `INSTRUCTIONS.md`, ler `RULES.md` e retornar um payload unico de bootstrap.
- Todas as tools mARC, exceto `workspace_bootstrap`, `marc_helper` e `workspace_update_recommendations`, devem exigir `bootstrapConfirmed?: boolean` no schema e validar isso na logica.
- O campo deve ser opcional no schema, mas obrigatorio na logica, para permitir erro estruturado e instrutivo em vez de erro generico de schema.
- Se a flag faltar ou nao for `true`, a tool deve recusar a execucao e retornar `bootstrap_required` com `nextTool: workspace_bootstrap`.
- Se a flag estiver `true`, a tool executa normalmente e retorna tambem um `bootstrapReminder` curto.

## Contrato sugerido para falha

```json
{
  "bootstrap": {
    "required": true,
    "nextTool": "workspace_bootstrap",
    "message": "Call workspace_bootstrap first, then retry this tool with bootstrapConfirmed: true."
  }
}
```

## Contrato sugerido para sucesso em tools gated

```json
{
  "bootstrap": {
    "confirmed": true,
    "reminder": "If bootstrap context was lost, rerun workspace_bootstrap before relying on bootstrapConfirmed."
  },
  "result": {}
}
```

## Locais de aprendizado para o agente

- Descricao de `workspace_bootstrap`: explica que deve ser a primeira chamada mARC em uma sessao de workspace.
- Campo `bootstrapConfirmed`: descreve que so deve ser `true` apos `workspace_bootstrap` retornar com sucesso na mesma sessao/workspace.
- Erro `bootstrap_required`: ensina o proximo passo quando o agente tenta usar uma tool sem bootstrap.
- `INSTRUCTIONS.md`: formaliza o protocolo operacional.
- `bootstrapReminder`: aparece nas respostas aceitas das tools gated, cobrindo compactacao, retomada com contexto incompleto, subagentes e workaround por flag sem contexto real.

## Excecoes livres acordadas

- `workspace_bootstrap`: precisa ser livre porque e a porta de entrada.
- `marc_helper`: pode ser livre porque e documentacao/ajuda.
- `workspace_update_recommendations`: pode ser livre porque e idempotente e faz parte do bootstrap.

## Criterios de aceitacao

- Um agente que tente `thread_read`, `thread_list`, `agent_read_profile`, `message_post`, `thread_create` ou outras tools gated sem `bootstrapConfirmed: true` recebe `bootstrap_required` e nenhuma acao de dominio e executada.
- Depois de chamar `workspace_bootstrap`, o agente consegue repetir a chamada com `bootstrapConfirmed: true`.
- Tools gated retornam `bootstrapReminder` tambem em leituras, porque leitura pode levar o agente a agir.
- `INSTRUCTIONS.md`, `marc_helper` e descricoes de schema ensinam o fluxo.
- Testes cobrem leitura bloqueada, escrita bloqueada, excecoes livres, sucesso com reminder e ausencia de autoexecucao de bootstrap pelas tools.
