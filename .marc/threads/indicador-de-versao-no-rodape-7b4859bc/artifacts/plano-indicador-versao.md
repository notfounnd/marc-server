# Plano de implementação: indicador de versão no rodapé

> Execução delegada sequencial com superpowers:subagent-driven-development, adaptada ao contrato local: sem Git, commits, worktree novo ou diário de coordenação. O usuário solicitou proposta registrada e desenvolvimento completo no workspace atual, com bc45139b em paralelo.

**Objetivo:** mostrar a versão da UI do mARC depois do crédito do desenvolvedor, mantendo o acesso aos atalhos.

**Arquitetura:** package.json permanece a única fonte da versão do pacote. O Vite lê esse arquivo relativo ao próprio config e injeta somente a string version como constante __MARC_VERSION__, tanto no desenvolvimento quanto no build. O rodapé apresenta v<versão> sem request HTTP e sem depender de workspace, token ou disponibilidade do daemon.

**Tecnologias:** TypeScript, Vite existente, React, CSS e node:test. Nenhuma dependência nova.

**Fontes:** mensagens msg_8193ebbecbb14c05b9 e msg_338e5bc2271741c69e desta thread; AGENTS.md; contrato marc-ops e RULES.md; README; docs de arquitetura, desenvolvimento, UI e workflows; ADRs de fonte Markdown, bootstrap, roteamento, regras e localização. A consulta memory_recall retornou histórico documental, lido sem encontrar decisão anterior específica de versão no rodapé. Inspeção feita por context-mode.

## Proposta e alternativas

A versão do bundle carregado é a informação exibida. package.json já informa a versão do MCP e evita divergência de manutenção. Injetar um valor no Vite conserva esse mesmo princípio na UI e não transfere o pacote completo ao navegador.

Consultar um novo endpoint do daemon acrescentaria um contrato e estados assíncronos para mostrar uma informação de outra camada. Duplicar uma string no JSX criaria risco de esquecimento no próximo release. Variáveis de ambiente ligadas ao comando npm/pnpm dependeriam da forma de invocação. Essas alternativas não são necessárias para o objetivo atual.

Alterar a versão exige reiniciar o Vite em desenvolvimento ou reconstruir e recarregar os assets publicados. A interface não promete identificar o commit Git nem detectar divergência entre bundle e processo do daemon.

## Escopo autorizado

| Caminho | Responsabilidade |
| --- | --- |
| vite.config.ts | Ler somente version de package.json e definir __MARC_VERSION__ com JSON.stringify. |
| src/ui/vite-env.d.ts | Declaração TypeScript da constante. |
| src/ui/app-content.tsx | Indicador imediatamente após o crédito, antes do controle existente de atalhos. |
| src/ui/styles/composer-footer.css | Ajuste localizado para preservar legibilidade e acesso em larguras estreitas. |
| public/locales/en_US/translation.json | Somente eventual rótulo acessível de versão; versão e prefixo v não são texto traduzível. |
| test/ui-version.test.ts | Verificação funcional da fonte, integração Vite e apresentação. |
| test/i18n.test.ts | Acrescentar somente o novo teste de UI à lista explícita de arquivos autorizados a usar localização, preservando o scan e sua asserção. |
| docs/ui-and-daemon.md | Origem e significado da versão exibida. |

O developer também pode criar artifacts de entrega nesta thread por ferramentas oficiais. Outros caminhos exigem consulta ao principal. Não alterar package.json, lockfile, scripts de avaliação, fixtures de memória, testes da E0, APIs do daemon, arquivos da correção b84827bb, regras gerenciadas ou perfis. Preservar todas as alterações preexistentes, inclusive quando presentes em um arquivo autorizado.

A revisão de integração identificou que o teste existente de localização também fiscaliza imports em arquivos de teste. O principal autorizou a entrada explícita de test/ui-version.test.ts nessa lista; isso reconhece sua finalidade de UI sem reduzir a restrição dos demais arquivos. Os cenários de versão e localização devem passar juntos após esse ajuste.

## Critérios de aceite e revisão

