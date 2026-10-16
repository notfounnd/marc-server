# Atividade consolidada e revisão integrada: versão no rodapé

## Resultado e escopo

A UI mostra v0.3.0 após o crédito do desenvolvedor e antes do acesso aos atalhos. O valor vem exclusivamente do campo version de package.json, lido pelo Vite relativamente ao próprio config e incorporado como constante de build. Representa o bundle carregado, sem consulta ao daemon, autenticação ou seleção de workspace. Alterar a versão requer reiniciar o Vite ou reconstruir e recarregar os assets.

A entrega executável compreende sete arquivos: vite.config.ts, src/ui/vite-env.d.ts, src/ui/app-content.tsx, src/ui/styles/composer-footer.css, test/ui-version.test.ts, test/i18n.test.ts e docs/ui-and-daemon.md. O catálogo permaneceu intacto. Foram preservadas as mudanças preexistentes e o trabalho paralelo bc45139b; nenhum comando Git, dependência, hook, configuração de cliente ou endpoint foi introduzido nesta tarefa.

Plano: marc://#msg_25d93cac8ba84b4183

Entrega própria do developer, cuja autoria codex-dev e metadados de artifact foram conferidos: marc://#msg_ba2ecb02fe95423faf

## Revisão final integrada do principal

Revisei todo o estado autorizado após a última correção, usando context-mode: plano e mensagens da thread, relatório do developer, configuração Vite, declaração, JSX, CSS, teste funcional, allowlist de localização e documentação. As fontes de contrato foram AGENTS.md, marc-ops, bootstrap completo com RULES.md e Custom Rules, README, docs de desenvolvimento, UI, arquitetura e workflows e ADRs aplicáveis 0001, 0003, 0004, 0007 e 0008. A consulta histórica e a leitura do histórico documental não revelaram decisão prévia que impedisse a proposta.

| Critério | Avaliação da integração e evidência |
| --- | --- |
| Fonte única da versão | vite.config.ts:7–14 lê somente version de package.json e usa JSON.stringify na constante. Não depende de ambiente npm/pnpm e não envia o pacote inteiro ao cliente. O teste carrega a configuração real, compara a versão do pacote com o HTML e falhou antes da implementação pelo markup ausente. Os assets finais não contêm a macro pendente. |
| Posição e disponibilidade | src/ui/app-content.tsx:98–115 mantém o crédito, coloca a versão antes do divisor/atalho e deixa o footer fora das condições de seleção. Teste SSR real e navegador sem token/workspace confirmaram a versão. |
| Layout e interação | CSS localizado permite wrap e encolhimento do crédito, preservando o indicador. Inspecionei capturas reais e medi documento e footer em 1280, 420 e 320 px. Não houve overflow; o atalho abriu por mouse e Enter, e Escape fechou a sheet. |
| Localização e manutenção | O valor e prefixo v são identificadores, sem novo texto traduzível. A única extensão de test/i18n.test.ts foi reconhecer o novo teste de UI na lista permitida, mantendo o scan e a asserção da fronteira. O teste usa Vite SSR e fecha o servidor em finally; não altera tsconfig para importar TSX. |
| Escopo e arquitetura | Não há alteração de persistência ou contratos de API. Markdown permanece autoritativo para os registros; projeções continuam derivadas. Não há novo fluxo condicional que exija Strategy; os caminhos alterados mantêm as regras de controle e testes sem seleção condicional de cenários. A documentação em docs/ui-and-daemon.md:115 explica bundle versus daemon. |

A revisão detectou a entrada ausente na allowlist e uma asserção de ordem que poderia aceitar crédito ausente por indexOf retornar -1. O developer corrigiu ambos sob autorização interna. A allowlist foi adicionada ao plano como expansão mínima de escopo; a asserção agora exige presença do crédito. A revisão complementar independente não encontrou defeitos bloqueantes e corroborou o segundo achado. Reavaliei a integração após as correções, incluindo execução do teste final.

## Evidência verificada pelo principal

- Foco de versão, localização, Markdown, perfil e sidebar: 15/15 após o ajuste da allowlist. Após reforçar a asserção do crédito, o foco versão+localização passou novamente 9/9.
- pnpm run code:check: exit 0, com lint e Prettier global aprovados. pnpm run typecheck: exit 0. O developer também executou pnpm validate final com exit 0, precedido por preflight sem edições previstas fora do escopo.
- pnpm build independente no estado final: exit 0. Vite 7.3.2 transformou 2392 módulos; JS index-qTdSIVZ_.js de 672,35 kB. Permanece o aviso de chunk acima de 500 kB.
- pnpm test independente no estado final: exit 0, 395/395, zero falhas, cancelamentos ou skips, em 77,01 s. Essa execução inclui a asserção final e supera a limitação temporal e de retenção dos resultados anteriores declarada pelo developer.
- Playwright CLI validou desenvolvimento e preview do build. No build final, larguras 1280/420/320 tiveram scrollWidth do documento igual à viewport e scrollWidth do footer igual a clientWidth; v0.3.0 permaneceu visível. A ativação por teclado e o fechamento passaram, sem pageErrors e sem requests /api no cenário sem token/workspace. O único erro de recurso observado foi favicon.ico ausente, também presente no baseline.
- Os hashes dos sete arquivos finais permaneceram iguais após os checks, build, suíte e navegador. O catálogo manteve seu hash inicial. As capturas de apoio estão no Temp do usuário: marc-footer-version-wide.png, marc-footer-version-narrow.png e marc-footer-version-final.png.

