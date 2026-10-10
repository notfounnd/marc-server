# Análise: corrida de startup no teste de auto-idle

## Conclusão e encaminhamento

A falha fetch failed é causada por uma corrida entre a primeira conexão HTTP e o encerramento por auto-idle configurado em 20 ms. A corrida foi reproduzida no teste original e rastreada no daemon sem importar Toast/Base UI. O problema está no requisito temporal do teste de auto-idle, fora da migração da thread 594973bb. Registrar correção separada; nenhuma mudança no daemon ou teste foi feita nesta investigação.

A investigação anterior apenas repetira a suíte e não estabelecera causa. Esta análise substitui aquele estado inconclusivo com reprodução e controle. Não afirma que falhas históricas já haviam sido observadas: não houve execução completa imediatamente antes da migração. Demonstra que a falha atual é reproduzível no caminho de daemon inalterado, sem executar código novo de notificações.

## Contexto, contrato e fontes

Origem: marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb. O usuário determinou analisar a causa, corrigir na demanda caso derivasse da migração, ou registrar uma thread com análise se fosse outro problema.

Workspace marc-dd422176e1, C:\Projetos\marc. Principal codex-software-architect, gpt-6.1-sol/high humano-confirmado. Bootstrap e regras vigentes, marc-ops e systematic-debugging aplicados. Investigação e comandos revisados via context-mode, usando Bash, sem Git, PowerShell ou mudança de configuração. memory_recall não retornou correspondência; índice informou stale. Não foi realizado rebuild de memória fora desta demanda.

Fontes: src/daemon/server.ts:23-30 e :153-160; src/daemon/leases.ts:58-83; test/daemon-runtime.test.ts:114-133; teste anterior de status foreground; scripts package.json; baseline de hashes anterior à migração; relatórios das execuções anteriores e reprodução nova.

## Mecanismo identificado

1. createDaemonServer registra startedAt e lastExternalActivityAt na criação. No modo detached, instala o timer de auto-idle antes de devolver o servidor e antes de server.listen.
2. installAutoIdleShutdown usa setInterval com intervalo min(autoIdleMs, 30000). Ao vencer o limite sem lease ou cliente de eventos, chama server.close.
3. O teste configura autoIdleMs 20, abre a porta e exige status HTTP 200 antes de aguardar close.
4. A abertura da porta e a primeira conexão em processo frio podem consumir esse intervalo. O timer fecha o servidor antes de o handler receber a requisição. O fetch então falha com ECONNRESET ou ECONNREFUSED.
5. Testes HTTP anteriores no mesmo arquivo inicializam o caminho de conexão. Isso reduz a janela de startup, mas não garante que toda execução sob carga termine dentro de 20 ms. O teste completo pode passar e o subteste sozinho falhar.

O comportamento de encerrar um daemon sem atividade é o objetivo do teste. A condição frágil é exigir que uma requisição real vença esse prazo minúsculo. Aquecer transporte não é a correção recomendada; foi um controle diagnóstico.

## Evidência de reprodução e controle

Ambiente confirmado: Node 22.20.0, pnpm 10.10.0, tsx 4.21.0 instalado.

### Teste original, sem alterações e sem novo teste de notificações

Comando Bash:

```bash
node --test --import tsx --test-name-pattern='detached daemon auto-idles' test/daemon-runtime.test.ts
```

Oito processos novos, executados sequencialmente: 8/8 falhas, exit 1 em todas, fetch failed em test/daemon-runtime.test.ts:127. Durações do subteste: 45.5539, 39.9357, 39.826, 75.2735, 64.286, 168.9106, 81.6135 e 47.9959 ms. Não há execução de ui-notifications.test.ts nesse comando.

Fonte context-mode: ORIGINAL_TEST_COLD_RUNS.

### Rastreamento causal sem atraso artificial

Harness temporário importa somente config.ts e server.ts. Registra a chamada original de close, timer, listen, fetch e recepção de request; não muda os módulos do repositório nem a política de encerramento.

Uma execução sem atraso acrescentado apresentou:

| Evento | Tempo desde início do cenário |
| --- | --- |
| createDaemonServer resolvido | 15.07 ms |
| listen resolvido | 40.19 ms |
| fetch iniciado | 40.20 ms |
| chamada fetch devolveu promise | 46.52 ms |
| timer de 20 ms executou | 47.03 ms |
| server.close chamado por leases.ts:76 | 47.34 ms |
| evento close | 49.13 ms |
| fetch falhou, ECONNRESET | 52.43 ms |

Nenhum evento HTTP request received ocorreu nessa execução. Nas duas execuções seguintes do mesmo processo, a abertura e conexão foram mais rápidas, a requisição chegou e retornou 200 antes do fechamento.

Outro controle com atraso explícito de 35 ms e limite de 20 ms falhou 3/3 com ECONNREFUSED. Mantendo o atraso e aumentando apenas o limite para 200 ms, passou 3/3. O aumento foi feito apenas no harness; não é proposta de correção por aumento arbitrário do prazo.

Fontes context-mode: Auto idle instrumented reproduction no Toast; Auto idle trace fetch cold synchronous cost.

### Controle de inicialização HTTP

