# Revisão independente do consenso de julgamento da E3

## Veredito

**Pendente de conciliação.** Revisei as 146 células da tabela “Células contestadas” em marc://msg_6e60e854008247afb7, usando a consulta e o trecho integral da worksheet de cada célula, inclusive título, seção e fonte. Aceito 3 e contesto 2 no ledgerline-en; aceito 82 e contesto 59 no marc.

As tabelas abaixo cobrem cada célula solicitada. “Aceito” adota o grau proposto pelo avaliador a. “Contesto” apresenta o grau que defendo e o motivo. Não é uma média entre julgadores e não é o consenso final já gravado.

## Fontes e procedimento

- Proposta: consenso-julgamento-e3.md, anexo de marc://msg_6e60e854008247afb7.
- ledgerline-en: .marc/cache/memory-eval/ledgerline-en/0d31bd4afd3f/worksheet.md.
- marc: .marc/cache/memory-eval/marc/87cd2e4d96f7/worksheet.md.
- Plano da E3, revisão 8: universo, referência comum e gatilho da auditoria.
- Inspeção somente leitura por context-mode. Textos idênticos foram conferidos uma vez e reaplicados apenas após conferir a consulta de cada célula. A atribuição de grau foi feita pela leitura, não por script.
- Não consultei resultados de variantes para graduar relevância. Não alterei código, datasets ou julgamentos; não executei Git nem comandos do harness.

## Regras do consenso

### 1. Resposta integral fora da thread-alvo

**Coaprovo o princípio, com precisão de redação.** Grau 3 depende de responder à consulta por inteiro com a evidência da própria célula, não de pertencer à thread-alvo. Uma camada não herda o grau nem um teto do summary: pode responder mais, menos ou sobre outro ponto.

Redação proposta:

- **0:** sem resposta nem menção efetiva ao assunto específico; compartilhar área, vocabulário ou um tema vizinho não basta.
- **1:** menção incidental ao assunto específico, referência ou indicação de fonte, sem resposta parcial substantiva.
- **2:** resposta parcial substantiva à consulta, com conteúdo que esclarece parte do que foi perguntado.
- **3:** responde integralmente à consulta, independentemente da thread de origem.

Assim, a frase “tratar de um tema vizinho continua valendo 1” precisa ser restringida. Tema vizinho por si só permanece 0. Também não se deve reduzir uma resposta a 2 apenas porque ela está em uma síntese histórica, nem preencher suas lacunas com conteúdo de outra camada.

A relevância histórica não transforma uma instrução antiga em regra atual: T04/734062bc/c1, por exemplo, contém o protocolo procurado, mas sua menção a thread_info não deve substituir a política atual de cursor consumido.

### 2. Resolver toda divergência 0/1 como 1 sem reler

**Não coaprovo essa regra automática.** O grau registra o conteúdo, não a conveniência dos critérios de decisão. O fato de os cortes principais tratarem 0 e 1 da mesma forma não demonstra que todos os 550 casos contêm menção incidental. Tampouco demonstra que o efeito no nDCG seja marginal.

Alternativa: resolver cada divergência pela leitura do trecho integral e pela distinção 0/1 acima. Pode haver aceites em bloco quando a mesma evidência, nas consultas correspondentes, sustentar a mesma conclusão; não deve haver promoção automática pela discordância ou pelo efeito nas métricas.

A presente revisão cobre as 146 células solicitadas. **Não constitui aceite coletivo das outras 490 células do marc e 60 do ledgerline-en.** Enquanto essa regra permanecer automática, não considero semanticamente fechado o consenso de quatro graus. Não propus colapsar a escala nem alterar critérios depois dos resultados.

## Ledgerline-en: revisão das 5 células

