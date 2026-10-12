# Proposta: correção pontual dos cabeçalhos de SUMMARY.md

Padronizar diretamente os cabeçalhos dos summaries históricos deste repositório no formato já aprovado. O usuário restringiu expressamente a entrega à edição editorial dos arquivos, sem desenvolvimento de código, scripts persistentes, comandos novos ou ferramentas. O plano foi aprovado no chat com a instrução de execução.

## Decisões e critérios

- Inventário por context-mode: 51 summaries; 50 ajustes e um cabeçalho canônico preservado.
- Título exatamente igual ao H1 de CHAT.md; identidade em Thread com referência marc://; Closed e separador antes do corpo.
- Preservar literalmente as 34 datas explícitas, incluindo a precisão existente.
- Para os 17 summaries sem Closed, utilizar o mtime capturado antes da edição. Escolha confirmada pelo usuário; trata-se do fallback já utilizado pelo mARC, não de uma data histórica comprovada.
- Preservar conteúdo, idioma, estrutura, links e formatação do corpo. Não produzir sínteses novas, traduções ou reorganizações.
- Corrigir o título H3 legado e remover o Status: closed redundante apenas dentro do cabeçalho técnico.
- Revalidar SHA-256 do arquivo e de CHAT.md antes de editar; qualquer divergência exige nova leitura do arquivo.
- Editar diretamente com apply_patch. Conferir também as quebras de linha; 48 fontes usam LF e três usam CRLF.
- Markdown continua fonte de verdade. Não alterar CHAT.md das threads migradas, artifacts históricos, configurações, código, contratos ou estado de fechamento.

## Validação e registro

Entrega editorial e registros mARC. Verificação focada de cabeçalhos, identidades, datas, corpos e hashes; revisão final do conjunto integrado e auditoria estrutural da thread. pnpm validate, pnpm build e pnpm test não se aplicam a esta entrega e não serão reportados como executados.

Referências consultadas: README, RULES.md, guia compartilhado de composição e encerramento, harness, ADRs aplicáveis, oportunidade original e decisão da thread de origem. Fonte de análise: context-mode, memory_recall e thread_read.

Manter a thread aberta. O registro da proposta e a entrega são as únicas publicações planejadas; não criar um diário de execução.

## Inventário e origem da data

