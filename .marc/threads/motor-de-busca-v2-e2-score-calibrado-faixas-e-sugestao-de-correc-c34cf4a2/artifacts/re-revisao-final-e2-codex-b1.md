# Re-revisão independente final da E2 após B1

## Veredito

**Coaprovação técnica, com ressalva de validação. B1 encerrado tecnicamente; nenhum novo bloqueio identificado no código revisado.**

A ressalva é uma execução ampla com 743/744 testes, seguida de repetição integral com 744/744. A saída resumida da primeira execução não preservou o diagnóstico da falha. Não atribuo causa nem declaro essa ocorrência resolvida. Os 12 testes focais da correção também passaram em execução separada.

O critério 8 continua condicionado ao aceite humano e à autorização do rebuild produtivo. Não executei rebuild nem encerrei a thread.

## Fontes e escopo

Revisão direta no disco, com context-mode, em resposta à msg_6407a3302fc6468192 e ao artifact revisao-final-e2.md atualizado. Conferi a correção do B1, a costura do daemon, os novos testes, os docs, os ajustes de relato e a justificativa para preservar a medição b72e80e00309.

A análise anterior permanece como base do restante do desenvolvimento. Esta revisão verifica a integração da correção, sem reabrir decisões estatísticas ou critérios já coaprovados.

## B1: correção conferida

Em `src/core/memory/operations.ts:237-257`, a lista deduplicada admitida fica em `admitted`; só `results` sofre o corte por `limit`. O booleano usa `admitted.length === 0`.

Assim, uma busca com admitidos e `limit` zero ou fracionário não é rotulada como abstenção. A correção não muda os argumentos do ranker, a deduplicação, a ordem, o score, as faixas ou o corte da resposta. `nextActions` continua baseado nos resultados retornados, como antes.

Não foi necessário alterar o domínio de limites aceitos pelo HTTP ou pela CLI. A solução satisfaz a alternativa de correção no núcleo indicada no parecer anterior. A distinção entre resposta vazia por truncamento e ausência de admissão agora corresponde ao contrato documentado.

## Costura do daemon

- `src/daemon/server.ts:27-38`: dependência comportamental separada de DaemonConfig, opcional no segundo argumento de createDaemonServer; o padrão é a função real recallMemory.
- `server.ts:147-154`: a função selecionada segue para o contexto das rotas.
- `src/daemon/routes.ts:34-41` e `src/daemon/memory-routes.ts:21-29`: o contexto carrega a função com o tipo do contrato real.
- `memory-routes.ts:51-72`: autenticação e despacho do servidor, leitura/validação da entrada, resolução do workspace e serialização permanecem no fluxo real; a chamada usa context.memoryRecall.
- O chamador produtivo em server.ts continua chamando createDaemonServer(config), sem substituição de dependência. Os demais chamadores encontrados sem fixture também usam o padrão.

A costura é pequena, explícita e restrita à função necessária. Não coloca comportamento em configuração persistida nem exige mock de módulo. O teste positivo usa o core real com provedores e store controlados; não é um teste que devolve um resultado pronto inventado no limite HTTP.

## Testes e documentação

- `test/core-memory-recall-abstained.test.ts:163-198`: três cenários declarados, limites 0, 0.5 e 5, verificando tamanho e abstenção falsa.
- `test/daemon-memory-search.test.ts:137-173`: workspace temporário, núcleo real com provedores falsos e servidor HTTP real.
- `:208-219`: resposta positiva, uma thread com faixa correspondente ao score e abstenção falsa.
- `:221-231`: limite zero, resposta vazia e abstenção falsa.
- Os casos anteriores de ausência real de admitidos, índice indisponível, manifest vazio e lock ocupado continuam na suíte focal.
- Inspeção AST dos trechos novos de testes: nenhuma ramificação de cenário por if, switch ou ternário.

O teste HTTP de limite fracionário não foi acrescentado, mas o núcleo cobre esse caso e o parser HTTP não mudou. Isso não deixa o B1 pendente: o limite zero reproduz a costura HTTP que falhava, e ambos os limites exercitam a mesma decisão corrigida no núcleo.

`docs/memory.md:204` e `docs/mcp-tools.md:101` dizem expressamente que abstained reflete admissão, independentemente do limite. O texto corresponde ao código.

## Relato e medição

Os dois ajustes pedidos foram aplicados:

1. O manifest tem **60 registros**, confirmado por leitura. SHA-256 preservado:
   `1540264d0d52643474c62104d58050de46324c92280adbe77214dd0724f2045d`.
2. A revisão identifica que a latência medida é a de **recallMemoryInWorkspace**, sem wrapper público nem transportes HTTP/MCP. Não trato essa medição como tempo completo de UI.

### Dispensa de recaptura

Confirmei o fingerprint derivado do código atual: **5bd43e2180bb**. Não existe uma nova pasta de captura com esse ID; ele não deve ser apresentado como nova evidência medida.

Fiz uma conferência adicional sem escrever arquivos: reconstruí em memória apenas as três alterações textuais do B1 em operations.ts e recalculei o hash dos 54 arquivos TypeScript do núcleo, pelo mesmo algoritmo do harness.

- Hash atual: `4481abdf4519784c9b849ab630660bf8e2283f7a23d15192515474aae307ae88`.
- Hash após desfazer só B1 em memória: `3ca175eadeb66278246a3a8d5804d3deeaa55f892f9a22c33ba99e0f6f646758`.
- Esse segundo valor é exatamente o sourceHash da captura **b72e80e00309**.

Isso demonstra que, dentro da árvore que o harness inclui no sourceHash, a diferença em relação à medição é precisamente essa correção posterior ao ranking. A mudança não acrescenta inferência, acesso ao store ou percurso de candidatos; apenas preserva a referência da lista e lê seu tamanho antes do truncamento. A costura do daemon fica fora do caminho cronometrado.

**Concordo em não recapturar.** A medição anterior sustenta a mesma cadeia de busca e a comparação de custo já feita; não afirmo que o novo fingerprint tenha sido medido. O booleano muda justamente nos limites que esvaziam uma lista admitida, mudança intencional e agora coberta por regressão.

## Validação independente e limites

Com Node **v22.20.0**:

- Typecheck sem emissão: passou.
- Suíte ampla, primeira execução: 743/744, uma falha; diagnóstico não conservado na saída resumida.
- Suíte ampla repetida: **744/744**, zero falhas, cancelamentos ou skips.
- Suíte focal dos dois arquivos de teste: **12/12**, zero falhas.
- ESLint sem escrita nos quatro arquivos de produção e dois de teste da correção: passou.

Uma tentativa inicial via executável do runtime Bun não conseguiu carregar tsx e não executou a suíte; foi descartada como evidência e substituída pelas execuções explícitas com Node descritas acima.

Não repeti build, Playwright ou medições de latência. As evidências dos executores para esses checks permanecem identificadas como tais. A UI não foi alterada pela correção.

Hash agregado antes/depois de **1.089 arquivos** em src, test, scripts, docs, public, .marc/memory, package.json e pnpm-lock.yaml: **idêntico**. Sem Git, rebuild produtivo, pnpm validate ou edição dos arquivos protegidos.

## Resultado integrado

Os critérios 2 e 4 deixam de ter o bloqueio B1. A correção preserva a decisão coaprovada e os limites aceitos da entrega. As demais conclusões técnicas anteriores permanecem, com os relatos de manifest e latência corrigidos e a ressalva da primeira execução ampla explicitamente registrada.

A coaprovação técnica não substitui o aceite humano, a autorização do critério 8 ou a autorização de encerramento.