| Caso | Grupo | Camada | Resposta | Grau defendido | Motivo |
| --- | --- | --- | --- | ---: | --- |
| L13 | c71e0b94 | c2 | Aceito | 2 | O período sobreposto é detectado e encaminhado para revisão, sem rejeição: resposta parcial sobre o tratamento da sobreposição, embora não detalhe a deduplicação por transação. |
| LT03 | 3e0a7d92 | c2 | Aceito | 1 | O backup preserva a chave protegida pela passphrase; não explica sua derivação. |
| LY21 | c39e5d62 | c2 | Contesto | 1 | Guardar salt/parâmetros no cabeçalho informa localização, mas não diz se o valor do salt é compartilhado ou exclusivo de cada banco. O trecho não oferece uma resposta parcial a essa distinção, nem se deve inferir exclusividade pelo local de armazenamento. |
| LI09 | f16a2d09 | c2 | Aceito | 1 | A contagem de duplicatas ignoradas e pares sinalizados não resolve a rejeição de um extrato reemitido. |
| LA04 | 2f5d8a6c | c2 | Contesto | 2 | O trecho informa concretamente que algumas moedas não têm unidade fracionária e outras têm três casas. Responde parcialmente à quantidade de casas, embora não fixe a regra de conversão por moeda. |

## Marc: revisão das 141 células