| Thread | Ação | Closed | Origem |
| --- | --- | --- | --- |
| ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983 | Corrigir cabeçalho | 2026-10-09T14:24:04Z | Explícita |
| ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c | Corrigir cabeçalho | 2026-10-10T14:09:33.000Z | Explícita |
| bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7 | Corrigir cabeçalho | 2026-05-13T05:35:00.000Z | Explícita |
| bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82 | Corrigir cabeçalho | 2026-05-20T06:00:32.717Z | mtime anterior à edição (fallback) |
| bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a | Corrigir cabeçalho | 2026-05-12T01:04:47.871Z | mtime anterior à edição (fallback) |
| bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180 | Corrigir cabeçalho | 2026-05-20T17:02:36.733Z | mtime anterior à edição (fallback) |
| correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684 | Corrigir cabeçalho | 2026-10-09T04:36:05Z | Explícita |
| corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898 | Corrigir cabeçalho | 2026-10-10T05:46:49.398Z | mtime anterior à edição (fallback) |
| documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81 | Corrigir cabeçalho | 2026-10-09T03:33:26Z | Explícita |
| oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1 | Corrigir cabeçalho | 2026-10-09T13:05:00Z | Explícita |
| oportunidade-autocomplete-de-referencias-no-composer-2341bc9f | Corrigir cabeçalho | 2026-05-11T00:43:20.102Z | Explícita |
| oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac | Corrigir cabeçalho | 2026-07-07T00:55:19.196Z | Explícita |
| oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686 | Corrigir cabeçalho | 2026-05-06T15:51:43.162Z | Explícita |
| oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa | Corrigir cabeçalho | 2026-10-12T01:27:15.254Z | mtime anterior à edição (fallback) |
| oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac | Corrigir cabeçalho | 2026-07-21T04:41:33Z | Explícita |
| oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99 | Corrigir cabeçalho | 2026-07-15T03:41:13.693Z | Explícita |
| oportunidade-criacao-de-threads-pela-ui-0845d0bb | Corrigir cabeçalho | 2026-10-09T18:00:27.243Z | mtime anterior à edição (fallback) |
| oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c | Corrigir cabeçalho | 2026-05-16T04:58:26.485Z | Explícita |
| oportunidade-documentacao-do-projeto-e-readme-encantador-e54fb794 | Corrigir cabeçalho | 2026-05-07T04:58:11.504Z | mtime anterior à edição (fallback) |
| oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba | Corrigir cabeçalho | 2026-10-08T22:39:53Z | Explícita |
| oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a | Corrigir cabeçalho | 2026-05-01T05:04:00.000Z | Explícita |
| oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b | Corrigir cabeçalho | 2026-05-22T02:20:47.643Z | mtime anterior à edição (fallback) |
| oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1 | Corrigir cabeçalho | 2026-05-26T03:01:30.000Z | Explícita |
| oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b | Corrigir cabeçalho | 2026-10-11T22:45:44.347Z | mtime anterior à edição (fallback) |
| oportunidade-indicador-visual-de-memory-na-interface-174c48b6 | Corrigir cabeçalho | 2026-07-07T05:16:41.873Z | Explícita |
| oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83 | Corrigir cabeçalho | 2026-05-01T23:47:41.015Z | Explícita |
| oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb | Corrigir cabeçalho | 2026-05-18T17:36:57.903Z | mtime anterior à edição (fallback) |
| oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd | Corrigir cabeçalho | 2026-07-09T04:44:18Z | Explícita |
| oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3 | Corrigir cabeçalho | 2026-05-24T23:15:59.807Z | Explícita |
| oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9 | Corrigir cabeçalho | 2026-05-05T23:18:38.188Z | Explícita |
| oportunidade-organizar-agentes-registrados-no-rules-md-734062bc | Corrigir cabeçalho | 2026-05-11T04:38:05.142Z | mtime anterior à edição (fallback) |
| oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba | Corrigir cabeçalho | 2026-05-27T01:40:53Z | Explícita |
| oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f | Corrigir cabeçalho | 2026-05-24T19:23:28.258Z | Explícita |
| oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd | Corrigir cabeçalho | 2026-05-06T01:21:05.418Z | Explícita |
| oportunidade-processamento-em-background-para-gerar-memory-aa4908aa | Corrigir cabeçalho | 2026-07-10T17:05:00.000Z | Explícita |
| oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4 | Corrigir cabeçalho | 2026-07-14T16:52:00.000Z | Explícita |
| oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682 | Corrigir cabeçalho | 2026-07-20T22:54:00.000Z | Explícita |
| oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486 | Corrigir cabeçalho | 2026-05-06T05:54:55.283Z | Explícita |
| oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4 | Corrigir cabeçalho | 2026-05-06T05:01:27.248Z | Explícita |
| oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896 | Corrigir cabeçalho | 2026-07-16T18:57:43.514Z | mtime anterior à edição (fallback) |
| oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be | Corrigir cabeçalho | 2026-05-18T23:31:54.762Z | mtime anterior à edição (fallback) |
| oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2 | Corrigir cabeçalho | 2026-05-20T04:10:39.350Z | mtime anterior à edição (fallback) |
| oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787 | Corrigir cabeçalho | 2026-10-11T19:14:21.000Z | Explícita |
| oportunidade-revisao-en-us-do-projeto-c14150b8 | Corrigir cabeçalho | 2026-05-11T22:35:27.000Z | Explícita |
| oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9 | Corrigir cabeçalho | 2026-07-13T23:31:15.250Z | Explícita |
| oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186 | Corrigir cabeçalho | 2026-05-15T17:30:00.000Z | Explícita |
| oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7 | Preservar | 2026-10-12T14:25:38.134Z | Explícita |
| oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb | Corrigir cabeçalho | 2026-07-07T22:15:00.000Z | Explícita |
| padronizar-mensagens-marc-em-bullets-concisos-6143a9b5 | Corrigir cabeçalho | 2026-05-02T20:26:52.426Z | mtime anterior à edição (fallback) |
| remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf | Corrigir cabeçalho | 2026-05-02T20:26:52.397Z | mtime anterior à edição (fallback) |
| substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb | Corrigir cabeçalho | 2026-10-09T20:57:04.788Z | mtime anterior à edição (fallback) |

## Prévias dos 50 cabeçalhos

As prévias abaixo mostram apenas o bloco de cabeçalho. O corpo começa na linha indicada e permanece fora do escopo editorial.

### ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983

Antes:

```markdown
# Resumo Executivo

Closed: `2026-10-09T14:24:04Z`
```

Depois:

```markdown
# Ajustar a política de registros do loop para separar orquestração e mensagens de desenvolvimento

Thread: marc://$ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983

Closed: `2026-10-09T14:24:04Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c

Antes:

```markdown
# Sumário executivo — Falha de schema no rebuild incremental da memória

Thread: `ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c`
Closed: `2026-10-10T14:09:33.000Z`
```

Depois:

```markdown
# Ajuste - Falha de schema no rebuild incremental da memória

Thread: marc://$ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c

Closed: `2026-10-10T14:09:33.000Z`

---
```

Primeira linha do corpo preservado: "## Objetivo e contexto".

### bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7

Antes:

```markdown
# Sumario executivo

Closed: `2026-05-13T05:35:00.000Z`
```

Depois:

```markdown
# Bug: agent_register nao sinaliza agente existente

Thread: marc://$bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7

Closed: `2026-05-13T05:35:00.000Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82

Antes:

```markdown
# Resumo Executivo
```

Depois:

```markdown
# Bug: agente repete bootstrap e investigacao redundante em fluxo mARC

Thread: marc://$bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82

Closed: `2026-05-20T06:00:32.717Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a

