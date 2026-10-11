# Entrega e revisão integrada: migração para MCP 2026-07-28

## Resultado e estado
Implementação aprovada tecnicamente pelo principal em 2026-10-10. O produto passa a 0.3.0, atende exclusivamente MCP 2026-07-28 por stdio e preserva as 24 ferramentas e seus contratos de aplicação. Não existe fallback legacy.

A implementação e a revisão técnica estão concluídas. A verificação do cliente real após reconfiguração/reinício permanece pendente da ação humana. Aprovação técnica não representa aceitação humana nem autorização de encerramento; a thread permanece aberta.

## Fontes e coordenação
Fonte: thread 3b4a8787, oportunidade anexada e plano aprovado.
marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787/#msg_f6262c3e8c994aa8bc

Contrato aplicado: AGENTS.md, skill marc-ops, bootstrap da workspace marc-dd422176e1 / C:\Projetos\marc, INSTRUCTIONS.md, RULES.md integral e Custom Rules. Fontes técnicas: README, docs/architecture.md, mcp-tools.md, development.md, agent-workflows.md, harness-engineering.md; ADRs 0001, 0003, 0004, 0007 e 0008; especificação MCP e documentação oficial SDK referenciadas no plano. Decisões históricas foram consultadas por memory_recall e leitura das threads pertinentes durante o planejamento.

Principal: perfil codex-software-architect. Execução: perfil compartilhado codex-dev, runtime /root/mcp_migration, seleção gpt-6-luna/xhigh. Configuração e requisitos de reasoning foram confirmados pelo usuário; não houve introspecção independente dos controles efetivos do modelo. Foi mantido o trial sequencial, com um desenvolvedor. O desenvolvedor realizou bootstrap próprio, confirmou fontes/regras/escopo e recebeu autorização explícita do principal antes dos edits.

Inspeção, revisão de código, evidências de comandos e probes usaram context-mode. Nenhum comando Git, administração de perfis ou alteração de configuração de clientes foi executado.

## Implementação integrada
- Dependências: server SDK 2.3.1 e Zod 4.6.5 em produção; client SDK 2.3.1 apenas em desenvolvimento. SDK monolítico removido; Node >=22 e pnpm 10.10.0 preservados.
- Servidor oficial serveStdio com legacy reject; identidade derivada do package.json; supportedProtocolVersions restrito a 2026-07-28.
- Catálogo dividido por responsabilidade, com schemas de objeto e registro público Standard Schema. Descoberta e listagem completas anunciam ttlMs 0 e cacheScope private.
- Bootstrap, validação e falhas de execução usam isError; exceções de domínio são sanitizadas. Envelope e ferramentas desconhecidas usam erros JSON-RPC.
- Coordenador compartilhado limita 60 invocações por janela fixa de 1 segundo, rejeita excesso antes do domínio, observa cancelamento antes do início e espera handlers ativos durante shutdown.
- Cleanup idempotente em EOF, sinais e fechamento efetivo do transporte preserva callbacks SDK, remove listeners/heartbeat, espera renovações, elimina lease e chama disposeMemoryProviders existente. Rede do heartbeat/DELETE possui timeout de 5 segundos.
- Os testes migraram de handlers privados para cliente oficial e subprocessos reais. Foram acrescentados probes de protocolo, lifecycle, cancelamento/escrita, mensagens/artifacts e versão por requisição.

## Caminhos entregues
- package.json; pnpm-lock.yaml.
- src/mcp/server.ts, responses.ts, memory-tools.ts, daemon.ts, types.ts, helper.ts.
- Novos src/mcp/tool-registration.ts, workspace-tools.ts, thread-tools.ts, agent-tools.ts.
- test/mcp.test.ts, mcp-agent.test.ts, mcp-memory.test.ts.
- Novos test/mcp-process.ts, mcp-protocol.test.ts, mcp-lifecycle.test.ts, mcp-threads.test.ts, mcp-tool-registration.test.ts, mcp-write-drain.test.ts, mcp-version-pin.test.ts.
- README.md; docs/architecture.md, mcp-tools.md, development.md; novo docs/mcp-migration-2026-07-28.md.
- dist gerado exclusivamente pelo build.

