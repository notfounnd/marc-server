# Parecer independente final da E3

## Veredito

**Coaprovo tecnicamente o estado integrado revisado para avaliação e aceite humano.** Não identifiquei bloqueio técnico nesse estado. O critério 6 permanece pendente por desenho: esta aprovação não autoriza ativar camadas adicionais, executar rebuild produtivo ou encerrar a thread.

A aprovação cobre o código atual, com INDEXED_LAYERS = [0]. Não declara que as camadas 1 e 2 já estejam disponíveis na base produtiva nem estende automaticamente a medição de latência ao índice misto futuro.

## Escopo e fontes

- Revisão integrada: marc://msg_54ac0a83a3a34ef4a5 e revisao-final-e3.md.
- Entrega 2/T5: marc://msg_65ce722086a143ce9a e entrega-2-e3.md.
- T3 reduzida: marc://msg_8b34ae9d5d12405ca5 e entrega-t3-e3.md.
- T4: marc://msg_62522eaca7174abd99 e entrega-t4-e3.md.
- Plano da E3, decisão revisada e meu parecer anterior marc://msg_045816d10190469682.
- Comparações compare-common das capturas marc/87cd2e4d96f7 e ledgerline-en/0d31bd4afd3f; latency-e2e-t5.json.
- Código do recall, camadas, seleção/ranking, comparação de fontes, transportes, UI/snapshot, compare-common e instrumentação de latência.
- ADR 0012, documentação de memória/daemon e atualização do backlog Playwright em marc://msg_4cfad711a1fe4726a5.

Inspeção por context-mode. Depois das verificações, a leitura incremental da thread não retornou mensagens posteriores à revisão integrada.

## Critérios de aceite

| Critério | Evidência confrontada | Parecer |
| --- | --- | --- |
| 1. Decisões de H4, H5, faixas e rebuild registradas | Decisão revisada conserva reprovações de H4/H5 no marc, recuos, aprovação das faixas e D10 conservadora. IC de abstenção agora distingue negative de total. A confirmação humana da máquina de referência está registrada em marc://msg_ce80a9b59c26469bb1; resolve a ressalva anterior sobre os 177 s. | Atendido para a decisão registrada. O tempo/RAM do rebuild foi conferido como evidência documental, não medido de novo por mim. |
| 2. Implementação corresponde à decisão | operations.ts:228–256 usa busca por camada e rankHybridMemoryHits, sem invocar o funil. A consolidação é a do M0, com identidade e até três passagens, não todas as passagens brutas. Depth explícita 0–2 nos transportes; default 0. UI faz uma requisição sem depth e não tem expansão automática. | Atendido no estado preparado, com ativação das camadas adicionais ainda pendente. |
| 3. Retirada do Deep, setting e depth 3 | Busca em src/docs/public não encontrou Deep retry ou recallMemorySearchDepths. searchRetryDepth resta só na explicação da migração de settings; depth 3 aparece na mensagem de rejeição, não como opção válida. Snapshot v7 descarta versões anteriores. | Atendido; não confundo nota de compatibilidade ou mensagem de erro com recurso ainda ativo. |
| 4. Playwright CLI e backlog | Entrega T4 registra 1280×720, 1440×900 e 390×844, busca/status interceptados, uma chamada e hits sem thread. Código desabilita a navegação desses hits e preserva seus caminhos. O backlog foi atualizado e distingue checagem ad hoc de testes duráveis. | Atendido com o limite de browser declarado. Não fiz uma nova execução de Playwright nem declarei E2E durável concluído. |
| 5. Checks e regras | Suíte completa, typecheck sem escrita e ESLint sem fix repetidos independentemente; resultados abaixo. validate/build verdes no estado final constam da revisão do principal. | Atendido com a distinção entre execução própria e evidência relatada. Não executei validate ou build nesta rodada. |
| 6. Rebuild produtivo depois do aceite | INDEXED_LAYERS permanece [0]; o manifest mantém o hash da baseline. | Pendente por desenho, não dispensado nem executado. |

A retirada do funil é efetiva no fluxo de produção. As funções experimentais ainda existem em módulos próprios, usados pelo harness; sua presença no fonte não significa que o recall as chame.

## Não inferioridade de DEPTH0

Conferi os relatórios e o código de compare-common: casos pareados por ID, consulta original, modo e consulta efetiva; os dois lados usam os julgamentos atuais, cada qual com sua captura. Não há exclusão por consulta diferente ou por incompletude nos casos comuns reportados.

| Corpus | Casos comuns | Top1-alvo total | Recall implicit | Abstenção negative |
| --- | ---: | --- | --- | --- |
| marc | 114 | Δ 0; IC [−0,028037; 0,029703] | Δ 0; IC [0; 0] | Δ 0; IC [0; 0] |
| ledgerline-en | 40 | Δ 0; IC [0; 0] | Δ 0; IC [0; 0] | Δ 0; IC [0; 0] |

Todos atendem δ 0,05, com bootstrap pareado por família. Os 23 e 39 casos fora dessas comparações são casos adicionais só da E3, não perdas ocultadas por qualidade.

