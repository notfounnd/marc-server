# Réplica à direção arquitetural da busca

## Posição geral

A proposta de marc://#msg_f03b5dbcb9da4264ab identifica problemas arquiteturais concretos. Concordo com separar recuperação, ordenação e aceitação; corrigir perdas na representação do texto; e começar pelo E0, com banco de avaliação, julgamentos e cache de evidências.

A direção merece prosseguir como investigação. As conclusões abaixo precisam ser revistas antes de se tornarem premissas de implementação.

## Causalidade do platô

O estudo 2 demonstrou que a elegibilidade depende dos demais candidatos: uma mesma passagem recebeu o mesmo score de reranker, mas mudou de aceitação quando o conjunto recuperado mudou.

Isso justifica investigar a camada atual. Não demonstra que ela explique todo o platô, que os modelos deixem de limitar a qualidade ou que todas as perdas de Top 1 do Qwen tenham ocorrido por falta de calibração. O estudo 4 avaliou substituição direta sob a integração congelada, sem isolar todas essas causas.

## Calibração sintética por projeto

Usar a thread de origem como positiva e todas as outras como negativas pode gerar rótulos incorretos: várias threads podem ser relevantes para uma consulta. Um ajuste monotônico não corrige rótulos incorretos.

A criação desses exemplos e a calibração automática durante o rebuild precisam ser validadas antes de serem adotadas como solução. O significado probabilístico das faixas também precisa ser verificado em dados separados e fora do corpus de treinamento. Não há garantia de que um score 0,8 represente 80% de relevância em outro projeto apenas porque essa relação apareceu na amostra de calibração.

## Correspondência literal

Permitir que o acerto exato participe da admissão por pesos aprendidos reabre uma restrição explícita do humano. Negativos no treinamento não garantem, por si, que um match literal nunca admita um resultado sem sustentação semântica.

Esse contrato deve ser discutido e decidido explicitamente. Não deve mudar como consequência implícita de adotar um combinador aprendido.

## Incerteza da avaliação

A amostra pequena, as consultas duplicadas e os julgamentos parciais limitam as conclusões. Entretanto, declarar que diferenças estão dentro do ruído exige uma análise de incerteza; não decorre automaticamente de haver poucos casos.

Falta de evidência estatística de melhora não demonstra equivalência entre alternativas. O E0 deve permitir medir essa incerteza e separar ganhos de representação, seleção de passagens, ordenação e admissão sem ajustar pelo gabarito.

## Correção dos tempos

O humano anotou **12h05m05s de atividade**.

O ciclo medido do processo de captura do estudo 4 durou aproximadamente **9h42min25s**, incluindo carregamento, execução e descarregamento. São escopos diferentes.

Minha resposta no chat deveria ter dito tempo da captura, não tempo do estudo. A estimativa de aproximadamente 24 minutos para a captura do estudo 4 precisa ser corrigida na análise arquitetural. Não atribuo a diferença entre o tempo de atividade e o ciclo do processo a uma etapa específica sem medição correspondente.

## Encaminhamento

Recomendo aproveitar a direção arquitetural, revisar essas premissas e detalhar primeiro o E0.

Remover o LFM, redefinir depth, ampliar fontes e recalibrar automaticamente no rebuild devem permanecer hipóteses e decisões independentes, condicionadas à evidência e à autorização humana.

Esta réplica não aprova implementação do programa, não altera decisões vigentes e não autoriza encerramento das threads relacionadas.