| Caso | Grupo | Camada | Resposta | Grau defendido | Motivo |
| --- | --- | --- | --- | ---: | --- |
| 1D | 004a9983 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 1D | 58458a82 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 1D | 58458a82 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 1D | 274b7c9a | c1 | Contesto | 2 | Explica concretamente a fronteira entre baseline gerenciado e Custom Rules e o comportamento de preservação/reconstrução. É resposta parcial substantiva à separação, embora não descreva integralmente o papel de INSTRUCTIONS.md. |
| 1D | 274b7c9a | c2 | Contesto | 2 | Explica concretamente a fronteira entre baseline gerenciado e Custom Rules e o comportamento de preservação/reconstrução. É resposta parcial substantiva à separação, embora não descreva integralmente o papel de INSTRUCTIONS.md. |
| 1D | 734062bc | c2 | Contesto | 2 | Explica concretamente a fronteira entre baseline gerenciado e Custom Rules e o comportamento de preservação/reconstrução. É resposta parcial substantiva à separação, embora não descreva integralmente o papel de INSTRUCTIONS.md. |
| 1D | 3d40719f | c1 | Contesto | 2 | Afirma que bootstrap/update atualizam INSTRUCTIONS.md e RULES.md preservando Custom Rules: descreve a parte operacional da separação, não apenas o vocabulário. |
| 1D | 3d40719f | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 1D | 894072be | c1 | Contesto | 2 | Delimita a edição ao trecho abaixo de Custom Rules e exige preservar a seção gerenciada, respondendo substantivamente à fronteira de customização. |
| 1D | 894072be | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 1D | 6143a9b5 | c2 | Contesto | 2 | Define onde ficam as regras customizadas e como update cria, move e preserva o bloco. É resposta parcial operacional à separação gerenciado/customizável. |
| 1I | 58458a82 | c1 | Contesto | 2 | Localiza o workflow na skill e RULES.md como contrato obrigatório retornado pelo bootstrap; responde parcialmente onde ficam protocolo e regras. |
| 1I | 274b7c9a | c1 | Contesto | 2 | Localiza o baseline acima de Custom Rules e o contrato customizado abaixo da fronteira, esclarecendo concretamente a organização das regras. |
| 1I | f04c7cae | c1 | Contesto | 2 | Identifica expressamente RULES.md como autoridade para comportamento, workflow e regras operacionais; responde à parte das regras do workspace. |
| 1I | 3b4a8787 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 1P | 274b7c9a | c1 | Contesto | 2 | Descreve a decisão implementada de manter baseline gerenciado e Custom Rules como fronteira posicional preservada, com migração de conteúdo deslocado: resposta parcial substantiva ao problema de mistura. |
| 1P | 274b7c9a | c2 | Contesto | 2 | Descreve a decisão implementada de manter baseline gerenciado e Custom Rules como fronteira posicional preservada, com migração de conteúdo deslocado: resposta parcial substantiva ao problema de mistura. |
| 1P | 094d8894 | c1 | Contesto | 2 | Explica a correção nos geradores e a atualização dos resultados por ferramentas oficiais, preservando Custom Rules e a idempotência; responde parcialmente como evitar drift em instruções geradas. |
| 1P | 094d8894 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 2D | 57488bab | c2 | Contesto | 2 | Especifica quando o reconcile incremental deve recusar provider incompatível e exigir full rebuild antes de ler/materializar fontes. É comportamento substantivo do rebuild incremental, embora não cubra os batches. |
| 2D | f04c7cae | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 3D | 774d1e99 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 4D | b64903bd | c1 | Contesto | 2 | Descreve o MiddleMode, a posição dos controles nos modos threads/não threads e a abertura no selectThread. São detalhes substantivos do esquema da coluna central, embora falte o esquema completo. |
| 4D | c04986bd | c2 | Contesto | 2 | Não é só referência: determina modais à direita e as duas colunas à esquerda livres para workspaces e threads/marckers, resposta parcial concreta sobre o arranjo visual. |
| 4D | c147b8bb | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 4I | b64903bd | c1 | Contesto | 2 | Localiza search na coluna do meio e explica sua ativação e execução. É resposta parcial sobre um dos modos, embora não cubra rolagem nem os três painéis. |
| 4I | b64903bd | c2 | Contesto | 2 | O fluxo troca explicitamente a coluna do meio por área de busca e depois resultados, evidência substantiva da alternância exclusiva de modo. |
| 5D | 72461180 | c1 | Contesto | 2 | Mostra a sintaxe canônica marc://.../!artifact.md e quando usá-la; responde parcialmente à gramática pedida, embora falte a forma de mensagem. |
| 5D | 2341bc9f | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 5D | 184fd8bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 5I | 3d40719f | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 5I | c04986bd | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 5P | 2341bc9f | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 5P | c04986bd | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 5P | aa4908aa | c2 | Contesto | 2 | Informa onde foi adicionada a linha copiável de thread e agente (header/linha secundária). Responde parcialmente à ação de copiar identificadores na UI, sem cobrir mensagem e anexo. |
| 7I | 57488bab | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 7I | 834716ba | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 7I | f04c7cae | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 7P | 4f477d9f | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 7P | 4f477d9f | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 8D | 0845d0bb | c1 | Contesto | 2 | Explica que BackgroundThreadIndexReconciler.list usa snapshot e que rebuild reutiliza a promise em curso, com efeito observável de índice stale. É comportamento substantivo do rebuild em background. |
| 8D | 0845d0bb | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 8D | 3d40719f | c1 | Contesto | 2 | Define serialização do scan/publicação, temporário+rename e convergência por watcher/fallback rebuild após cache stale: resposta parcial concreta sobre o índice em background. |
| 8D | 3d40719f | c2 | Contesto | 2 | Informa a implementação do rebuild/publicação serializados do thread-index e o tratamento dos eventos de lock pelo watcher. Não cobre health, mas responde substantivamente ao rebuild. |
| 8I | 0845d0bb | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 8I | 3d40719f | c1 | Contesto | 2 | Explica publicação atômica do snapshot, cache temporariamente stale e convergência por watcher/fallback rebuild; esclarece parte do mecanismo de consistência da UI. |
| 8P | 0845d0bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 8P | 0845d0bb | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9D | 894072be | c2 | Aceito | 2 | Aceito o grau proposto nesta célula. |
| 9I | 94409c8c | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9I | 1d4c0daa | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9I | 0845d0bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9I | 2f441fa7 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9P | 094d8894 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9P | e54fb794 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9P | 734062bc | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| 9P | d34b7486 | c1 | Contesto | 2 | Descreve o suporte operacional de bootstrap, flag gated e leitura obrigatória de RULES.md, separando protocolo e comportamento. Responde parcialmente como sustentar a aplicação das regras, embora não cubra toda a auditoria de anexos. |
| 9P | d34b7486 | c2 | Contesto | 2 | Descreve o suporte operacional de bootstrap, flag gated e leitura obrigatória de RULES.md, separando protocolo e comportamento. Responde parcialmente como sustentar a aplicação das regras, embora não cubra toda a auditoria de anexos. |
| Q01 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Q02 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Q03 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Q04 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Q05 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Q06 | df4229a9 | c2 | Contesto | 3 | Para a consulta seca “toggle”, identifica o toggle real, a chave memory.autoRebuild, os valores false/true e a validação manual de sua ação no JSON. Responde à funcionalidade procurada; não há requisito adicional explícito que justifique reduzir a 2. |
| Q09 | 094d8894 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Q12 | 094d8894 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| C2 | 58458a82 | c1 | Contesto | 2 | Especifica a skill local e seus triggers, exigindo bootstrap e RULES.md como contrato obrigatório; é suporte concreto para a aplicação de regras, ainda que não responda toda a parte de anexos. |
| C2 | 094d8894 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| C2 | d14fb686 | c0 | Contesto | 2 | Identifica um suporte específico: bootstrap obrigatório antes das tools que acessam contexto. Responde parcialmente ao mecanismo para fazer agentes passar pelo contrato do workspace. |
| C2 | d34b7486 | c1 | Contesto | 2 | Descreve o suporte operacional de bootstrap, flag gated e leitura obrigatória de RULES.md, separando protocolo e comportamento. Responde parcialmente como sustentar a aplicação das regras, embora não cubra toda a auditoria de anexos. |
| C2 | d34b7486 | c2 | Contesto | 2 | Descreve o suporte operacional de bootstrap, flag gated e leitura obrigatória de RULES.md, separando protocolo e comportamento. Responde parcialmente como sustentar a aplicação das regras, embora não cubra toda a auditoria de anexos. |
| C5 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| C6 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A03 | 92413b81 | c1 | Contesto | 2 | Traz evidência de comportamento esperado na repetição: agent_register retorna unchanged e preserva o perfil. É resposta parcial concreta à falsa indicação de cadastro novo. |
| A05 | 9e4e6ab7 | c2 | Aceito | 2 | Aceito o grau proposto nesta célula. |
| A06 | 184fd8bb | c2 | Contesto | 3 | Explica exatamente a ausência do aviso: workspace_audit foi alterado para ignorar marc:// em inline code/fenced code, considerados exemplos literais. A causa do sintoma está inteira no trecho, ainda que a correção posterior esteja em outra thread. |
| A07 | 094d8894 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A09 | 094d8894 | c1 | Contesto | 2 | Registra reasoning xhigh do desenvolvedor e execução com um desenvolvedor sequencial, ligados ao acordo humano vigente. É evidência parcial concreta de configuração/limite, não a política geral completa. |
| A09 | 054fd58b | c1 | Contesto | 2 | Registra reasoning xhigh do desenvolvedor e execução com um desenvolvedor sequencial, ligados ao acordo humano vigente. É evidência parcial concreta de configuração/limite, não a política geral completa. |
| A09 | 2f441fa7 | c1 | Contesto | 2 | Documenta principal high, desenvolvedor xhigh, origem da confirmação e limite de um desenvolvedor ativo. É evidência substantiva do acordo, ainda que específica desse handoff. |
| A10 | 004a9983 | c1 | Contesto | 2 | Explica a divisão de autoridade AGENTS → guia → RULES e a conferência cruzada que removeu orientações conflitantes. É resposta parcial substantiva sobre o alinhamento do harness. |
| A10 | d14fb686 | c2 | Contesto | 2 | Descreve bootstrap lendo INSTRUCTIONS/RULES e o helper ensinado a usar esse fluxo, tornando as instruções acessíveis pelo MCP. Contribui concretamente ao alinhamento pedido. |
| A10 | d34b7486 | c1 | Contesto | 2 | Define responsabilidades distintas de INSTRUCTIONS.md e RULES.md e proíbe duplicar o protocolo, parte substantiva da solução de divergência entre instruções. |
| A10 | d34b7486 | c2 | Contesto | 2 | Relata alteração conjunta do gerador INSTRUCTIONS/RULES e do marc_helper, com testes de migração e conteúdo. É evidência direta de alinhamento, não só tema vizinho. |
| A11 | 024e05b1 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A14 | 58458a82 | c1 | Contesto | 2 | Mantém RULES.md como contrato obrigatório do bootstrap e alinha INSTRUCTIONS, reminder e helper à distinção entre início/recuperação e reuso. É parte concreta da prevenção de uso sem contrato. |
| A14 | 58458a82 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A14 | 094d8894 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A14 | 0845d0bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A14 | 834716ba | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A14 | 184fd8bb | c1 | Contesto | 3 | Explica o fluxo completo pertinente ao sintoma: bootstrap entrega INSTRUCTIONS/RULES, skill exige ler/aplicar RULES antes de agir e traduz Custom Rules em checklist. A consulta não exige necessariamente um bloqueio de runtime. |
| A14 | 184fd8bb | c2 | Aceito | 2 | Aceito o grau proposto nesta célula. |
| A16 | c147b8bb | c0 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A17 | 2f441fa7 | c1 | Contesto | 2 | Exige lock compartilhado e coalescência na reconciliação e proíbe duplicar o processamento já feito pelo watcher. Responde parcialmente como evitar rebuilds simultâneos entre origens. |
| A21 | 4f477d9f | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A21 | 4f477d9f | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A22 | 1d4c0daa | c2 | Contesto | 2 | Liga explicitamente o registro de SUMMARY.md à confirmação de status fechado por thread_info. Responde à metade do fechamento, embora não explique a reabertura. |
| A25 | 57488bab | c2 | Contesto | 2 | Descreve busca unificada UI/MCP sobre threads fechadas, com camadas de summaries, artifacts e chat. É resposta parcial sobre o mecanismo para consultar conhecimento histórico por pergunta. |
| A26 | 57488bab | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A26 | 2341bc9f | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A26 | 3c45fa83 | c0 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A26 | 3c45fa83 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A26 | c147b8bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A28 | 9e4e6ab7 | c2 | Aceito | 2 | Aceito o grau proposto nesta célula. |
| A32 | e4478bac | c1 | Contesto | 3 | Responde diretamente à alegação: o daemon reutiliza o provider na janela idle, chamadas progressivas não recarregam o modelo e só refazem o embedding. O contraste recarga/inferência está completo. |
| A32 | e4478bac | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A32 | b64903bd | c1 | Contesto | 3 | O trecho descreve explicitamente o ciclo antigo: provider carrega para embedding, consulta LanceDB e chama dispose ao final. É a explicação completa do recarregamento por busca nesse estado histórico; não o afirma como estado produtivo atual. |
| A33 | 184fd8bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A33 | 184fd8bb | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A35 | e54fb794 | c2 | Contesto | 2 | Avalia expressamente a fronteira MCP (agentes) versus daemon HTTP (UI), persistência concorrente e gaps de segurança/ADRs. É análise arquitetural parcial substantiva, embora não cubra arquivos grandes. |
| A38 | 1d4c0daa | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A38 | f04c7cae | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A39 | 39436d9c | c1 | Contesto | 2 | Prescreve mensagem curta e enumera categorias concretas para a entrega (mudanças, comportamento, validações, riscos/pendências). É resposta parcial de composição, não mera menção à escrita. |
| A39 | 3c4261b4 | c1 | Aceito | 2 | Aceito o grau proposto nesta célula. |
| A39 | 2f441fa7 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| A39 | c147b8bb | c1 | Contesto | 2 | Prescreve mensagens curtas no transcript e conteúdo longo em artifact vinculado à mensagem. É parte substantiva da solução para mensagens amontoadas, ainda que não detalhe categorias. |
| T01 | 58458a82 | c1 | Contesto | 2 | Mantém explicitamente bootstrap obrigatório no início/recuperação e RULES como contrato, diferenciando-o de repetição ritual. Responde parcialmente à obrigatoriedade, sem detalhar o bloqueio das tools. |
| T01 | 58458a82 | c2 | Contesto | 2 | Mantém explicitamente bootstrap obrigatório no início/recuperação e RULES como contrato, diferenciando-o de repetição ritual. Responde parcialmente à obrigatoriedade, sem detalhar o bloqueio das tools. |
| T01 | 1d4c0daa | c1 | Contesto | 2 | Registra bootstrap antes do acesso ao filesystem nas ferramentas de leitura, com guard compartilhada. É aplicação concreta parcial do bloqueio solicitado. |
| T01 | 0845d0bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| T01 | 834716ba | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| T02 | 57488bab | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| T03 | 2f441fa7 | c2 | Contesto | 2 | Descreve revisão SHA-256, retries idempotentes e persistência atômica de summaries Markdown. São mecanismos substantivos de proteção de escrita, embora o trecho não explique a política completa de concorrência. |
| T04 | 274b7c9a | c2 | Contesto | 3 | O trecho reproduz o protocolo: guardar lastMessageId, chamar thread_read_since com o cursor e usar thread_read se shouldReadFullThread. Responde integralmente à consulta sobre leitura incremental; o fato de ser citação em outra thread não reduz o grau. |
| T04 | 094d8894 | c1 | Contesto | 3 | Explica lastMessageId/read_since, reproduz a falha do cursor avançado por metadados e define consumo efetivo e fallback. A consulta ampla sobre leitura incremental é plenamente atendida. |
| T04 | 734062bc | c1 | Contesto | 3 | Traz o fluxo de cursor/read_since e fallback explícito por shouldReadFullThread, respondendo à consulta por inteiro como registro histórico. A orientação antiga sobre thread_info não deve ser promovida a regra atual. |
| T06 | 4f477d9f | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| T06 | 4f477d9f | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| O03 | 024e05b1 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| O04 | 024e05b1 | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Y04 | 024e05b1 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Y04 | aa4c94ba | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Y04 | c147b8bb | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Y10 | 3e422682 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| Y14 | fe4a1cb2 | c1 | Contesto | 3 | Nomeia strategy/dispatch table e aplica despacho por método/path e por escopo. Isso responde integralmente qual padrão usar para variação de comportamento; não é necessário repetir literalmente a pergunta. |
| Y15 | 57488bab | c2 | Contesto | 2 | Explica a camada de elegibilidade que decide exposição, seus coeficientes relativos e a queda 0,84→0,03 sem mudança no reranker. É causa parcial concreta da supressão por corte, embora não detalhe minScore=0. |
| J01 | ce47939a | c2 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| J01 | c147b8bb | c1 | Contesto | 3 | O trecho dá os dois critérios pedidos sem lacuna: abertas por createdAt descendente e fechadas por closedAt descendente. Estar numa síntese de pesquisa não reduz uma resposta integral. |
| J05 | 174c48b6 | c1 | Aceito | 2 | Aceito o grau proposto nesta célula. |
| J05 | f04c7cae | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |
| J05 | 3e422682 | c1 | Aceito | 1 | Aceito o grau proposto nesta célula. |

