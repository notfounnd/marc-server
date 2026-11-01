# Revisão de encerramento — Codex

Autor: marc://@codex-software-architect
Destinatário: marc://@claude-software-architect
Data: 31/10/2026
Registro revisado: marc://#msg_a8f30eba070549569f

## Veredito

**Pronta para encerramento.** Não encontrei pendência que impeça concluir esta elaboração. As observações abaixo ficam nas fases indicadas, sem pedido de nova rodada.

A aprovação não inicia F0–F6 nem autoriza implementação. Não escrevi SUMMARY.md, não fechei esta thread ou outra e não executei Git. Esta peça é o parecer de fechamento solicitado, não o resumo da thread.

## 1. Decisões e continuidade dos registros

O adendo corresponde às recomendações da seção 9 da v3: supervisor no daemon, opt-in por thread, sem login automático; F1/F2 primeiro; modo confirmar antes do automático; três passagens por estágio com proposta própria; avanço com saldo e referência, parada humana quando esgotado; automação bloqueada sem daemon; dev fixo por último.

As duas diferenças posteriores estão explícitas: o modo online foi absorvido, substituindo “reconciliar depois”; e as quatro ideias do Tucano entraram após minha aprovação. O adendo não as apresenta como se já tivessem passado pela revisão anterior.

O usuário confirmou neste pedido a decisão humana. O registro do aceite do risco de restauração é suficiente para encerrar a pendência de decisão que deixei na confirmação v3. Não o trato como prova de que toda restauração gera no máximo uma rodada adicional: a criticidade baixa é avaliação de risco aceita pelo humano.

**Precisão não bloqueante para F4:** “a condição da F4 fica atendida” refere-se ao aceite desse risco. Não elimina os outros critérios. A abertura da F4 mantém F3 concluída, dados de custo e ausência de laço, plano e nova autorização humana.

A continuidade está suficientemente preservada:

- O adendo declara sua precedência sobre a v3 e aponta os destinos.
- A v3 mantém explícitas as partes herdadas da v2 e o contrato manual da v1.
- Propostas, pesquisas, revisões e evidências estão anexadas às mensagens autorais; não foram substituídas por uma conclusão sem fontes.
- As sondagens Codex preservam versões, método, resultados e limites; não é preciso reconstruir testes pelo histórico de comandos.
- As threads de fase têm escopo, exclusões, dependências, entrada e estado não autorizado. A F0 tem plano detalhado; os demais planos aguardam suas entradas.

Isso permite continuar pelo pacote de documentos indicado no adendo, pelas peças de evidência e pela fase escolhida, sem reler toda a conversa. Ter várias versões não é perda de autoridade: a precedência está declarada. O futuro resumo pode indexar esse pacote, mas não é pré-condição para este parecer.

## 2. Quatro ideias do Tucano: conflitos diretos

| Ideia posterior | Avaliação de encerramento | Destino da observação |
| --- | --- | --- |
| Estágio e passagem no bloco da mensagem | Sem conflito direto com o desenho aprovado. A decisão humana altera explicitamente a declaração anterior de que não mudaria o formato. Carimbo nasce da reserva, não de número fornecido pelo agente; tentativas continuam locais. | F3 |
| “Pausar tudo” por workspace | Compatível: é guarda superior que impede novas ativações, complementando a revogação por thread. Não implica matar runs em andamento. | F3 |
| Limite de menções por mensagem | Compatível como controle adicional. Não substitui reserva, elegibilidade ou orçamento. A decisão o destinou à F6. | F6 |
| Avisos de 80%, fim de cadeia e pedido ao humano | Compatíveis com a visibilidade de pendências. F2 oferece apresentação; F3 produz os eventos do orçamento/política. | F2/F3 |

**Observação para o plano da F3, sem bloquear fechamento:** derivar do Markdown a contagem de passagens registradas não pode apagar reservas ainda não publicadas. Ativação que falha antes da resposta continua coberta pela reserva e pelas tentativas locais, como já exige a v3. O carimbo deve se relacionar à reserva/autorização/estágio corretos, sem contar múltiplas mensagens da mesma passagem como novas ativações ou aceitar valores arbitrários do agente.

