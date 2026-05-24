# Resumo - Modelo de segurança e gestão de token do daemon

Thread: `oportunidade-modelo-de-seguranca-e-gestao-de-token-do-daemon-674632b3`
Closed: `2026-05-24T23:15:59.807Z`

## Resultado executivo

- A oportunidade foi encerrada sem desenvolvimento após investigação do comportamento real do daemon, da UI, do MCP, das rotas HTTP e da documentação existente.
- A hipótese inicial de que o token único e persistente exigiria endurecimento no produto atual não se sustentou para o contrato suportado: daemon local em `127.0.0.1`, operado pelo proprietário da máquina.
- O token atual é adequado ao uso local: ele autentica chamadas para a API de uma instância do daemon, mas não concede acesso autônomo ao repositório nem representa identidade de usuário ou máquina perante um serviço central.
- Não foram identificadas alterações de código ou documentação técnica que entregassem valor proporcional sem introduzir complexidade artificial no fluxo local do mARC.

## Motivação original

A thread foi aberta para avaliar se o daemon necessitava de um modelo de segurança mais elaborado, considerando:

- rotação ou regeneração do token;
- token único versus permissões separadas;
- isolamento entre workspaces registrados;
- vazamento do token;
- comportamento em máquina local versus possível ambiente compartilhado;
- UX para token inválido, expirado ou alterado.

A avaliação era pertinente enquanto essas perguntas permaneciam abertas. A investigação posterior esclareceu que parte delas pressupunha capacidades ou ameaças que não existem no produto atual.

## Arquitetura verificada

- O MCP é configurado por repositório e escreve diretamente no diretório `.marc/` desse projeto.
- O daemon serve a UI, mantém um registro de workspaces locais e expõe uma API HTTP para visualizar e acrescentar conteúdo nos workspaces que consegue acessar no próprio filesystem.
- Um workspace registrado contém caminhos locais (`rootPath` e `marcPath`); o daemon não sincroniza conteúdo entre máquinas nem recebe uma réplica remota do repositório.
- O token é armazenado em `.marc-daemon/token`, pertence à instância do daemon e é reutilizado entre reinicializações para preservar a operação simples da UI e integrações locais.
- O mesmo token é utilizado pela UI para acessar a API e pelo MCP, quando configurado com daemon, para registrar/desregistrar o workspace e manter leases; as demais operações MCP sobre threads, regras, agents e artifacts continuam ocorrendo diretamente em `.marc/`.

## Impacto real de vazamento do token

No contrato atual, um token copiado ou até versionado acidentalmente não concede acesso ao ambiente de origem a partir de outra máquina, porque o daemon padrão escuta apenas em `127.0.0.1` e o conteúdo permanece no disco local.

- Uma pessoa que obtenha o token e o use em seu próprio computador apenas autentica uma instância local que ela própria executar com esse valor.
- Para usar o token contra o daemon original, seria necessário alcançar a API HTTP naquela máquina.
- Se um processo já possui acesso local suficiente para ler ou alterar a pasta `.marc/`, o token deixa de ser a barreira relevante: o mesmo ambiente normalmente também permite alcançar o restante do repositório.
- A ausência de versionamento ou recuperação de mudanças em `.marc/` é uma preocupação de histórico/backup do projeto, não uma falha que rotação ou escopo do token resolvam.

## Capacidade das rotas atuais

A API autenticada do daemon não equivale a acesso administrativo ao repositório:

- permite listar workspaces registrados, ler threads, regras, agents e artifacts exibidos pela UI;
- permite acrescentar mensagens e artifacts em threads existentes, o que poderia poluir o histórico caso a API local estivesse acessível a alguém indevido;
- permite remover um workspace do registro do daemon/UI, sem apagar a pasta `.marc/` nem o código-fonte do projeto;
- não fornece uma rota para apagar ou editar arbitrariamente arquivos do repositório.

Essas capacidades não constituem uma ameaça prática demonstrada enquanto a API permanece local à máquina controlada pelo usuário.

## Decisão

- Manter o modelo atual de token único, estável e reutilizado pela instância local do daemon.
- Não implementar rotação automática de token.
- Não implementar tokens por workspace, separação read/write ou autorização granular.
- Não alterar a persistência do token na UI como resultado desta oportunidade.
- Não alterar fluxos de registro, lease ou acesso da API apenas por uma hipótese de exposição que não pertence ao modo suportado atual.
- Encerrar a oportunidade sem plano de desenvolvimento, pois a investigação eliminou a necessidade de implementação.

## Fronteira futura

Um mARC centralizado ou disponibilizado em rede seria uma evolução arquitetural diferente. Nesse cenário, tokens poderiam representar identidade de cliente, usuário ou daemon perante um serviço compartilhado, e passariam a ser relevantes para:

- autorização por workspace;
- autoria e auditoria de ações;
- revogação de acesso;
- sincronização entre máquinas;
- concorrência e conflitos em conteúdo compartilhado;
- definição de onde vive a fonte de verdade.

Nenhuma dessas capacidades existe atualmente, e elas não devem ser introduzidas de forma indireta por mudanças no token do daemon local.

## Evidência e validação

- A investigação via context-mode revisou a thread, a implementação de configuração/autenticação/rotas/lifecycle do daemon, o cliente MCP, a UI React e o fallback embutido, os testes do daemon e a documentação vigente.
- `workspace_update_recommendations` confirmou que as recomendações gerenciadas já estavam atuais antes do encerramento.
- `workspace_audit` com escopo `preflight` não encontrou achados antes do registro desta decisão.
- Não houve mudança em código, testes ou documentação do produto; por isso o fluxo de validação de desenvolvimento (`pnpm run validate`, `pnpm test`, `pnpm build`) não foi acionado para este encerramento analítico.

