# Correção do teste de recuperação de lock stale

## Diagnóstico e objetivo
Após o reinício, o usuário reportou timeout no teste recovers a stale write lock before executing the writer. O teste usa timeoutMs 100; o core tem default 10.000 ms e sua política não foi modificada pela migração. Isolado, o arquivo passou 6/6; a suíte atual passou 226/226. Um diagnóstico em memória atrasando 120 ms apenas o mkdir do diretório de aquisição reproduziu o mesmo erro/stack: 5/6, com falha somente nesse caso. Isso demonstra dependência de latência de filesystem na fixture, embora o objetivo do teste seja recuperação funcional.

## Escopo e decisão
Alterar somente test/core-write-coordination.test.ts, no teste reportado: prazo de aquisição 100 para 5.000 ms; manter retryDelayMs 1 e staleAfterMs 10; verificar callback executado e lock removido após a liberação. Não relaxar o teste de timeout quando outro escritor mantém o recurso ocupado. Não mudar core, SDK, transporte, testes MCP, limites de produção, concorrência global, cliente ou configurações. Não ignorar casos nem adicionar retries.

## Execução delegada
Principal codex-software-architect; um desenvolvedor codex-dev, gpt-6-luna/xhigh, conforme confirmação humana vigente. Bootstrap independente obrigatório, fontes AGENTS/RULES/skill, este plano, teste e core readonly; retornar OK_BOOTSTRAP e aguardar autorização explícita. Snapshot do arquivo e hashes para verificar alcance do formatter; preservar trabalho existente. Sem Git. Manual edits via apply_patch.

## Aceite e validação
Arquivo isolado 6/6; mesmo diagnóstico de atraso 120 ms passa mantendo os testes de contenção/timeout; pnpm validate, pnpm build e pnpm test passam, sem skipped ou cancelled. Docs development/migration revisadas; sem mudança técnica esperada, porque só a fixture muda. Principal revisa diff pontual, semântica e evidências atuais após última mudança, e registra veredito substantivo em relatório consolidado.

## Limite operacional
Ferramentas mARC ausentes no conector desta sessão após restart. Bootstrap oficial via stdio moderno separado confirmou workspace marc-dd422176e1 e thread sem mensagens posteriores à entrega. Isso prova funcionamento do servidor, não conexão do host. Diagnóstico do cliente permanece separado, aguardando mensagem de startup do usuário. Thread aberta; sem rollback de compatibilidade.
