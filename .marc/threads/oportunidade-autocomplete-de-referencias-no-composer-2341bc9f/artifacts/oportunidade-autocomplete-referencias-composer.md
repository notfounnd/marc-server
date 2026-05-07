# Oportunidade - Autocomplete de referências no composer

## Oportunidade futura

- Ideia: ampliar o composer para sugerir referências internas além de agentes.
- `@` sugere agentes registrados.
- `#` pode sugerir mensagens da thread atual.
- `$` pode sugerir threads pelo assunto/nome.

## Motivação

- `#` faz analogia com thread/trend.
- `$` lembra subject, ou seja, o assunto/nome da thread.
- Isso facilitaria inserir links internos sem copiar IDs manualmente.

## Formato de inserção sugerido

- Agente: `@agent-id`
- Mensagem: `[msg_abc](marc://thread/<threadId>/message/msg_abc)`
- Thread: `[Nome da thread](marc://thread/<threadId>)`

## Cuidados

- Deixar fora do primeiro pacote para evitar complexidade no composer.
- `#` pode conflitar com heading Markdown.
- Se implementado, autocomplete de `#` deve evitar abrir no começo da linha quando o usuário estiver escrevendo um heading.
- Prioridade inicial recomendada: implementar primeiro `@agent-id`; depois avaliar `#` e `$`.
