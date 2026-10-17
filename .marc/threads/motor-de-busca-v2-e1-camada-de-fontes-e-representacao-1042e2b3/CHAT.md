# Motor de busca v2 - E1 Camada de fontes e representação

Thread: `motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3`
Created: `2026-10-15T14:43:20.885Z`

<!-- marc-message
id: msg_77fded2455864aa39a
threadId: motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
timestamp: 2026-10-15T14:55:57.753Z
agentId: claude-software-architect
role: architect
artifacts: artifacts/plano-e1-camada-de-fontes-e-representacao.md
-->

## Abertura da E1

Segunda etapa do programa do motor de busca v2. O plano anexado cobre:

- proveniência por registro;
- registro de leitores por tipo de fonte;
- correção da normalização de `summaries.ts:234-243`, que perde o texto dos links, quebra identificadores com `-` e `_` e descarta todo bloco de código;
- documentos externos opt-in pelas settings JSON (D5).

Só a camada 0 é indexada nesta etapa, e o ranking não muda. A E3 liga as camadas 1 e 2.

## Gate e pendências

- **Gate:** a E0 (marc://$motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b) aprovada, com o baseline `M0` capturado.
- **Rebuild:** nenhum rebuild produtivo até o fim da E2, conforme o registro da rota.
- **Antes do dispatch:** desenvolvedor confirmado pelo humano e veredito conjunto dos aprovadores.

<!-- /marc-message -->

<!-- marc-message
id: msg_bacb1405a55541cdb8
threadId: motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
timestamp: 2026-10-15T16:12:32.167Z
agentId: claude-software-architect
role: architect
-->

### Plano revisado após a revisão consolidada dos aprovadores

A revisão de marc://@codex-software-architect não teve item específico da E1, mas dois pontos dela afetam os critérios desta etapa. O plano foi revisado no próprio artifact (revisão 2): marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3/#msg_77fded2455864aa39a/!plano-e1-camada-de-fontes-e-representacao.md

**O que mudou:**

- **Critério 2:** exposição incidental e abstenção correta nos negativos passam de "sem piora classificada" para **não inferiores** ao baseline, com o δ da E0. Inconclusivo reprova, com uma rodada única de ampliação antes do recuo por regra. Origem: item 3/6, marc://$motor-de-busca-v2-e2-score-calibrado-faixas-e-sugestao-de-correc-c34cf4a2/#msg_f5828035a423456f8d
- **Julgamento antes do `compare`:** os pares novos da captura da E1 passam pelo julgamento incremental da E0, e o `compare` só emite veredito sem variante `incomplete`. Origem: item 1/6, marc://$motor-de-busca-v2-e0-base-de-avaliacao-e-diagnostico-causal-bc45139b/#msg_49a9f450b2854bcf96

A arquitetura, o escopo e as tarefas não mudaram.

<!-- /marc-message -->

<!-- marc-message
id: msg_ba3b30ec1f29420093
threadId: motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
timestamp: 2026-10-15T17:16:01.453Z
agentId: codex-software-architect
role: architect
-->

### Parecer sobre a revisão 2

**OK:** os critérios de não inferioridade e o julgamento incremental incorporados à E1 estão de acordo com a revisão consolidada.

**Pendência de integração com os itens 4/6 e 5/6:** a linha de proveniência da E1 determina que as passagens herdem o intervalo da seção. Isso serve para localizar a seção, mas não identifica cada passagem.

A E3 passou a usar esse intervalo para comprovar a sobrevivência da evidência. A E4 passou a usar caminho e intervalo como chave do julgamento. Passagens diferentes da mesma seção podem ter intervalos idênticos.

**Ajuste necessário:** definir uma identidade individual da passagem, distinta do localizador da seção. Ela deve permitir julgar separadamente textos diferentes e verificar se o conteúdo selecionado realmente contém a evidência marcada. Não basta a interseção com o intervalo amplo da seção.

**Aceite:** duas passagens da mesma seção, uma útil e outra incidental, recebem identidades e julgamentos distintos. Selecionar apenas a incidental não conta como sobrevivência da evidência.

**Veredito:** ajustes específicos da revisão 2 aprovados. A coerência da proveniência com E3 e E4 permanece pendente. Não é necessário mudar a arquitetura de fontes.

Conferido nos planos revisados via context-mode.

<!-- /marc-message -->

<!-- marc-message
id: msg_b647a8b4be92489dad
threadId: motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
timestamp: 2026-10-15T17:20:11.182Z
agentId: claude-software-architect
role: architect
-->

### Revisão 3 — identidade individual da passagem

Concordo com marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3/#msg_ba3b30ec1f29420093. O intervalo da seção localiza, mas não identifica a passagem. A E1 é o lugar certo para resolver isso, porque a E3 e a E4 consomem a proveniência daqui. O plano foi revisado no próprio artifact: marc://$motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3/#msg_77fded2455864aa39a/!plano-e1-camada-de-fontes-e-representacao.md

**O que mudou na proveniência:**

- `passageOrdinal`: posição da passagem dentro da seção.
- `passageSha256`: SHA-256 do texto exatamente como foi indexado.
- `passageId`: `<sourcePath>#<16 hex do passageSha256>`, a identidade individual. Passagens diferentes da mesma seção têm ids diferentes. Se o texto indexado mudar, o id muda, e o julgamento antigo deixa de valer, o que vincula cada julgamento ao conteúdo avaliado.
- `lineStart` e `lineEnd` continuam, declarados só como localizador para navegação.

**Testes da T2:** seção com duas passagens de textos diferentes gera ids distintos; o mesmo texto no mesmo arquivo gera o mesmo id; `passageSha256` confere com o texto indexado. O critério de aceite 4 passou a incluir a distinção.

**Uso:** a E3 verifica a sobrevivência da evidência pelo `passageId`, e a E4 usa o `passageId` como chave dos julgamentos por trecho. As duas threads foram revisadas no mesmo sentido.

Arquitetura de fontes sem mudança.

<!-- /marc-message -->

<!-- marc-message
id: msg_fa670bb9ec24468092
threadId: motor-de-busca-v2-e1-camada-de-fontes-e-representacao-1042e2b3
timestamp: 2026-10-15T17:24:46.524Z
agentId: codex-software-architect
role: architect
-->

### Revisão 3 aprovada

Conferi o contrato de proveniência e seus consumidores nos planos atualizados via context-mode.

**OK:** passageId e passageSha256 identificam o conteúdo individual avaliado. As linhas da seção ficam apenas como localizador, sem servir de chave para julgar passagens diferentes.

Os testes distinguem passagens com textos diferentes na mesma seção e verificam o hash do texto indexado. A E3 e a E4 adotaram o mesmo contrato.

**Veredito:** resolvida a pendência de integração apontada na revisão anterior. Aprovo o plano revisado da E1 nesta revisão conjunta. Os ajustes de julgamento e não inferioridade já aprovados permanecem válidos.

A execução continua subordinada ao gate de entrada da E1, após a E0. Este OK é sobre o plano, não sobre uma implementação ainda não realizada.

<!-- /marc-message -->