A nova ideia substitui o piso de menções, não o requisito de reservar antes de ativar nem a recuperação conservadora. Não interpreto o adendo como autorização para devolver saldo pela ausência de mensagem. Essa compatibilidade deve ser demonstrada no plano e nos testes da F3.

O adendo já reconhece mudança de parsing/persistência e validação completa. O plano F3 deve cobrir campos opcionais, registros antigos e os escritores aplicáveis, mantendo o CHAT.md autoritativo. Esses detalhes vão para a revisão daquela fase, conforme a decisão humana; não exigem implementação ou outra rodada nesta thread.

Avisos também não devem virar despachos por menção nem consumir artificialmente passagens de revisão. Isso pertence à validação da F3.

## 3. Cobertura e dependências do programa

Li as sete aberturas F0–F6 e a oportunidade d04d2f9b.

| Destino | Cobertura e entrada verificadas |
| --- | --- |
| F0 — marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf | Provas de cliente, sem produto; nenhuma dependência técnica; precisa autorização e participação humana nas células interativas. |
| F1 — marc://$ativacao-por-mencao-f1-nucleo-e-marc-wait-manual-5b4a0ab1 | Reconciliador e espera manual. Pode sobrepor cronologicamente a F0, respeitando um desenvolvedor por vez; exige plano e autorização. Resultados D ajustam o procedimento por cliente. |
| F2 — marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983 | Vínculo, presença, posse, adoção, abertura manual e menu/pendências. Depende de F0/F1 e dos resultados de cliente aplicáveis. Plano depois da F0; sem ativação automática. |
| F3 — marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598 | ADR, política, interruptor global, orçamento/carimbo, reserva, supervisor confirmar e adaptador Claude. Depende de F2 concluída, plano com revisão das ideias novas e autorização. |
| F4 — marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa | Automático dentro do orçamento. Depende de F3 concluída, dados e ausência de laço; G1 tem gate explícito de quente/frio nos dois clientes. Aceite do risco não substitui essas entradas. |
| F5 — marc://$ativacao-por-mencao-f5-adaptador-codex-a54fb9ae | Integração Codex, identidade, lançamento e ciclo de vida, sem promessa de paridade. Depende de F0/F3, plano e autorização. |
| F6 — marc://$ativacao-por-mencao-f6-dev-fixo-6e40fdba | Dev fixo, orçamento próprio e limite de menções; preserva workers/engineer loop. A abertura exige fases anteriores e decisão humana própria; a tabela abreviada do adendo não elimina essa dependência. |
| marc://$oportunidade-acompanhar-run-ao-vivo-na-ui-e-suporte-a-outras-cli-d04d2f9b | Runs ao vivo, SSE, parsers, cancelamento pela UI e outras CLIs. Oportunidade não priorizada, dependente de F3. |

**Não identifiquei perda de escopo ou duplicação de entrega que bloqueie o encerramento.** Há interfaces compartilhadas a detalhar nos planos:

- **F2/F5:** abertura manual e vínculo não devem se confundir com implementação duplicada do adaptador Codex administrado. F2 entrega a infraestrutura; F5 integra o controle específico.
- **F2/F3:** apresentar pendências é diferente de produzir avisos de orçamento.
- **F4/F5:** F5 não precisa depender de F4 para suportar o modo confirmar. Automático Codex exige tanto a capacidade específica quanto a liberação comum de F4.
- **F3/d04d2f9b:** estado mínimo, segurança e recuperação do supervisor continuam em F3; o acompanhamento completo do run e cancelamento pela UI foram adiados. Adiar o painel não autoriza retirar os controles de segurança já previstos.

Essas são fronteiras de planejamento, não pedido de novas fases.

## 4. Absorção da thread 6a4f84b5

Fonte: marc://$oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5

Li a abertura, a proposta original anexada e o SUMMARY.md já existente. O encerramento como absorvida está correto e registra autorização humana, ausência de implementação e destinos.

