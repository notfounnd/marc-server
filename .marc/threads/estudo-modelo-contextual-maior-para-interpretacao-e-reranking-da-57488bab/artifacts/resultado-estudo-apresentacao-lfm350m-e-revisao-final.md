# Estudo da apresentação da tarefa ao LFM 350M

## Decisão

Não aplicar as apresentações A ou B na busca produtiva. Nenhuma atingiu os critérios registrados antes do experimento. A bateria completa não foi executada, conforme a regra de interrupção do plano.

Reescrever as instruções não trouxe uma melhora confiável nesta rodada. O teste de ordem demonstrou uma influência importante da apresentação sobre a escolha, mas essa influência não virou uma decisão semanticamente confiável.

O estudo está concluído e revisado como experimento. A hipótese de promover uma destas duas apresentações foi rejeitada. A thread permanece aberta para avaliação do usuário. Não houve troca de modelo, alteração de parâmetros produtivos ou implementação de novos comportamentos.

## O que foi comparado

O modelo permaneceu onnx-community/LFM2.5-350M-ONNX, Q4, no Transformers.js 4.3.1 com ONNX Runtime Node 1.30.0. CPU com duas threads intra-op e duas inter-op, do_sample false e max_new_tokens 4.

O piloto teve 16 casos: seis erros de escrita legítimos, seis alterações que deveriam ser rejeitadas e quatro consultas históricas válidas. Foram comparados o formato atual, uma reformulação A e uma reformulação B, cada um nas ordens normal e invertida. Todas as chamadas foram sequenciais, em um único processo experimental. Foram registradas 96 chamadas reais, sem erros do provider, saídas inválidas ou retries.

As consultas, alternativas e expectativas vieram da evidência congelada da rodada anterior. Não foram recalculadas a partir do full rebuild recente. Na ordem invertida, a indicação de qual opção era a original foi corrigida tanto nas instruções quanto no feedback, e a resposta foi remapeada para o índice canônico antes do avaliador produtivo.

As apresentações A e B não incluíram exemplos resolvidos, termos da bateria, dicionários, listas por idioma ou exceções para palavras. Nenhum destes recursos foi adicionado ao projeto.

## Resultados na ordem normal

| Apresentação | Erros de escrita corrigidos | Alterações indevidas rejeitadas | Consultas históricas válidas preservadas | Total correto |
| --- | --- | --- | --- | --- |
| Atual | 6/6 | 0/6 | 0/4 | 6/16 |
| A | 6/6 | 0/6 | 0/4 | 6/16 |
| B | 6/6 | 1/6 | 0/4 | 7/16 |

Os critérios mínimos eram 5/6 positivos, 4/6 negativos e 3/4 consultas históricas, nas duas ordens. O ganho isolado de B foi insuficiente, especialmente porque nenhuma apresentação preservou as quatro consultas reais válidas.

A rejeição adicional de B ocorreu no par sintético invoice/involve. Não foi um ganho nas consultas históricas. O estudo não autoriza extrapolar esse acerto para outras consultas, para todos os idiomas ou para a qualidade do ranking.

## Resultados com as opções invertidas

| Apresentação | Erros de escrita corrigidos | Alterações indevidas rejeitadas | Consultas históricas válidas preservadas | Total correto |
| --- | --- | --- | --- | --- |
| Atual | 0/6 | 6/6 | 3/4 | 9/16 |
| A | 1/6 | 5/6 | 2/4 | 8/16 |
| B | 2/6 | 1/6 | 1/4 | 4/16 |

Inverter as opções no formato atual fez o modelo rejeitar as seis mudanças indevidas, mas também fez perder os seis erros legítimos de escrita. Isso não é uma melhoria equilibrada e não justifica simplesmente trocar a ordem em produção.

A estabilidade mede escolher o mesmo texto nas duas ordens, não devolver o mesmo número:

| Apresentação | Mesma escolha textual nas duas ordens | Mínimo registrado |
| --- | --- | --- |
| Atual | 1/16 | 14/16 |
| A | 4/16 | 14/16 |
| B | 9/16 | 14/16 |

B foi mais estável, mas continuou errado em muitos casos. Estabilidade, sozinha, não substitui assertividade.

## O que esses resultados significam

