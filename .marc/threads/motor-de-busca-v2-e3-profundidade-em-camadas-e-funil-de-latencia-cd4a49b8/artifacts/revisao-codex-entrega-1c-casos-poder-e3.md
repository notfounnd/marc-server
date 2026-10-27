# Revisão independente — E3, Entrega 1c e proposta de casos/poder

Autor: codex-software-architect.
Fontes principais: msg_68555da7a1ec402896, entrega-1c-e3.md, msg_b161968ae18d478d87 e casos-e-poder-e3.md.
Escopo: revisão, sem alteração dos arquivos avaliados e sem execução de captura, rebuild ou Git.

## Vereditos

- **Admissão:** aprovo a correção funcional. A extração de hybridAdmissionOrder reutiliza a ordem de admissão do M0, inclusive o teto apenas sobre os semanticamente elegíveis. Há uma pendência de conformidade nas fixtures novas.
- **Casos:** pendentes de ajustes de exclusividade, consultas e graus. Não aprovo o congelamento dos 52 como estão.
- **Quantidade:** os totais 137/69 e o acréscimo de seis estão corretos. Não coaprovo ainda a justificativa de suficiência estatística.
- **Rank:** coaprovo a proposta da revisão 7, com a semântica por passagem do M0. Essa aprovação é da decisão; o núcleo ainda usa group e a implementação posterior precisa ser verificada.

## 1. Entrega 1c: correção funcional e limites da evidência

Conferi funnel-admission.ts, hybrid-ranking.ts e as extrações de rerankingEntriesOf/applyRerankScores em semantic-ranking.ts. admittedOfCandidates passa por rankThreadCandidates e pela mesma hybridAdmissionOrder do M0 antes do filtro final. Um inelegível não reduz o teto de um elegível.

O arquivo t1f-admission-parity.json registra:
- marc: conjuntos admitidos e primeiro ID iguais em 114/114;
- ledgerline-en: conjuntos admitidos e primeiro ID iguais em 40/40.

validationOf, em scripts/memory-eval/t1e-discordance-prestudy.ts:258, compara conjuntos ordenados por ID e o primeiro ID real, não apenas acerto de Top1-alvo. Isso sustenta os dois números declarados. Não é, sozinho, uma comparação de toda a sequência ou de todos os scores.

Também conferi as tabelas armazenadas. No modo passage, primeiro passo: marc b/c = 2/6 em K=8, 2/4 em K=12 e 2/0 em K>=15; ledgerline 0/0. Os registros de discordância não mostram nova perda de Top1 nem remoção de ganho ao trocar group por passage nas configurações examinadas.

Limites preservados: catálogo aproximado pelos canais da E2, cossenos reconstruídos desses scores, sem as passagens adicionais do catálogo real da E3. Não extrapolo paridade ou poder para a captura nova.

### Pendência de conformidade das fixtures

- test/memory-funnel-admission.test.ts:57: if (group.title).
- test/memory-funnel-admission-m0.test.ts:51: if (passage.title).

As duas condições escolhem a montagem do cenário dentro de helpers. A regra canônica proíbe ramificação nos testes e nas fixtures, mesmo fora do corpo do test. Declarar os hits lexicais ou seus IDs separadamente e montá-los diretamente preserva os mesmos cenários. Aceite: nenhum condicional de cenário nesses helpers, com os testes de paridade ainda passando.

## 2. Casos e escala: ajustes antes do congelamento

### C1 — Y13 não é um caso exclusivamente de camada

scripts/memory-eval/datasets/marc.json:3961.

A consulta pergunta se a ferramenta pode encerrar a thread sozinha ao fim de uma resposta. O SUMMARY.md de 2f441fa7:16 já declara que a autorização humana de encerramento permanece responsabilidade do fluxo do agente. O mesmo resumo distingue a ferramenta que persiste o conteúdo do agente que decide e é autorizado a encerrar.

Defendo grau 3 para esse summary na consulta atual, em vez de 2. A resposta normativa já está na camada 0; a formulação diferente do artifact não torna o fato novo. Substituir o caso por outro fato realmente ausente ou mantê-lo como controle fora da cota layer. Se sair da cota, repor um caso para manter o mínimo de 15 no marc. Não alterar o summary para fabricar exclusividade.

### C2 — Y08/J04: a política de cache já aparece no summary

O SUMMARY.md de 3b4a8787:19 registra “Contratos de cache privado sem TTL”. Portanto, não se pode tratar toda a política como inédita só porque os nomes ttlMs/cacheScope não aparecem literalmente.

