# Indicador de versão no rodapé

Thread: marc://$indicador-de-versao-no-rodape-7b4859bc

Closed: `2026-10-16T00:46:23.189Z`

---

O indicador de versão no rodapé do mARC foi implementado, revisado e aprovado tecnicamente. A apresentação final segue crédito | versão | atalhos, com os dois separadores equivalentes. A thread é encerrada por autorização explícita do usuário após a revisão visual e a inclusão dos arquivos no stage.

## Decisão e entrega

package.json permanece a fonte única da versão. O Vite lê seu campo version relativamente ao próprio config e injeta somente esse valor em __MARC_VERSION__. A UI mostra v<versão> depois do crédito, independentemente de token ou workspace selecionado e sem request ao daemon.

O indicador representa o bundle carregado, não a versão do processo do daemon nem um commit. Alterar a versão exige reiniciar o Vite ou reconstruir e recarregar os assets. Não foram adicionadas dependências, endpoints ou configurações de cliente.

O ajuste solicitado na revisão humana reutiliza content-footer-divider entre crédito e versão, com aria-hidden, mantendo o divisor antes dos atalhos. O CSS existente e as ações de teclado foram preservados. A documentação explica a origem e o significado do valor exibido.

Plano e proposta: marc://#msg_25d93cac8ba84b4183

Entrega própria do developer: marc://#msg_ba2ecb02fe95423faf

Entrega do ajuste visual: marc://#msg_7c1f66d51ce844c09a

Revisão integrada final e relatório consolidado: marc://#msg_fd4100711f164942b8

## Validação e aprovação

Após o último ajuste, o developer executou foco de versão e localização 9/9, pnpm validate, pnpm build e suíte completa 395/395, todos aprovados, sem falhas ou skips. A fronteira de localização inclui explicitamente o novo teste de UI; os demais arquivos continuam sujeitos ao mesmo scan.

O principal conferiu a entrega e os extratos, reavaliou o estado integrado e confirmou por comparação de conteúdo que o ajuste final acrescentou somente o span solicitado. O navegador por Playwright CLI e as capturas em 1280 e 320 px confirmaram divisores da mesma cor, borda e altura, ausência de overflow e abertura/fechamento dos atalhos. A versão também foi validada anteriormente no build de produção em 1280/420/320 px, sem requests de API no cenário sem token/workspace.

O parecer técnico final foi aprovado antes da autorização humana de encerramento. As verificações pertencem às entregas documentadas; este fechamento altera somente registros mARC e não representa nova execução dos checks de código.

## Limites e continuidade

Permanece o aviso do build para chunk JavaScript acima de 500 kB. Não houve otimização de bundle neste escopo nem aprovação por extensão do trabalho paralelo bc45139b.

O backlog Playwright foi revisado e complementado antes do encerramento, cobrindo versão do bundle, dois separadores, responsividade, atalhos e atualização em fixture descartável. A cobertura E2E durável continua pendente, separada das verificações ad hoc realizadas. Registro: marc://$oportunidade-testes-playwright-para-referencias-e-artifacts-ui-f742659a/#msg_d1fc1c85bd6a48b9b1

A auditoria de mensagens desta thread e a de referências do backlog retornaram zero achados. Os 11 arquivos de implementação e registros existentes foram adicionados ao stage conforme solicitação anterior; os novos registros deste encerramento não foram adicionados ao índice.
