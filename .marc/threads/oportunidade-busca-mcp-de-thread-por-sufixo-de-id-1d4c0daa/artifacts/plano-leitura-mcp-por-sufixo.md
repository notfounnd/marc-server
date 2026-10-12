# Plano aprovado — leitura MCP de threads por sufixo curto

## Objetivo e fontes
Permitir consultas com o sufixo hexadecimal de oito caracteres nas ferramentas thread_read, thread_read_since, thread_tail e thread_info, preservando a identidade canônica. O usuário confirmou o formato de oito caracteres e solicitou a implementação do plano apresentado.

Fontes: thread alvo, README, docs/mcp-tools.md, docs/architecture.md, docs/development.md, docs/agent-workflows.md, docs/harness-engineering.md, ADRs 0001, 0003, 0004, 0007 e 0008 e contrato completo de bootstrap/RULES/Custom Rules. Histórico consultado por memory_recall: padronização de nomes MCP e leitura incremental. A thread relacionada marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787 foi lida; sua migração foi concluída. Esta tarefa preserva MCP 2026-07-28, SDK, envelope, bootstrap, isolamento e catálogo de 24 ferramentas.

## Contrato de implementação
- Aceitar ID completo existente e sufixo hexadecimal com exatamente oito caracteres. Letras maiúsculas ou minúsculas são aceitas no sufixo; normalizar somente o sufixo para comparação.
- Priorizar correspondência exata com o ID completo existente. Resolver sufixos pelo segmento final após hífen, somente quando existir uma correspondência.
- Consultar exclusivamente os diretórios de threads do workspace atual, abertos ou encerrados, com CHAT.md válido como arquivo. Não depender do índice JSON para decidir correspondência; índices e caches continuam derivados.
- Rejeitar entradas com separadores de caminho, segmentos de navegação ou tentativa de escapar do diretório de threads. Não seguir diretórios simbólicos para descobrir correspondências.
- Executar resolução somente após a verificação de bootstrap, usando um resolvedor compartilhado na camada MCP. Não alterar leitores do domínio.
- Acrescentar result.threadId canônico às quatro respostas, inclusive a cursor_not_found. Em thread_info, preservar id existente e acrescentar threadId igual a id. Manter mensagens, opções, limites, cursores e demais campos.
- Retornar erros MCP com isError: true e error.code thread_not_found, ambiguous_thread_id ou invalid_thread_id. Ambiguidade retorna error.details.candidates com IDs completos ordenados. Mensagens em en-US, sem caminhos absolutos, stacks ou detalhes internos. Falhas inesperadas continuam tratadas pelo coordenador atual.
- Não resolver sufixos nas ferramentas de escrita, APIs de UI/daemon ou referências marc://. Não criar novas ferramentas ou aliases. Não alterar protocolo, dependências, configurações locais, RULES ou INSTRUCTIONS.

## Tarefa atômica e escopo autorizado
Principal: codex-software-architect, gpt-6.1-sol/high conforme perfil humano-confirmado vigente. Desenvolvedor compartilhado: codex-dev, gpt-6-luna/xhigh, configuração humano-confirmada no perfil e no histórico; solicitar os mesmos parâmetros no cliente e registrar a fonte sem fingir introspecção. Limite: um desenvolvedor ativo, sequencial.

Caminhos autorizados:
- src/mcp/thread-resolution.ts (novo): resolução compartilhada, erros esperados e proteção de caminhos.
- src/mcp/thread-tools.ts: integrar resolução às quatro ferramentas e atualizar descrições/schema.
- src/mcp/helper.ts: orientar uso de IDs e sufixos.
- test/mcp-thread-resolution.test.ts (novo): testes do resolvedor.
- test/mcp-threads.test.ts: integração das quatro ferramentas no protocolo moderno e regressões.
- README.md e docs/mcp-tools.md: documentar contrato e exemplos em en-US.
- Artefatos e mensagens oficiais exclusivamente na thread alvo para plano, entrega e revisão consolidada.

O desenvolvedor deve ler AGENTS.md, marc-ops, seu bootstrap completo, fontes aplicáveis, plano e thread antes de editar. Retornar OK_BOOTSTRAP com identidade/path, fontes lidas, regras críticas, configuração solicitada/efetiva quando verificável e fonte, escopo e estado existente dos alvos. Aguardar autorização explícita do principal no canal entre agentes. Não criar perfis nem delegar.

## Passos e critérios de aceite
1. Inspecionar os alvos via context-mode e preservar alterações existentes.
2. Escrever testes significativos que falhem antes da implementação. Cobrir ID completo/sufixo nas quatro ferramentas, ausência, colisão, threads encerradas, maiúsculas, workspace isolado, diretórios inválidos e bootstrap.
3. Implementar resolvedor e integração mínima. Usar early returns, sem else e sem if aninhado; erros esperados específicos não devem afrouxar sanitização de falhas inesperadas.
4. Verificar threadId canônico em thread vazia e cursor_not_found, manutenção de opções/limites e recusa de sufixos nas ferramentas de escrita.
5. Atualizar helper e documentação; executar testes direcionados e pnpm validate, pnpm build e pnpm test via context-mode. O validate aplica fixes: inspecionar efeitos e interromper para resolver qualquer conflito fora do escopo; nunca reverter trabalho alheio.
6. Retornar relatório interno detalhado com caminhos/linhas, mudanças, RED/GREEN, comandos/resultados, documentação e riscos. Publicar a própria entrega consolidada sob codex-dev usando ferramentas oficiais, anexando o relatório e retornando messageId; publicação não requer pré-aprovação do principal.
7. Principal revisa independentemente todo o estado integrado, executa probe real no build compilado, resolve findings com o mesmo desenvolvedor e repete verificações afetadas. Consolidar revisão substantiva no artefato de atividade, com critérios ligados à implementação/evidências, limitações e veredito aprovado/pendente/rejeitado.
8. Auditar artifacts/references quando aplicável e messages antes da conclusão. Apresentar resultado ao usuário sem encerrar a thread.

## Validação inicial e limites
Inspeção por context-mode confirmou Node 22.20.0 e pnpm 10.10.0; pnpm typecheck e dois testes MCP atuais passaram. A chamada nativa com 1d4c0daa retornou internal_error; a leitura pelo ID completo respondeu corretamente. Isso constitui o comportamento anterior observado, não validação da futura implementação.

Não executar Git, worktrees ou commits. Usar Bash/context-mode para investigação e comandos; native apply_patch para edições manuais. Manter código e documentação técnica em en-US; conversa, plano e relatórios mARC em pt-BR. Este handoff substitui ledgers de execução e review packages que exigem Git: seguir o loop canônico do workspace, consolidando evidências na entrega e revisão, sem diário de comandos.

## Pendências
Nenhuma decisão funcional pendente. Processos MCP já abertos poderão precisar de recarga após o build; não reiniciar processos humanos automaticamente. Aprovação técnica e aceitação humana são distintas; fechamento exige autorização explícita.
