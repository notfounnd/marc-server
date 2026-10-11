# Plano aprovado: migração do mARC para MCP 2026-07-28

## Resumo e decisões confirmadas
Atender exclusivamente 2026-07-28 pelo transporte MCP stdio. O usuário confirmou duas vezes a retirada da compatibilidade legacy e solicitou implementação do plano em 2026-10-10. Depois de build e revisão, o principal apresenta as configurações locais a atualizar e pede reconfiguração/reinício ao usuário; após restart, retoma a verificação do processo real. Não reiniciar durante a implementação.

Manter Node >=22 e pnpm 10.10.0. SDK server/client 2.3.1 e Zod 4.6.5 foram confirmados no registro oficial durante o planejamento. Versão do produto: 0.3.0. Identidade MCP usa a versão real do package.json, sem constante divergente.

## Fontes e baseline
Thread fonte: marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787/#msg_f9e6c3bf4f984fe19e e seu anexo oportunidade-revisao-mcp-2026-07-28.md.
Lidos por context-mode: README, docs/architecture.md, docs/mcp-tools.md, docs/development.md, docs/agent-workflows.md, docs/harness-engineering.md e ADRs 0001, 0003, 0004, 0007 e 0008. Histórico consultado via memory_recall e thread_read: 58458a82 (reuso do bootstrap). Thread relacionada 2f441fa7 lida, sem incorporar implementação de summaries.

Baseline: SDK instalado 1.29.0, declaração ^1.17.5, protocolo máximo 2025-11-25, Zod ^3.25.0, 24 tools. Servidor anuncia 0.1.0 enquanto pacote é 0.2.0. Os testes MCP atuais acessam _registeredTools e chamam handlers privados, sem demonstrar conformidade wire. pnpm typecheck e os 18 testes MCP selecionados passaram no planejamento.

## Matriz normativa e evidências de aceite
| Superfície | Obrigação e fonte | Baseline e responsável | Correção e teste |
| --- | --- | --- | --- |
| Versão/metadados | MUST declarar versão e capabilities por requisição; versão não suportada retorna -32022 com requested/supported. basic/versioning e basic/index | SDK v1 usa initialize; SDK fornece validação wire | SDK oficial v2, versões suportadas apenas 2026-07-28; verificar metadados ausentes/malformados e versão inválida sem efeitos colaterais |
| Descoberta | MUST implementar server/discover; cliente MAY chamar antes das demais RPCs. server/discover | Ausente na era atual; responsabilidade SDK | Testar descoberta e chamada direta moderna sem descoberta prévia; verificar capabilities e identidade |
| Legacy | Suporte dual-era MAY; modern-only SHOULD anunciar versões no erro de initialize. basic/versioning | Comportamento atual legacy; mudança de produto aprovada | serveStdio(factory, {legacy:'reject'}); rejeição explícita de initialize e recuperação por abertura moderna no mesmo canal quando SDK permitir |
| stdio | MUST UTF-8/JSON-RPC válido por linha; stdout exclusivo; logs em stderr; nenhuma request servidor-cliente moderna. basic/transports/stdio | server.connect(StdioServerTransport); SDK cuida framing | Usar serveStdio; probes por subprocesso compilado; inspeção stdout e encerramento por EOF |
| Tools | MUST declarar tools, validar entradas, manter catálogo independente de conexão; ordem determinística SHOULD. server/tools | 24 registros .tool com shapes Zod 3; SDK e aplicação | registerTool com z.object e Zod 4.6.5; preservar nomes/argumentos/defaults; testes catálogo antes/depois bootstrap, clientes distintos e reinício |
| Schemas/resultados | Input schema MUST objeto JSON Schema válido; default 2020-12. Resultado MUST resultType; outputSchema é opcional. basic/index, server/tools | Texto JSON com envelope de aplicação; SDK normaliza wire | Preservar content textual; SDK produz resultType e serverInfo; não declarar outputSchema sem structuredContent correspondente; validar resultados no canal |
| Cache | MUST ttlMs >=0 e cacheScope em discover/list completos. server/utilities/caching | Sem hints explícitos na era atual; SDK oferece cacheHints | ttlMs:0/cacheScope:private explícitos em discover e tools/list; testar wire. Não confundir com TTL de modelos memory |
| Falhas | JSON-RPC para envelope/método/tool desconhecida; isError para falhas de execução. server/tools | Bootstrap bloqueado é texto sem isError; exceções chegam ao SDK | isError no bootstrap_required; manter envelope original; erros de domínio acionáveis e sanitizados. SDK decide falha de schema de tool segundo seu contrato oficial |
| Segurança | MUST validar entradas, access controls, rate limit e sanitizar resultados. server/tools | Paths/core existentes; nenhum limite explícito no MCP | Guard compartilhado: 60 chamadas por janela fixa de 1s/processo para todas as tools; sem fila; limite rejeita antes do domínio com isError e code rate_limited/retryAfterMs; não revelar tokens/stacks/corpo bruto de erro do daemon |
| Cancelamento | stdio usa notifications/cancelled; receiver SHOULD parar recursos; cancelamento é best effort. basic/patterns/cancellation | SDK e workers/locks existentes | SDK lida com cancelamento wire; observar signal antes de iniciar domínio; não desfazer commit ou matar worker compartilhado. Testar cancelamento/desconexão e íntegra dos arquivos/locks |
| Encerramento | Fechar stdio e liberar recursos da conexão. SDK serving/stdio | Heartbeat retorna timer e instala handlers de processo | Cleanup idempotente vinculado ao fechamento EOF/sinais, sem aguardar rede indefinidamente; testes heartbeat e término sem timer órfão |
| Features opcionais | Recursos/prompts/progresso/subscriptions/tasks/MRTR apenas se usados | Aplicação não usa recursos/prompts/sampling/roots/logging MCP ou tasks | Não adicionar uso novo. Capabilities verdadeiras; mecanismo de subscriptions/notificações que o SDK declarar deve estar suportado por ele. HTTP MCP/auth não aplicáveis ao servidor stdio; UI SSE permanece API própria |