Antes:

```markdown
# Sumario executivo
```

Depois:

```markdown
# Bug: comentario pela UI adiciona usuario ao RULES.md

Thread: marc://$bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a

Closed: `2026-05-12T01:04:47.871Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180

Antes:

```markdown
# Resumo Executivo
```

Depois:

```markdown
# Bug: workspace_audit ignora referencias mARC em inline code

Thread: marc://$bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180

Closed: `2026-05-20T17:02:36.733Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684

Antes:

```markdown
# Resumo executivo

Thread: marc://$correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684
Closed: `2026-10-09T04:36:05Z`
```

Depois:

```markdown
# Correção do fluxo de agentes para independência de fornecedores e perfis

Thread: marc://$correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684

Closed: `2026-10-09T04:36:05Z`

---
```

Primeira linha do corpo preservado: "## Objetivo e aceite".

### corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898

Antes:

```markdown
# Correção da corrida no teste de auto-idle
```

Depois:

```markdown
# Corrigir corrida de startup no teste de auto-idle do daemon

Thread: marc://$corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898

Closed: `2026-10-10T05:46:49.398Z`

---
```

Primeira linha do corpo preservado: "Encerramento autorizado pelo usuário em 2026-10-10. Implementação e revisão técnica aprovadas em 2026-10-09.".

### documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81

Antes:

```markdown
# Resumo executivo

Thread: marc://$documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81
Closed: `2026-10-09T03:33:26Z`
```

Depois:

```markdown
# Documentar o fluxo de desenvolvimento em loop e a política de modelos, reasoning e delegação

Thread: marc://$documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81

Closed: `2026-10-09T03:33:26Z`

---
```

Primeira linha do corpo preservado: "## Objetivo e aceite".

### oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1

Antes:

```markdown
# Resumo executivo

Thread: marc://$oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1
Closed: `2026-10-09T13:05:00Z`
```

Depois:

```markdown
# Oportunidade - Atalhos de teclado em sheet lateral

Thread: marc://$oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1

Closed: `2026-10-09T13:05:00Z`

---
```

Primeira linha do corpo preservado: "## Objetivo e encerramento".

### oportunidade-autocomplete-de-referencias-no-composer-2341bc9f

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-autocomplete-de-referencias-no-composer-2341bc9f`
Closed: `2026-05-11T00:43:20.102Z`
```

Depois:

```markdown
# Oportunidade - Autocomplete de referências no composer

Thread: marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f

Closed: `2026-05-11T00:43:20.102Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac`
Closed: `2026-07-07T00:55:19.196Z`
```

Depois:

```markdown
# Oportunidade - Banco de embeddings quantizado e indice estruturado de sumarios

Thread: marc://$oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac

Closed: `2026-07-07T00:55:19.196Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686`
Closed: `2026-05-06T15:51:43.162Z`
```

Depois:

```markdown
# Oportunidade - Bootstrap obrigatório nas tools mARC

Thread: marc://$oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686

Closed: `2026-05-06T15:51:43.162Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa

Antes:

```markdown
# Leitura MCP de threads por sufixo de ID
```

Depois:

```markdown
# Oportunidade - Busca MCP de thread por sufixo de ID

Thread: marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa

Closed: `2026-10-12T01:27:15.254Z`

---
```

Primeira linha do corpo preservado: "## Resultado e encerramento".

### oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac`
Closed: `2026-07-21T04:41:33Z`
```

Depois:

```markdown
# Oportunidade - Calibragem de recall lexical e candidatos da memory

Thread: marc://$oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac

Closed: `2026-07-21T04:41:33Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99`
Closed: `2026-07-15T03:41:13.693Z`
```

Depois:

```markdown
# Oportunidade - Coordenacao global de rebuild da memory entre processos

Thread: marc://$oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99

Closed: `2026-07-15T03:41:13.693Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-criacao-de-threads-pela-ui-0845d0bb

Antes:

```markdown
# Resumo executivo — Criação de threads pela UI
```

Depois:

```markdown
# Oportunidade - Criacao de threads pela UI

Thread: marc://$oportunidade-criacao-de-threads-pela-ui-0845d0bb

Closed: `2026-10-09T18:00:27.243Z`

---
```

Primeira linha do corpo preservado: "Encerramento autorizado pelo usuário em 2026-10-09 com “Finalize a thread”. Implementação concluída e aprovada tecnicamente pelo principal após revisão integrada.".

### oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c`
Closed: `2026-05-16T04:58:26.485Z`
```

Depois:

```markdown
# Oportunidade - Daemon detached e instalacao global via npm

Thread: marc://$oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c

Closed: `2026-05-16T04:58:26.485Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-documentacao-do-projeto-e-readme-encantador-e54fb794

Antes:

```markdown
# Resumo Executivo
```

Depois:

```markdown
# Oportunidade - Documentacao do projeto e README encantador

