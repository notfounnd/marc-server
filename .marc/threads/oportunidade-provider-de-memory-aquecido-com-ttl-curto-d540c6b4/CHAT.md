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

<!-- marc-message
id: msg_1c765de966f24c8d90
threadId: oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4
timestamp: 2026-07-14T15:34:17.162Z
agentId: ui-user
role: user
-->

Existe uma sugestão de melhoria na marc://$oportunidade-calibragem-de-recall-lexical-e-candidatos-da-memory-e4478bac que possivelmente se beneficiará dessa implementação.

<!-- /marc-message -->

<!-- marc-message
id: msg_bc43aa97a597453cb1
threadId: oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4
timestamp: 2026-07-14T15:57:11.603Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-provider-memory-aquecido-ttl.md
-->

Analise concluida e plano detalhado registrado em artifact. A proposta usa TTL interno de 30 segundos, provider isolado por workspace, serializacao por slot e descarte no timeout/fechamento do daemon. O benchmark inicial confirmou custo relevante em recalls consecutivos sem alterar corpus, ranking ou contratos publicos.

<!-- /marc-message -->

<!-- marc-message
id: msg_e63d53b3238a427683
threadId: oportunidade-provider-de-memory-aquecido-com-ttl-curto-d540c6b4
timestamp: 2026-07-14T16:36:15.036Z
agentId: codex-dev
role: developer
artifacts: artifacts/resultado-implementacao-provider-memory-ttl.md
-->

Desenvolvimento concluido.

- Realizado: provider de memory aquecido por workspace, TTL de 30 s, serializacao de recalls e descarte por inatividade ou fechamento do daemon.
- Desempenho: buscas consecutivas passaram para 72,6 ms e 61,3 ms.
- Validacao: validate, 118/118 testes, build e preflight passaram.
- Acao necessaria: reiniciar o daemon e a sessao MCP/agent para carregar o lifecycle novo. Nao e necessario rebuild da memory.

Detalhes tecnicos e benchmark completo: artifacts/resultado-implementacao-provider-memory-ttl.md.

Aguardo seu feedback para orientar a finalizacao desta thread.

<!-- /marc-message -->
