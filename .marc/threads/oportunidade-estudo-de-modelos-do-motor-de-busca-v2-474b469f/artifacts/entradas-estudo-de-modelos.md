# Entradas do estudo de modelos

Este documento reúne o que as etapas E3 e E4 do motor de busca v2 encaminharam ao estudo de modelos. Ele não é plano: o plano do estudo será escrito quando o humano priorizar esta oportunidade.

## Princípio

Decisão do humano em 2026-10-29: **a busca é ferramenta; o julgamento é do agente.** Com o porte dos modelos locais em uso, não há expectativa de milagre.

Consequências para o estudo:
- **Medir ganhos, não perfeição:** ordenação do topo (a resposta antes das menções incidentais) e separação da faixa de confiança, sempre sob o limite de latência.
- **Adoção por custo e benefício:** um modelo maior só entra se o ganho medido compensar o custo em latência, memória e disco. Um ganho pequeno com o dobro da latência não se paga.
- **A proveniência continua sendo a garantia.** `memory_recall` e `memory_deep` devolvem a origem de cada resultado e mandam o agente ler a fonte antes de confiar nela. O estudo não substitui essa leitura.

## Casos e questões encaminhados

1. **D03 (ordering, E4).** "qual foi o raciocínio para indexar apenas summaries na memory v1?"
   - A evidência do CHAT ficou em 10º na saída do `DEEP`.
   - A evidência do SUMMARY não entrou no pool.
   - A consulta pede "raciocínio" e a evidência descreve a motivação sem os termos da consulta.
   - Fonte: resultado-deep-e4.md em marc://$motor-de-busca-v2-e4-memory-deep-com-escopo-por-thread-e-fonte-934ac2b7
2. **Casos em que `@rules` é a resposta (E3).** O recall em depth 2 ordenou artifacts acima do `RULES.md`.
   - Fonte: marc://$motor-de-busca-v2-e3-profundidade-em-camadas-e-funil-de-latencia-cd4a49b8
3. **Armadilha de menção incidental (consulta do humano em 2026-10-29).** A consulta foi "implementação componente toast".
   - **Resposta:** marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb. Ela ficou em 1º no `memory_recall` (depth 0) e no `memory_deep` sem escopo. No `memory_deep`, os dois primeiros trechos foram a arquitetura do plano e a lista dos arquivos alterados.
   - **Armadilha:** marc://$ajustar-a-politica-de-registros-do-loop-para-separar-orquestraca-004a9983, que só cita o Toast numa frase ("o desenvolvimento independente de Toast não foi alterado").
   - **Defeito observado:** a armadilha pontua quase igual à resposta.
     - `memory_recall` em depth 0: 0,9937 contra 0,9959, as duas com faixa "medium".
     - `memory_deep`: 0,655 contra 0,657 do 2º trecho real.
   - **Critério sugerido:** a armadilha deve ficar abaixo de todos os trechos da resposta no top 5, ou a faixa deve separá-la.
4. **Faixa da depth 0 subconfiante.** A thread do Toast recebeu "medium" com "componente toast" no título. Na depth 2, a faixa separou as duas threads ("high" contra "medium"). Liga-se a marc://$oportunidade-indicador-de-sinal-em-barras-para-a-faixa-de-confia-214864b9
5. **Trecho exibido na UI.** Para a thread do Toast, a UI mostrou a seção "Validação e limites" do resumo, e não a que descreve a implementação.
6. **Botão manual "buscar mais fundo" na UI.** A decisão depende da latência que o estudo alcançar.
7. **Meta de 5 s.** Ela é informativa desde a E3. Os gates da E3 e da E4 usaram até 1,2 × M0 na mesma execução.

## Restrições conhecidas

- **Latência relativa:** a medição é sempre contra a M0 na mesma execução. A ADR 0013 exige repetir a medição ao mudar o reranker.
- **Reavaliação completa:** trocar o reranker ou a segmentação muda os scores e os `passageId`. Os julgamentos e os gates da E3 e da E4 precisam ser reavaliados com o modelo novo.
- **Sem dependências novas** sem decisão explícita do humano.
