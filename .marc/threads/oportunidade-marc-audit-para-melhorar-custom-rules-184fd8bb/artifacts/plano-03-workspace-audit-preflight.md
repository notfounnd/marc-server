# Plano 03 - Workspace audit e preflight

## Objetivo

Criar a tool MCP `workspace_audit` para fornecer feedback estruturado sobre a saude do conteudo mantido pelo mARC no workspace atual. A tool deve ajudar agentes a corrigir falhas antes de registrar planos ruins, deixar artifacts soltos, usar referencias quebradas ou fechar threads com pendencias.

## Principios

- A auditoria e sob demanda.
- A auditoria nao roda automaticamente em todo `message_post`.
- A auditoria nao aplica auto-fix sem pedido explicito.
- A auditoria deve ser barata em tokens e retornar achados compactos.
- O foco e melhorar a saude do workspace mARC do projeto em uso.
- Markdown continua sendo source of truth.

## Tool MCP

Nome: `workspace_audit`

Motivo do nome:

- respeita o padrao `{prefix}_{action}`;
- usa o prefixo `workspace`, ja existente para inspecao e manutencao da workspace;
- evita introduzir alias legado ou prefixo externo.

A tool sera gated por `bootstrapConfirmed`.

## Entrada planejada

```ts
type WorkspaceAuditInput = {
  bootstrapConfirmed: true;
  scope?: "all" | "rules" | "messages" | "agents" | "references" | "artifacts" | "preflight";
  threadId?: string;
  messageId?: string;
  severity?: "all" | "critical" | "warning" | "suggestion";
  maxFindings?: number;
};
```

Defaults:

- `scope`: `all`.
- `severity`: `all`.
- `maxFindings`: limite conservador definido pelo core.

## Saida planejada

```ts
type WorkspaceAuditResult = {
  ok: boolean;
  summary: {
    scopes: string[];
    totalFindings: number;
    critical: number;
    warning: number;
    suggestion: number;
  };
  findings: Array<{
    severity: "critical" | "warning" | "suggestion";
    scope: string;
    code: string;
    location: string;
    message: string;
    suggestion: string;
  }>;
};
```

`ok` deve ser falso quando houver achado `critical` depois dos filtros aplicados.

## Escopos

### rules

- detectar ausencia de `## Custom Rules`;
- detectar regras criticas em formato operacional incompleto;
- sugerir conversao de regra livre para `Trigger`, `Do instead`, `Evidence` e `Severity` quando aplicavel;
- sinalizar regra critica sem evidencia esperada.

### messages

- validar mensagens de uma thread especifica quando `threadId` for informado;
- validar todas as threads quando necessario e dentro do limite de achados;
- detectar mensagem que referencia artifact no texto sem metadata correspondente;
- detectar plano ou proposta que deveria declarar fontes e nao declara.

### artifacts

- detectar artifact citado mas nao anexado;
- detectar artifact anexado mas inexistente no disco;
- detectar artifact no disco mas orfao quando estiver em `artifacts/` e nenhuma mensagem da thread o referencia.

### references

- detectar `marc://` invalido;
- detectar referencia a thread inexistente;
- detectar referencia a mensagem inexistente quando houver thread suficiente para validar;
- detectar referencia a agente inexistente;
- detectar referencia a artifact nao anexado.

### agents

- detectar profile sem `ID`, `Role`, `Model` ou `Description`;
- detectar divergencia entre nome do arquivo e `ID`;
- detectar description vazia ou fraca demais para orientar outros agentes;
- preservar contexto manual quando existir.

### preflight

- validar se um plano ou mensagem de planejamento declara fontes quando regras exigem isso;
- validar se artifacts do plano foram anexados antes da mensagem de indice;
- validar se a mensagem de indice referencia artifacts usando metadata de `message_post`.

## Modelo de implementacao

- Criar um modulo core de auditoria com Strategy ou dispatch table por escopo.
- Evitar `else`.
- Evitar `if` aninhado.
- Usar early returns para guards.
- Manter funcoes pequenas e testaveis.

## Uso esperado

A tool deve ser usada:

- antes de registrar plano;
- antes de desenvolver;
- antes de conclusao;
- antes de fechar thread;
- quando o usuario pedir validacao de qualidade.

A tool nao deve substituir julgamento do agente. Ela fornece feedback estruturado para melhorar o conteudo mARC.

## Criterios de aceite

- `workspace_audit` aparece na lista canonica de tools MCP.
- A tool exige `bootstrapConfirmed`.
- A tool aceita `scope`, `threadId`, `messageId`, `severity` e `maxFindings`.
- O retorno e compacto, filtravel e estruturado.
- Testes cobrem artifacts, references, agents, rules e preflight.
- A auditoria nao altera arquivos.
