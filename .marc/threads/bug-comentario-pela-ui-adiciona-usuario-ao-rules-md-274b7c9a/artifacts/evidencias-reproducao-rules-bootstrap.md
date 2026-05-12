# Evidencias - reproducao do bug em RULES.md via bootstrap

## Contexto

Investigacao realizada sem implementar correcao de codigo. O objetivo foi tentar reproduzir e coletar evidencias antes de tratar a thread.

Contrato relevante:

- ADR 0007: `RULES.md` tem baseline gerenciado acima de `## Custom Rules` e conteudo do projeto preservado abaixo da fronteira.
- `.marc/agents/*.md` e as tools `agent_list` / `agent_read_profile` sao a fonte da verdade para agentes registrados.
- A resiliencia aceita deve manter/migrar headings `###` ou mais profundos que tenham ficado antes de `## Custom Rules`.

## Reproducao observada

Durante esta sessao, a chamada real de `workspace_bootstrap` reproduziu a falha no workspace real:

- retorno incluiu `recommendations.updated: ["RULES.md"]`;
- o `rules` retornado perdeu o bloco customizado `### Flow Rules` que estava abaixo de `## Custom Rules`;
- o resultado tambem voltou sem o comentario estrutural atual `<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->`.

Isso aponta que a chamada MCP ativa nao estava executando o mesmo codigo que esta atualmente em `src`/`dist` no disco.

## Estado atual do RULES.md apos restauracao manual

O arquivo foi restaurado para conter:

```md
## Custom Rules

<!-- Keep project-specific custom rules below this line. This section is preserved by workspace_update_recommendations. -->
<!-- Prefer ### or deeper headings to organize project-specific rules in this section. -->

### Flow Rules

- Before finalizing development, review project documentation and update or expand it when a need is identified.
- When the user asks to close a UI implementation thread, review `oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a` and update its Playwright backlog when needed.
```

## Comparacao src vs dist local

Foram executados probes em workspaces temporarios usando:

- `src/core/workspace.ts` via `node --import tsx`;
- `dist/core/workspace.js`.

Resultado para `RULES.md` com `### Flow Rules` abaixo de `## Custom Rules`:

- `src`: preservou `### Flow Rules` abaixo de `## Custom Rules`.
- `dist`: preservou `### Flow Rules` abaixo de `## Custom Rules`.
- ambos adicionaram/mantiveram o comentario estrutural atual.

Resultado para `RULES.md` com `## Project Notes` abaixo de `## Custom Rules`:

- `src`: perdeu o heading `## Project Notes` e seu conteudo.
- `dist`: perdeu o heading `## Project Notes` e seu conteudo.

Conclusao parcial: ha dois achados separados.

1. A perda de `### Flow Rules` no workspace real foi reproduzida pela tool MCP ativa, mas nao pelo `src`/`dist` local atual em workspace temporario.
2. O codigo atual ainda tem um bug real contra a ADR 0007: conteudo com heading `##` abaixo de `## Custom Rules` nao e preservado.

## Processo MCP ativo

Processos relevantes encontrados:

```text
ProcessId: 13528
Name: node.exe
CreationDate: 06/05/2026 12:46:58
CommandLine: "C:\nvm4w\nodejs\node.exe" /Projetos/marc/dist/cli.js mcp --workspace /Projetos/marc --daemon-url http://127.0.0.1:4187 --token ...

ProcessId: 2512
Name: node.exe
CreationDate: 06/05/2026 12:47:16
CommandLine: "C:\nvm4w\nodejs\node.exe" /Projetos/marc/dist/cli.js mcp --workspace /Projetos/marc --daemon-url http://127.0.0.1:4187 --token ...

ProcessId: 27120 / 26780 / 17600
CreationDate: 11/05/2026 19:56:19
CommandLine: tsx src/cli.ts daemon
```

Interpretação:

- O daemon atual foi iniciado em 11/05/2026.
- Os processos MCP usados pela sessao foram iniciados em 06/05/2026.
- Rebuildar/reiniciar o daemon nao reinicia automaticamente o processo MCP conectado ao agente.
- Mesmo se `dist/core/workspace.js` no disco estiver atualizado, um processo MCP iniciado em 06/05 continua executando o codigo carregado naquela data.

## Hipotese mais forte no momento

A falha que removeu `### Flow Rules` no workspace real provavelmente veio de um processo MCP antigo/stale ainda ativo na sessao do agente.

O daemon ter sido baixado/rebuildado/reiniciado nao garante que o MCP server usado pela conversa tenha sido reiniciado. Para validar a correcao real do fluxo, sera necessario reiniciar tambem o MCP client/server usado pelo agente, nao apenas o daemon.

## Bug confirmado no codigo atual

Mesmo com `src` e `dist` atuais, `ensureCustomRulesSection` usa um recorte que trata `## Custom Rules` como se terminasse no proximo `##`. Isso contraria a ADR 0007, que define preservacao posicional de tudo abaixo dos comentarios de Custom Rules, inclusive headings `#` ou `##`.

Esse bug deve entrar no plano de correcao quando a thread for retomada em plan mode.