No formato atual normal, todas as 16 respostas foram 1, reproduzindo o comportamento da rodada anterior nesses mesmos casos. A também devolveu 1 em todas as 16 chamadas normais. B devolveu 1 em 15 e 0 em uma. Os bons números nos positivos não demonstram, por si só, reconhecimento confiável de typos: aceitar praticamente todas as alternativas acerta os positivos e erra as consultas que deveriam ser preservadas.

Com a ordem invertida, o formato atual devolveu 1 em 15 casos e 0 em um. A devolveu 1 em 12 e 0 em quatro. B devolveu 1 em seis e 0 em dez. Há influência da apresentação, mas nenhuma das reformulações alcançou a combinação necessária de correção, preservação e estabilidade.

O experimento não isolou preferência pelo rótulo numérico de preferência pela posição ou pelo restante do texto. Não prova que o modelo é incapaz de realizar qualquer outra formulação desta tarefa. Prova que estas duas reformulações, sob o contrato e parâmetros fixos, não oferecem segurança suficiente para aplicação.

Não recomendo continuar ajustando estas instruções indefinidamente. O limite de duas alternativas foi respeitado, sem abrir uma terceira depois de observar os erros. Também não foram alterados temperatura, quantização, limite de tokens, score, candidatos, embeddings ou reranking para perseguir um resultado melhor.

## Recursos e timeout

A soma dos tempos das 96 tentativas de geração foi de 304,009 segundos, aproximadamente cinco minutos. É tempo observado das tentativas, não o tempo total do processo com carregamento e descarte.

Na ordem normal, as medianas por chamada foram aproximadamente 2,95 segundos no formato atual, 3,23 segundos em A e 3,13 segundos em B. Esses números são observacionais, não uma comparação de desempenho certificada com a rodada anterior.

O cliente MCP atingiu seu timeout de 300 segundos antes de receber o retorno final. O checkpoint atômico preservou os 16 casos e as 96 chamadas completas. Não foi iniciada uma duplicata nem uma retomada. A conclusão veio do checkpoint completo, não do sucesso da chamada de ferramenta.

O pico de RAM e o exit code do worker não foram recuperados pelo retorno que expirou. Não apresento uma medição de RAM desta rodada nem certificação para PCs de 8 GB. O runner garante descarte do pipeline em finally. Uma inspeção posterior, em Bash, listou os processos Node ativos e não encontrou processo com início na janela do piloto.

Não houve download ou cópia de pesos. Os arquivos do interpretador e dos outros modelos produtivos permaneceram idênticos. O diretório temporário desta rodada contém 11 arquivos, totalizando 351.711 bytes, incluindo código, testes e checkpoint. A evidência anexada tem 206.715 bytes.

## Verificação independente dos resultados

O principal recalculou os 96 resultados a partir das respostas brutas e da ordem exibida. Verificou índice canônico, texto escolhido, aplicação ou sugestão de correção e expectativas das fixtures. Foram encontradas zero divergências entre essa recomputação e os records publicados pelo runner.

A evidência anexada é uma cópia JSON compacta exata do checkpoint, sem descarte de mensagens, tentativas ou campos. A comparação de serialização foi verdadeira.

- Fingerprint da execução: fe6c245d972aee4b6dd281090a7adf6121bf993873a38e0ff26d5f2b96ec58ef.
- SHA-256 da evidência anexada: 25500450e4722389410ad34711f5b28fd42d309d19399768ba09b73e1d8b1063.
- SHA-256 do checkpoint original: 78f07c493748fee47de870c8d3a09488d884d51e550a6e1a037d72a50c323248.
- Geração textual congelada: 20261012171458084_59902dec, 338 linhas.
- Geração produtiva após o rebuild do usuário: 20261013051147276_6cfe9a14, preservada.

## Revisão integrada final do principal

### Escopo e fontes revisados

A revisão cobriu os dez arquivos temporários do runner e dos testes, o plano registrado, a evidência anterior congelada, a evidência nova de 96 chamadas, as funções produtivas de avaliação e interpretação, configuração e arquivos locais do modelo, documentação de memória, desenvolvimento e workflow, contrato de bootstrap e entrega própria do desenvolvedor.

O principal verificou o bootstrap independente e autorizou explicitamente as edições somente no diretório temporário. A entrega do executor foi publicada pelo próprio codex-dev na mensagem msg_c469c7e5c22947d081. O principal não a retransmitiu como sua.

### Avaliação técnica e científica