src/core, src/ui e src/daemon não receberam mudanças. Persistência Markdown e políticas de paths continuam no domínio existente. Não foram alterados modelos, configurações de clientes, hooks, perfis ou regras gerenciadas. Não houve publicação npm.

O snapshot de hashes antes/depois da validação identificou como único delta externo o log .playwright-output/console-2026-10-09T06-08-56-718Z.log. Sua origem não foi atribuída à implementação; ele foi preservado e excluído da entrega.

## Validação verificada
| Evidência | Resultado e alcance |
| --- | --- |
| pnpm validate, execução final atual | Status 0; fixes, lint, formatação e typecheck. Saídas antigas indexadas não foram usadas como resultado final. |
| pnpm build, após última mudança | Status 0; compilação TypeScript e Vite. Permanece aviso de chunk JS maior que 500 kB. |
| pnpm test, após build final | 226/226 passaram; 0 falhas, 0 ignored/skipped e 0 cancelled. Inclui as quatro combinações source/dist com abertura moderna direta ou legacy rejeitado antes. |
| pnpm run code:check independente do principal | ESLint e Prettier passaram no estado corrigido. |
| Probe raw independente source | Modern listing seguido de versão antiga em tools/list e tools/call retorna -32022; metadados ausentes após pin retornam -32602; conexão recupera listagem moderna de 24 tools; EOF termina com código 0. |
| Probe raw independente dist, após build final | Descoberta 2026-07-28/0.3.0; 24 schemas objeto; cache private/0; legacy rejeitado e recuperação moderna; rejeição de versão após pin; erros de envelope, ferramenta desconhecida e input; isError no gate; 60 gates e uma rejeição rate_limited com retryAfterMs; recuperação moderna e EOF código 0. stdout exclusivo JSON-RPC, stderr sanitizado. |

O probe inicial do principal tinha uma expectativa adicional de stderr sempre vazio. Ela foi corrigida após isolamento: a rejeição de initialize legacy aciona uma linha genérica de diagnóstico do SDK em stderr. Esse comportamento é permitido pelo contrato e não expõe erro bruto, stack ou segredo.

## Revisão final substantiva do principal
Escopo revisado: todo o estado integrado autorizado, registros das quatro famílias de ferramentas, coordenador, schemas/resultados, transporte/cleanup, dependências e lockfile, testes públicos e documentação. Após a última correção, foram relidos o guard, seu regression test e o guia; o build final foi exercitado por um probe independente sem o cliente SDK nem o helper dos testes.

