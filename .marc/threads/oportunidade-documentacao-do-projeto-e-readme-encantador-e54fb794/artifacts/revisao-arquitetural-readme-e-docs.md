# Revisão Arquitetural — README e docs/

Autor: claude-software-architect
Escopo: `README.md` + `docs/architecture.md`, `docs/development.md`, `docs/mcp-tools.md`, `docs/agent-workflows.md`, `docs/ui-and-daemon.md`, `docs/harness-engineering.md`

## Revisão Arquitetural — README

**Coerência com a arquitetura.** O README descreve com precisão os três elementos do sistema (MCP server, daemon, `.marc/`) sem antecipar detalhes que pertencem a `docs/architecture.md`. A tabela "Without mARC / With mARC" comunica o problema (contexto preso em chat) e o princípio arquitetural central (Markdown como source of truth) de forma intuitiva.

**Quickstart.** A sequência `pnpm install → build → dev:daemon → token → register` é linear e reflete o fluxo real de bootstrap. Bom destaque do `.marc-daemon/token` que é peça crítica do contrato de segurança local.

**Alert sobre MCP.** O bloco `[!IMPORTANT]` sobre não usar configuração global resolve uma classe inteira de erros arquiteturais (workspace cruzado entre repositórios). Posicionamento correto, antes das instruções por agente.

**Seções `<details>` por agente.** Decisão acertada: mantém a página principal enxuta sem perder cobertura. Os três blocos (Claude Code, Codex, VS Code/Copilot) são consistentes em forma — mesmo `command`, mesmos args, mesmas variáveis — o que reforça a abstração de que o MCP é só transporte stdio.

**Pontos a observar:**
- "Files Created In A Project" mostra o layout, mas não menciona que `.marc-daemon/` (com o token) também é criado e fica fora do `.marc/`. Vale uma linha para evitar confusão entre os dois diretórios.
- A tabela de Troubleshooting menciona `node:sqlite` sem o leitor saber ainda que SQLite é opcional — só fica claro em `architecture.md`. Pequena nota inline ou link resolveria.

## Revisão Arquitetural — docs/

**architecture.md.** Documento bem estruturado. A separação "MCP server / Daemon / `.marc/`" é a divisão certa — três responsabilidades, três contratos. O parágrafo "Markdown is the source of truth" e a seção "Cache And Indexes" deixam claro que SQLite é índice rebuildable, não estado primário. Isso é uma decisão arquitetural forte e está bem comunicada. A seção "Internal References" com `marc://` documenta uma URI scheme que merece ser tratada como contrato público — está aqui, ótimo.

**mcp-tools.md.** Catalogação completa em tabelas por grupo (`workspace_*`, `agent_*`, `thread_*`, `message_*`). O destaque para o protocolo de bootstrap (Free Tools vs gated tools com `bootstrapConfirmed`) é o que separa mARC de "só mais uma API" — esse contrato de sessão é arquitetural e está no lugar certo. O "Efficient Reading Pattern" (cursor `lastMessageId` + `thread_read_since`) documenta um padrão de eficiência que é parte da proposta de valor.

**agent-workflows.md.** Foca no comportamento esperado dos agentes. "Posting Style" e "Artifacts" codificam a separação mensagem-curta / artefato-longo, que é o que evita o code smell "chat virou log". "Directed Mentions" reforça o ponto importante: mARC não roteia, apenas endereça. Essa restrição deliberada precisa ser visível e está.

**ui-and-daemon.md.** Cobre token, SSE em `/api/events`, e a regra de que "MCP clients should prefer the MCP tools" — fronteira clara entre superfícies. O parágrafo sobre normalização de nome de artefato (`.md` automático) é um detalhe de implementação que vale estar documentado porque afeta referências `marc://`.

**development.md.** Estrutura de `src/` espelha as camadas (`core/`, `daemon/`, `mcp/`, `ui/`) com separação adequada. Validation Checklist (typecheck/test/build) é bom contrato de qualidade. A nota sobre cache de tool definitions por sessão MCP é exatamente o tipo de armadilha que documentação útil precisa capturar.

**harness-engineering.md.** Complementa muito bem a visão de agentes. A tabela "Harness need / mARC support" é a melhor síntese conceitual do projeto inteiro — explica POR QUE cada peça existe. "Orchestration Without Hidden Routing" e "What mARC Does Not Replace" delimitam o escopo arquitetural com honestidade (não substitui CI/lint/review). Isso evita que o leitor projete responsabilidades que mARC nunca prometeu.

## Pontos fortes

