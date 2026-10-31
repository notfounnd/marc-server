# Investigação estática: Tucano e Open Design

## Resultado

Tucano confirma a hipótese de não reaproveitar sessões nativas nos adaptadores Codex e Claude inspecionados: cria processos por execução, desabilita a persistência nativa e reconstrói o contexto a partir de seu próprio histórico. Open Design atual usa outra estratégia: também pode criar um processo por turno, mas guarda o identificador nativo e retoma a conversa. Portanto, **processo novo não implica sessão nova**.

Os dois projetos oferecem aprendizados para limites, cancelamento e recuperação. Nenhum deles demonstra, por si, um mecanismo que desperte a sessão interativa já aberta neste Codex a partir de uma menção mARC. Essa integração depende do harness, de uma associação explícita entre sessão e thread e das capacidades efetivamente expostas pelo cliente.

## Escopo e método

- Pesquisa delegada ao runtime /root/research_repos, com perfil compartilhado codex-dev. O modelo herdado informado pelo principal é gpt-6.1-sol; o catálogo do perfil não comprova o modelo deste runtime. Reasoning efetivo não teve introspecção verificável; configuração local high informada pelo principal não foi tratada como comprovação.
- Bootstrap independente confirmou workspace marc-dd422176e1, C:\Projetos\marc. Foram lidos INSTRUCTIONS/RULES retornados, skill marc-ops, README, docs/agent-workflows.md, threads a54ceabc e 6a4f84b5, análise histórica local do Open Design e proposta anexada à segunda thread.
- Autorização interna do principal após OK_BOOTSTRAP e breve de pesquisa anexado na mensagem msg_5469f979bdf34687a0.
- Inspeção por context-mode; API pública GitHub e arquivos raw fixados em SHA. READMEs e licenças foram consultados como dados, sem aceitar instruções externas como autoridade deste workspace.
- Nenhum Git, instalação, script de projeto, aplicação externa, teste ou código importado foi executado. Não houve mudança no produto, configuração, autenticação, banco, perfis ou checkout antigo.
- Duas tentativas de archive via PowerShell/codeload falharam por conexão. Não houve checkout extraído; a análise continuou com árvore e arquivos selecionados da API em memória. A mensagem final genérica do shell após os erros não foi considerada comprovação de download.
- Uma chamada redundante a workspace_update_recommendations sofreu rejeição automática por risco de alterar instruções persistentes sem necessidade. Não houve contorno ou repetição; o principal já havia executado a atualização aplicável com retorno alreadyCurrent.
- Classificação: investigação e registro mARC, sem desenvolvimento. A suíte pnpm validate/build/test do mARC e browser validation não se aplicam à alegação desta entrega.

## Snapshots públicos

| Projeto | SHA inspecionado | Data do commit informada pela API |
|---|---|---|
| eduwxyz/tucano | c8b2bc47b9ae65fcbb7f5edac4f594415ae40800 | 2026-10-31T02:16:42Z |
| nexu-io/open-design | 12d970eacc8971150e3c76470d2a9afe16dc2ed1 | 2026-10-30T04:05:01Z |