Preload temporário cria um servidor HTTP nativo, faz uma requisição, consome resposta e fecha o servidor antes de iniciar o teste original. Não importa qualquer componente de UI:

```bash
node --test --import tsx --import file:///C:/Users/junior/AppData/Local/Temp/marc-warm-http.mjs --test-name-pattern='detached daemon auto-idles' test/daemon-runtime.test.ts
```

Oito processos novos: 8/8 aprovados, exit 0 em todas. Única variável do controle: uma troca HTTP completa antes do teste original. Fonte context-mode: ORIGINAL_TEST_WARM_HTTP_RUNS.

Um controle intermediário que inicializava somente fetch usando uma URL data passou 5/8 e falhou 3/8. Portanto, não atribuir a causa exclusivamente à inicialização de fetch: o caminho de listen/conexão também participa do custo de startup. A primeira tentativa desse preload usou um specifier Windows inválido para --import e não carregou o teste; aqueles erros de setup foram descartados.

## Relação com a migração

O principal percorreu os imports/exports estáticos relativos de config.ts e server.ts: 59 arquivos, nenhum arquivo de UI ou components, e imports externos estáticos somente node:*. Hashes dos 59 arquivos são idênticos ao baseline anterior à migração. test/daemon-runtime.test.ts também permanece idêntico. Os módulos novos do Toast, seu adaptador e Base UI não pertencem a esse grafo.

A suíte foi alterada pela adição de um teste e pela troca Sonner/Base UI, mas o novo teste não é necessário para produzir a falha: o comando focal original falhou 8/8 sem executá-lo. O timer, o requisito de 20 ms e a inicialização HTTP nativa explicam a reprodução diretamente. Não há correção indicada no Toast.

Limites: não foram reinstaladas dependências antigas, revertido workspace ou simuladas todas as condições de carga da suíte. Não se afirma conhecer o instante exato de cada falha anterior sem trace. A ordem fechamento-before-request está comprovada na reprodução que apresenta o mesmo erro e a mesma origem de auto-idle.

## Correção recomendada e critérios

Escopo inicial proposto: test/daemon-runtime.test.ts. Separar a prova de desligamento da exigência de uma primeira resposta HTTP dentro de 20 ms. Registrar o observador de close antes de iniciar o servidor, comprovar que o servidor abriu e aguardar seu encerramento com limite de teste explícito. A verificação de resposta /api/status já possui cenário separado. Se for indispensável verificar status no cenário de auto-idle, usar controle explícito do relógio ou estado de atividade; não aumentar prazo nem inserir warmup/retry para ocultar a corrida.

Critérios para a correção futura:

- Cenário de auto-idle passa sozinho em processos novos e junto ao arquivo completo.
- Preserva a prova de encerramento sem leases/clientes/atividade.
- Não depende de testes anteriores, aquecimento HTTP ou resposta em menos de 20 ms.
- Falha de encerramento produz erro limitado pelo timeout, sem pendurar a suíte.
- pnpm validate, pnpm build e pnpm test passam; revisão integrada confere a robustez do teste.
- Nenhuma mudança de política de runtime deve ser incluída sem requisito e evidência próprios.

Estado da investigação original: análise concluída e correção então pendente nesta thread separada. O usuário pediu registro separado para problema fora da demanda; não foi implementada correção fora do Toast naquela investigação. O principal revisou o mecanismo, a ordem dos eventos, os controles e os hashes; o encaminhamento foi aprovado como análise.

Atualização de 2026-10-09 após solicitação de implementação: a correção foi realizada somente no cenário de test/daemon-runtime.test.ts e aprovada tecnicamente pelo principal. Observa abertura/close sem fetch, preserva autoIdleMs 20 e usa watchdog de 5000 ms com limpeza. Oito processos novos, arquivo completo 6/6 e suíte 210/210 passaram; controles negativos confirmaram timeout e cleanup. Plano e avaliação integrada estão em plano-correcao-auto-idle.md e atividade-correcao-auto-idle.md, anexados nesta thread. A thread permanece aberta para revisão humana.

## Evidência operacional preservada

Scripts diagnósticos no Temp, criados com native apply_patch:

- C:\Users\junior\AppData\Local\Temp\marc-auto-idle-diagnostic.mjs
- C:\Users\junior\AppData\Local\Temp\marc-warm-http.mjs
- C:\Users\junior\AppData\Local\Temp\marc-warm-fetch.mjs

Nenhum arquivo de implementação da migração ou do daemon foi editado nesta investigação. Não há comando ou aprovação pendente. Thread permanece aberta.

Cópias duráveis anexadas nesta thread: artifacts/repro-auto-idle.md e artifacts/warm-http.md, com os scripts em blocos de código. Cópias executáveis repro-auto-idle.mjs e warm-http.mjs estão preservadas no mesmo diretório. O primeiro contém a instrumentação e os controles de prazo; o segundo contém somente o preload HTTP nativo. Para repetir o controle, substituir o caminho temporário do comando --import pelo file:/// correspondente ao warm-http.mjs desta thread. Metadata da mensagem de entrega foi corrigida para apontar às cópias Markdown compatíveis com o catálogo de artefatos; identidade, autoria e corpo da mensagem foram preservados.
