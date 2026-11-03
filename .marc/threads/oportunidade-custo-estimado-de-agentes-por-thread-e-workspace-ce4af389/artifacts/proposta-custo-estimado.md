# Custo estimado de agentes por thread e workspace

Autor: marc://@claude-software-architect
Data: 03/11/2026
Estado: oportunidade no radar. Sem plano nem autorização de desenvolvimento.

## 1. Resumo

Mostrar na UI do mARC quanto os agentes consumiram em cada thread e na workspace inteira, em tokens e em dólar estimado. O dólar vem de tokens vezes uma tabela de preços por modelo e é conferido, quando possível, contra o custo que o próprio cliente informa.

O objetivo é visibilidade. O custo não bloqueia nem limita nenhuma ação.

## 2. Origem

- A F0 da ativação por menção mediu o custo de despertar em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf. Despertar quente custa uma fração do frio: numa sessão de cerca de 80 mil tokens no Haiku, US$ 0,0016 contra US$ 0,0132.
- O humano perguntou se esse valor poderia aparecer na thread e somado na workspace.
- Decisões do humano em 03/11/2026:
  - a preocupação com custo existe, mas não deve bloquear;
  - a estimativa usa o consumo real e a tabela de preços do provedor;
  - cruzar consumo e tabela mostra o gasto real do usuário, que na assinatura fica escondido porque o provedor subsidia;
  - o dado não é persistido em Markdown e fica no SQLite do daemon, que não é versionado.

## 3. Por que não vai para Markdown

- Pela ADR 0001, Markdown é a fonte da verdade para registros legíveis: mensagens, artefatos e resumos. Índices, caches e projeções são derivados e recalculáveis.
- O custo estimado é derivado: sai dos históricos locais dos clientes e de uma tabela de preços. Pode ser recalculado a qualquer momento.
- Gravá-lo em `CHAT.md` mudaria a estrutura do registro e geraria diffs a cada turno.
- O daemon já mantém `marc.sqlite` no diretório de dados dele, fora do repositório (`src/daemon/store.ts`). O custo entra ali como projeção, e o mARC deve funcionar sem ele.

## 4. Fontes de dados

| Cliente | Consumo | Custo informado pelo cliente | Estado |
| --- | --- | --- | --- |
| Claude Code | Histórico JSONL da sessão: tokens de entrada, leitura e gravação de cache, saída e modelo, por resposta. Subagentes têm histórico ligado à sessão principal | `total_cost_usd` no modo `-p`, acumulado por sessão | Formato observado na F0 |
| Codex | Uso de tokens por turno, observado pelo App Server e pela execução não interativa | Não informa dólar | Arquivo local de histórico a confirmar |

**Atribuição à thread:** pelo vínculo de sessão da F2. Cada thread tem a sessão do seu arquiteto vinculada. O consumo dessa sessão e dos subagentes dela é atribuído à thread. Sessões sem vínculo entram só no total da workspace, como "não atribuído".

## 5. Cálculo

- **Tabela de preços:** por modelo, com entrada, leitura de cache, gravação de cache e saída por milhão de tokens. A tabela tem data de atualização e pode ser editada pelo usuário. O formato fica em JSON, na configuração, e não em Markdown.
- **Estimativa:** tokens vezes a tabela, por resposta ou por turno.
- **Conferência:** no Claude, comparar a estimativa com o delta de `total_cost_usd` da mesma chamada. Na F0, as taxas que o CLI usou foram: entrada US$ 0,10, leitura de cache US$ 0,01, gravação de cache de 1 h US$ 0,20 e saída US$ 0,50 por milhão de tokens. Divergência acima de uma margem indica tabela desatualizada.
- **Acumulados:** `total_cost_usd` e `duration_api_ms` do Claude são acumulados por sessão na retomada. O valor de cada chamada é o delta. A F0 errou isso uma vez na latência; o importador precisa tratar os dois campos assim.

## 6. Apresentação

- **Thread:** custo estimado por agente e total, em tokens e em dólar, com a nota "equivalente ao preço da API, não é cobrança" e a data da tabela.
- **Workspace:** soma das threads, mais o consumo não atribuído, com filtro por período.
- **Despertares:** quando a F4 existir, cada despertar automático mostra se foi quente ou frio e quanto custou. É aí que o usuário vê o efeito de deixar os arquitetos em uso.

## 7. Relação com a ativação por menção

- **F2:** o vínculo de sessão é pré-requisito para atribuir consumo à thread.
- **F3:** o orçamento e o razão de gasto da F3 podem reaproveitar este importador. O razão é observação, não bloqueio, conforme a decisão do humano.
- **F4:** a política automática pode usar a estimativa para preferir despertar com cache quente. Manter a sessão aberta não mantém o cache: ele só se renova quando a sessão recebe turno. Na F0, o conteúdo da sessão saiu do cache entre 6 e 65 minutos sem uso.

## 8. Riscos e pontos abertos

- **Leitura fora da workspace:** os históricos dos clientes ficam no diretório do usuário. O mARC leria só os campos de consumo. Decidir se a leitura é opcional e ligada pelo usuário.
- **Formato não documentado:** os históricos JSONL dos clientes podem mudar entre versões. O importador deve tolerar campos ausentes e registrar a versão do cliente.
- **Codex:** confirmar onde o uso por turno fica gravado localmente e com que granularidade.
- **Tabela desatualizada:** sem conferência no Codex, a estimativa depende só da tabela. A data dela deve aparecer junto do valor.
- **Assinatura:** o valor mostrado não é o que o usuário paga. A UI deve deixar isso claro sem esconder o número.

## 9. Threads relacionadas

- marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf: medições de custo e cache.
- marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983: vínculo de sessão.
- marc://$oportunidade-terminal-embarcado-para-abrir-agentes-pela-ui-2d4c2799: lançamento de agentes pela UI, que também fixa o `--session-id`.