Thread: marc://$oportunidade-documentacao-do-projeto-e-readme-encantador-e54fb794

Closed: `2026-05-07T04:58:11.504Z`

---
```

Primeira linha do corpo preservado: "## Contexto".

### oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba

Antes:

```markdown
# Resumo executivo

Thread: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba
Closed: `2026-10-08T22:39:53Z`
```

Depois:

```markdown
# Oportunidade - Elegibilidade semântica e candidatos lexicais da memory

Thread: marc://$oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba

Closed: `2026-10-08T22:39:53Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a

Antes:

```markdown
# Executive Summary

Thread: `oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a`
Closed: `2026-05-01T05:04:00.000Z`
```

Depois:

```markdown
# Oportunidade - Encerramento de threads por SUMMARY e índice JSON

Thread: marc://$oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a

Closed: `2026-05-01T05:04:00.000Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b

Antes:

```markdown
# Resumo - Esquemas de visualização das colunas da UI
```

Depois:

```markdown
# Oportunidade - Esquemas de visualização das colunas da UI

Thread: marc://$oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b

Closed: `2026-05-22T02:20:47.643Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1

Antes:

```markdown
# Resumo - Estilo neo-brutalism para a UI

Thread: marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
Closed: `2026-05-26T03:01:30.000Z`
```

Depois:

```markdown
# Oportunidade - Estilo neo-brutalism para a UI

Thread: marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1

Closed: `2026-05-26T03:01:30.000Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b

Antes:

```markdown
# Validação proporcional ao impacto da entrega
```

Depois:

```markdown
# Oportunidade - Gate de validação proporcional ao impacto da entrega

Thread: marc://$oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b

Closed: `2026-10-11T22:45:44.347Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-indicador-visual-de-memory-na-interface-174c48b6

Antes:

```markdown
### Sumario executivo

Thread: `oportunidade-indicador-visual-de-memory-na-interface-174c48b6`
Closed: `2026-07-07T05:16:41.873Z`
```

Depois:

```markdown
# Oportunidade - Indicador visual de memory na interface

Thread: marc://$oportunidade-indicador-visual-de-memory-na-interface-174c48b6

Closed: `2026-07-07T05:16:41.873Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83

Antes:

```markdown
# Resumo Executivo

Thread: `oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83`
Closed: `2026-05-01T23:47:41.015Z`
```

Depois:

```markdown
# Oportunidade - Leitura incremental de threads por cursor

Thread: marc://$oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83

Closed: `2026-05-01T23:47:41.015Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb

Antes:

```markdown
# Summary
```

Depois:

```markdown
# Oportunidade - marc_audit para melhorar Custom Rules

Thread: marc://$oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb

Closed: `2026-05-18T17:36:57.903Z`

---
```

Primeira linha do corpo preservado: "## Goal".

### oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd

Antes:

```markdown
# Oportunidade - Mecanismo de busca sobre o conhecimento do projeto

Closed: 2026-07-09T04:44:18Z
```

Depois:

```markdown
# Oportunidade - Mecanismo de busca sobre o conhecimento do projeto

Thread: marc://$oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd

Closed: `2026-07-09T04:44:18Z`

---
```

Primeira linha do corpo preservado: "## Executive Summary".

### oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3

Antes:

```markdown
# Resumo - Modelo de segurança e gestão de token do daemon

Thread: `oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3`
Closed: `2026-05-24T23:15:59.807Z`
```

Depois:

```markdown
# Oportunidade - Modelo de seguranca e gestao de token do daemon

Thread: marc://$oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3

Closed: `2026-05-24T23:15:59.807Z`

---
```

Primeira linha do corpo preservado: "## Resultado executivo".

### oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9`
Closed: `2026-05-05T23:18:38.188Z`
```

Depois:

```markdown
# Oportunidade - Ordenar threads mais novas no topo

Thread: marc://$oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9

Closed: `2026-05-05T23:18:38.188Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-organizar-agentes-registrados-no-rules-md-734062bc

Antes:

```markdown
# Executive Summary
```

Depois:

```markdown
# Oportunidade - Organizar agentes registrados no RULES.md

Thread: marc://$oportunidade-organizar-agentes-registrados-no-rules-md-734062bc

Closed: `2026-05-11T04:38:05.142Z`

---
```

Primeira linha do corpo preservado: "## Outcome".

### oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba`
Closed: `2026-05-27T01:40:53Z`
```

Depois:

```markdown
# Oportunidade - Organizar CSS da UI por domínio

Thread: marc://$oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba

Closed: `2026-05-27T01:40:53Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f

Antes:

```markdown
# Resumo - Política de concorrência e escritas no Markdown SoT

Thread: `oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f`
Closed: `2026-05-24T19:23:28.258Z`
```

Depois:

```markdown
# Oportunidade - Politica de concorrencia e escritas no Markdown SoT

Thread: marc://$oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f

Closed: `2026-05-24T19:23:28.258Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd`
Closed: `2026-05-06T01:21:05.418Z`
```

Depois:

```markdown
# Oportunidade - Popup para postar artifacts pela UI

