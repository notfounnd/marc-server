# Resumo executivo

Thread: marc://$correcao-do-fluxo-de-agentes-para-independencia-de-fornecedores--dd4a5684
Closed: `2026-10-09T04:36:05Z`

## Objetivo e aceite

Corrigir o acoplamento do fluxo de desenvolvimento a fornecedores, famílias de modelos, links de clientes e IDs de perfis atuais. O humano aprovou o desenvolvimento e autorizou explicitamente o encerramento. Não há pendência de implementação nesta thread.

Esta correção sucede a política registrada em marc://$documentar-o-fluxo-de-desenvolvimento-em-loop-e-a-politica-de-mo-92413b81. O resumo anterior permanece como histórico do desenvolvimento, sem ser reescrito.

## Implementação

- AGENTS.md, docs/agent-workflows.md e somente Custom Rules de .marc/RULES.md foram alinhados a uma política independente de fornecedor, cliente, modelo e ID de perfil.
- Exemplos de famílias de modelos e links de fornecedores foram removidos da política. A orientação geral de IDs usa exemplo neutro por papel.
- Capacidade é avaliada pelos resultados exigidos. O principal deve realizar análise arquitetural, planejamento, orquestração e revisão independente. O desenvolvedor deve implementar e validar a tarefa autocontida com qualidade. Economia é preferida apenas quando esses requisitos são atendidos.
- Reasoning permanece separado de capacidade. As referências do projeto são mínimo medium e recomendado high para o principal, mínimo high e recomendado xhigh para o desenvolvedor. Não são campos de API ou controles universais. Equivalência com controles diferentes precisa de confirmação humana ou documentação do cliente.
- Seleção ou adequação do modelo desconhecida/insuficiente, reasoning não verificado ou equivalência não confirmada exige consulta ao humano antes da implementação. Configuração conhecida, válida e confirmada não exige pergunta repetida. Confirmação humana é aceita quando introspecção não está disponível.
- O principal resolve perfis por inventário, responsabilidade e mapeamento de papéis. Desenvolvedores reutilizam o perfil compartilhado adequado, sem cadastro por spawn ou variação de configuração. IDs, modelos e identidades runtime escolhidos ficam nas evidências da atividade, não em uma lista normativa fechada.
- Cadastro e publicação continuam sob responsabilidade do principal. Rename/delete e reescrita de histórico não são efeitos automáticos da atribuição de tarefas. Manutenção explícita do cadastro exige autorização humana.
- Bootstrap independente, autorização para editar, escopo atômico, teto/overrides de concorrência e revisão iterativa foram preservados. A política não cria hooks nem configura clientes automaticamente.

## Desenvolvimento e revisão

Um desenvolvedor trabalhou sequencialmente, com bootstrap independente e autorização explícita antes de editar. O principal revisou os três documentos e devolveu refinamentos ao mesmo desenvolvedor até separar capacidade de reasoning, preservar manutenção humana de perfis e restaurar o fallback explícito para seleção e adequação do modelo.

A configuração corrente de modelos e perfis foi registrada somente como evidência desta execução. Não constitui restrição para ferramentas ou modelos usados em atividades futuras.

## Validação

- pnpm validate, pnpm build e pnpm test passaram na ordem prevista. Rodada final com 199 testes, zero falhas e zero skips. O build apresentou apenas o warning conhecido de bundle acima de 500 kB.
- Prettier API passou nos três documentos. Links locais e âncora interna foram conferidos. Busca confirmou ausência de nomes de fornecedores, famílias, modelos atuais e links de clientes na política alterada.
- Doze cenários de independência e preservação do fluxo foram avaliados como critérios documentais. Não são benchmarks ou testes de clientes e modelos reais.
- Hashes confirmaram preservação de 290 arquivos de código, testes, scripts, perfis e histórico, além de 35 arquivos de documentos fora do escopo e arquivos da raiz. O prefixo gerenciado de RULES.md permaneceu intacto.
- Auditorias rules e messages passaram sem findings. A auditoria de encerramento ocorreu depois do registro completo do aceite e dos anexos.

## Limites e continuidade

Trocar fornecedor, cliente, modelo ou nomes de perfis não exige mudar a política, desde que capacidades, controles efetivos, mapeamento de papéis e limites da atividade estejam confirmados. A verificação de compatibilidade do cliente escolhido ocorre em cada atividade quando necessária, sem inventar uma correspondência universal.

Perfis atuais, código do produto e histórico não foram alterados nesta correção. A thread anterior permanece encerrada. Plano, critérios e revisão detalhada continuam nos artefatos anexados desta thread.