Fontes:
- https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
- https://modelcontextprotocol.io/specification/2026-07-28/basic/index
- https://modelcontextprotocol.io/specification/2026-07-28/server/discover
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio
- https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching
- https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation
- https://modelcontextprotocol.io/specification/2026-07-28/deprecated
- https://github.com/modelcontextprotocol/specification/blob/main/schema/2026-07-28/schema.ts
- https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2
- https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28.html
- https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html

## Handoff atômico: integração MCP moderna e testes
Objetivo: produzir uma integração única, funcional e revisável do MCP moderno, incluindo dependências, wiring, contratos, lifecycle, testes e documentação. Não separar a troca de SDK de seus testes e registros; estas partes são dependentes.

Perfil principal: codex-software-architect. Perfil desenvolvedor: codex-dev. Configuração solicitada: gpt-6-luna/xhigh. O usuário confirmou reasoning efetivo do principal >=medium e desenvolvedor gpt-6-luna/xhigh; a seleção de spawn é evidência solicitada, não introspecção runtime. Um desenvolvedor ativo por vez, conforme trial sequencial vigente.

Escopo autorizado:
- package.json e pnpm-lock.yaml.
- src/mcp/server.ts, responses.ts, memory-tools.ts, daemon.ts, types.ts, helper.ts.
- Novos módulos em src/mcp/: tool-registration.ts, workspace-tools.ts, thread-tools.ts e agent-tools.ts, somente se necessários para manter limite de 300 linhas e responsabilidades legíveis.
- test/mcp.test.ts, mcp-agent.test.ts, mcp-memory.test.ts; novos test/mcp-*.ts para helpers/protocolo/lifecycle/segurança.
- README.md; docs/architecture.md, mcp-tools.md, development.md e novo mcp-migration-2026-07-28.md.
- dist/** como saída de pnpm build, não edição manual.

Exclusões: src/core/**, src/ui/**, src/daemon/**, schemas/motor de memory, summaries, hooks/configurações proprietárias, catálogo de perfis, mudanças em AGENTS/RULES/INSTRUCTIONS/skill gerenciada. Se implementação demandar ampliar escopo, comunicar ao principal antes de editar. Sem Git, worktrees, commits ou limpeza global; preservar trabalho existente.

Antes de editar, desenvolvedor faz bootstrap próprio, lê skill marc-ops, contrato completo, AGENTS e fontes aplicáveis; devolve OK_BOOTSTRAP com workspace, fontes, regras críticas, configuração solicitada/efetiva e fonte de confirmação, escopo e status dos arquivos. Espera autorização explícita do principal no canal agente-agente.

Passos:
1. Inventariar arquivos alvo e dependências via context-mode; escrever testes/probes que falham com a baseline para abertura moderna, legacy rejeitada, identidade, cache e isError.
2. Atualizar dependências e registros, usar transporte oficial, restringir supportedProtocolVersions no servidor a ['2026-07-28'], preservar contratos de aplicação e montar controles compartilhados de invocação.
3. Ajustar cleanup da conexão/heartbeat; testes com stream/subprocesso e daemon fake. Nenhum teste toca memory real ou baixa modelos.
4. Migrar testes atuais para chamada pública Client/transport, sem depender de _registeredTools ou do formato interno SDK. Testes de schema consultam tools/list.
5. Documentar novo contrato e migração; manter conteúdo técnico en-US e comunicação pt-BR.
6. Rodar verificações; auto-revisar; devolver relatório consolidado ao principal.

## Validação e revisão
Checks obrigatórios: pnpm validate, pnpm build, pnpm test. validate executa fixes; verificar seu alcance antes e inspecionar arquivos afetados via context-mode. Não reverter indiscriminadamente mudanças de formato. Se houver conflito de escopo, parar somente aquela mudança e comunicar ao principal.
Probes executam dist/cli.js mcp com workspace temporária, metadados modernos e cliente independente. Assertar catálogo completo, identidade package.json, bootstrap, escrita/leitura de mensagem/artifact e proteção de path, incompatibilidade legacy, malformed metadata, rate limit, EOF e cancelamento.
Principal revisa todo o estado final autorizado, arquitetura, aceitação, evidências reais, documentação e efeitos colaterais; devolve findings ao mesmo desenvolvedor e reavalia após correções. Consolidar fontes/linhas/verificações/findings/limites e veredito aprovado, pendente ou rejeitado em artifact de atividade final. Sem diários e sem registrar cada handshake.

## Reconfiguração, retomada e limites
Após aprovação técnica e testes do binário compilado, principal inspeciona de forma sanitizada as configurações locais relevantes; não altera configurações globais. Entrega instruções concretas de mudança/reinício ao usuário. Smoke em sessão reiniciada confirma processo efetivo e contrato MCP; isto é checkpoint pendente até a ação humana.
Manter thread aberta. Não publicar no npm e não encerrar thread. Apenas registrar decisões materiais e entrega consolidada via tools oficiais, com metadata, referências raw marc:// e audit scope messages antes do resumo final.
Nenhuma pergunta de produto pendente; reconfiguração/reinício dependem da ação humana após build.
