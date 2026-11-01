# Correção - thread_write_summary recusa ID de thread com hífen duplo

Thread: marc://$correcao-thread-write-summary-recusa-id-de-thread-com-hifen-dupl-3748e692

Closed: `2026-11-01T14:36:50.423Z`

---

Corrigida a inconsistência que impedia gravar resumos em threads históricas com hífen duplo antes do sufixo hexadecimal. A geração de novas threads também foi ajustada para evitar esse formato no corte do título, mantendo `slugify` e os identificadores existentes. O desenvolvimento foi entregue, recebeu aprovação técnica integrada e teve o encerramento explicitamente autorizado pelo humano.

## Decisões e entrega

- `threadSlug` remove hífens finais somente na criação de IDs de thread; `slugify` permanece inalterado para agentes e registros da memória.
- O writer aceita um ou dois hífens imediatamente antes do sufixo hexadecimal de oito caracteres. Duplicações internas, hífen triplo, slug vazio, maiúsculas, sufixo inválido e traversal continuam rejeitados.
- IDs, referências e dados históricos foram preservados, sem migração. Markdown continua autoritativo; formatos de resumo, revisão, locks e projeções mantêm o fluxo existente.
- A implementação ficou em três arquivos do core e dois arquivos de testes. A revisão documental dispensou alterações porque o formato interno do ID não constitui contrato documentado da ferramenta.

## Validação e aprovação

A inspeção e as validações foram realizadas via context-mode. Antes da implementação, os testes reproduziram os defeitos; depois da correção, os nove testes focados passaram. `pnpm validate` concluiu sem erros; build e suíte completa passaram, com 1.177 testes aprovados, zero falhas e zero skips. O principal executou independentemente outros 18 testes relacionados, todos aprovados. O smoke do MCP compilado confirmou criação de resumo para um ID novo corrigido e para um ID histórico com `--`, em workspace temporário e processo separado.

A revisão integrada do principal recebeu veredito **approved**, sem achados técnicos pendentes. Antes do encerramento, os cinco arquivos de código e testes foram comparados aos hashes do estado aprovado e permaneceram idênticos; as auditorias estruturais de mensagens e referências não apontaram achados. Não houve nova alteração de implementação nesta etapa, portanto os checks de código da entrega não foram repetidos.

A entrega registra o aviso de tamanho do bundle Vite e avisos informativos de datasets temporários LanceDB. A validação compilada utilizou processo separado; não verificou o recarregamento da conexão MCP que estava ativa durante o desenvolvimento. Nenhuma thread real foi encerrada durante os testes.

## Aceitação, encerramento e continuidade

Após receber a entrega aprovada, o humano autorizou expressamente encerrar esta thread e, em seguida, adicionar ao stage apenas os arquivos correspondentes a este desenvolvimento. Essa autorização é distinta da aprovação técnica e não inclui commit. Registros de outras threads, projeções de memória, logs e alterações alheias ficam fora do stage desta tarefa.

As decisões e evidências detalhadas permanecem na proposta original, no brief, na entrega do desenvolvedor e na revisão integrada, anexados às mensagens abaixo:

- Proposta original: marc://#msg_16bb617fe97642eca2
- Brief de execução: marc://#msg_4497016781cf4fe2b6
- Entrega de autoria do desenvolvedor: marc://#msg_225472821a4c4760a9
- Revisão integrada e aprovação técnica: marc://#msg_75bd6eecdb9244d882