- Y08: explicitar que se procuram os nomes e valores exatos dos campos anunciados por descoberta/listagem, se esse for o fato exclusivo pretendido. Revalidar a ausência dessa resposta exata nos summaries.
- J04, marc.json:4096: proponho 2, não 1, para o summary de 3b4a8787: contém parte substantiva da política solicitada, não uma menção incidental.
- J04/d540c6b4: proponho 0, não 1. O summary trata da residência de um provider de embeddings no servidor por 30 segundos, não do cache da lista de tools no cliente. TTL/cache em comum não é o mesmo assunto. Ele continua podendo ser um distrator plausível com grau 0.

### C3 — Não redefinir o grau 2 como localização de uma fonte

casos-e-poder-e3.md:22 atribui 2 quando o summary é do assunto certo e aponta para a fonte. Isso não basta pela escala revisada: 2 exige parte substantiva da resposta. Um link para o artifact ou a promessa de que lá há medições não fornece automaticamente essa parte.

Contraexemplos:
- Y02/174c48b6: proponho 1 para o summary. Ele registra a atualização de lucide-react para obter os ícones, mas não fornece a versão anterior perguntada.
- LY17/c39e5d62, ledgerline-en.json:1423: proponho 1 para o summary. Ele explica derivação e atraso e registra um aviso antes da confirmação da senha; não diz o que a interface mostra durante a derivação. A linha de progresso, no artifact, continua com 3.

Reaplicar a definição original aos demais graus 2 justificados apenas por apontar para o anexo. Não é uma exigência de baixar todos os summaries para 1: onde há resposta parcial real, 2 continua correto.

### C4 — LA04: RULES também responde

ledgerline-en.json:1604 e test/fixtures/memory-eval/ledgerline-en/RULES.md:7.

A consulta pergunta a regra de casas decimais na conversão para minor units, sem pedir os exemplos da tabela. RULES já responde: usar o expoente do código ISO 4217. É o mesmo fato do trecho citado no artifact.

Proponho layerJudgments[1]["@rules"] = 3, em vez de 2. Manter 3 para o artifact OFX. Não exigir a fonte OFX como única resposta correta.

### C5 — Precisar as consultas de latência

- LA02, ledgerline-en.json:1558: “how fast does the transaction list load” não distingue leitura SQL de carregamento/renderização. O artifact de benchmark mede a consulta de leitura; scrolling-measurements.md mede first paint. Não são a mesma medição. Reformular, por exemplo, para perguntar qual orçamento de p95 foi adotado para a consulta de leitura da lista no laptop de referência. O benchmark responde 250 ms; a virtualização continua um distrator plausível. Atualizar a citação/grau conforme a consulta final.
- LY19, ledgerline-en.json:1467: a tabela tem 0,3 s, 0,6 s e 0,9 s para o mesmo lote de mil linhas, conforme o volume. Especificar o cenário de 500.000 linhas se a evidência esperada continuar sendo 0,9 s.

São correções de ambiguidade do gabarito, não de dificuldade da busca. Não avaliar como erro uma resposta alternativa sustentada pelas fontes para uma consulta subespecificada.

### Cobertura e distratores

Li as 52 consultas e suas citações, confrontei as fontes e fiz busca transversal nos summaries fixados; li integralmente os 30 summaries do ledgerline. Os contraexemplos acima já impedem confirmar a alegação universal de exclusividade dos casos tal como está escrita.

Nos demais fatos específicos examinados não encontrei outra contraprova de resposta completa em summary. Isso não equivale a aceitar automaticamente todos os graus a: a regra de atribuição de 2 precisa ser corrigida.

As armadilhas são, em geral, plausíveis: retry versus scheduler, persistência de tema versus migração do settings, parsing CSV versus mapeamento, startup versus derivação de chave, TTL do provider versus cache do catálogo. Plausibilidade como distrator não exige grau 1; um distrator convincente pode e deve ter 0 quando só compartilha vocabulário.

## 3. Evidência compartilhada e threads grandes

Há 23 casos novos no marc com 19 citações textuais distintas; ledgerline tem 29 com 23. Repetições exatas:
- marc: Y05/J06, Y08/J04, Y10/J05 e Y12/J02.
- ledgerline: LY01/LA02, LY03/LA08, LY05/LA05, LY06/LA03, LY08/LA01 e LY09/LA07.