Thread: marc://$oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd

Closed: `2026-05-06T01:21:05.418Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-processamento-em-background-para-gerar-memory-aa4908aa

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-processamento-em-background-para-gerar-memory-aa4908aa`
Closed: `2026-07-10T17:05:00.000Z`
```

Depois:

```markdown
# Oportunidade - Processamento em background para gerar memory

Thread: marc://$oportunidade-processamento-em-background-para-gerar-memory-aa4908aa

Closed: `2026-07-10T17:05:00.000Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4`
Closed: `2026-07-14T16:52:00.000Z`
```

Depois:

```markdown
# Oportunidade - Provider de memory aquecido com TTL curto

Thread: marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4

Closed: `2026-07-14T16:52:00.000Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682

Antes:

```markdown
# Sumario executivo

Closed: `2026-07-20T22:54:00.000Z`
```

Depois:

```markdown
# Oportunidade - Rebuild incremental e batches limitados da memory

Thread: marc://$oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682

Closed: `2026-07-20T22:54:00.000Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486`
Closed: `2026-05-06T05:54:55.283Z`
```

Depois:

```markdown
# Oportunidade - Reestruturar INSTRUCTIONS e RULES para bootstrap

Thread: marc://$oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486

Closed: `2026-05-06T05:54:55.283Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4`
Closed: `2026-05-06T05:01:27.248Z`
```

Depois:

```markdown
# Oportunidade - Referências internas e menções direcionadas

Thread: marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4

Closed: `2026-05-06T05:01:27.248Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896

Antes:

```markdown
# Resumo Executivo
```

Depois:

```markdown
# Oportunidade - Reforçar gatilhos de ativação da skill marc-ops

Thread: marc://$oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896

Closed: `2026-07-16T18:57:43.514Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be

Antes:

```markdown
# Summary: reformatar Custom Rules com base na auditoria

Thread: `oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be`

Status: closed
```

Depois:

```markdown
# Oportunidade: reformatar Custom Rules com base na auditoria

Thread: marc://$oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be

Closed: `2026-05-18T23:31:54.762Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2

Antes:

```markdown
# Resumo
```

Depois:

```markdown
# Oportunidade - Revisao de arquitetura do projeto

Thread: marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2

Closed: `2026-05-20T04:10:39.350Z`

---
```

Primeira linha do corpo preservado: "Thread encerrada após a revisão de arquitetura e a evolução do quality gate do projeto mARC.".

### oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787

Antes:

```markdown
# Resumo executivo

Thread: marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
Closed: `2026-10-11T19:14:21.000Z`
```

Depois:

```markdown
# Oportunidade - Revisão e atualização do mARC para MCP 2026-07-28

Thread: marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787

Closed: `2026-10-11T19:14:21.000Z`

---
```

Primeira linha do corpo preservado: "## Objetivo e decisões".

### oportunidade-revisao-en-us-do-projeto-c14150b8

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-revisao-en-us-do-projeto-c14150b8`
Closed: `2026-05-11T22:35:27.000Z`
```

Depois:

```markdown
# Oportunidade - Revisão en-US do projeto

Thread: marc://$oportunidade-revisao-en-us-do-projeto-c14150b8

Closed: `2026-05-11T22:35:27.000Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9`
Closed: `2026-07-13T23:31:15.250Z`
```

Depois:

```markdown
# Oportunidade - Settings estruturado em JSON para reduzir parser customizado

Thread: marc://$oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9

Closed: `2026-07-13T23:31:15.250Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186`
Closed: `2026-05-15T17:30:00.000Z`
```

Depois:

```markdown
# Oportunidade - Status health e rebuild de índice em background

Thread: marc://$oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186

Closed: `2026-05-15T17:30:00.000Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

Antes:

```markdown
# Resumo executivo

Thread: `oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb`
Closed: `2026-07-07T22:15:00.000Z`
```

Depois:

```markdown
# Oportunidade - Tuning de recall e ranking da memory

Thread: marc://$oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb

Closed: `2026-07-07T22:15:00.000Z`

---
```

Primeira linha do corpo preservado: "## Objetivo".

### padronizar-mensagens-marc-em-bullets-concisos-6143a9b5

Antes:

```markdown
# Resumo Executivo
```

Depois:

```markdown
# Padronizar mensagens mARC em bullets concisos

Thread: marc://$padronizar-mensagens-marc-em-bullets-concisos-6143a9b5

Closed: `2026-05-02T20:26:52.426Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf

Antes:

```markdown
# Resumo Executivo
```

Depois:

```markdown
# Remover comandos legados do MCP - Reduzir sobrecarga de contexto

Thread: marc://$remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf

Closed: `2026-05-02T20:26:52.397Z`

---
```

Primeira linha do corpo preservado: "## Resultado".

### substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb

Antes:

```markdown
# Migração de Sonner para Toast Neobrutalism
```

Depois:

```markdown
# Substituir componente sonner pelo componente toast da lib Neobrutalism

