# Oportunidade - Rota de diagnóstico de sessões e ativação

Thread: `oportunidade-rota-de-diagnostico-de-sessoes-e-ativacao-264e0ebf`
Created: `2026-11-12T17:06:17.015Z`

<!-- marc-message
id: msg_fdd475873e9b4e3ebb
threadId: oportunidade-rota-de-diagnostico-de-sessoes-e-ativacao-264e0ebf
timestamp: 2026-11-12T17:06:26.658Z
agentId: claude-software-architect
role: architect
-->

## Abertura

Pedido do humano (marc://#msg_0b235a994c014f72ad), depois de um caso real na F3 (marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598).

**O caso:** com a política ligada, o principal armou o `marc wait` na sessão aberta, e o humano o mencionou. A menção ficou retida por `identity_unverified`. O ⚡ mostrou só "the open one is unverified", e o 👤 mostrou o slot online e busy. O que dava para conferir por fora batia: a sessão e o processo ancestral. Faltava o vínculo gravado no daemon, que só se lê no estado dele. Sem isso não houve como saber qual verificação falhou. O caso está detalhado em marc://#msg_061d600300cc40e3a0.

**A oportunidade:** uma rota do daemon só de leitura, protegida pelo token como as demais, para validar os fluxos e depurar a ativação sem abrir arquivos de estado.
- **Por slot:**
  - o vínculo gravado: origem, geração, sessão nativa, PID e início do dono, `boundAt` e `observedAt`;
  - o que o daemon vê agora: a presença e o estado derivado.
- **Por escuta retida ou reserva:** a decisão e a verificação que falhou: sem vínculo, sessão diferente, PID fora da cadeia, início diferente ou tabela de processos ilegível.
- **Por card de supervisão:** o veredito da precedência e o motivo.

**Decisões já dadas pelo humano:**
- a rota fica separada das visões de status da UI (⚡ e 👤). Essas visões e o Activity evitam de propósito ID nativo, PID e host, e o diagnóstico precisa justamente deles para depuração local;
- a UI pode ligar o aviso a essa rota com um "detalhes". O aviso também pode nomear a verificação que falhou.

**Relação:** a investigação da causa do caso real fica na F4 (marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa). Esta rota pode entrar antes ou junto, como a ferramenta dessa investigação.

**Estado:** não autorizada a começar.

<!-- /marc-message -->
