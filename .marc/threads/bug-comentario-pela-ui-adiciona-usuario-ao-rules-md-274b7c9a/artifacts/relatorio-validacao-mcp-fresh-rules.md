# Relatorio de validacao - MCP fresh e RULES.md

## Objetivo

Validar com alta confianca que a correcao de manutencao do `RULES.md` funciona quando executada pelo entrypoint MCP real, nao apenas por import direto das funcoes do core.

A preocupacao era legitima: no incidente original, o comportamento observado veio de uma chamada `workspace_bootstrap` feita por uma tool MCP ativa. Portanto, validar apenas `updateWorkspaceRecommendations()` por import direto poderia deixar uma lacuna entre o core e o caminho real usado por agentes.

## Contexto do problema

A thread investigou uma corrupcao/inconsistencia no `RULES.md`:

- um usuario de UI (`ui-user`) apareceu como item de agente dentro da area de regras customizadas;
- uma secao customizada que deveria ficar abaixo de `## Custom Rules` apareceu antes da fronteira;
- uma chamada real de `workspace_bootstrap` em uma sessao anterior removeu a secao customizada do `RULES.md`.

A investigacao encontrou dois pontos importantes:

1. O processo MCP conectado ao agente naquela sessao estava stale, iniciado dias antes do rebuild/restart do daemon.
2. O codigo atual tinha uma fragilidade real: `## Custom Rules` era tratado como uma secao que terminava no proximo `##`, mas a ADR 0007 define preservacao posicional de tudo abaixo da fronteira customizada.

A correcao implementada refatorou a manutencao de `RULES.md` para um normalizador canonico:

- baseline gerenciado fica acima de `## Custom Rules`;
- tudo abaixo dos comentarios de `## Custom Rules` e conteudo customizado preservado por posicao;
- headings `#`, `##`, `###`, etc. dentro da area customizada sao preservados;
- headings customizados `###` a `######` encontrados antes de `## Custom Rules` sao migrados para baixo da fronteira;
- inventario legado de agentes e removido;
- agentes seguem tendo `.marc/agents/*.md` como fonte da verdade.

## Validacao automatizada de base

Antes da bateria MCP fresh, foram executadas as validacoes normais do projeto.

### Testes automatizados

Comando:

```sh
pnpm test test/core.test.ts test/daemon.test.ts
```

Resultado observado:

```text
# tests 48
# pass 48
# fail 0
```

Observacao: pelo script atual do projeto, mesmo passando arquivos especificos, a suite completa foi executada.

### Typecheck

Comando:

```sh
pnpm typecheck
```

Resultado: passou sem erros.

### Build

Comando:

```sh
pnpm build
```

Resultado: passou sem erros e atualizou `dist`.

Resumo do build:

```text
vite v7.3.2 building client environment for production...
✓ 1867 modules transformed.
✓ built in 5.01s
```

## Probe direto no dist

Foi executado um probe direto contra `dist/core/workspace.js` para validar o ciclo de recomendacoes sem passar pelo MCP.

Cenario:

- criar workspace temporario;
- escrever `RULES.md` desatualizado;
- incluir conteudo customizado com heading `##` e `###` abaixo de `## Custom Rules`;
- executar `updateWorkspaceRecommendations()` duas vezes.

Resultado:

```json
{
  "first": {
    "updated": ["RULES.md"],
    "alreadyCurrent": ["INSTRUCTIONS.md"]
  },
  "second": {
    "updated": [],
    "alreadyCurrent": ["INSTRUCTIONS.md", "RULES.md"]
  },
  "stable": true,
  "hasCustomH2": true,
  "hasCustomH3": true,
  "hasOldRegisterAgent": false
}
```

Interpretacao:

- a primeira chamada corrigiu o drift;
- a segunda chamada ficou estavel;
- conteudo customizado `##` e `###` foi preservado;
- texto legado `register_agent` foi removido.

## Bateria MCP fresh em workspaces temporarios

Para validar o caminho real de agente/MCP, foi usado o SDK MCP com `StdioClientTransport`.

Em vez de chamar funcoes internas diretamente, o teste iniciou um processo MCP fresh com:

```sh
node dist/cli.js mcp --workspace <temp-workspace>
```

Depois, um cliente MCP chamou as tools reais:

- `workspace_bootstrap`
- `workspace_update_recommendations`
- `workspace_read_rules`
- `thread_create`
- `message_post`

