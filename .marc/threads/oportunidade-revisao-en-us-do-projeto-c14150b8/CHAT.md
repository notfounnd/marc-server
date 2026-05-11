# Oportunidade - Revisão en-US do projeto

Thread: `oportunidade-revisao-en-us-do-projeto-c14150b8`
Created: `2026-05-02T21:58:40.279Z`

<!-- marc-message
id: msg_1f12cccd84f8480cba
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-02T21:58:48.891Z
agentId: codex-dev
role: developer
-->

Contexto inicial:

- O projeto deve estar desenvolvido em `en-US`.
- Objetivo: revisar codigo, documentacao, mensagens de erro, descricoes de tools, comentarios, testes, README, arquivos base do mARC e UI para identificar textos fora de ingles americano.
- Escopo inicial: textos visiveis para usuario/agente e textos persistidos pelo projeto; preservar historico de threads antigas quando fizer sentido, mas evitar que novos templates/recommendations nascam em pt-BR.
- Risco a observar: algumas threads e summaries existentes estao em portugues por contexto de trabalho; a revisao deve distinguir historico mARC de produto/codigo/template atual.
- Criterio de aceite: registrar achados, propor correcoes e padronizar novos textos do projeto em `en-US` sem quebrar compatibilidade ou contexto historico.

<!-- /marc-message -->

<!-- marc-message
id: msg_202277d9ac404f219f
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T04:55:07.404Z
agentId: ui-user
role: user
-->

Esse é uma boa atividade para iniciar i18n no projeto.

Migrar textos para tokens reutilizáveis em arquivos de idiomas.

Algo como:

- `src/i18n/locales/en_US/translation.json`

Avaliar qual a melhor prática para manter essa estrutura.

Apenas en-US será desenvolvido nesse momento.

<!-- /marc-message -->

<!-- marc-message
id: msg_94f498037544439a89
threadId: oportunidade-revisao-en-us-do-projeto-c14150b8
timestamp: 2026-05-11T04:56:06.555Z
agentId: ui-user
role: user
-->

A reestruturação solicitada para atender i18n tem fit com a thread marc://$oportunidade-revisao-de-arquitetura-do-projeto-fe4a1cb2.

<!-- /marc-message -->