No marc, cinco sequências admitidas mudam de ordem, mantendo seus conjuntos. Portanto, o resultado sustenta **não inferioridade nos critérios declarados, não identidade histórica**. A linha Top1 implicit inconclusiva é diagnóstico: o critério aprovado pede Top1 total e recall implicit, não Top1 de cada estilo. Não acrescentei esse gate depois da medição.

Isso fecha o aceite que faltava no meu parecer anterior.

## Latência

Recalculei mediana, p95 e razão a partir das 90 amostras cronometradas de cada caminho, sem executar inferência ou regravar o JSON.

| Caminho | Índice | Mediana | p95 |
| --- | --- | ---: | ---: |
| UI, depth 0/length | camada 0 | 11.813,929 ms | 12.904,574 ms |
| Referência M0, depth 0/input | camada 0 | 18.221,243 ms | 19.574,133 ms |
| MCP, depth 2/length | camadas 0, 1 e 2 | 18.131,184 ms | 22.326,590 ms |

**Razão UI/M0 = 0,648360**, abaixo de 1,2. Confirmo o passe para o percurso medido na máquina de referência confirmada pelo humano.

O código de instrumentação cronometra recallMemoryInWorkspace, com providers reais, uma chamada de aquecimento e três medidas por caminho em cada consulta, intercaladas por caso. As 30 consultas e as contagens de pares coincidem com o protocolo/relatório. O M0/input é a aproximação pré-declarada da ordem anterior do reranker, não a execução de um checkout histórico. Não medi transporte HTTP, renderização do navegador ou carregamento frio de modelos.

O MCP/depth 2 permanece apenas reportado. A referência de 5 s não foi atingida e não é um gate. Não converti p95 em novo requisito.

## Limites preservados

1. **Ativação ainda não ocorreu.** A constante do fonte continua [0]; um rebuild ordinário nesse estado continua usando esse default. O passo humano precisa abranger a ativação/autorização correta das três camadas, o rebuild e a confirmação de status ready. Qualquer mudança de código nessa ativação exige revisão e checks afetados; este parecer não a cobre antecipadamente.
2. **Latência do estado futuro.** A UI medida usa índice só da camada 0, não depth 0 sobre um índice misto. O passe atual não é prova dessa segunda condição. A base mista foi usada para medir MCP/depth 2; após a ativação, validar o percurso da UI afetado antes de estender a alegação de latência ao novo estado.
3. **Modelos residentes e carga de desktop.** São medidas aquecidas, em uma máquina e com processos concorrentes. A intercalação reduz viés entre caminhos, mas não elimina variabilidade ou representa toda máquina de 8 GB.
4. **UI e julgamento.** A checagem de browser usou respostas interceptadas, e os cenários E2E duráveis continuam pendentes. O kappa inicial baixo do marc, os trechos truncados na primeira passada de a e as limitações de cegamento já registradas continuam parte da evidência histórica; consenso não as apaga.
5. **Faixas e lacunas.** Faixas continuam heurísticas, com saturação perto de 1. As lacunas de referência da T2 são diagnóstico; não demonstram cobertura integral de conteúdo não julgado. A comparação de DEPTH0 passa nos escopos declarados, sem garantia universal sobre consultas novas.
6. **Escopo de formatação.** Sem Git e sem snapshot completo anterior à execução de validate, não há como certificar retrospectivamente ausência de reformatação fora do escopo. Os checks atuais não substituem essa prova.

Esses limites não contradizem o estado preparado aprovado. Eles delimitam o que pode ser anunciado agora e o que continua dependendo de aceite/ativação.

## Verificação independente

- Suíte completa: node --test --test-concurrency=2 --import tsx test/*.test.ts, com os 171 arquivos explicitamente enumerados. **1.020 aprovados, zero falhas, zero skips; exit 0.**
- Testes focados em 11 arquivos de camadas/transportes, compare-common, UI/snapshot/settings, interpretação e status: **39 aprovados, zero falhas/skips; exit 0.**
- Typecheck: node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit: **exit 0**, no escopo configurado pelo projeto.
- ESLint em src, test e eslint.config.js, sem --fix: **exit 0**.
- Medianas, p95, razão e quantidade de amostras da T5 recalculados em memória; pares UI/M0 correspondentes ao replay.
- Manifest conferido antes e depois dos checks: b96e41ce172065f704bc99ed6ceb02ae21c8648f8a361f16a8f01cc086b9b56a, inalterado.
- A primeira tentativa da suíte global, com concorrência padrão, foi interrompida pelo limite de 110 s e não produziu veredito final. Não foi contada como passe ou como regressão funcional. A execução completa acima terminou com concorrência 2 em cerca de 203 s.
- validate e build não foram repetidos; seus resultados são evidência do principal. Não executei Git, rebuild/capture produtivos ou comandos que regravem medições/datasets.

A aprovação técnica não é aceite humano, ativação produtiva nem autorização de encerramento. Thread mantida aberta.
