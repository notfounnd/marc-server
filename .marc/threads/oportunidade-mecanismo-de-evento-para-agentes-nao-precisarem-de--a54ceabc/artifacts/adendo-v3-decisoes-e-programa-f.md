# Adendo à proposta v3 — decisões humanas e programa F

Autor: marc://@claude-software-architect
Data: 31/10/2026
Base: proposta v3 de marc://#msg_b57b3747c091448bbd, aprovada para decisão humana em marc://#msg_49dfcd6a7f884644ab.
Natureza: registro das decisões do humano no chat. Prevalece sobre a v3 onde houver diferença. Sem implementação.

Depois da aprovação do Codex, fiz na v3 os dois ajustes de precisão que ele sugeriu sobre restauração antiga, nas seções 6 e 10. A seção 9 da v3 é decidida aqui.

## 1. Decisões confirmadas

| # | Decisão | Resultado |
| --- | --- | --- |
| 1 | Supervisor | Dentro do daemon, opt-in por thread, sem inicialização no login |
| 2 | Implantação | F1 e F2 primeiro; a ativação começa em modo confirmar |
| 3 | Orçamento | 3 passagens por estágio, com a proposta como estágio próprio |
| 4 | Avanço de estágio | Agente avança só com saldo e referência à condição do plano; estágio esgotado exige decisão humana |
| 5 | Sessão sem daemon | Bloqueia a automação naquela thread |
| 6 | Dev fixo | Por último |
| 7 | Thread do modo online | Absorvida por este programa, seção 4. Substitui "reconciliar depois" |

**Restauração antiga:** risco aceito pelo humano, com criticidade baixa. O pior caso é uma rodada adicional de ciclos, ainda limitada. A condição da F4 fica atendida por esta decisão.

## 2. Ideias do Tucano incluídas

Vieram da leitura do fonte fixado (SHA c8b2bc47), por decisão do humano. Elas são posteriores à revisão do Codex, que as avaliará nos planos das fases.

| Ideia | Fase | Efeito no desenho |
| --- | --- | --- |
| Gravar estágio e número da passagem no bloco da própria mensagem do `CHAT.md` | F3 | Contagem de passagens passa a ser derivada do Markdown. Substitui o piso calculado da v3, seção 6 |
| Interruptor global "Pausar tudo", por workspace | F3 | Impede novas ativações em todas as threads; complementa a revogação por thread |
| Limite de menções por mensagem | F6 | Evita acionar vários participantes de uma vez; só importa com perfis fixos |
| Aviso uma vez em 80% do orçamento; aviso único no fim da cadeia; aviso quando o agente pede algo ao humano | F2 e F3 | Alimenta a visibilidade de pendências |

**Correção à v3:** a seção 6 dizia que o desenho não exigia mudar o formato das mensagens. Com a primeira ideia, ele exige um campo opcional no bloco da mensagem. Isso é mudança de contrato de parsing e persistência, com validação completa.

**Salvaguarda da primeira ideia:** o número é carimbado pelo MCP a partir da reserva, nunca informado pelo agente. Tentativas continuam no registro local.

## 3. Adiado

Acompanhar o run ao vivo na UI, com SSE, parsers de saída e cancelamento pela UI, e o suporte a outras CLIs ficam registrados em marc://$oportunidade-acompanhar-run-ao-vivo-na-ui-e-suporte-a-outras-cli-d04d2f9b.

## 4. Thread do modo online

Autorizado o encerramento de marc://$oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5 como absorvida:

| Item do modo online | Destino |
| --- | --- |
| Modos `auto` e `semi` | Automático limitado (F4) e confirmar (F3) |
| Agentes permitidos | Participantes elegíveis (F3) |
| Hop counter e limite de custo | Orçamento e limites separados (F3) |
| Master switch do workspace | "Pausar tudo" (F3) |
| Daemon cria run e inicia a CLI | Supervisor e adaptador (F3 e F5) |
| TTL de confirmações pendentes | Pendências; prazo a definir na F3 |
| Runs ao vivo por SSE e cancelamento | Oportunidade da seção 3 |

## 5. Programa F

Cada thread abre com escopo, dependência e critério de entrada. **Nenhuma está autorizada a começar.** O plano detalhado existe só na F0, porque o resultado dela pode mudar as fases seguintes.

| Thread | Depende de | Plano detalhado |
| --- | --- | --- |
| marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf | Nada | Anexado |
| marc://$ativacao-por-mencao-f1-nucleo-e-marc-wait-manual-5b4a0ab1 | Pode correr junto com a F0 | Depois de abrir a F0 |
| marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983 | F0 e F1 | Quando a F0 terminar |
| marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598 | F2 | Quando a F2 terminar |
| marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa | Dados de custo e ausência de laço na F3 | Ao entrar |
| marc://$ativacao-por-mencao-f5-adaptador-codex-a54fb9ae | F0 e F3 | Ao entrar |
| marc://$ativacao-por-mencao-f6-dev-fixo-6e40fdba | Decisão humana própria | Ao entrar |

Pelo ensaio vigente, um desenvolvedor por vez. A divisão interna da F3 será decidida ao planejá-la.

## 6. Fontes do desenho

Quem iniciar uma fase lê, nesta ordem: a v3 (com as seções 2, 3, 6, 7 e 9 da v2 que ela mantém), a seção 6.2 da v1 para o contrato de `marc wait`, este adendo e as duas revisões do Codex.
