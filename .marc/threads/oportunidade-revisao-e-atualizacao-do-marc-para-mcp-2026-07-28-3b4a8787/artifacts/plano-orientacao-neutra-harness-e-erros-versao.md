# Plano aprovado — documentação neutra e orientação em erros MCP

## Vínculo, objetivo e decisão humana

Complemento da task 3b4a8787, aprovado pelo usuário com "Implement the plan." após o plano apresentado nesta conversa. Manter o mARC independente do harness e tornar os erros de versão mais úteis. A decisão anterior permanece: somente MCP 2026-07-28, sem compatibilidade legada.

O contrato atual é marc-dd422176e1 em C:\Projetos\marc. A thread foi lida incrementalmente a partir de msg_7cbb76b24d5242d9a2, sem novas mensagens. Recomendações atuais. memory_recall foi consultado durante a análise, sem resultados relevantes.

## Fontes e escopo autorizado

Ler AGENTS.md, skill marc-ops, contrato completo de bootstrap, README, docs/agent-workflows.md, docs/harness-engineering.md, ADRs aplicáveis e este plano. Consultar o guia de migração, src/mcp/server.ts, os dois testes abaixo e test/mcp-process.ts. O SDK instalado 2.3.1 permite fornecer transport a serveStdio; StdioServerTransport.send recebe JSONRPCMessage e retorna Promise<void>. O callback onerror é apenas diagnóstico e não altera a resposta enviada. A rejeição inicial do SDK e a rejeição do mARC passam pela mesma saída do transporte.

Alterar exclusivamente:
- docs/mcp-migration-2026-07-28.md
- src/mcp/server.ts
- test/mcp-protocol.test.ts
- test/mcp-version-pin.test.ts

Não alterar configurações locais ou globais, dependências, node_modules, código de lock, ferramentas mARC, catálogo de perfis, CLI, API do daemon ou regras. Sem Git e sem reiniciar processos existentes. Usar native apply_patch. Registros oficiais deste complemento serão publicados pelo principal através das ferramentas mARC.

## Documentação

Substituir a seção "Codex CLI 0.162.1 and modern stdio" por uma seção geral de configuração do harness. Em en-US, declarar:
- mARC exige MCP 2026-07-28.
- Consultar documentação oficial do próprio harness para suporte da versão instalada, configurações e atualização.
- Configuração pode habilitar suporte existente, mas não adicionar suporte ausente.
- Reiniciar o cliente após alterar sua configuração.
- Falhas anteriores ao catálogo podem aparecer apenas em warnings ou logs, sem chegar ao agente.

Remover dessa seção flags, variáveis e referências de implementação específicas do Codex. Preservar os exemplos gerais de inicialização do mARC e todas as configurações locais já funcionais.

## Implementação do diagnóstico

Adicionar subclasse interna de StdioServerTransport em src/mcp/server.ts, sem export público. Usá-la em runMcpServer e fornecer a mesma instância a serveStdio. Sobrescrever apenas send, delegando ao método público original e preservando semântica de Promise/rejeição.

Para resposta JSON-RPC com error.code -32022, copiar a mensagem e error, acrescentando à mensagem original, com um espaço e somente uma vez:
"mARC supports MCP 2026-07-28 only. Check your agent harness documentation for protocol support and any required configuration or upgrade."

Derivar a revisão exibida de SUPPORTED_PROTOCOL_VERSIONS. Preservar jsonrpc, id, código, data e quaisquer outros campos; não acrescentar campo novo a data. As demais mensagens passam sem alteração. Não modificar classificação de entrada, lifecycle, legacy reject, cleanup ou operações de domínio. Guards planos e early returns; sem else ou if aninhado. Respeitar limite de linhas efetivas.

## Testes e aceite

Reutilizar subprocessos e matriz source/dist:
- initialize legado: orientação presente uma vez, código -32022, id e data preservados; abertura moderna seguinte funciona.
- server/discover sem revisão e com revisão incompatível: orientação presente.
- tools/list e tools/call incompatíveis após conexão válida: orientação presente uma vez, id/data preservados e nenhuma operação executada.
- Metadata inválida e erros de outros códigos não recebem orientação de versão.
- Notificações incompatíveis continuam sem resposta e sem efeitos; requisições válidas continuam funcionando.
- Executar source e dist no estado compilado final, sem skips desses cenários.

Estender testes existentes para verificação no wire; não exportar implementação apenas para testar nem criar testes que espelham o helper. Demonstrar falha dos novos asserts no comportamento anterior e sucesso após implementação.

Rodar testes direcionados antes dos checks completos. Comandos finais: pnpm validate, pnpm build, pnpm test. validate executa autofix; fazer snapshot anterior dos arquivos existentes, inspecionar efeitos e reportar imediatamente qualquer alteração fora do escopo. Não reverter trabalho preexistente nem repetir checks sem nova alteração, falha ou dúvida concreta.

## Execução e revisão

Uma tarefa atômica para um developer por vez, reutilizando perfil codex-dev e runtime já disponível. Configuração gpt-6-luna/xhigh previamente confirmada pelo humano permanece válida para a implementação limitada. Antes de editar, o developer confirma bootstrap independente, fontes, regras, escopo, hashes existentes e configuração; aguarda autorização explícita do principal.

Retornar caminhos, linhas, resumo, evidência RED/GREEN, comandos com exit/resumo, comparação de escopo e limites. O principal revisa independentemente todo o estado integrado, incluindo documentação, comportamento, contrato, arquitetura, regras e validação. Corrigir achados no mesmo canal de agentes e reassessar após qualquer mudança.

Consolidar execução e revisão substantiva com veredito em um artifact final. Auditar artifacts/messages após metadata pertinente. A orientação é entregue ao harness; não há promessa de apresentação ao agente. Thread permanece aberta.

## Baseline sensível conferido pelo principal

server.ts: 9b6a18580a78929756d866d9d5a252c158dd358b2d806e668248dd8960f81f84
guia: 6588b01e1f48681bf7d73218ab29b6bee91f452291cd1eb1f55c85420466f7d8
mcp-protocol.test.ts: 02a7255fbbccacb426fa5c55bd7730b83ea01072f87fbbd3c0c92272d18f19c0
mcp-version-pin.test.ts: 4a02c422980ac9863422152763722fc47941e7f623e729aff8a4b054cdee0adf
.codex/config.toml: 8c3c4b2cba9d4d72dc7e3e994ad3553765f5ba98b4e4d3d27450cb8d435543e5
.mcp.json: 8864a834d81894639ca6202a5239164fcd28f1142d089568b4a2fa83fdac2511
.vscode/mcp.json: f327e1b0cf551cea39c08ca73a7d754f53ac9f6eaa836960a157eaf750675322
package.json: f4d1b61ded3db77cb64753b150012b5f9455ae162f075fa98afbd069e6684124
pnpm-lock.yaml: f497890acaf06c6327fa8c1b5ef66719daf199f06cc9bc4b2fd59583bb8ff60f