Thread: marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb

Closed: `2026-10-09T20:57:04.788Z`

---
```

Primeira linha do corpo preservado: "Encerramento autorizado pelo usuário em 2026-10-09. Aprovação técnica do principal registrada na atividade consolidada.".

## Revisões capturadas antes da aplicação

| Thread | SHA-256 original | SHA-256 do corpo |
| --- | --- | --- |
| ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983 | 18154e509a781dd86469d5ac31680e34b3104b98cc6153abd3a210360b6e023e | c36aeef2b438287df829f77ab0b72d860fb81c1c05e831d137ff404bae97620b |
| ajuste-falha-de-schema-no-rebuild-incremental-da-memoria-94409c8c | c33450d1d8c039d412d7ff0b8a1d55ef628a8780ff5be4177266815acfc9e90b | 0f73a903f234b6924bff56b28621d4d60ae81ee5e45d5cebab381a7305a764be |
| bug-agent-register-nao-sinaliza-agente-existente-9e4e6ab7 | eb0e196c8ba3b0572ba02390f98e3fa402a3127c96a7907e95bcd83744cbb241 | 3fc14ecdc6f5e07849a5efc37a056943d49a1296914e8779edc0d1f4c9351768 |
| bug-agente-repete-bootstrap-e-investigacao-redundante-em-fluxo-m-58458a82 | 9879d9e1ec3b937b78652701aae021e7e74ab8cb3d87f438fc1d67807dc21e25 | c22b93f9fe556c313e00e3032c9872cf6ff235b2016d1b4e5243c689f51d8557 |
| bug-comentario-pela-ui-adiciona-usuario-ao-rules-md-274b7c9a | aa90537bcf875e2a53a9557c3f15785b83d03d3ad300e054b7fe5a298d2375b9 | f9d5d5790308f4e6e69e33bd4b07ff31b6aa5e630532e14af779be071aeee81b |
| bug-workspace-audit-ignora-referencias-marc-em-inline-code-72461180 | ba2514439121b5b7d6be463b8d20968b30c2b3d39a58d867e2aa61c40d0384b7 | a94c5b48df8e713031ad1b50e8554b3da2152f0dc8f8787a21bc70429d070a3f |
| correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684 | a039fd4db4e12661e679a2ab6edd92fa65c4900464d67e086701da331cb9ede6 | 5b00cfe3a1f03359a5d391fcf1648a46a5ea6b8a707a7f6c6e75f7882441399b |
| corrigir-corrida-de-startup-no-teste-de-auto-idle-do-daemon-504e1898 | e6b10869fd572bf6f7579c4fc22171874b98cd5a1a1b3a50c100a153b4503466 | 30e51902f1f39c084a13916e7304e1b62057d36679764bfc946d3277b2d115ee |
| documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81 | c4fbcf366c2d11f5cc7c3f61fa7564f09b51f797f9633bd91255173ed4d7a1f5 | 9500afe17a551a88b2e6c7fa0b901a26060f70bc92563e1bbbb3a3b380dbea0b |
| oportunidade-atalhos-de-teclado-em-sheet-lateral-5845b8a1 | 22e864a96a0c4e4a4ec3611fd7748ba18530694e1a0063084c43826ae3196d9f | 6527799614f8edf3d95777d146b4f3ff5a58a3623f7d766a4446587f17431a04 |
| oportunidade-autocomplete-de-referencias-no-composer-2341bc9f | 5ffe087a370c5ba1ceba4c79c966894e3b7c55b805c67dc4eb184048033c5572 | a4aebd5b5b1bc3152ebefb230e1c1c3f86dc699e44c800d2853aeda321368fe1 |
| oportunidade-banco-de-embeddings-quantizado-e-indice-estruturado-0e4dbaac | 25e754cdf404b9f50bf02988d3e52a700ec789c714734e162a8b050e1349dde8 | b4c3b8e5bf47f7d08803f72e722d7946e845af92e25a68fe37adf22f3bb26df3 |
| oportunidade-bootstrap-obrigatorio-nas-tools-marc-d14fb686 | 66557909af94aee6ef67e8ee1fd22aaeffa80542b4ec13b24ebee500b41a89a7 | a55bbc59051daa0ece38ebc21f790a9e7902b636763dcdd04cc59e2ed13ddac6 |
| oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa | 9463c9898f1994e2f980ed656a0f75ceeb14a07e1cb7aefd96a3c9281849deef | 112f5255201e0ddf602317d8346ac4738eef10ae36879aeb16ab43cc86d947cf |
| oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac | 31f49569918c7a5f750296ea5486d5b31bdf7758706ad67c434bf63efe6776db | db2776c6e8b78bcda4d32c766dfedbb33e144dda04593eb1f9a6703ee34f27f6 |
| oportunidade-coordenacao-global-de-rebuild-da-memory-entre-proce-774d1e99 | c0aaffb22499bd584fa5cc48394297e061950eef79d8320b63aa0ff69a5d6767 | 6458bb10f2f02a6598f5f29da68cd268467d872e8d1f96e7b116addd4fb899c1 |
| oportunidade-criacao-de-threads-pela-ui-0845d0bb | cb8329b48bc3d6d48b691fd214b3d65902daf31907d596e1c7f3117c2988923d | 0cbece0cdeed9962972dfd483ea020c2c63ba0c73d2c634b2ccd0ccf1d360959 |
| oportunidade-daemon-detached-e-instalacao-global-via-npm-39436d9c | 632c35a4fa62e30d4ad22c53c492bc26662490d430d0ea9573e45d0b9adabe46 | 1fb3371d5dc1304c2bd62cffdeec2e9f1ac14109c30d39e128d4a486282800be |
| oportunidade-documentacao-do-projeto-e-readme-encantador-e54fb794 | 92b57b8afb8d0255128a5a42fbd4cc7899bd4f607ee0ca6c1d642fc5ddb4fc70 | 051da33504dea4578fe235cf0395cb2848f90be25c1dbe71fb3de099522b0421 |
| oportunidade-elegibilidade-semantica-e-candidatos-lexicais-da-me-834716ba | 04e713a823e1ac1edfa0c2eeae5f203912ae0e0b7c645d136aaa46ceba926e6b | e4a82354f77cdf8485cb51aef1614529602ca761ce733e5004dd41b4272b328e |
| oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a | 7f159b227e9f83451c8d798a39c7ff1d3f36837b3304c410b849154b2c038fc8 | 2fe109e929e7a4da6b8c07df6963a735ee574b9e3b3ec06b5a86a2f46a5a6d7f |
| oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b | 860d03fa3fe9c1454a8f6b17a1017fa98f459f5631a2c9487286379f40ae3eaa | a63ad718c64a804405d2e944961842c515ef3a943b28dd4074afb8575cfbeb15 |
| oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1 | c9d19aace75bcf081224cc1c8744dedcd47779315fc75561808cc653e36e05fa | 4155c6f469dcecaa0496a5dc6eedaca09510685bd3f4c6f1d8b7e3aa5ddc1778 |
| oportunidade-gate-de-validacao-proporcional-ao-impacto-da-entreg-054fd58b | b7bbf1dc05f1f4cea3cef25bfb0261e8a871b77695722bc3389c79800068bcb6 | 7b2a1824b9e76860685107427fa40a5e83aa8c2d75a751be73d4a790f5ff57bc |
| oportunidade-indicador-visual-de-memory-na-interface-174c48b6 | f0ece2b2870381f2dae1fd668b612c8f064fcb42512493dc66cfe91d1b99376b | 4ccf5315860b5b17f1cff7a4fe3f2cf3b01cafbf5bbb0a58459ff8a2ffc6929d |
| oportunidade-leitura-incremental-de-threads-por-cursor-3c45fa83 | 41e6cd49c8efb074f4c67bc3cf2e40ff905c4ec4d33983556344e03f469f083d | 9824a8f1302c8b9720f430b66903de3c207354d0afc185b3a349a8894234548c |
| oportunidade-marc-audit-para-melhorar-custom-rules-184fd8bb | 9a616b43e482f76f83a187d2e94f5bfb6497952d2b24373e71c2e1d2da1490db | 2914ce88431dc730e32042003eed9bd16cba05c1df1f1472b33243b43cdc868f |
| oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd | 4d00bcd5db17aa5ee3e2a73309a812736c57a3a72a1c9fc73a57293b42133c46 | 30940cb3860c9f9bff56479084822869dc84d6f6850bd804bc59daa5685e3f21 |
| oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3 | 81b8ef36cd19ab8ba093974b50027daa2db068f864daabd044fa077d33d8d578 | e6dac18c7a4d5f717590493cd87d38082de67d54332945751bf8f0a5db5e8b6c |
| oportunidade-ordenar-threads-mais-novas-no-topo-394a14b9 | ec4439884726a7c0ae166d74dbf6b5c40bd94e6d1a2f305304ffccdda66f1fae | 4b35becf3a5d3362c43e3bb71abc5ac4344a8d8a74f7a0499569068c7909e53d |
| oportunidade-organizar-agentes-registrados-no-rules-md-734062bc | 8dc9ee6116ec1c1bcfc81fefb5ae9748285752fa0ad6526694c3c56fed1ceac5 | 99e8e279f1305a4ddf93fc219dd0c873f87d1426ee3f96aaeeccb3403220fbaa |
| oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba | b6410771d094c314af964fe23e020b3e02b6586de3cbe2ab8db2481446c97d73 | 0db3004eb60e7e844c28099f3195d28d2bd9007c34503ede8ce3fafc3be74b6d |
| oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f | bd9396f61a223ad0d6794ca2602c82cb7a099930168235bcde5ffd533f4cb068 | 7c89bad1e3236ca74696731f446632ee89130f1e4c7aa197a13704c0e960c21c |
| oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd | 45043c2e7f316e174eb6563cd2f0859af20ee3bdba7ec8f480baa20c3e06e929 | 1dfed83039cbd58c1d86234448e9d8f4457a7a6e202116dc321c0fbbe0aa2fd2 |
| oportunidade-processamento-em-background-para-gerar-memory-aa4908aa | 691850c24a10d40190978adc6f0eb7da69ee143e820296287d0263e3a8ed0669 | 5ddf8c5f6d9609624d16d74ba6f98d6f06e2c99622c517810e7977e9c3440adf |
| oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4 | a7a77fa9ab08979bb71f17b32de21dc06d433396ff51a97c012eac4540bc73c7 | 07817f67e3f52568cb2115c0518bbe4937f4da112e1f26390bbf5a70901fb01a |
| oportunidade-rebuild-incremental-e-batches-limitados-da-memory-3e422682 | 7f3e995983003f5934eb9af33d170d86a0e0bf21787029711596d4319e7ce8f4 | d0ae1996e21fbb9efb9f5ddc1c4d874d2b193861a3c6cab2244d405b12a337d2 |
| oportunidade-reestruturar-instructions-e-rules-para-bootstrap-d34b7486 | 2a42d5ca54984c4f7bc4e8e2a5a4beae5618d236fb43973128107df3761c08a3 | b53c903a620cbc503ce5eba74b42bc0ece5a4e79afa108ed24fffc33674e2ea9 |
| oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4 | 94de0a339dd3b85ae6e77b1a46af3c4d91a283ea4550b5d9ed41ce735e4c9821 | 7515a151d840ee79cc09a372850d55e7d0d696686428b6330e88c1217dcf0f25 |
| oportunidade-reforcar-gatilhos-de-ativacao-da-skill-marc-ops-934c4896 | f4e4c4f7054bf049abd1581da7b5389feb943cf723d7d65317b2bee24d909566 | d5116f235ed395ee2613c441afa7528631e444b4e6fdb4a2029cb5e953d45a8d |
| oportunidade-reformatar-custom-rules-com-base-na-auditoria-894072be | 921d36967131d9896a2b8e511bacb995683ddc178810232136ca0110aee119ee | 737a420fb6996ca6dc3181c98628295493b143669f8adc3b3e95829243fa47c4 |
| oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2 | ddab36239b3e21038d4723350043d60bc337aac6e6bffe171761e47f53b54b8c | 9dd34805da25c5350684f1db45f31307ccfa12999f15abd6c1cf5c82bf34a403 |
| oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787 | 48791330cbe68c4bc04e74e8022a534087e85cc36ed0a534386dd35f5e4df53f | 5437b4e1889d03e97f153412cabaac08236286a775b46feb7d5311e2f2b135a0 |
| oportunidade-revisao-en-us-do-projeto-c14150b8 | 38c11b054c776402bd8ced6b4cabc4c96874ccd0f8f16c36b7272587c1a4c34c | 27647d18c61e0253525d1b856993334a46818895dd2e9ae4cd3f3a9a9ea79407 |
| oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9 | a4b7cd15175b24a013ab9ae546eac65bbafcda3703397b179aa27ae103b1a018 | e14a26953e3386116e5413904c78924cbb872c9923a5939f8a8543f5dd95a00b |
| oportunidade-status-health-e-rebuild-de-indice-em-background-6340b186 | a7bcd3f9d93216c5d4f5ca8a0655f95b40b488e91590c08ec24311eb2e695efd | a4438ea103f881b972f136cb4330de027c49aad6ae66034faedde981e0043610 |
| oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7 | 16844b14aa905ee78c5a88d2bf35bba08f852b899b226ae77d811d2b0853117f | 2100e40a1ef306382990eae4315cdbc4d106e46ceedc9c6354928d907915a3d6 |
| oportunidade-tuning-de-recall-e-ranking-da-memory-c147b8bb | dc21349e9f82d68bc3f447add1250669f45baeff292dfb9c9fb838b613bb5d9c | e0e1467f9fd53c8f59b49c353310c0660b42c701592d81f5374efea8a4e2096b |
| padronizar-mensagens-marc-em-bullets-concisos-6143a9b5 | 61bd7d1f756c2ad1d86c75ff287e2b285dfcacbfb4df9ba6f3d4b4c3e03f1443 | 21daf35e57a6829d35ed275dc660d1adc0c7fb54c115d5facac987c0aec202da |
| remover-comandos-legados-do-mcp-reduzir-sobrecarga-de-contexto-034ad1bf | 3a42367f70c135db2832c9a447faa93e25e9e3a343aa614fdfef9ae6e75fa6f3 | d391d1a8e08841683cd758918ff53330b55e90059a929bfda36628af26c1dd1d |
| substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb | 26015e3cecd1843c1b7f59a1124c8c5ddc761bef032937f536b06e5a4626bd3b | 5f3327791f512b0059cbc550a3b512f7b541bc7f13271d2aad39e3b44f8c00b0 |
