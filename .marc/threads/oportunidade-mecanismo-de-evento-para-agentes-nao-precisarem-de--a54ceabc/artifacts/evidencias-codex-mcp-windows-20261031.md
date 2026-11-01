# Evidências — sondagem Codex MCP e inicialização Windows

Data: 31/10/2026. Autor: codex-software-architect. Escopo: testes descartáveis de controle, sem implementação de produto.

## Método

[T] Sondagem com Node.js 22.20.0, stdio, windowsHide e shell:false. CODEX_HOME isolado sob Temp, sem copiar arquivos de autenticação ou configuração do usuário. MCP de teste com uma ferramenta somente de leitura, que reporta PID e quatro variáveis explicitamente permitidas. Não inspecionei nem registrei valores de credenciais; o launcher herdou seu ambiente normal.

[T] Métodos utilizados: initialize, initialized, thread/start com ephemeral, mcpServerStatus/list, mcpServer/tool/call e thread/unsubscribe. Não foi enviado turn/start. As chamadas diretas da ferramenta de teste permitiram conferir o _meta.threadId. Nenhuma notificação turn/started foi observada.

[T] Houve uma rodada inicial na instalação npm 0.166.0 e uma na versão 0.161.0; depois a associação do valor de _meta.threadId foi confirmada novamente em ambas. Os dados abaixo usam as rodadas finais para identidade e a rodada inicial para a matriz de launcher.

[T] O ancestral do context-mode desta conversa é um App Server 0.161.0, enquanto o npm no PATH é 0.166.0. A versão da CLI no PATH não foi tomada como versão do host deste chat.

## Resultado sanitizado

[T] IDs nativos efêmeros foram substituídos por A/B. O campo metaThreadIdMatches foi calculado comparando o valor recebido pelo MCP com thread/start na respectiva rodada. PIDs são observações históricas, não instruções para limpeza.

```json
{"date":"2026-10-31","launcherChecks":[{"name":"bare-no-shell","error":"ENOENT","status":null},{"name":"cmd-no-shell","error":"EINVAL","status":null},{"name":"cmd-with-shell","error":null,"status":0,"stdout":"codex-cli 0.166.0"},{"name":"node-launcher-no-shell","error":null,"status":0,"stdout":"codex-cli 0.166.0"},{"name":"native-no-shell","error":null,"status":0,"stdout":"codex-cli 0.166.0"}],"mcpTests":[{"runtime":"codex-cli 0.161.0","mcpProcesses":[{"thread":"A","pid":13784,"parentPid":3456,"metaThreadIdMatches":true,"environment":{"CODEX_THREAD_ID":null,"CODEX_SESSION_ID":null,"CODEX_HOME":null,"CLAUDE_CODE_SESSION_ID":null}},{"thread":"B","pid":15272,"parentPid":3456,"metaThreadIdMatches":true,"environment":{"CODEX_THREAD_ID":null,"CODEX_SESSION_ID":null,"CODEX_HOME":null,"CLAUDE_CODE_SESSION_ID":null}}],"snapshots":[{"state":"catalog-no-thread","livePids":[]},{"state":"A-loaded","livePids":[13784]},{"state":"A-B-loaded","livePids":[13784,15272]},{"state":"two-seconds-after-unsubscribe-A","livePids":[13784,15272]},{"state":"after-appserver-exit","livePids":[]}],"catalogProcesses":6,"turnStartedNotifications":0,"appServerExit":{"code":0,"signal":null}},{"runtime":"codex-cli 0.166.0","mcpProcesses":[{"thread":"A","pid":36668,"parentPid":8940,"metaThreadIdMatches":true,"environment":{"CODEX_THREAD_ID":null,"CODEX_SESSION_ID":null,"CODEX_HOME":null,"CLAUDE_CODE_SESSION_ID":null}},{"thread":"B","pid":35044,"parentPid":8940,"metaThreadIdMatches":true,"environment":{"CODEX_THREAD_ID":null,"CODEX_SESSION_ID":null,"CODEX_HOME":null,"CLAUDE_CODE_SESSION_ID":null}}],"snapshots":[{"state":"catalog-no-thread","livePids":[]},{"state":"A-loaded","livePids":[36668]},{"state":"A-B-loaded","livePids":[36668,35044]},{"state":"two-seconds-after-unsubscribe-A","livePids":[36668,35044]},{"state":"after-appserver-exit","livePids":[]}],"catalogProcesses":6,"turnStartedNotifications":0,"appServerExit":{"code":0,"signal":null}}],"limits":["Only control RPCs and direct MCP tool calls; no model turn or TUI trial","2 seconds observation after unsubscribe; no unload grace measured","Isolated CODEX_HOME caused helper-alias warning under Temp; no file/shell tool trial","All MCP identity fields observed through explicit probe only; no general guarantee for other clients/versions"]}
```

## Alcance

[T] Cada rodada final criou dois MCPs persistentes distintos para A/B e quatro processos transitórios de descoberta. A chamada de ferramenta retornou o PID persistente correspondente. Não havia ID nativo nas variáveis de ambiente sondadas. Dois segundos após unsubscribe, ambos os processos persistentes ainda estavam vivos; depois da saída do App Server, todos estavam encerrados.

[D] A documentação atual de App Server descreve descarregamento de thread após período de inatividade sem assinante; o teste não mediu esse prazo. Fonte: https://developers.openai.com/codex/app-server

[I] Isso não estabelece uma duração universal do processo, nem prova compartilhamento/isolamento em todos os modos da TUI, IDE, SDK ou MCP remoto. Não foi testado um turno de modelo, sessão interativa ociosa contra retomada ou injeção de evento neste chat.

[T] O CODEX_HOME sob Temp gerou aviso de recusa de criar aliases de helpers naquele diretório. Versionamento, protocolo e ferramenta de sondagem funcionaram; execução de shell/file tools e paridade da instalação não foram testadas.

## Preservação

[T] Os App Servers de teste encerraram com exit 0; os drivers terminaram com exit 0; não houve processo encerrado por nome. O diretório temporário exclusivo foi resolvido, comparado ao caminho autorizado e verificado sem reparse points. Remove-Item removeu apenas esse diretório; Test-Path retornou False. Não restou processo próprio ativo segundo os snapshots e o encerramento dos drivers.