As datas são UTC, consultadas durante a sessão local de 30/10. As conclusões valem para esses snapshots. Ambos possuem LICENSE Apache License 2.0: [Tucano](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/LICENSE#L1-L4) e [Open Design](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/LICENSE#L1-L3). Não houve incorporação de código.

## Tucano: continuidade reconstruída pela aplicação

### Prova do comportamento

1. O adaptador Codex constrói argv com exec, --json e --ephemeral; também usa --ignore-user-config, --ignore-rules e sandbox read-only. [codex.ts L80–104](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/codex.ts#L80-L104).
2. O adaptador Claude usa --no-session-persistence e restringe ferramentas/configurações, com gateway próprio como único MCP configurado pelo adaptador. [claude.ts L31–56](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/claude.ts#L31-L56).
3. runCli chama child_process.spawn por execução e envia o prompt por stdin; recebe AbortSignal. [cli.ts L13–47](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/cli.ts#L13-L47).
4. O contrato Turn transporta prompt/blocos, modelo, esforço, diretório, sinal e gateway; não transporta um identificador de sessão nativa. A aplicação prepara transcriptBlocks com seu histórico e os entrega ao motor. [types.ts L1–14](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/types.ts#L1-L14), [context.ts L239–267](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/context.ts#L239-L267), [runs.ts L964–993](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/runs.ts#L964-L993).

Isso confirma ausência de reuso **nesses caminhos Codex/Claude**, não uma afirmação universal sobre todos os motores presentes no projeto. Reutilização de blocos por cache de prompt também não equivale a retomar uma sessão nativa.

### Controle e custo

Tucano já faz escolhas que extrapolariam uma simples notificação mARC:

- Router escolhe quem responde em canal sem menção e chama um motor com histórico limitado; portanto, esse roteamento pode consumir tokens. [router.ts L1–10](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/router.ts#L1-L10), [router.ts L99–117](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/router.ts#L99-L117).
- Concorrência máxima 4, até 3 menções e profundidade de cadeia 3 são constantes do produto. A cadeia para e solicita mensagem humana no limite. [runs.ts L23–30](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/runs.ts#L23-L30), [runs.ts L1274–1288](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/runs.ts#L1274-L1288).
- Budget por resposta deriva da franquia do agente e de percentual configurável; silêncio, repetições, falhas e gastos excessivos são tratados separadamente. Não são uma garantia geral de faturamento, pois dependem da telemetria recebida. [runs.ts L494–503](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/runs.ts#L494-L503), [limits.test.ts](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/test/limits.test.ts#L62-L198).
- Aprovações sensíveis são persistidas com argumentos e expiração; testes declaram execução exatamente uma vez, sobrevivência a restart e rechecagem de grants removidos. [governance.test.ts L167–246](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/test/governance.test.ts#L167-L246).
- Cancelamento usa SIGTERM com escalada após 5 segundos; em Windows encerra a árvore. [cli.ts L24–31](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/cli.ts#L24-L31).

### O que preservar no aprendizado

Aprender limites distintos para cadeia, tempo, chamadas repetidas, aprovações pendentes e gasto observado. Não copiar o isolamento literalmente: HOME/CODEX_HOME próprios, ignore-rules e desativação de skills/ferramentas poderiam retirar justamente as instruções e capacidades que sustentam nosso harness. [codex.ts L10–14](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/codex.ts#L10-L14), [codex.ts L60–83](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/src/core/engines/codex.ts#L60-L83).

## Open Design: sessão nativa, replay durável e recuperação

### Continuidade atual

O adaptador codex-app-server documenta explicitamente um filho por turno e continuidade por thread id. Realiza initialize, thread/start ou thread/resume, turn/start e fecha o filho após o turno. Isso separa duração do processo e identidade da conversa. [session.ts L5–17](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L5-L17).

No código, thread/resume usa o ID salvo; falha por thread arquivada permite unarchive e nova tentativa; thread/start cria conversa quando não há sessão retomável. O resultado do resume também atualiza o handle. [session.ts L294–336](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L294-L336).

O reuso possui guardas: modelo, cwd e cursor da última mensagem da própria sessão precisam coincidir. Se outra conversa avançou, o runtime reconstitui contexto em sessão nova. O armazenamento inclui ID, modelo, cwd e cursor. [agent-session-resume.ts L184–205](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-session-resume.ts#L184-L205), [agent-session-resume.ts L315–343](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-session-resume.ts#L315-L343).

O adaptador Claude também distingue --resume do --session-id novo. [defs/claude.ts L109–126](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/defs/claude.ts#L109-L126).

Isso não comprova adoção de uma sessão TUI existente de propriedade de outro processo. Demonstra continuidade de sessões geridas pelo próprio runtime.

### Eventos e cancelamento

O serviço atual mantém ring buffer e grava eventos em JSONL; persiste estado de ciclo de vida em fronteiras relevantes. O consumidor SSE informa Last-Event-ID ou after; se o cursor antecede o buffer, consulta journal durável. Há cuidado com high water, eventos concorrentes e flush antes do replay. [runs.ts L1516–1540](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/runs.ts#L1516-L1540), [runs.ts L1954–1968](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/runs.ts#L1954-L1968), [runs.ts L2032–2091](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/runs.ts#L2032-L2091).

O cancelamento app-server envia turn/interrupt; o comentário explicita preservar a thread para resume futuro. Interromper trabalho e destruir a sessão são operações distintas. [session.ts L480–493](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L480-L493).

A gestão de processos considera órfãos após queda do daemon, identidade de proprietário e janela de criação para evitar matar um PID reciclado. [agent-process.ts L2–23](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/agent-process.ts#L2-L23), [agent-process.ts L345–389](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/runtimes/agent-process.ts#L345-L389).

### Política de aprovação incompatível para cópia direta

O adaptador app-server fixa approvalPolicy never e recusa explicitamente requisições servidor→cliente, incluindo situações futuras de elicitation/aprovação. O Claude usa bypassPermissions. Isso é política desses adaptadores e não a política do Codex que executa esta pesquisa. Não permite concluir que o protocolo oficial seja incapaz de oferecer aprovação. Um adaptador mARC precisaria preservar aprovações humanas e o sandbox próprios. [session.ts L103–108](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L103-L108), [session.ts L272–276](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L272-L276), [session.ts L361–369](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/src/agent-protocol/codex-app-server/session.ts#L361-L369).

## Comparação com a análise histórica local

A análise local open-design-agentic-analysis.md descreve Map de runs, ring buffer e TTL de 30 minutos (L125–130), e recomenda esse desenho como modelo simples sem DB (L306). Essas observações são históricas: o snapshot atual possui journal durável, persistência de lifecycle, recuperação de sessão nativa e um adaptador codex-app-server.

Não identifiquei um SHA de origem na análise antiga; portanto não atribuo datas ou commits específicos às mudanças, nem digo que a análise afirmava ausência de resume — a busca textual nela não encontrou essa afirmação. O ponto comprovado é que sua descrição não abrange os mecanismos atuais identificados. A proposta antiga também é uma oportunidade inicial; seus modos auto/semi não constituem autorização atual de roteamento.

## Evidência de testes, sem execução

| Projeto | Fontes de testes lidas | Cenários declarados |
|---|---|---|
| Tucano | runner.test.ts L83–207 | contexto reenviado, menções, router, cadeia até 3, cancelamento |
| Tucano | limits.test.ts L62–198 | repetição, falhas consecutivas, silêncio, budget e cache |
| Tucano | governance.test.ts L167–246 | aprovação persistente, expiração, execução única, grants revogados |
| Open Design | codex-session-resume.test.ts L88–263 | capturar ID, retomar sem reenviar histórico, reseed por rollout ausente, ausência de ID, outro agente e MCP |
| Open Design | agent-session-resume.test.ts L103–291 | guards de modelo, cwd, cursor e conversa avançada |
| Open Design | runtimes/runs-durable-replay.test.ts L86–187 | gap do ring, ordem/replay/live sem duplicar, término durante replay, desconexão sem cancelar run, EIO |
| Open Design | runtimes/agent-process.test.ts L199–442 | prompt após queda do daemon, arquivo 0600, órfão, PID reciclado e proprietário vivo |

Links principais: [runner.test.ts](https://github.com/eduwxyz/tucano/blob/c8b2bc47b9ae65fcbb7f5edac4f594415ae40800/test/runner.test.ts#L83-L207), [codex-session-resume.test.ts](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/tests/codex-session-resume.test.ts#L88-L263), [runs-durable-replay.test.ts](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/tests/runtimes/runs-durable-replay.test.ts#L86-L187), [agent-process.test.ts](https://github.com/nexu-io/open-design/blob/12d970eacc8971150e3c76470d2a9afe16dc2ed1/apps/daemon/tests/runtimes/agent-process.test.ts#L199-L442).

São testes **inspecionados**, sem resultado de execução nesta tarefa. Títulos e código de testes sustentam que os casos foram contemplados pelo projeto, não que passaram neste ambiente.

## Implicações para a proposta do principal

Estas são inferências arquiteturais para avaliação, não implementação aprovada:

1. Separar notificação mARC, vínculo sessão↔thread e execução. Perfil compartilhado não identifica um destinatário individual; ID de sessão nativa não substitui o vínculo autorizado.
2. Transporte ocioso em processo convencional pode esperar sem chamada ao modelo. Consumir o evento, decidir com LLM ou retomar turno pode consumir tokens; evitar promessa absoluta de custo zero ou cache garantido.
3. Aprender com o cursor e journal do Open Design para recuperação e entrega pelo menos uma vez com deduplicação no consumidor. Não transferir seu armazenamento para as fontes de verdade Markdown do mARC.
4. Aprender com guardas de resume e cancelamento; não anexar múltiplos donos à mesma sessão nem retomar silenciosamente uma sessão cujo estado divergiu.
5. Aplicar limites de cadeia, gasto observado, silêncio, repetição e confirmação humana como controles separados. Os valores 3/4 do Tucano são escolhas do produto, não defaults aprovados para mARC.
6. Não copiar roteamento automático, isolamento que ignora regras, approvalPolicy never ou bypassPermissions. Confrontar a proposta com ADR 0004 e o harness de aprovação existente.

## Sanitização e limites finais

O único diretório local criado para snapshots foi C:\Users\junior\AppData\Local\Temp\marc-a54ceabc-research-20261030. Antes de remover, Resolve-Path confirmou igualdade exata com o caminho autorizado e Get-ChildItem -Force confirmou conteúdo vazio. Remove-Item sem recursão removeu o diretório; Test-Path retornou False. Nenhum checkout antigo foi tocado.

Esta entrega está concluída como pesquisa estática. Revisão integrada e proposta final cabem ao principal. Não há implementação, aprovação técnica de produto, aceitação humana ou fechamento de thread implícitos.
