# Revisão QA — Documentação mARC

Revisão de: README.md + docs/ (architecture, mcp-tools, agent-workflows, ui-and-daemon, development, harness-engineering).

---

## README.md

**Pontos fortes:**
- Tabela "Without mARC / With mARC" comunica o valor imediatamente.
- Alert `[!IMPORTANT]` sobre escopo local do MCP está no lugar certo.
- Seções `<details>` por agente evitam poluição visual sem ocultar informação crítica.
- Tabela de troubleshooting cobre os erros mais prováveis.
- Seção "Files Created In A Project" complementa a arquitetura sem duplicar docs/.

**Problemas:**

1. **Pré-requisito ausente: versão do pnpm.** Node.js 22+ está especificado, pnpm não.
2. **`cat .marc-daemon/token` é Unix-only.** No Windows: `type .marc-daemon\token`. Nenhum aviso de compatibilidade de plataforma.
3. **Ordering implícito no quickstart.** O token para configurar o MCP só existe depois que o daemon sobe — mas isso não é dito. O leitor descobre por inferência.
4. **Typo potencial na URL do repositório.** `notfounnd/marc-server` — "n" duplo. Verificar se é o handle correto.
5. **`pnpm dev:mcp` não aparece no README.** O script existe (listado em development.md), mas o README não menciona como iniciar o MCP server em modo de desenvolvimento isolado.
6. **Core Workflow (passo 7) usa terminologia técnica sem referência.** Quem não leu mcp-tools.md antes não conhece `lastMessageId` ou `thread_read_since`.

---

## docs/architecture.md

Sólida. Componentes, fluxo de dados e ciclo de vida de thread bem descritos.

**Problema:** Comportamento com dois processos MCP apontando para o mesmo `--workspace` simultaneamente não é documentado nem descartado.

---

## docs/mcp-tools.md

A tabela de ferramentas por grupo é o ponto mais útil do conjunto de docs.

**Problemas:**
1. `thread_read` na tabela diz "Markdown is omitted by default" mas não indica como incluir. O parâmetro `includeMessages: true` aparece só no exemplo abaixo, não na tabela.
2. "Typical Agent Flow" mistura dois contextos sem separação clara: como iniciar o servidor MCP e quais ferramentas o agente chama depois.

---

## docs/agent-workflows.md

Fluxo "Working A Thread" (6 passos) é concreto e acionável.

**Problema:** IDs de exemplo em "Directed Mentions" (`@architect`, `@qa-reviewer`) não batem com os IDs reais do projeto (`codex-dev`, `claude-qa-engineer`, `claude-software-architect`). Usuário que copia os exemplos vai criar menções para agentes não registrados.

---

## docs/ui-and-daemon.md

Cobre daemon, token, workspaces, SSE e live updates corretamente.

**Problemas:**
1. "HTTP API Overview" lista categorias de rotas mas zero endpoints concretos — inútil para uso direto. Se a API não for pública, dizer isso explicitamente.
2. `cat .marc-daemon/token` Unix-only (mesmo problema do README).
3. Flag `--token` do `marc daemon` sem explicação: o usuário pode fornecer o próprio token? O que acontece se omitida?

---

## docs/development.md

Limpa e precisa. "Validation Checklist" ao final é acréscimo útil.

**Problema menor:** Instrução de bootstrap (`workspace_bootstrap`) está em development.md mas deveria estar — ou também estar — em agent-workflows.md. Desenvolvedor de feature vs. agente usando o sistema são públicos diferentes.

---

## docs/harness-engineering.md

Documento conceitual bem escrito. Contextualiza o propósito do projeto com clareza.

**Problema:** Tabela "What mARC Adds" e lista "Practical Result" (6 passos) cobrem o mesmo conteúdo em formatos diferentes. Parece descuido editorial. Um dos dois deveria ser removido ou diferenciado.

---

## Checklist de Qualidade

| Critério | Status | Nota |
|---|---|---|
| Clareza — novo usuário consegue seguir o quickstart | ✅ | Com ressalvas de ordering |
| Completude — passos críticos presentes | ⚠️ | Versão do pnpm ausente; `pnpm dev:mcp` não no README |
| Precisão — comandos corretos | ⚠️ | `cat` Unix-only; typo potencial na URL |
| Consistência de terminologia README ↔ docs | ✅ | `marc://`, `bootstrapConfirmed`, `lastMessageId` consistentes |
| Links internos e referências cruzadas | ⚠️ | IDs de exemplo em agent-workflows.md não batem com IDs reais |
| Fluxo README: quickstart → config → uso diário | ✅ | Estrutura clara; lacuna de ordering no quickstart |
| Documentação da API HTTP | ❌ | Sem endpoints concretos |
| Cobertura de cenários de erro / concorrência | ⚠️ | Troubleshooting OK; concorrência de MCP servers não abordada |

---

## Problemas por Prioridade

**Alta:**
- Comandos `cat` Unix-only em README e ui-and-daemon.md.
- Ordering implícito: daemon → token → MCP config não está explícito no quickstart.

**Média:**
- `pnpm dev:mcp` ausente no README.
- API HTTP sem endpoints concretos.
- Versão mínima do pnpm não documentada.
- Flag `--token` do daemon sem documentação de comportamento padrão.

**Baixa:**
- Typo potencial "notfounnd" na URL do repositório.
- IDs de exemplo em agent-workflows.md não correspondem aos IDs reais registrados.
- Redundância entre tabela e lista em harness-engineering.md.
- Instrução de bootstrap em development.md em lugar menos óbvio.

---

## Veredicto

Documentação acima da média para esta fase do projeto. README funcional e bem organizado. docs/ cobre os principais conceitos com boa profundidade. Nenhum problema bloqueia um usuário experiente — mas o conjunto de issues de plataforma (Windows) e o gap na API HTTP merecem atenção antes de divulgação ampla.

**Prioridade imediata:** corrigir ordering do quickstart e adicionar alternativa Windows para `cat`.