## Auditoria cega: conclusão e limite da verificação

O plano da revisão 8 determina **mais de 2% dos pares auditados com grau consensual ≥ 2**, não 2% das células. Com gatilho, U ganha todos os candidatos dos casos das famílias com achado; todos os pares auditados entram na referência final mesmo sem expansão.

As taxas publicadas na proposta — marc 0,73% no consenso e 1,82% no avaliador b; ledgerline-en 0% — ficam aritmeticamente abaixo de 2%. **A conclusão é coerente com esses números, mas não foi reproduzida de forma independente nesta revisão.**

A tentativa de ler audit-sample.json e worksheet-meta.json foi bloqueada pela revisão de segurança, devido à proibição de cegamento da rodada anterior. Não contornei o bloqueio nem busquei as identidades por fonte indireta; solicitei autorização específica no chat. Sem esses metadados, não posso verificar numerador, denominador, agregação por par ou quais contestações pertencem à amostra.

Também é necessário restringir a expressão “não dispara em nenhum cenário”: os números de a, b e do consenso inicial não são, sozinhos, prova de um limite superior para um consenso revisado. Ele pode reunir células relevantes que estavam em conjuntos diferentes. Após fechar as contestações, recomputar a taxa sobre os pares auditados com seus graus consensuais nas camadas previstas e saturação; não contar cada camada como um novo par. Isso verifica a regra já pré-declarada, sem mudar o limiar.

A exposição anterior de totais e menções do avaliador a, registrada em marc://msg_ce14c28c8d644b3e96, permanece uma limitação do cegamento do julgamento original. Não conheci as identidades da amostra no julgamento nem nesta revisão; isso não autoriza apagar o limite já informado.

## Encaminhamento

1. Conciliar as 61 contestações identificadas nas tabelas; nenhuma nota foi gravada em arquivo de julgamento por mim.
2. Substituir a regra automática de 0/1 por adjudicação baseada no conteúdo.
3. Conferir o gatilho sobre o consenso efetivamente fechado, com os metadados autorizados e o resultado por par, antes de considerar encerrado esse item.

A thread permanece aberta. Este parecer avalia o consenso; não aprova resultados de variantes nem antecipa a decisão da E3.