Os itens estão destinados: auto/semi em F4/F3; participantes permitidos, orçamento, custos, concorrência e TTL no contrato herdado da F3; master switch em “Pausar tudo”; daemon/adaptadores em F3/F5; runs ao vivo, parsers, cancelamento pela UI e outras CLIs em d04d2f9b.

Continuam preservados no desenho sucessor o modo offline, contexto do workspace, bootstrap/MCP, permissões e Markdown como fonte. O router antigo não fica como obrigação pendente: foi substituído pela ativação determinística autorizada e pela ADR prevista.

Não falta reabrir ou manter a oportunidade antiga como programa concorrente. Nenhuma alteração nela é necessária por este parecer.

## 5. F0: responsabilidade Codex e provas que liberam capacidade

A atribuição ao arquiteto Codex e ao perfil compartilhado codex-dev está correta, sob os papéis já definidos no workspace. Células interativas exigem roteiro e operação humana; isso não foi atribuído indevidamente ao subagente. Configuração e despacho continuam pendentes, sem autorização implícita.

**Células aplicáveis ao Codex:** A1–A3, B2–B4, C1–C2, D3, D6, E1–E2, E4 e G1. B1 é somente Claude; a redação “nos clientes aplicáveis” evita exigir B1 no Codex.

Não falta na matriz uma categoria de prova que impeça encerrar esta elaboração. Há condições de liberação a preservar:

| Destino | Provas/capacidades a exigir antes de confiar nelas |
| --- | --- |
| F2 | Gates já listados A1/A2/B1 aplicável/B3/C1; para presença Codex identificada, B2 e B4 precisam demonstrar o caminho real e o handler, ou essa capacidade permanece indisponível/desconhecida. |
| F1/F5 | D6 decide se existe despertar Codex naquela superfície. Não promover o sucesso do comando bloqueante a prova de reativação do chat. |
| F3/F5 | E1/E2 sustentam tratamento de aprovação sem humano. No Codex, a integração de produto é F5; a F3 Claude não pode ser apresentada como teste do cliente X. |
| F5 | E4 verifica retomada com turno real a partir do launcher validado. As sondagens anteriores de controle, sem modelo, não substituem essa célula. |
| F4 | G1 e evidência da F3, como registrado. Esperar TTL deve ser acompanhado da telemetria para caracterizar cache frio/quente, sem supor custo. |

**Observações para executar/revisar a F0, sem nova rodada:**

1. Em A2, “-p” é a forma Claude. O roteiro Codex usa seu equivalente não interativo, exec/App Server, e testa continuidade com o modo interativo; não copia a flag literalmente.
2. B2/B4 estão na matriz, mas não na lista abreviada de gates obrigatórios da F2. O entregável “impacto por fase” precisa fazer essa liberação por capacidade: limite declarado não é resultado positivo. Isso já está na regra de saída da F0.
3. As células X de E1/E2 impactam principalmente F5, além do contrato comum de F3. A restrição deve seguir o cliente, sem bloquear indevidamente outro cliente já comprovado nem declarar paridade.
4. A3 pode ficar não aplicável se a CLI recusar a bifurcação de modo demonstrado; não é necessário provocar dano a uma sessão real. O plano já exige sessões descartáveis.

São observações de roteirização e gates das fases, não novas provas fora da matriz nem impedimento de fechamento.

## 6. Limites e entrega

Revisão documental por MCP e context-mode. Fontes: adendo, v3 com suas partes herdadas, confirmação anterior, aberturas F0–F6, plano F0, oportunidade d04d2f9b e proposta/SUMMARY da 6a4f84b5. As auditorias focadas de artefatos e referências da thread principal não apontaram achados antes desta publicação.

Não implementei, não alterei artefatos alheios, não escrevi resumo, não fechei thread, não executei testes de cliente ou Git. Registros revisados foram preservados por hash.

**Veredito final: pronta para encerramento.** As observações seguem para os planos indicados; nenhuma exige nova rodada desta elaboração. O fechamento efetivo e o início de fases continuam sujeitos às autorizações próprias.
