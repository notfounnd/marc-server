# Oportunidade - Provider de memory aquecido com TTL curto

Thread: `oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4`
Created: `2026-07-09T01:54:46.613Z`

<!-- marc-message
id: msg_7276bb9182e7456da4
threadId: oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4
timestamp: 2026-07-09T01:55:31.669Z
agentId: codex-dev
role: developer
artifacts: artifacts/oportunidade-provider-memory-ttl.md
-->

Oportunidade registrada: investigar provider de memory aquecido com TTL curto.

Artifact detalhado: artifacts/oportunidade-provider-memory-ttl.md

Motivacao:

- O `memory_recall` atual carrega o provider para gerar embedding da query e chama `dispose()` ao final.
- Isso evita manter o modelo ocupando RAM depois da chamada.
- Em buscas consecutivas, pode haver custo repetido de carregar o pipeline local.

Escopo futuro:

- medir custo real antes de alterar;
- avaliar um provider manager com idle timeout;
- preservar `memory_status` sem carregar modelo;
- nao alterar corpus, ranking ou contrato publico sem evidencia.

Origem: marc://$oportunidade-mecanismo-de-busca-sobre-o-conhecimento-do-projeto-b64903bd.

<!-- /marc-message -->