Isso cobre o caminho pratico utilizado por um agente em uma sessao nova.

### Resultado geral

```json
{
  "ok": true,
  "scenarioCount": 6
}
```

Todos os 6 cenarios passaram.

## Cenarios MCP cobertos

### 1. Workspace recem-inicializado

Objetivo: garantir que um workspace novo nao gere drift falso.

Fluxo:

- criar workspace temporario vazio;
- iniciar MCP fresh apontando para ele;
- chamar `workspace_bootstrap`;
- chamar `workspace_update_recommendations`;
- chamar `workspace_read_rules`.

Resultado:

```json
{
  "name": "fresh-init",
  "firstUpdated": [],
  "secondUpdated": [],
  "secondAlready": ["INSTRUCTIONS.md", "RULES.md"]
}
```

Interpretacao:

- o setup inicial ja criou arquivos coerentes;
- a segunda chamada confirmou estabilidade;
- `RULES.md` estava current.

### 2. Baseline antigo preservando todos os niveis de heading customizado

Objetivo: validar a ADR 0007: conteudo abaixo de `## Custom Rules` deve ser preservado por posicao, independente do heading.

O `RULES.md` temporario continha:

- baseline antigo com `register_agent`;
- area customizada com:
  - `## Project Notes`
  - `### Project Workflow`
  - `# Project Root Heading`

Resultado:

```json
{
  "name": "stale-baseline-preserve-all-heading-levels",
  "firstUpdated": ["RULES.md"],
  "secondUpdated": [],
  "secondAlready": ["INSTRUCTIONS.md", "RULES.md"]
}
```

Checks validados:

- `## Project Notes` foi preservado;
- `### Project Workflow` foi preservado;
- `# Project Root Heading` foi preservado;
- `register_agent` nao sobreviveu;
- a segunda chamada estabilizou.

### 3. Migracao de headings customizados deslocados

Objetivo: validar a resiliencia aprovada pelo usuario: headings `###` a `######` encontrados antes de `## Custom Rules` podem ser migrados para baixo da fronteira.

O `RULES.md` temporario continha:

- `### Project Workflow` antes de `## Custom Rules`;
- `#### Deep Custom Rule` antes de `## Custom Rules`;
- uma linha customizada existente abaixo de `## Custom Rules`.

Resultado:

```json
{
  "name": "misplaced-custom-subsections",
  "firstUpdated": ["RULES.md"],
  "secondUpdated": [],
  "secondAlready": ["INSTRUCTIONS.md", "RULES.md"]
}
```

Checks validados:

- `### Project Workflow` foi migrado para baixo de `## Custom Rules`;
- `#### Deep Custom Rule` foi migrado para baixo de `## Custom Rules`;
- a linha customizada existente foi preservada;
- os headings nao permaneceram antes de `## Custom Rules`.

### 4. Inventario legado de agentes e H2 invalido na area gerenciada

Objetivo: garantir que `RULES.md` nao volte a ser fonte de verdade para agentes e que `##` desconhecido acima da fronteira customizada seja descartado.

O `RULES.md` temporario continha:

- `### Registered Agents (Marckers)`;
- link de agente `codex-dev`;
- `### Project Workflow` antes de `## Custom Rules`;
- `## Unknown Managed Drift` acima de `## Custom Rules`;
- `### Existing Custom` abaixo de `## Custom Rules`.

Resultado:

```json
{
  "name": "legacy-agents-and-invalid-managed-h2",
  "firstUpdated": ["RULES.md"],
  "secondUpdated": [],
  "secondAlready": ["INSTRUCTIONS.md", "RULES.md"]
}
```

Checks validados:

- `### Registered Agents (Marckers)` foi removido;
- link de agente foi removido;
- `## Unknown Managed Drift` foi descartado;
- `### Project Workflow` foi preservado via migracao;
- `### Existing Custom` foi preservado.

### 5. Comentarios duplicados de Custom Rules

Objetivo: validar normalizacao de comentarios duplicados e comentarios antigos.

O `RULES.md` temporario continha:

- comentario oficial repetido;
- comentario antigo `<!-- Use ### or deeper headings... -->`;
- comentario atual `<!-- Prefer ### or deeper headings... -->`;
- conteudo customizado depois dos comentarios.

Resultado:

```json
{
  "name": "duplicate-comments-normalized",
  "firstUpdated": ["RULES.md"],
  "secondUpdated": [],
  "secondAlready": ["INSTRUCTIONS.md", "RULES.md"]
}
```

