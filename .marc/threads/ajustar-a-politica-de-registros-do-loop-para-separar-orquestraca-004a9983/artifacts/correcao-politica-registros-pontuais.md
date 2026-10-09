# Correção da política de registros do loop

## Autorização e objetivo

O usuário solicitou corrigir imediatamente o contrato. A regra anterior incentivou atualizações contínuas no artefato, transferindo o diário das mensagens para o documento. A correção deve impedir esse comportamento, não apenas mudar o destino do diário.

## Escopo e execução

- Correção executada diretamente pelo principal por ordem explícita do usuário, sem delegação. O subagente inicialmente iniciado foi encerrado antes de qualquer edição.
- O principal alinha somente as responsabilidades dos dois perfis existentes, preservando metadados e configurações.
- Em futuras tarefas delegadas, bootstrap independente e autorização explícita continuam obrigatórios no canal entre agentes antes de editar. Seu registro mínimo será consolidado na entrega, sem editar documentos durante o controle do loop.
- Não alterar a atividade de Toast em execução, produto, modelos, cadastro, concorrência, skill, instruções gerenciadas, outras threads ou código.

## Contrato esperado

- Handoff/handover pontual no início de uma tarefa ou transferência real de responsabilidade. Não repetir a cada iteração, teste ou orientação.
- Rodadas, comandos, diagnósticos intermediários, autorizações e ajustes são conduzidos no canal entre agentes. Não gerar diário em mensagens nem em artefatos.
- Não atualizar documento de atividade/revisão a cada descoberta, check ou correção. Consolidar resultados necessários na entrega da tarefa e na avaliação final integrada.
- Uma decisão material que realmente mude o plano ou contrato pode atualizar o documento pertinente. Uma descoberta relevante pode ser publicada na thread quando muda entendimento ou exige decisão. Não há supressão de registros úteis nem replicação automática do controle interno.
- Preservar autoria direta relevante do desenvolvedor, perfil compartilhado, revisão final completa pelo principal, evidência substantiva e separação entre aprovação, aceite e encerramento.

## Critérios de aceite e validação

- Remover instruções que exigem preservar cada rodada/check/ajuste no artefato durante execução.
- Harmonizar os três documentos e os dois perfis, sem instruções residuais de diário transferido.
- Linguagem normativa en-US, registros conversacionais pt-BR, sem quebra forçada de prosa.
- Prefixo gerenciado, metadados dos perfis e produto intactos.
- Parser Markdown, links e checagem efetiva de formatação. Principal executa pnpm validate, pnpm build e pnpm test e revisa o conjunto final.

## Limites

Correção instrucional, sem hooks ou enforcement. Sessões em execução podem conservar o contrato anterior em contexto e precisam receber o esclarecimento pelo humano ou pelo seu principal. Não interromper ou editar a atividade de outro agente.

## Entrega e avaliação final da correção

O principal corrigiu diretamente AGENTS.md, Agent Workflows, Custom Rules e as responsabilidades dos dois perfis. A revisão cruzada dos cinco arquivos confirmou a remoção da obrigação de atualizar atividade a cada rodada, diagnóstico, autorização ou check. Handoff/handover pontual pode ser mensagem ou documento no início da tarefa ou na transferência real de responsabilidade. Iterações permanecem no canal interno; a entrega e a avaliação final consolidam somente a evidência necessária. Decisões que efetivamente alterem um plano ou contrato continuam podendo atualizar o documento pertinente.

Autoria direta, perfis compartilhados, bootstrap e autorização antes de editar, revisão final completa e separação entre aprovação e fechamento foram preservados. IDs, roles, modelos, descriptions e configurações dos perfis não mudaram. O prefixo gerenciado de RULES mantém o hash d8fece9a56dd8c460cb23df377151ea6a42db05871b58805bdc63cc3809b670d.

Validação direta por context-mode: Markdown aprovado nos cinco arquivos, 22 links locais válidos; pnpm validate, pnpm build e pnpm test aprovados, com 210 testes, zero falhas ou testes ignorados. O build conserva o aviso não bloqueante de bundle superior a 500 kB. Os checks globais ocorreram no workspace compartilhado, que contém desenvolvimento independente em andamento; não representam aprovação da atividade de Toast.

Veredito técnico da correção: aprovado. A instrução nova impede tanto diário em mensagens quanto diário transferido para artefatos, sem dispensar evidência final ou revisão integral. Nenhuma sessão nova foi usada para provar adesão automática. Agentes já em execução podem manter a instrução anterior em contexto e precisam receber ou reler o contrato atualizado. Esta entrega substitui a política de registro contínuo presente no estado originalmente aprovado, sem reescrever a atividade de Toast.
