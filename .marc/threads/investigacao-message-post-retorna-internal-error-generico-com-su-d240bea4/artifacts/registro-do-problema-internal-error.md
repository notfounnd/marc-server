# Registro do problema: `internal_error` genérico nas ferramentas de escrita

## Resumo

Ferramentas MCP de escrita do mARC devolvem `internal_error` com a mensagem `Tool execution failed.` quando o core lança um erro esperado e explicável. O agente não recebe a causa. Dois casos foram observados em 2026-10-15, na mesma sessão:

1. `message_post` com o sufixo de 8 caracteres do id da thread;
2. `message_post` com corpo acima do limite de tamanho.

Nos dois, o core já produz uma mensagem clara, mas ela é descartada no registro das ferramentas.

## Ocorrência 1: sufixo de id em ferramenta de escrita

**O que aconteceu (por volta de 16:12Z):**

- cinco chamadas de `message_post` foram feitas em paralelo, cada uma com o sufixo de 8 caracteres de uma thread diferente (`bc45139b`, `1042e2b3`, `c34cf4a2`, `cd4a49b8`, `934ac2b7`);
- as cinco falharam com `internal_error`, e nenhuma mensagem foi gravada;
- as mesmas cinco publicações, **com o corpo idêntico**, funcionaram depois, uma de cada vez e com o id completo. Exemplo: marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3/#msg_bacb1405a55541cdb8

O corpo idêntico descarta o tamanho como causa nessa ocorrência. Ainda restam duas variáveis, o paralelismo e o formato do id. O código indica o formato do id (veja a evidência abaixo), mas a reprodução isolada ainda precisa confirmar.

**Decisão histórica relacionada:** marc://$oportunidade-busca-mcp-de-thread-por-sufixo-de-id-1d4c0daa definiu que só as ferramentas de leitura aceitam o sufixo, e que as de escrita continuam exigindo o id completo. Esta investigação não reabre essa decisão. O foco é a forma como a restrição aparece para o agente.

## Ocorrência 2: corpo acima do limite

Ao registrar esta própria thread (por volta de 16:44Z), o `message_post` com o id completo também falhou com `internal_error`. O corpo tinha cerca de 3.000 caracteres. O limite é de 2.400 caracteres, 30 linhas e 6 linhas longas (`src/core/guards.ts:6-8`).

O guard produz uma mensagem útil: `Message is too long (N chars). Keep it under 2400 chars or attach an artifact.` (`src/core/guards.ts:29-33`). Essa mensagem também se perde, e o agente só descobriu o limite lendo o código.

## Evidência no código (lida via context-mode)

| Local | Comportamento |
|---|---|
| `src/mcp/thread-tools.ts:81` | O `message_post` repassa `input.threadId` direto para `appendMessage`, sem `resolveThreadId` |
| `src/mcp/thread-tools.ts:103` | O `message_attach_artifact` faz o mesmo |
| `src/core/threads.ts:64-69` | A validação do corpo lança `Error` com o motivo e o guia de estilo |
| `src/core/threads.ts:75-78` | Com o sufixo, o `CHAT.md` não existe no caminho montado, e o core lança `Thread not found: <id>` |
| `src/mcp/tool-registration.ts:70-81` | O `executeSafely` captura qualquer exceção sem olhar o tipo e devolve sempre `internal_error` / `Tool execution failed.` |
| `src/mcp/thread-tools.ts:50-64` | O `thread_write_summary` é exceção: trata `ThreadSummaryError` e mapeia o código antes de cair no genérico |
| `src/mcp/helper.ts:120` | A restrição "use full IDs for writes" está no helper, mas não na descrição nem no schema do `threadId` das ferramentas de escrita |

Hoje não há diretório de thread com nome de sufixo puro em `.marc/threads`.

## Hipótese

O defeito principal é a **opacidade dos erros**. Os erros esperados do core (thread inexistente, corpo inválido e provavelmente outros) chegam ao agente como falha interna genérica. A consequência é que o agente gasta chamadas tentando adivinhar a causa ou desiste da operação. O paralelismo provavelmente não tem relação com a ocorrência 1.

O padrão do `thread_write_summary` (erro tipado com código, mapeado na borda MCP) já existe no projeto e é o precedente natural para a correção.

## Perguntas da investigação

1. **Reprodução isolada:** `message_post` com sufixo em uma única chamada; com id completo inexistente; com id completo em chamadas paralelas na mesma thread e em threads diferentes; com corpo acima de cada um dos três limites.
2. **Artifact órfão:** o `message_attach_artifact` com sufixo falha antes de escrever ou pode criar um diretório `threads/<sufixo>/artifacts`?
3. **Inventário:** quais erros do core chegam hoje ao agente como `internal_error`? O levantamento é feito por ferramenta e por erro, separando os que são esperados (entrada inválida, recurso inexistente) dos que são realmente internos.
4. **Segurança da mensagem:** quais mensagens do core podem ser expostas sem vazar caminho absoluto ou detalhe sensível. A decisão da `1d4c0daa` fala em "erros seguros".

## Direção recomendada para a correção (a confirmar no plano)

- **Erros tipados no core:** erros esperados do core passam a ter código, seguindo o padrão do `ThreadSummaryError`. Por exemplo: `thread_not_found`, `message_body_invalid`, `artifact_name_invalid`.
- **Mapeamento por tabela:** o `executeSafely` mapeia esses códigos com uma tabela de dispatch e mantém `internal_error` só para o que for de fato inesperado.
- **Restrição visível:** a descrição e o schema do `threadId` das ferramentas de escrita dizem que é exigido o id completo, e o erro de thread inexistente sugere usar `thread_list` ou o id canônico devolvido pelas ferramentas de leitura.
- **Fora do escopo:** aceitar o sufixo também na escrita é mudança de contrato. Só entra se o humano pedir.

## Escopo atual

Só investigação, sem alteração de código. Um plano de correção será anexado antes de qualquer desenvolvimento.
