# Resumo executivo

Thread: marc://$oportunidade-revisao-e-atualizacao-do-marc-para-mcp-2026-07-28-3b4a8787
Closed: `2026-10-11T19:14:21.000Z`

## Objetivo e decisões

Revisar e atualizar a integração MCP do mARC para a revisão 2026-07-28, com análise do contrato oficial, implementação, testes e confirmação da conexão na sessão real.

O usuário confirmou suporte exclusivo à revisão 2026-07-28, sem compatibilidade legada. O servidor stdio utiliza a API moderna do SDK oficial v2 e rejeita clientes incompatíveis. Foram preservados as 24 ferramentas, bootstrap, RULES/Custom Rules, isolamento de workspace, Markdown como fonte de verdade, UI/daemon e motor de memory.

## Entrega integrada

- Migração para `@modelcontextprotocol/server` 2.3.1, schemas Zod 4.6.5 e discovery moderno, com identidade derivada do pacote mARC 0.3.0.
- Proteção por requisição contra revisão incompatível, inclusive após uma conexão moderna válida; notificações incompatíveis não alcançam o domínio.
- Contratos de cache privado sem TTL, erros seguros, limite de chamadas, cancelamento e limpeza do processo cobertos pela implementação e pelos testes.
- README e guia de migração atualizados. O guia remete à documentação oficial do harness para suporte, configuração e atualização, sem receita específica de fornecedor.
- Erros JSON-RPC de versão recebem orientação neutra sobre o harness tanto na rejeição inicial do SDK quanto nas requisições posteriores. Apenas a mensagem é complementada; código, dados, ID e demais campos permanecem preservados.
- O aviso geral do guia foi ajustado diretamente pelo principal, a pedido do usuário, para tratar falhas de conexão ou negociação sem depender de um código de erro específico.
- A fixture de recuperação de lock stale foi corrigida: orçamento de 5 segundos e asserção de liberação do lock. A implementação de produção do lock permaneceu intacta.

## Configuração local e conexão confirmada

O diagnóstico do Codex CLI 0.162.1 mostrou que a feature global, isoladamente, não selecionava o fluxo moderno para esse servidor stdio. Na configuração local, após autorização explícita do usuário, foi acrescentado `CODEX_MCP_PROTOCOL_VERSION = "2026-07-28"` ao ambiente de `mcp-marc`, preservando command e args. Esse diagnóstico é evidência histórica da versão do cliente investigada, não uma receita geral de configuração do mARC.

Após o reinício informado pelo usuário, as ferramentas nativas mARC ficaram disponíveis. `workspace_bootstrap` e `thread_read_since` responderam com sucesso para `marc-dd422176e1` em `C:\Projetos\marc`. O aviso restante da feature experimental não era uma falha de conexão. A pendência de confirmação da sessão real foi resolvida.

## Validação e aprovação

O principal revisou o estado integrado de implementação, documentação e testes e concedeu aprovação técnica. Inspeção do repositório e revisão de saídas foram realizadas por context-mode. Os relatórios consolidados distinguem execução do desenvolvedor e verificação independente do principal.

- `pnpm validate`, `pnpm build` e `pnpm test` passaram nas entregas e novamente após o último ajuste do guia: 226 testes aprovados, sem falhas ou skips.
- A seleção de protocolo passou em 12/12 casos, após RED que demonstrou a ausência da orientação nos erros de versão.
- Probes independentes source/dist verificaram o contrato moderno. A prova final no CLI compilado confirmou rejeições iniciais e posteriores, envelope preservado, ausência de orientação em erro de metadata e recuperação com catálogo de 24 ferramentas; subprocesso exit 0.
- A correção da fixture de lock foi verificada também com atraso controlado de filesystem.
- No último ajuste, a reconstrução do guia anterior confirmou que somente o parágrafo autorizado mudou. O `validate` não alterou arquivos adicionais.
- As auditorias estruturais de artifacts e messages após a entrega não apresentaram achados; elas complementam, sem substituir, a revisão técnica.

## Limites e contexto futuro

A disponibilidade de suporte à revisão MCP e a apresentação dos diagnósticos ao agente dependem do harness. O mARC não garante que um erro exibido em warnings/logs entre no contexto do agente. Processos já abertos precisam recarregar um build atualizado para adotar novos diagnósticos; esta entrega não reiniciou processos do usuário. O build final apresentou aviso de tamanho do bundle da UI, sem impedir sua conclusão.

Não há pendência de implementação nesta thread. A oportunidade separada de ferramentas MCP para summary e encerramento não foi incorporada a esta migração:

marc://$oportunidade-tools-mcp-para-summary-e-encerramento-de-threads-2f441fa7

Os planos e relatórios completos permanecem nos artifacts associados às mensagens da thread, incluindo `atividade-migracao-mcp-2026-07-28.md`, `atividade-correcao-lock-stale-e-diagnostico-codex.md`, `atividade-opt-in-stdio-codex-0-162-1.md` e `atividade-orientacao-neutra-harness-e-erros-versao.md`.

## Encerramento

Após a entrega e o ajuste editorial final, o usuário autorizou explicitamente: “Pode encerrar a thread”. Este resumo registra o encerramento autorizado, separado da aprovação técnica já concluída.
