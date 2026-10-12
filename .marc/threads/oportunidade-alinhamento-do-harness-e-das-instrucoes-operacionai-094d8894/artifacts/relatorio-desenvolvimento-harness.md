# Relatório de Desenvolvimento: Alinhamento do Harness

**Thread:** `oportunidade-alinhamento-do-harness-e-das-instrucoes-operacionai-094d8894`
**Executor:** perfil compartilhado `codex-dev`, desenvolvimento sequencial.
**Configuração da delegação:** `gpt-6-luna`, raciocínio `xhigh`, conforme confirmação humana. Não usei spawn como fonte de introspecção.
**Estado:** implementação e validações concluídas; revisão técnica integrada do principal pendente; thread permanece aberta.
**ID da mensagem de entrega:** `msg_7b6108ddf22044ef88`.

## Implementação

As mudanças preservam o comportamento em execução e os contratos públicos da API. O corpo da skill-fonte foi ajustado sem alterar `description` ou `when_to_use`; a skill gerada e `.marc/INSTRUCTIONS.md` não foram editadas. A geração de recomendações mantém as atualizações idempotentes e preserva `Custom Rules`.

Os critérios do plano foram atendidos:

1. Reuso de perfis existentes quando adequados; registro ou atualização somente quando necessário e permitido, sem IDs ou catálogo de papéis fixos.
2. O cursor avança após leitura e consumo do conteúdo; `thread_info` fornece metadados e `thread_tail` cobre somente sua janela retornada.
3. A composição de mensagens, artefatos e resumos aponta para uma fonte compartilhada concisa, sem duplicar a política nos guias operacionais.
4. Publicações registram decisões, descobertas, riscos, bloqueios, resultados e entregas materiais, não confirmações rotineiras ou diários de iteração.
5. `workspace_update_recommendations` continua obrigatório antes de iniciar trabalho em thread; sua atualização não estabelece nem recupera o bootstrap.
6. Markdown fica restrito a conhecimento e coordenação legíveis; formatos estruturados, incluindo JSON, são preservados.
7. O helper ancora composição e encerramento no contrato atual do workspace e não presume documentação local do consumidor.
8. A regra Git mantém a proibição de contornar, evadir ou burlar negativas e aprovações pendentes, permitindo nova tentativa após nova autorização explícita.
9. Recomendações geradas permanecem duráveis e idempotentes, e a seção Custom Rules é preservada.
10. Regressões cobrem os contratos acima, geração idempotente, preservação, consumo incremental e operação MCP em consumidor sem `docs` locais.

## Escopo

Fontes:
- `src/core/recommendations.ts` (guias gerados, atualização/bootstrap e formatos).
- `src/core/marc-ops-skill.ts` (corpo da skill-fonte; metadata imutável).
- `src/mcp/helper.ts` (orientações MCP por tópico).

Testes:
- `test/core-recommendations.test.ts` e `test/core-recommendations-bootstrap.test.ts`.
- `test/mcp.test.ts` e `test/mcp-threads.test.ts`.

Documentação:
- `AGENTS.md`.
- `.marc/RULES.md`, somente dentro de `Custom Rules`.
- `docs/agent-workflows.md`, `docs/development.md`, `docs/mcp-tools.md` e `README.md` nos trechos afetados.

Referências úteis: `src/core/recommendations.ts:18,40,46`; `src/core/marc-ops-skill.ts:64,100`; `src/mcp/helper.ts:73,97,127,187`; `AGENTS.md:31,34,35`; `.marc/RULES.md:48,89,137`; `test/core-recommendations-bootstrap.test.ts:26,73,96,123,158`; `test/mcp.test.ts:160,219,274`; `test/mcp-threads.test.ts:90,107,114`.

## Verificação

- Suítes direcionadas: 26 testes passaram, incluindo `core.test.ts` para compatibilidade dos textos gerados.
- `pnpm run code:check`: passou (ESLint e Prettier).
- `pnpm validate`: passou, incluindo correção de código, checagem e verificação de tipos.
- `pnpm build`: passou; saída compilada em `dist/`.
- `pnpm test`: 284 passaram, zero falhas.
- Teste MCP no `dist` recém-compilado: passou em workspace temporário após bootstrap e sem `docs/agent-workflows.md`; os tópicos de threads, agentes, mensagens e workspace foram lidos e conferidos.
- A suíte MCP exercita o caso A/B: após ler A, publica B, consulta `thread_info` com metadados de B e então lê B via `thread_read_since` usando o cursor consumido de A.
- Nenhum comando Git foi executado; não houve atualização de recomendações no workspace real.

## Efeitos e Limites

O build gerou arquivos em `dist/`, como esperado para a validação e para a atualização gerenciada posterior do principal. A hash de `.marc/cache/thread-index.json` variou durante janelas iniciais de monitoramento de validate/build; o arquivo foi preservado e não restaurado, sem atribuição causal confirmada. No ciclo final monitorado de validate/build, a hash permaneceu estável e nenhum outro arquivo fora de `dist/` mudou.

A verificação do principal comunicada nesta coordenação confirmou a árvore sintática abstrata dos quatro testes sem condicionais de seleção de cenário, links dos seis documentos sem erros e teste independente do `dist` com catálogo de 25 ferramentas, helper sem docs locais e A/B após `thread_info`. Isso não substitui a revisão integrada final.

## Revisão Integrada

**Veredito: pendente do principal.** O executor revisou os critérios, o conteúdo dos 13 arquivos autorizados, as regressões direcionadas, o formato e a preservação de Custom Rules, além das evidências de validação acima. A revisão independente integrada de arquitetura, comportamento, documentação, escopo e riscos permanece com o principal; não há aprovação técnica final registrada pelo executor.