1. O valor corresponde a package.json e não é uma string de release duplicada; há evidência em desenvolvimento e no build.
2. O indicador aparece após o crédito em todas as seleções, inclusive sem workspace ou token.
3. A identificação não faz request novo nem depende do daemon; o catálogo mantém a fronteira de localização.
4. O crédito, a versão e o atalho continuam legíveis e utilizáveis em desktop e viewport estreito, sem overflow introduzido.
5. A fonte e os artefatos Markdown permanecem autoritativos. Código evita else e if aninhado; testes têm cenários explícitos, sem skips condicionais.

## Tarefa única: implementação e entrega

- [ ] Bootstrap independente do developer; ler fontes e plano; responder OK_BOOTSTRAP com escopo, estado inicial e configuração. Esperar autorização explícita interna antes de editar.
- [ ] Registrar hashes/estado inicial dos alvos e limites da bc45139b sem Git. Definir teste que falhe antes da implementação por falta da versão; verificar comportamento real, evitando teste só de texto do código.
- [ ] Implementar a leitura no config, constante tipada e apresentação do indicador. Preservar assinatura, ações existentes e layout geral.
- [ ] Executar testes focados da versão e regressões de UI/localização pertinentes. Inspecionar o resultado antes de ampliar.
- [ ] Formatar apenas os arquivos autorizados. Antes de pnpm validate, rodar preflight read-only de lint e formatação global; se houver escrita prevista fora do escopo, reportar ao principal e não executar write-mode global até resolver a colisão. Não reverter alterações da E0.
- [ ] Executar pnpm validate quando o preflight permitir, pnpm build e pnpm test. Capturar resultados exatos e separar falhas alheias ao escopo; uma rodada serial pode diagnosticar timeouts, sem reclassificar a rodada padrão como sucesso.
- [ ] Retornar relatório interno detalhado com paths/linhas, mudanças, comandos/resultados, limites e estado documental. Publicar entrega própria consolidada sob codex-dev nesta thread, com relatório anexado e revisão do principal pendente.
- [ ] O principal revisa independentemente toda a integração, roda verificações focadas e Playwright CLI, devolve correções internamente e registra atividade/revisão final com parecer explícito.

## Configuração e coordenação

Principal: perfil codex-software-architect, gpt-6.1-sol, high humano-confirmado no perfil. Developer: perfil compartilhado codex-dev, gpt-6-luna, xhigh solicitado no spawn e humano-confirmado no perfil para este modo; não alegar introspecção de reasoning. Essa capacidade é adequada ao escopo pequeno de config, JSX, CSS e testes. Um developer desta tarefa por vez; bc45139b é trabalho humano-autorizado em paralelo e seus caminhos estão excluídos.

O estado de Git é preservado: nenhum comando está autorizado para este novo desenvolvimento. A revisão usa conteúdo e hashes por context-mode. Não criar hooks nem configuração específica de cliente. Registros internos de bootstrap e revisão ficam no canal entre agentes, consolidados apenas na entrega.

## Validação, limites e perguntas

Classificação: alteração executável de UI e build, exigindo validate, build e test, mais browser por Playwright CLI. A validação visual distingue ensaio ad hoc de cobertura E2E durável. Há histórico de timeouts MCP sob concorrência; registrar o que ocorrer no estado atual sem atribuição automática.

Nenhuma pergunta funcional pendente. Decisão de execução: usar a versão do bundle conforme fonte do pacote; não expandir para comparação UI/daemon ou identificação de commit. A autorização para desenvolver já consta do pedido atual; não há publicação, commit ou encerramento autorizado.

## Ajuste visual solicitado na revisão humana

O usuário pediu que o crédito e a versão também sejam separados pela mesma linha vertical já usada antes do atalho. Inserir somente um span content-footer-divider, com aria-hidden, entre o crédito e a versão em src/ui/app-content.tsx. Reutilizar o CSS existente e preservar a ordem crédito, separador, versão, separador e atalho.

Aceite: dois separadores visuais equivalentes, ambos decorativos, sem perder legibilidade, responsividade ou ação dos atalhos. Não criar teste que apenas reproduza esse JSX; executar o teste funcional existente, os checks globais exigidos e verificar o navegador. O developer publica sua própria entrega breve; o principal reavalia a integração após a alteração e atualiza o parecer consolidado. A aprovação técnica anterior se refere ao estado anterior a este ajuste.