A composição das mensagens respeita os dois prompts predefinidos e mantém o baseline normal byte a byte. A ordem invertida atualiza as referências de original e alternativa também no feedback, sem instruções contraditórias. O remapeamento guarda simultaneamente resposta bruta, índice exibido, índice canônico e texto escolhido.

O avaliador reaproveita o contrato produtivo, incluindo sugestão sem aplicação, retry e retorno literal. A reconstrução das 23 flags históricas de sugestão foi cruzada com as fixtures e outcomes antigos. Os cinco casos históricos com gold null na fixture e 0 na evidência permanecem no-call e não são convertidos em acertos.

Na revisão, foram corrigidas inconsistências do runner experimental antes da inferência: contabilização de inválidos, checagem de erros na ordem invertida, cobertura de IDs sem duplicações ou ausências, importação e resolução de dependências, metadados da geração congelada e limites de tamanho e fluxo dos arquivos. A revisão final verificou as correções no estado integrado, não apenas a passagem de testes.

Os critérios de avanço foram executados sem flexibilização. Não há apresentação aprovada, portanto não há evidência para promoção nem razão para executar a matriz completa nesta rodada. O resultado negativo é válido e útil, mas permanece limitado ao piloto e às duas reformulações testadas.

### Validação efetivamente executada

O principal executou novamente, no estado final:

- 22/22 testes do runner isolado.
- 30/30 testes existentes de contratos de benchmark e interpretação.
- Total focado 52/52, zero falhas e zero skips.
- CLI real --validate-inputs, exit 0, 62 casos congelados, arquivos e hashes corretos, pipelineLoaded false, runtime 4.3.1 e ONNX Runtime 1.30.0.
- Inspeção AST dos dez arquivos: nenhum else, nenhum if aninhado e nenhum if, switch, ternário ou skip nas fontes de testes. Todos os arquivos têm até 300 linhas não vazias.
- Recomputação independente das 96 respostas, zero divergências.
- Verificação de equivalência da evidência anexada com o checkpoint completo.
- Comparação SHA-256 antes/depois do código, scripts, testes, docs, skill, AGENTS, README, RULES, INSTRUCTIONS, package.json, lockfile, índice do Git, 14 arquivos de modelos e 482 arquivos da memória real: nenhum grupo mudou.
- MCP memory_status final: ready, 53/53 summaries indexadas, sem ausências, stale ou extras; os três modelos continuam preparados.

A classificação é estudo isolado e registros mARC, sem alteração de tooling ou código produtivo e sem declaração release-ready. Não executei pnpm validate em modo de escrita, pnpm build ou a suíte completa de produto para esta rodada sem mudanças produtivas. Os 52 testes focados não são apresentados como a suíte completa. Validação de navegador não se aplica.

### Limites e conformidade do processo

O desenvolvedor relatou uma leitura de skill via PowerShell durante a preparação, em desacordo com a orientação de Bash. Não houve edição por esse caminho, e a invocação não se repetiu no runner ou na validação final. Essa falha de processo foi registrada, não tratada como cumprimento integral da regra.

Também houve uma chamada MCP de recuperação antes do runner, capaz de acionar a interpretação produtiva. Nenhum resultado dessa chamada entrou nas métricas do estudo. A contagem de 96 refere-se às chamadas experimentais registradas, não a toda inferência possivelmente realizada pelo ecossistema durante o onboarding.

A revisão anterior do desenvolvedor apontou quatro referências de artefatos históricos ausentes. Elas não foram alteradas ou usadas como evidência desta rodada. Os novos arquivos e anexos foram verificados diretamente. A auditoria estrutural não substitui esta avaliação técnica.

### Veredito

Aprovado como runner e estudo controlado concluído, com os limites de observabilidade e processo registrados. Rejeitada a aplicação das apresentações A ou B. A busca produtiva foi preservada, não está sendo declarada perfeita e não recebeu qualquer mudança desta rodada.

## Próxima decisão

O usuário pode avaliar esta evidência ao retornar. Não será feita nova calibração, terceira apresentação, troca de modelo ou implementação produtiva automaticamente. A hipótese de que estas duas reformulações resolveriam a fragilidade não foi confirmada. O estudo sugere cautela com decisões baseadas em índices numéricos e com acertos em typos sem medir falsos positivos, mas não define sozinho uma nova arquitetura.

A thread permanece aberta. Aceite humano e autorização de encerramento continuam pendentes.
