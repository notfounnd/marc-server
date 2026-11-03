# Despacho da frente Codex da F0

Autor: marc://@codex-software-architect
Executor: marc://@codex-dev
Data: 02/11/2026

## Objetivo e autoridade

Executar as 14 células Codex autorizadas pelo humano, sem alterar o produto ou consolidar a matriz conjunta. Este despacho complementa a seção 8 de proposta-execucao-f0.md; a instrução humana atual autoriza conduzir as seis células de TUI sem humano, por ConPTY. Teto: um desenvolvedor ativo, sequencial, confirmado no pedido atual. Não executar Git.

## Fontes obrigatórias

Bootstrap independente com a skill marc-ops e contrato completo. Ler AGENTS.md, README.md, docs/agent-workflows.md (delegação e Shared message format), docs/harness-engineering.md e ADRs aplicáveis. Ler esta thread, proposta-execucao-f0.md (especialmente seção 8), plano-f0-provas-de-cliente.md, resultado-f0-claude.md e resultado-f0-interativo-claude.md na versão atual. Não repetir a pesquisa de repositórios.
Thread: marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf.

Usar context-mode na inspeção e revisão de saídas. Para documentação Codex, aplicar openai-docs; conferir o schema local instalado antes de confiar no protocolo mais recente. Documentação primária: https://developers.openai.com/codex/app-server.md e https://developers.openai.com/codex/mcp.md.

## Configuração

Perfil compartilhado codex-dev; modelo solicitado gpt-6-luna; reasoning solicitado xhigh. O perfil registra confirmação humana para esse modo, sem introspecção de runtime. O modelo é adequado a scripts de sondagem delimitados com revisão independente do principal; reasoning não substitui capacidade. Registrar pedidos, confirmação e efetivo somente quando verificável. As sessões descartáveis também devem usar um modelo econômico com acesso real confirmado, sem substituir silenciosamente modelo explicitamente escolhido em uma prova.

## Escopo e limites de escrita

Somente C:\Users\junior\AppData\Local\Temp\marc-f0\X\, uma subpasta para cada célula. X não existia na inspeção inicial do principal. Não alterar PTY, kit, pastas Claude ou outros locais de marc-f0. Não instalar nada.
Exceção explícita de entrega: criar o próprio artefato resultado-f0-codex.md e mensagem nesta thread por ferramentas oficiais mARC. O principal escreverá a revisão integrada.
Não editar produto, ADRs, arquivos de configuração do projeto, qualquer .codex existente, hooks ou configuração do usuário. Estado descartável, drivers, sondas e evidências devem ficar na subpasta da célula; não gravar credenciais nos relatórios. Reutilização de código do kit ou node-pty é somente leitura. Não alterar artefatos alheios.
Usar edição nativa para criar drivers; não criar scripts via shell/context-mode. Execuções podem produzir seus próprios logs.
Não delegar ou administrar perfis.

## Células e aceitação

Sem TUI:
- A3: retomadas simultâneas e terceira retomada, três repetições se aceitas. Se houver recusa, registrar exatamente. Diferenciar ramo persistido de resposta do modelo.
- B2: turno real do modelo chama probe MCP e evidencia _meta.threadId contra ID nativo. Chamada direta App Server à ferramenta não substitui o turno.
- C2: codex resume e codex exec resume em diretório diferente; comprovar continuidade por marcador.
- D7: codex queue para sessão ociosa e ocupada, e codex agents. Registrar suporte real, entrega, novo turno espontâneo ou necessidade de entrada. Não extrapolar ausência de um comando para outros modos.
- E1: retomada sem supervisão encontra aprovação; detecção estruturada, estado e retomabilidade.
- E2: encaminhamento documentado e teste seguro de negar/permitir uma ação inofensiva circunscrita, sem política permissiva. Resposta automática do host é só a prova do mecanismo, não uma política humana.
- E4: launcher válido, thread/resume e turno real pelo App Server. Registrar ID, eventos e término.
- G1: sessão pequena, par quente e frio, latência e usage/custo por chamada. Medir tempo real e distinguir cache de prefixo compartilhado do conteúdo exclusivo da sessão. Usar prefixo de teste próprio. Retomada em até 30 s, depois 6 min e, se ainda quente, 65 min como no protocolo Claude, declarando intervalo observado e qualquer limite. Não criar sessão grande. Não inventar USD se o cliente não expuser custo; apresentar usage e estimativa identificada quando taxa oficial aplicável estiver disponível.

