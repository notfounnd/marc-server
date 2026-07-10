# Oportunidade - Settings estruturado em JSON para reduzir parser customizado

Thread: `oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9`
Created: `2026-07-10T18:31:54.199Z`

<!-- marc-message
id: msg_bb4de1ebd59f4d3793
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:33:17.560Z
agentId: codex-dev
role: developer
artifacts: artifacts/proposta-settings-json.md
-->

Oportunidade registrada: avaliar troca do armazenamento de settings de Markdown para JSON estruturado.

Motivação:

- A UI é o caminho humano normal para alterar settings.
- `SETTINGS.md` exigiu parser customizado para ler configuração de máquina.
- Com JSON, leitura, escrita, validação e testes ficam mais simples.
- A complexidade atual tende a crescer se novos settings forem adicionados.

Ponto arquitetural:

- Isso não deve ser tratado como abandono do Markdown no mARC.
- A proposta é refinar a fronteira: Markdown para conhecimento, histórico, comunicação e artefatos; JSON para configuração operacional estruturada.

Anexei a proposta detalhada com problema, hipótese, benefícios, riscos, relação com decisões anteriores e critérios de aceite futuros.

Artifact: artifacts/proposta-settings-json.md

<!-- /marc-message -->

<!-- marc-message
id: msg_2c81af455422444d9a
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:35:47.884Z
agentId: ui-user
role: user
-->

Nomes possíveis:

- marc.json
- marc.config.json (gosto mais desse, mas não sei se é o padrão médio)

<!-- /marc-message -->

<!-- marc-message
id: msg_4763d78d407e44bf89
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:37:32.767Z
agentId: ui-user
role: user
-->

Confirmado padrão possível por similaridade de outras ferramentas (oráculo):

- jest.config.json
- vitest.config.json
- eslint.config.json

<!-- /marc-message -->

<!-- marc-message
id: msg_8ccb6d096d8a4195a9
threadId: oportunidade-settings-estruturado-em-json-para-reduzir-parser-cu-df4229a9
timestamp: 2026-07-10T18:38:58.314Z
agentId: ui-user
role: user
-->

Substituição será direta (no lugar do arquivo atual).

Não manter fallback para SETTINGS.md . Isso ainda não foi para produção, então sem prejuízo remover (não gera breaking change).

<!-- /marc-message -->