| Critério de aceite | Implementação e evidência | Avaliação |
| --- | --- | --- |
| Somente 2026-07-28, inclusive depois da abertura | server.ts:26 e :91; mcp-version-pin.test.ts:17; probes raw source/dist | Aprovado. Restrição do construtor SDK sozinha não bastava após pin; guard no callback público rejeita antes do domínio. |
| Identidade, descoberta e catálogo estável | server.ts:26, grupos de registro e testes de catálogo; probe dist | Aprovado. Versão vem do pacote; schemas objeto e 24 nomes únicos; hints explícitos e sem dependência do bootstrap. |
| Contratos de aplicação e tipos públicos | responses.ts:33/:48; módulos por domínio; registerMcpTool em tool-registration.ts:84 | Aprovado. Registro Standard Schema preserva inferência; testes usam APIs públicas; bootstrap continua explícito. Sem outputSchema fictício. |
| Segurança e limite de invocação | tool-registration.ts:10/:35; erros sanitizados e testes negativos de paths/metadados/daemon | Aprovado. Limite compartilhado rejeita sem fila antes do domínio. Políticas existentes de paths preservadas; o teste negativo realmente sai da fronteira .marc. |
| Cancelamento e integridade da persistência | guard de signal em tool-registration.ts:84; mcp-tool-registration.test.ts e mcp-write-drain.test.ts | Aprovado dentro do contrato best effort. Teste de escrita bloqueada comprova espera antes do EOF, commit único e lock removido; operação iniciada pode concluir após cancelamento. |
| Recursos e encerramento | server.ts:49 e daemon.ts:56/:113; mcp-lifecycle.test.ts, probes EOF | Aprovado. Callbacks SDK são compostos, cleanup é idempotente e heartbeat possui timeout; workers compartilhados são liberados somente no shutdown. |
| Manutenibilidade e regras locais | divisão por família; typecheck/lint/Prettier; revisão dos guards | Aprovado. Sem else, sem if aninhado, guards com early return e dispatch por responsabilidade. Nenhum acesso a API privada do SDK ou mudança do domínio para viabilizar o adaptador. |
| Documentação e migração | README, architecture, mcp-tools, development e guia novo | Aprovado. Documenta contrato moderno, ausência de fallback, códigos de erro conforme fase, rate limit, best effort e restart. |

Finding material resolvido: a primeira requisição regular moderna fixa uma conexão que, no SDK 2.3.1, aceitava posteriormente tools/list com uma revisão antiga. O teste inicial enviava o erro antes dessa primeira requisição regular e não detectava o problema. A revisão independente reproduziu o defeito source/dist, corrigiu a sequência do teste e exigiu proteção no callback público. O estado entregue rejeita também tools/call incompatível e não cria threads em requests/notifications negativas.

A solução conserva o SDK como dono do framing e das regras de envelope. O guard local trata apenas metadados válidos com versão explicitamente incompatível; requests ausentes/malformados, respostas e cancelamento compatível seguem ao SDK. Isso corrige a lacuna sem acoplar a aplicação a handlers privados ou alterar persistência.

Veredito: APROVADO TECNICAMENTE. Critérios do plano foram atendidos no código integrado e nas evidências finais; não restam findings de implementação. O smoke do cliente instalado é um checkpoint operacional separado, ainda pendente.

## Limites e retomada após reinício
- Cancelamento é best effort e não oferece rollback de domínio iniciado. Shutdown espera operações ativas; seu tempo total depende delas.
- Testes de memória usam cenários sem modelo disponível; não baixam/carregam modelos reais. A integração chama o cleanup público existente.
- Não foi implementado MCP HTTP/auth nem features opcionais fora do uso do produto. UI e daemon mantêm suas interfaces existentes.
- Não se presume suporte de todos os hosts. A instalação Codex contém referências modernas, mas isso não prova a negociação em runtime.
- Aprovação técnica não encerra a thread e não substitui revisão humana.

As configurações locais encontradas já lançam node com dist/cli.js mcp e a workspace deste projeto:
| Arquivo | Seção |
| --- | --- |
| .codex/config.toml | mcp_servers.mcp-marc |
| .mcp.json | mcpServers.mcp-marc |
| .vscode/mcp.json | servers.mcp-marc |

O comando atual não precisa de troca para carregar o build local. Preservar daemon URL e token existentes; não copiar segredos para mensagens. Caso se queira normalizar paths, usar C:/Projetos/marc/dist/cli.js e C:/Projetos/marc. Não há parâmetro TOML protocolVersion documentado para essa migração; a negociação é responsabilidade do cliente.

Próxima ação humana: reiniciar o MCP/cliente que mantém esta sessão para descartar o processo antigo e seu catálogo. Após retorno, ler a skill e restaurar bootstrap, verificar workspace/path e a conexão efetiva do cliente com o servidor moderno, confirmar catálogo e identidade quando expostos pelo host, e continuar pela primeira etapa pendente. Se o host não negociar 2026-07-28, atualizar seu suporte MCP; a decisão de não oferecer compatibilidade permanece válida.