Essas contagens não tornam as demais evidências independentes: fontes e fatos próximos também se correlacionam. Aprovo manter famílias compartilhadas e reportar sobrevivência por caso e por citação única, sem usar duplicatas como novas unidades independentes.

A condição de pelo menos quatro casos layer em threads com 100 ou mais passagens ainda não está demonstrada. Os count.json existentes trazem pares por caso, não o catálogo necessário para comprová-la.

Antes da captura, registrar os IDs dos casos, as threads e a contagem de passagens do catálogo real. Não usar tamanho do CHAT, bytes ou o catálogo aproximado da E2. Y05–Y07 são três layer na 834716ba; Y08–Y09 são dois na 3b4a8787. Só contam para o mínimo os que estiverem em threads que efetivamente atinjam 100.

Nota de relato: essas duas threads têm cinco layer e três armadilhas (J03, J04, J06), não quatro armadilhas como diz casos-e-poder-e3.md:55.

## 4. Quantidade e poder

Confirmo 137 casos no marc e 69 no ledgerline, sendo 123 e 63 positivos por estilo. Os seis extras LY16–LY21 pertencem a quatro famílias já presentes; três deles estão na mesma família da derivação de chave.

As contas por caso são uma aproximação explicitamente declarada, mas não sustentam concluir que 63 positivos resolvem a perda isolada sob a regra real. Fiz uma análise de sensibilidade puramente sintética, em memória, com pairedBootstrap de statistics.ts, sua semente fixa e 10.000 reamostragens, sobre as 31 famílias dos 63 positivos do ledgerline. Cenário: exatamente uma perda e todos os demais pares empatados; não são resultados observados de variante.

- Se a perda está na família @rules: limite inferior = -0,0526315789.
- Se está na família account-linking: limite inferior = -0,0576923077.

Ambos não passam no requisito estrito de limite inferior acima de -0,05. O intervalo varia conforme a família atingida. Isso não é uma estimativa completa de poder nem demonstra que o estudo real falhará; demonstra que a justificativa “uma perda isolada passa” não pode ser transportada do bootstrap por caso para o teste efetivo.

Aceite: refazer a estimativa com a estrutura real de famílias e separar os critérios/cenários avaliados; decidir previamente se a quantidade é mantida ou ampliada com a mesma regra do plano. Não crio um novo limiar de poder, nem autorizo ampliar depois de olhar a qualidade da E3.

Também distinguir a população: acrescentar consultas não aumenta a amostra da comparação DEPTH0 contra o M0 congelado nos casos comuns. Os novos casos ajudam os testes de camada/funil/expansão, não essa comparação histórica.

## 5. Rank proposto: coaprovado

Restaurar a posição global da melhor passagem pontuada é coerente com a fórmula de elegibilidade do M0. Limitar seleção por K/P é um mecanismo distinto de transformar o rank em posição por grupo. A decisão tem fundamento no mecanismo e pode ser registrada antes da captura; o contato com os resultados exploratórios da E2 continua declarado.

Na implementação, reutilizar a semântica dos helpers de produção, incluindo fallback identity-only e desempates/ordem estável. numericRanks usa posição ordinal global; applyBestPassage desempata por denseRank. Não substituir por dense rank de scores empatados ou por desempate novo por groupId.

Aceite da tarefa posterior: com a mesma lista de evidências/scores, paridade com o M0 também em múltiplas passagens, empate de scores e fallback de identity. Não exigir que seleções diferentes por P produzam a mesma saída. Retirar group sem acrescentar configuração é coerente com a proposta.

## 6. Verificação independente e preservação

Executei via context-mode, Node 22/tsx:
- memory-funnel-admission.test.ts;
- memory-funnel-admission-m0.test.ts;
- core-memory-hybrid-ranking.test.ts;
- memory-eval-dataset.test.ts;
- memory-eval-dataset-ledgerline.test.ts;
- memory-eval-t1d-path.test.ts.

Resultado: 27/27, sem skips. Os testes de dataset agora usam validationCorpus/CORPORA e repassam sources a validateDataset, como o comando validate, nos dois corpora. Essa correção está aprovada; validação estrutural não detecta os problemas semânticos de casos e escala acima.

Inspeção AST: sem else ou if aninhado nos quatro arquivos de implementação/harness examinados; as duas condições de fixture estão listadas na seção 1.

Manifest da memória permaneceu com SHA-256 b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a antes e depois desses testes. Não executei a suíte 960/960 do desenvolvedor, pnpm validate, Git, rebuild ou captura. Não alterei datasets, código, testes, docs ou .marc/memory/**. A thread permanece aberta.