Os stdout globais anteriores do developer não estavam recuperáveis após sua compactação. Não os reconstruímos. A rodada independente acima capturou diretamente status, saída final e totais, fornecendo evidência atual para este parecer.

## Autoria e coordenação

Principal: codex-software-architect, gpt-6.1-sol/high humano-confirmado no perfil, sem alegação de introspecção. Developer runtime /root/footer_version: perfil compartilhado codex-dev, gpt-6-luna/xhigh solicitado no spawn e humano-confirmado no perfil para este modo. Verifiquei seu bootstrap independente no workspace marc-dd422176e1, leitura das fontes, escopo e hashes iniciais, e autorizei explicitamente a edição antes de qualquer mudança. Houve um developer desta tarefa por vez. A revisão complementar foi somente leitura e não substituiu esta revisão integrada.

## Parecer e limites

**Aprovado tecnicamente para o indicador de versão no rodapé.** O estado final atende aos critérios funcionais, mantém a arquitetura existente e tem cobertura de integração e evidência visual atual. A aprovação decorre da revisão integral, das correções verificadas e dos resultados independentes acima; não apenas do relato do executor ou da auditoria estrutural.

O indicador identifica a UI carregada; não detecta discrepância com o processo do daemon nem identifica commits. A verificação de navegador foi ad hoc e não cria uma suíte E2E durável. Nenhuma otimização de bundle integrou o escopo. A aprovação desta tarefa não declara o repositório inteiro release-ready nem aceita por extensão o trabalho paralelo.

A implementação é apresentada à revisão humana. Aceite do usuário e autorização de encerramento permanecem separados deste parecer; a thread continua aberta.

Após associar este relatório à mensagem de entrega do principal, workspace_audit nos escopos artifacts, messages e references retornou zero achados em todos eles. Essa auditoria é estrutural e não substitui o parecer técnico acima.

## Revisão integrada após o ajuste visual solicitado pelo usuário

O usuário pediu um separador entre o crédito e a versão, igual ao existente antes do atalho. O developer reutilizou somente o span content-footer-divider com aria-hidden em src/ui/app-content.tsx:102. Sua entrega própria está em marc://#msg_7c1f66d51ce844c09a.

O principal reavaliou o estado integrado: a comparação de conteúdo confirmou que remover apenas o novo span recupera o hash anterior do componente. Os outros seis arquivos de fonte/testes/documentação desta entrega permaneceram iguais. A fonte da versão, a injeção pelo Vite, a tipagem, a fronteira de localização e os critérios anteriores continuam preservados; não há nova lógica ou estilo a manter. O hash final do componente é 7da9465e21cf5cd6939965d902ffb6b4f7ee884766f5c7e36be4d5441b1ecb21.

Na validação independente por Playwright CLI e inspeção das capturas em 1280 e 320 px, conferi a ordem crédito, separador, versão, separador e atalho. Os dois divisores têm aria-hidden=true, borda de 1 px na mesma cor e altura de 15 px. O documento e o footer mantiveram scrollWidth igual à largura disponível no viewport estreito; o atalho abriu e Escape fechou a sheet. O servidor e a sessão de browser criados para essa verificação foram encerrados.

Conferi os extratos diretos enviados pelo developer após este delta: foco versão+localização 9/9; pnpm validate exit 0; build exit 0, 2392 módulos e JS index-DQANPnd-.js de 672,42 kB; pnpm test exit 0, 395/395, zero falhas, cancelamentos ou skips, em 45,00 s. O aviso de chunk acima de 500 kB permanece. Esses checks são do developer; a revisão de integração, comparação de conteúdo e execução de navegador acima são do principal. Não foram criados testes que apenas reproduzissem o markup do separador.

**Parecer atualizado: aprovado tecnicamente para o estado final com os dois separadores.** O ajuste corresponde ao pedido humano e conserva os critérios funcionais, a integração e a manutenção já avaliados. Este parecer substitui a aprovação do estado anterior para a apresentação visual atual. A thread continua aberta; não houve comando Git nem alteração no trabalho paralelo bc45139b.