Checks validados:

- comentario oficial ficou uma unica vez;
- comentario estrutural atual ficou uma unica vez;
- conteudo customizado apos os comentarios foi preservado.

### 6. Tools de escrita nao alteram RULES.md

Objetivo: validar que o fluxo MCP de escrita em thread nao toca `RULES.md`.

Fluxo:

- iniciar workspace temporario;
- chamar `workspace_bootstrap`;
- ler `RULES.md` antes;
- chamar `thread_create`;
- chamar `message_post` com `ui-user`;
- ler `RULES.md` depois.

Resultado:

```json
{
  "name": "mcp-write-tools-do-not-touch-rules",
  "firstUpdated": [],
  "rulesLength": 1489
}
```

Checks validados:

- `message_post` nao alterou `RULES.md`;
- mensagem retornou `agentId: "ui-user"`;
- a escrita ficou limitada ao fluxo de thread/agente.

## Bateria MCP fresh no workspace real

Alem dos workspaces temporarios, foi feita uma rodada controlada no workspace real `C:/Projetos/marc`.

Essa rodada foi propositalmente destrutiva, mas com backup/restauracao no proprio script.

Fluxo:

1. Ler o conteudo original de `.marc/RULES.md` em memoria.
2. Sobrescrever temporariamente `.marc/RULES.md` com um conteudo baguncado.
3. Subir MCP fresh via:

```sh
node dist/cli.js mcp --workspace C:/Projetos/marc
```

4. Chamar `workspace_bootstrap`.
5. Chamar `workspace_update_recommendations`.
6. Chamar `workspace_read_rules`.
7. Validar o resultado normalizado.
8. Restaurar o conteudo original no `finally` do script.
9. Confirmar que o arquivo restaurado e igual ao original.

### Conteudo baguncado usado no RULES real

O arquivo temporario incluiu casos como:

- `register_agent` legado;
- `### Custom Before Boundary` antes de `## Custom Rules`;
- `## Random Managed Drift` acima de `## Custom Rules`;
- `### Registered Agents (Marckers)`;
- link de agente `ui-user`;
- comentario antigo de Custom Rules;
- `## Real Workspace Stress H2` abaixo da fronteira;
- `### Real Workspace Stress H3` abaixo da fronteira;
- a secao customizada real `### Flow Rules`.

### Resultado da rodada real

```json
{
  "ok": true,
  "first": {
    "updated": ["RULES.md"],
    "alreadyCurrent": ["INSTRUCTIONS.md"]
  },
  "second": {
    "updated": [],
    "alreadyCurrent": ["INSTRUCTIONS.md", "RULES.md"]
  },
  "normalizedLength": 2087,
  "restored": true,
  "checks": {
    "staleBaselineUpdated": true,
    "stabilized": true,
    "customH2Preserved": true,
    "customH3Preserved": true,
    "misplacedH3Migrated": true,
    "flowRulesPreserved": true
  }
}
```

Interpretacao:

- MCP fresh atualizou o arquivo baguncado na primeira chamada;
- segunda chamada estabilizou;
- custom `##` foi preservado;
- custom `###` foi preservado;
- custom `###` antes da fronteira foi migrado;
- `### Flow Rules` foi preservado;
- o arquivo real foi restaurado ao final.

## Observacao sobre git status

Depois da rodada real, `git status` ainda marcou `.marc/RULES.md` como modificado.

Comandos de verificacao mostraram:

- `git diff -- .marc/RULES.md` nao apresentou diferenca textual;
- `git hash-object .marc/RULES.md` bateu com o hash no indice:

```text
a5ff60215860f50ec88da4334ccadb6f3a9ec419
```

Interpretacao: nao ha diferenca de conteudo detectavel no `RULES.md`; parece estado/metadata do Git no Windows.

## Conclusao

A correcao foi validada em tres niveis:

1. Testes automatizados do projeto.
2. Probe direto no `dist/core/workspace.js`.
3. Cliente MCP real via `StdioClientTransport` chamando `dist/cli.js mcp`.

A bateria MCP fresh aumentou a confianca porque exercitou o mesmo entrypoint que um agente usa em uma sessao nova.

Resultado final: o normalizador atual preserva Custom Rules corretamente, estabiliza `recommendations.updated`/`alreadyCurrent`, nao recoloca agentes em `RULES.md` e nao altera `RULES.md` durante escrita de mensagens.