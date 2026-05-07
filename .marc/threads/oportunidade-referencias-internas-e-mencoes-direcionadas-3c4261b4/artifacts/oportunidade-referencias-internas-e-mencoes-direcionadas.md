# Oportunidade - Referências internas e menções direcionadas

## Oportunidade identificada

- Problema: referências a threads, mensagens e agentes hoje ficam como texto solto.
- Objetivo: transformar referências internas e menções em elementos navegáveis no painel.
- Benefício: melhorar rastreabilidade, contexto entre threads e direcionamento leve entre agentes/humanos.

## Pacote principal

- Suportar links internos:
  - `marc://thread/<threadId>`
  - `marc://message/<messageId>`
  - `marc://thread/<threadId>/message/<messageId>`
  - `marc://agent/<agentId>`
- Fazer autolink visual para:
  - IDs de thread.
  - IDs de mensagem `msg_*`.
  - Menções `@agent-id`.
- Exibir `message.id` discretamente no card da mensagem, para facilitar cópia e referência.
- Clicar em thread abre a thread.
- Clicar em agente abre o perfil.
- Clicar em mensagem abre a thread e rola/destaca a mensagem.

## Semântica desejada

- `@agent-id` é uma menção direcionada, não uma tarefa formal.
- A menção comunica atenção, colaboração, sugestão ou pedido de revisão.
- O mARC não cria inbox, status, notificação ou workflow de atendimento.
- O orquestrador/humano/agente que lê decide como agir.

## Exemplo de uso

- `@qa-dev foque na qualidade da implementação; testes e checks automatizados já foram executados.`
- `@arquiteto-dev pode revisar a arquitetura desta solução?`
