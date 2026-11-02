# Correção - CLI de memória não encerra e descrições MCP desatualizadas

Thread: `correcao-cli-de-memoria-nao-encerra-e-descricoes-mcp-desatualiza-d6466eae`
Created: `2026-11-02T04:10:13.149Z`

<!-- marc-message
id: msg_4f9dfeb9fb034d53ab
threadId: correcao-cli-de-memoria-nao-encerra-e-descricoes-mcp-desatualiza-d6466eae
timestamp: 2026-11-02T04:10:49.595Z
agentId: claude-software-architect
artifacts: artifacts/plano-correcao-cli-e-descricoes-mcp.md
-->

Registro das pendências da revisão de documentação de busca para a 0.4.0.

**Itens:**
- CLI de memória responde, mas não encerra: resposta em 21 s, saída em 305 s, na medição com o interpretador ativo. O canal IPC dos workers mantém o processo vivo.
- Descrições das ferramentas MCP de memória ainda dizem "summary-memory", e a do `memory_deep` cita "E4".
- Suíte completa pendente sobre o estado integrado, com a revisão de documentação e a versão 0.4.0.

**Decisão:** o CLI descarta os workers ao terminar, restaurando o que marc://$oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4 decidiu. Daemon e MCP mantêm os tempos ociosos.

**Fora do escopo:** busca por intenção, que segue em pausa.

**Situação:** plano anexado, sem questões de desenho. O desenvolvimento aguarda autorização do humano.

<!-- /marc-message -->

<!-- marc-message
id: msg_6fc82a5450f24487a1
threadId: correcao-cli-de-memoria-nao-encerra-e-descricoes-mcp-desatualiza-d6466eae
timestamp: 2026-11-02T04:39:42.025Z
agentId: claude-dev
-->

Entrega da Fase 2 (claude-dev), sequencial. Somente os 7 caminhos autorizados.

Alterações:
- src/cli-memory-command.ts (novo): runMemoryCommand com try/finally.
- src/cli.ts: handleMemoryCommand usa runMemoryCommand (linhas 164-168).
- src/mcp/memory-tools.ts: descrições (linhas 35, 44, 53, 64, 91).
- test/cli-memory-command.test.ts (novo) e test/mcp-memory.test.ts: 4 testes.
- docs/memory.md (linha 74) e CHANGELOG.md (linha 26): só o texto do plano.

Checagens:
- pnpm validate: EXIT=0. pnpm build: EXIT=0.
- pnpm test: 1181 testes, 0 falhas.
- Sem else, if aninhado ou ternário nos arquivos alterados.

Riscos:
- Saída real do processo (critérios 1 e 2) não medida; fica para o principal.
- .marc/cache/thread-index.json e um log em .playwright-output mudaram durante a execução. São ignorados pelo git e não foram editados por mim.

Pendente: revisão técnica do principal.

<!-- /marc-message -->

<!-- marc-message
id: msg_48600eb781a548d290
threadId: correcao-cli-de-memoria-nao-encerra-e-descricoes-mcp-desatualiza-d6466eae
timestamp: 2026-11-02T04:44:31.506Z
agentId: claude-software-architect
artifacts: artifacts/revisao-final-cli-e-descricoes-mcp.md
-->

Revisão final integrada: aprovado na revisão técnica, aguardando a aceitação do humano.

**Resultados:**
- CLI: com `arquitetrua do projeto`, resposta e saída aos 25 s, contra saída aos 305 s antes da correção.
- Resultado do recall preservado, com `exit=0`.
- `src/core/memory/inference-manager.ts` sem alteração, então daemon e MCP mantêm os tempos ociosos.
- `pnpm validate` e `pnpm build` passaram, e `pnpm test` fechou 1181/1181, rodados por mim no estado integrado.

**Pendente:** conferir as novas descrições na lista de ferramentas depois do reinício do ecossistema.

**Limite:** a saída real do processo foi medida uma vez, com modelos reais, porque a suíte não carrega modelos.

Sem achados bloqueantes.

<!-- /marc-message -->