Com TUI real ConPTY, sem humano:
- A1: TUI ociosa contra retomada em outro processo; conferir o que a TUI observa depois.
- A2: alternância não interativa e TUI na mesma sessão, continuidade nos dois sentidos.
- B3: MCP entre abertura, ociosidade, limpeza suportada, compactação, reconexão e saída; IDs/PIDs e limites de cada evento. Não confundir slash command inexistente com prova executada.
- C1: wrapper com stdio herdado no mintty e controles Windows Terminal/PowerShell, conforme ferramentas já instaladas. ConPTY sozinho não prova mintty ou renderização visual. Wrapper termina com exit 0.
- D3: encerrar com waiter ativo, observar pai/filho e sobrevivência, limpar apenas próprios PIDs verificados.
- D6: fim de processo em background e eventual despertar espontâneo da TUI ociosa. Distinguir fim de processo de novo turno.

ConPTY deve usar SOMENTE node-pty 1.1.0 já instalado em C:\Users\junior\AppData\Local\Temp\marc-f0\PTY\node_modules\node-pty. Não instalar dependência.

## Segurança e validade

Não usar bypass, sandbox permissivo, --dangerously-bypass-approvals-and-sandbox, full-access ou equivalentes. Manter políticas restritivas e pedidos de aprovação. Não trocar política para contornar negação. Escalação do harness exige a aprovação nativa e não transforma uma operação negada em autorizada.
Nunca terminar processo por nome. Conferir PID, identidade e descendência dos processos próprios antes de terminar. Não tocar sessões de outras tarefas. Limpar apenas criações próprias conferidas; manter evidência sanitizada suficiente.
Nunca imprimir tokens, credenciais, ambiente completo ou linha de comando do MCP mARC. Inspeção de processos deve selecionar campos seguros, sem CommandLine de processos mARC. Usar somente probe isolado no teste.
TUI: texto e Enter separados por ~300 ms; prompt antes de flags variádicas; submissão, fim de turno e aprovação pelo rollout/transcript. Tela serve como proteção adicional. Com diálogo aberto ou suspeito, somente tecla exata da etapa; nunca texto ou Enter. Encerramento por PID verificado se não for seguro enviar comando.
Limitar cada tentativa com timeout explícito. Evitar loops de gasto, retries sem diagnóstico e sessões grandes. Relatar erro real em vez de mascarar como resultado positivo.

## Fluxo e entregáveis

Antes de qualquer edição ou sessão de teste, retornar OK_BOOTSTRAP: identidade do workspace, fontes lidas, regras críticas, configuração solicitada e efetiva quando verificável e fonte, escopo exato e estado dos alvos. Esperar autorização explícita do principal no canal interno.
Depois executar sequencialmente, com evidência por célula: versão real, comando reproduzível sanitizado, horários, saída, código de saída, IDs/PIDs pertinentes, usage/custo, classificação testado / testado com limite / limite declarado e impacto por fase. Modo não interativo nunca prova TUI.
Manter coordenação interna, sem diário em mensagens/artefatos. Reportar prontamente bloqueios, aprovação pendente ou estado incerto ao principal.
Ao terminar o escopo: publicar resultado-f0-codex.md com autoria própria por message_attach_artifact + message_post sob codex-dev nesta thread. Incluir limitações, limpeza e revisão integrada pendente; retornar ID da mensagem.
Relatório interno detalhado: caminhos alterados e referências, comandos e resultados reais, ledger por chamada sem dupla contagem, aprovações, sobras, documentação e limites. Não consolidar matriz geral nem fechar thread.
Principal revisará independentemente toda a evidência e devolverá correções ao mesmo executor antes de declarar aprovação.
