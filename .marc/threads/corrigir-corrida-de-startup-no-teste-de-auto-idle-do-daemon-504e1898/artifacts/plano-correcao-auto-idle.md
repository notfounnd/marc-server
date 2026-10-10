# Plano: corrigir corrida no teste de auto-idle

## Objetivo e decisão

Corrigir somente test/daemon-runtime.test.ts para comprovar abertura e encerramento automático sem atividade, sem depender da primeira conexão HTTP dentro de 20 ms. Plano aprovado e execução solicitada pelo usuário em 2026-10-09. Nenhuma decisão pendente.

A análise anexada reproduziu a corrida do teste original. Prova de viabilidade em memória pelo principal: cenário sem fetch passou em 8/8 processos novos; impedindo o fechamento, timeout de 5 segundos falhou e context.after executou a limpeza. Não houve edição de arquivo de projeto nessa prova.

## Fontes e contrato

Thread 504e1898 e seus artefatos analise-corrida-auto-idle.md, repro-auto-idle.md e warm-http.md; thread histórica de lifecycle 39436d9c lida após memory_recall; test/daemon-runtime.test.ts; src/daemon/server.ts e leases.ts; README, AGENTS.md, marc-ops, docs/agent-workflows.md, docs/ui-and-daemon.md e ADR 0001. Contrato completo de bootstrap e Custom Rules vigentes. Documentação oficial Node 22 consultada via context-mode para timeout e context.after; APIs verificadas também nas declarações instaladas e na prova de execução.

## Tarefa delimitada

Único path de implementação autorizado: test/daemon-runtime.test.ts, somente o cenário detached daemon auto-idles when there are no leases, UI clients, or activity.

- Preservar o nome do cenário, mode detached, port 0 e autoIdleMs 20.
- Usar a opção timeout: 5000 de node:test e receber context.
- Após criar o servidor, registrar context.after para chamar server.close, garantindo limpeza em falha ou timeout.
- Criar Promise<void> com server.once("close", resolve) antes de listen.
- Chamar o helper listen existente, sem usar sua URL para requisição.
- Verificar server.listening true após listen, aguardar a Promise de close e verificar server.listening false.
- Remover desse cenário fetch /api/status, headers e asserção HTTP 200. A cobertura de status em outros cenários permanece.
- Não adicionar helpers, imports, dependências, warmup, retries, sleeps ou aumento do prazo de auto-idle.
- Nenhuma mudança no daemon, Toast, modais, config, docs de produto ou outro teste. Se houver conflito, informar ao principal antes de ampliar escopo.

O principal mantém os artefatos operacionais de plano e atividade nesta thread. Documentação técnica revisada: nenhuma atualização necessária, pois o runtime não muda. Código e texto do teste em en-US; comunicação e registros mARC em pt-BR. Native apply_patch para edição manual; context-mode e Bash para inspeção/checks; nenhum comando Git.

## Execução e aceite

1. Registrar plano com metadata, atualizar recomendações e auditar preflight.
2. Desenvolvedor bootstrapa independentemente, lê fontes e retorna OK_BOOTSTRAP antes de editar. Principal verifica configuração, fontes, regras, identidade e estado; autoriza pelo canal entre agentes.
3. Observar RED do teste original em processo frio antes de editar. Se passar uma tentativa, repetir até oito processos e registrar o resultado real; não usar warmup.
4. Implementar a alteração definida. Executar o cenário corrigido em oito processos novos e o arquivo completo, sem depender de testes anteriores.
5. Fazer controle negativo temporário em memória, sem editar runtime: impedir fechamento automático, comprovar falha pelo timeout de 5000 ms, execução da limpeza e saída do processo. Não criar teste permanente que espelhe a implementação.
6. Executar pnpm validate, pnpm build e pnpm test sequencialmente. validate inclui fix/write: inspecionar efeitos e informar ao principal qualquer path fora do escopo; preservar trabalho existente.
7. Entregar linhas alteradas, evidências reais/rotuladas de comandos, documentação e limitações. Principal revisa todo o resultado integrado, confere escopo por hashes, repete verificações afetadas quando necessário e consolida avaliação com veredito.
8. Auditar mensagens após metadata em lugar e apresentar resultado ao usuário. Thread permanece aberta até autorização humana de encerramento.

Aceite: o cenário corrigido passa sozinho em oito processos novos e no arquivo completo; falha de auto-idle não pendura a suíte; checks padrão aprovados; somente o path autorizado foi alterado; não há mudança de contrato de runtime.

## Configuração e delegação

Principal codex-software-architect, gpt-6.1-sol/high, e desenvolvedor compartilhado codex-dev, gpt-6-luna/xhigh: configurações já confirmadas pelo humano nesta sessão e reutilizadas. Confirmar a instância selecionada no OK_BOOTSTRAP, sem inventar introspecção. Limite vigente de um desenvolvedor sequencial. Desenvolvedor não delega nem administra perfis. Aprovação técnica e aceite/fechamento humano permanecem separados.

