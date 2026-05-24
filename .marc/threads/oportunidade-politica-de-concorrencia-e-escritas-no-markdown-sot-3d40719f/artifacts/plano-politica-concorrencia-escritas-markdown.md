# Plano Detalhado - Politica de concorrencia para escritas Markdown do mARC

## Objetivo

Implementar uma politica consistente de concorrencia para os writers Markdown gerenciados pelo mARC, preservando Markdown como source of truth quando MCP e daemon/UI operarem simultaneamente no mesmo workspace.

## Diagnostico confirmado

- `appendMessage` altera `CHAT.md` por append direto.
- `attachArtifactToMessage` le e regrava todo o mesmo `CHAT.md`; em concorrencia, pode apagar mensagens ou metadata adicionadas por outro writer.
- A UI registra agente ao postar mensagem e o MCP tambem pode registrar agentes; `agents/*.md` e relido e regravado para preservar contexto manual.
- `workspace_bootstrap` e `workspace_update_recommendations` atualizam `RULES.md`, `INSTRUCTIONS.md` e `.agents/skills/marc-ops/SKILL.md`, preservando `Custom Rules` em `RULES.md`.
- `thread-index.json` ja e cache derivado e usa arquivo temporario + `rename`, mas rebuilds concorrentes entre processos podem publicar snapshots fora de ordem.
- MCP e daemon/UI podem operar em processos distintos; fila somente em memoria nao resolve o contrato.

## Regras aplicaveis e evidencias

- Preservar Markdown como source of truth: locks e escrita segura protegem os arquivos autoritativos; o indice continua derivado e reconstruivel.
- Usar context-mode para investigacao e validacao: a analise foi baseada na leitura de `threads`, `artifacts`, `agents`, `recommendations`, `thread-index`, rotas MCP/daemon, testes e documentacao via context-mode.
- Conteudo de produto, codigo e documentacao em en-US; comunicacao desta thread em pt-BR.
- Fluxo de codigo alterado sem `else` e sem `if` aninhado; usar early returns para guards e estrategia/helper explicito para writers.
- Antes de concluir: executar `pnpm run validate`, `pnpm test` e `pnpm build`, relatando os resultados.
- Preflight executado antes do desenvolvimento: `workspace_audit` retornou sem findings.

## Escopo decidido

Cobrir todos os writers Markdown controlados pelo mARC:

- `threads/<thread-id>/CHAT.md` e `threads/<thread-id>/artifacts/*`.
- `agents/<agent-id>.md`.
- `RULES.md`, `INSTRUCTIONS.md` e `.agents/skills/marc-ops/SKILL.md` nas atualizacoes gerenciadas.
- `thread-index.json` apenas na condicao de cache derivado que deve convergir sem corrupcao.

Fora do escopo:

- Edicoes manuais externas aos writers do mARC, que permanecem legiveis mas nao participam do protocolo de coordenacao.
- Token, registry e estado operacional do daemon, que nao sao Markdown source of truth do workspace.
- Novo schema MCP, nova rota HTTP ou mudanca nos payloads existentes.

## Implementacao

### Coordenacao de escrita

- Criar infraestrutura interna de lock cooperativo entre processos em `.marc/cache/write-locks/`, area tratada como controle derivado.
- Usar locks por recurso logico:
  - `thread:<threadId>` para transcript e artifacts da thread.
  - `agent:<agentId>` para perfil de agente.
  - `recommendations` para arquivos gerenciados de recomendacoes.
  - `thread-index` para rebuild/persistencia do indice.
- Aquisicao exclusiva deve usar operacao atomica do filesystem, com ownership identificavel, espera limitada, retry e recuperacao de lock stale.
- Falha em adquirir lock deve encerrar a operacao sem escrever o arquivo alvo.

### Substituicao atomica de arquivo

- Criar helper que escreve o conteudo completo em temporario no mesmo diretorio e promove por `rename` somente quando a escrita estiver completa.
- Esta garantia significa que leitores observam o arquivo anterior completo ou o novo arquivo completo; nao significa commit Git nem transacao de multiplos arquivos.

### Threads e artifacts

- Fazer `appendMessage` participar do lock da thread; manter append apos adquirir o lock, sem regravacao desnecessaria do transcript.
- Fazer `attachArtifact` adquirir o mesmo lock da thread e publicar o arquivo por substituicao atomica.
- Fazer `attachArtifactToMessage` executar sob um unico lock de thread: reler `CHAT.md` dentro do lock, escrever artifact de forma atomica e substituir `CHAT.md` com a metadata atualizada.
- O vinculo do artifact continua publicado pela metadata em `CHAT.md`. Se o processo falhar entre a gravacao do arquivo e a atualizacao da metadata, pode sobrar artifact orfao detectavel por auditoria, mas nenhuma mensagem pode ser apagada ou exposta parcialmente.

### Agentes e recomendacoes

- Fazer `registerAgent` reler e regravar o perfil dentro do lock do agente, preservando contexto manual existente em operacoes concorrentes.
- Fazer atualizacoes de recomendacoes rodarem sob lock unico e usarem substituicao atomica para cada arquivo.
- Preservar `Custom Rules` a partir da versao mais recente lida dentro do lock.
- Manter recomendacoes como atualizacao convergente e idempotente, nao como transacao multi-arquivo: uma nova execucao deve completar eventual interrupcao sem perder `Custom Rules`.
- Escrever arquivos iniciais fixos de workspace de forma segura quando ainda nao existirem.

### Indice derivado

- Manter `thread-index.json` reconstruivel e nao autoritativo.
- Serializar scan e publicacao do snapshot entre writers do mARC, reaproveitando persistencia por temporario + `rename`.
- Aceitar que mudancas Markdown posteriores ao scan deixem o cache temporariamente stale; watcher/fallback rebuild deve convergir a UI.

## Testes

- Testar a infraestrutura de lock: exclusao mutua, liberacao apos falha, timeout sem escrita insegura, recuperacao de lock stale e substituicao atomica.
- Cobrir concorrencia em thread com mensagens e attachments simultaneos, verificando parse integro, presenca de mensagens e metadata de artifacts.
- Cobrir registro concorrente de agente com preservacao de contexto manual.
- Cobrir atualizacoes concorrentes de recomendacoes preservando `Custom Rules`.
- Cobrir rebuilds concorrentes do indice, JSON valido e reconciliacao final baseada no Markdown atual.
- Manter testes MCP/daemon existentes como regressao do contrato publico.

## Documentacao

- Adicionar ADR em en-US descrevendo locks cooperativos, substituicao atomica de arquivo, limites com edicoes externas e consistencia eventual do indice.
- Atualizar `docs/architecture.md` e o indice de ADRs para registrar a politica compartilhada entre MCP e daemon/UI.

## Encerramento da execucao

- Executar validacao completa.
- Comentar nesta thread, em pt-BR, o que foi implementado, documentacao tratada, validacoes executadas e riscos residuais.
- Manter a thread aberta aguardando feedback para orientar a finalizacao.