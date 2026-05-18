# Plano: reformatar Custom Rules para formato operacional

Thread: marc://$oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be

## Contexto

A auditoria `workspace_audit` com `scope: rules` reporta 5 warnings `custom_rule_freeform` em `.marc/RULES.md`, todos dentro de `## Custom Rules`:

- `Agent Tooling`
- `Project References`
- `Session Onboarding`
- `Flow Rules`
- `Code Style`

As regras atuais são compatíveis, mas estão escritas em formato livre. O objetivo desta oportunidade é converter essas regras para o formato operacional recomendado pelo mARC, preservando o sentido do contrato local e tornando as regras mais acionáveis para agentes.

## Escopo

Alterar somente `.marc/RULES.md`, dentro de `## Custom Rules`.

Não alterar as seções gerenciadas:

- `Workspace Maintenance`
- `Agents`
- `Conversation Rules`
- `Message Style`
- `Context Reading`
- `Operational Custom Rules`

Preservar também os comentários gerenciados logo abaixo de `## Custom Rules`.

## Formato alvo

Cada regra custom crítica ou recorrente será descrita como bloco operacional com:

- `Trigger`: quando a regra deve ser aplicada.
- `Do instead`: ação concreta esperada do agente.
- `Evidence`: evidência mínima que o agente deve deixar quando a regra impactar plano, desenvolvimento, validação, mensagem ou encerramento.
- `Severity`: `critical`, `warning` ou `suggestion`.

## Mapa de conversão

### Agent Tooling

Converter em duas regras:

- uso obrigatório de context-mode para investigação de repositório, validação e revisão de saída de comandos;
- Bash como shell assumido no workspace, salvo instrução explícita diferente do usuário.

### Project References

Converter em uma regra:

- ao citar assets do mARC, usar formato de link ou referência esperado pelas tools.

### Session Onboarding

Converter em duas regras:

- ao entrar em `@notfounnd/marc-server`, ler `README.md` e `docs/` para entender o estado atual;
- depois do onboarding, apresentar overview estruturado em chat e aguardar instruções antes de propor ou alterar algo, salvo pedido explícito para outro fluxo.

### Flow Rules

Converter em duas regras:

- antes de finalizar desenvolvimento, revisar documentação e atualizar quando houver necessidade identificada;
- ao fechar thread de implementação de UI, revisar `marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` e atualizar o backlog Playwright quando necessário.

### Code Style

Converter em regras críticas e separadas:

- proibir `else` em código do projeto;
- proibir `if` aninhado;
- exigir conditionais planos e intencionais;
- exigir early return para guards, validação, programação defensiva e short-circuit;
- exigir Strategy pattern ou dispatch table quando houver variação real por ação, tipo ou variante equivalente;
- manter guards simples como early returns;
- reservar Strategy pattern para variação comportamental significativa.

## Validação

Executar `workspace_audit` com:

- `scope: rules`
- `severity: all`
- `maxFindings: 50`

Resultado esperado:

- `ok: true`
- nenhum finding crítico em `rules`
- warnings `custom_rule_freeform` removidos das 5 seções convertidas

Também inspecionar o diff para confirmar que apenas `.marc/RULES.md` e o artifact da thread foram alterados.

## Risco e mitigação

Risco principal: alterar sem querer uma seção gerenciada do mARC. Mitigação: substituir somente o trecho abaixo de `## Custom Rules`, preservando comentários e títulos custom.

Risco secundário: transformar regra simples em texto excessivo. Mitigação: usar blocos objetivos e repetir campos apenas para tornar a execução determinística.