- **Source of truth explícito.** Markdown como verdade, cache/SQLite como índice rebuildable. Decisão clara, repetida em múltiplos documentos sem contradição.
- **Contrato de bootstrap.** Documentado simetricamente em README, mcp-tools.md, agent-workflows.md e harness-engineering.md. Reforço sem repetição vazia.
- **Escopo deliberadamente limitado.** "mARC não roteia agentes", "não substitui CI/tests" — restrições explícitas são tão valiosas quanto features.
- **Separação de superfícies.** MCP (agentes) vs HTTP daemon (UI/tooling local) com regra clara de preferência. Boa fronteira de Bounded Context.
- **URI scheme `marc://` tratado como contrato.** Aparece com a mesma gramática em três documentos. Coerência.
- **Navegação README → docs/.** Um link por documento, sem subníveis. Funciona porque cada doc tem escopo claro.

## Gaps e sugestões

**1. Diagrama de fluxo de dados ausente.** `architecture.md` descreve o data flow em prosa ("MCP client → stdio → bootstrap → notify daemon → /api/workspaces → /api/events → browser"), mas um diagrama ASCII/Mermaid de 10 linhas tornaria a leitura muito mais rápida. Sugiro adicionar em `architecture.md` na seção "Data Flow".

**2. Modelo de concorrência não documentado.** O que acontece se MCP server e UI escrevem em `CHAT.md` simultaneamente? Há lock, append atômico, last-write-wins? Esse é um ponto arquitetural importante para um sistema cuja verdade é arquivo Markdown. Sugiro uma seção curta "Concurrency And Writes" em `architecture.md`.

**3. Modelo de segurança superficial.** Token bearer compartilhado entre UI e API, mas não há discussão sobre: rotação, escopo (read vs write), isolamento entre workspaces no mesmo daemon, comportamento se token vazar. Para sistema local-first isso pode ser intencional, mas vale uma seção "Security Model" explicitando o threat model assumido (loopback only, single-user dev machine).

**4. Versionamento e migração.** `INSTRUCTIONS.md` é "managed by mARC". Quando o formato evolui (novo campo, nova regra), como mARC migra `.marc/` antigos? `workspace_update_recommendations` cobre isso? Falta um parágrafo sobre evolução de schema/formato em `architecture.md` ou `harness-engineering.md`.

**5. ADRs ausentes.** O projeto tem decisões arquiteturais fortes (Markdown como SoT, sem roteamento, MCP por repo). Um diretório `docs/adrs/` ou seção "Key Decisions" com 5-6 ADRs curtos (decisão, contexto, alternativas consideradas, consequências) tornaria as escolhas mais defensáveis e ensináveis. Hoje as justificativas estão diluídas no texto.

**6. `harness-engineering.md` poderia linkar de volta.** O documento conceitual mais forte só é referenciado pelo README. Cada um dos outros docs (`agent-workflows.md`, `architecture.md`) ganharia ao referenciar `harness-engineering.md` como "leitura conceitual" para quem quer o porquê.

**7. Comportamento offline/falha do daemon.** MCP server é stdio puro e pode operar sem daemon. UI requer daemon. Isso está implícito mas não dito. Sugiro uma frase em `architecture.md` deixando explícito que MCP funciona sem daemon e que o daemon é "broadcast/UI infrastructure", não dependência crítica.

**8. Convenção de IDs.** `agent-workflows.md` menciona "stable ID such as codex-dev". Existe regra de namespacing (slug, prefixo, charset)? Para um sistema com `marc://@agent-id` como referência durável, regras explícitas evitariam fragmentação futura.

**9. Tabela de troubleshooting do README.** Útil, mas mistura sintomas de UI, MCP e cache. Vale separar em três grupos curtos ou mover para `ui-and-daemon.md` deixando no README só os 2-3 mais comuns.

## Veredicto geral

Documentação **acima da média** para um projeto em desenvolvimento ativo. Coerência cross-document é forte, escopo está bem delimitado, e há clara consciência arquitetural de que mARC é uma camada de coordenação, não um orquestrador.

Os gaps identificados são todos de aprofundamento (concorrência, segurança, versionamento, ADRs), não de correção — a base está sólida. As três sugestões de maior alavancagem, em ordem de prioridade arquitetural:

1. **Seção "Concurrency And Writes"** em `architecture.md` (risco de corrupção do SoT).
2. **Seção "Security Model"** em `ui-and-daemon.md` ou `architecture.md` (threat model explícito).
3. **`docs/adrs/`** com 5-6 decisões-chave (Markdown SoT, sem roteamento, MCP por repo, bootstrap gating, `marc://` scheme, daemon como infra opcional).

Com esses três acréscimos, a documentação passaria de "muito boa" para "referência" — um leitor novo conseguiria reconstruir as decisões sem precisar inferir do código.
