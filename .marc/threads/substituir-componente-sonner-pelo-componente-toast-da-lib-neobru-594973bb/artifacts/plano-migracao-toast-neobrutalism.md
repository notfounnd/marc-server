# Plano de migração para o Toast do Neobrutalism

## Objetivo e decisões

Substituir Sonner pelo componente local do registro oficial Neobrutalism, baseado em Base UI. Preservar os fluxos existentes e a identidade teal, as superfícies neutras, bordas, sombras e tipografia monoespaçada consolidadas na UI.

Proposta aprovada no chat; execução solicitada pelo usuário em 2026-10-09. Nenhuma decisão de produto pendente. Aprovação técnica e fechamento da thread permanecem separados da autorização para implementar.

## Fontes

- Thread atual: marc://$substituir-componente-sonner-pelo-componente-toast-da-lib-neobru-594973bb, mensagem inicial msg_fef6a0d3094942f9b8.
- Decisão histórica recuperada por memory_recall e lida: marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1.
- README.md; docs/agent-workflows.md; docs/harness-engineering.md; docs/ui-and-daemon.md; ADRs 0001, 0003, 0004, 0007 e 0008.
- Contrato completo retornado por workspace_bootstrap; .agents/skills/marc-ops/SKILL.md; AGENTS.md.
- Documentação oficial: https://www.neobrutalism.dev/docs/toast e https://neobrutalism.dev/r/toast.json.
- Base UI: documentação atual consultada via Context7; registro npm verificou @base-ui/react 1.9.0 compatível com React 19.
- Código e configuração inspecionados via context-mode, incluindo adaptador, Toaster, Button, tokens, testes e catálogo en-US.

## Arquitetura e interfaces

- Criar src/components/ui/toast.tsx a partir do registro oficial. Reutilizar o Button atual; não instalar seu substituto nem migrar outros componentes Radix.
- Usar um gerenciador toast compartilhado criado por ToastPrimitive.createToastManager em src/components/ui/toast-manager.ts e um único Toaster montado na raiz da aplicação. O componente importa/reexporta o singleton; adaptador e teste importam o módulo .ts por specifier .js relativo.
- Adicionar @base-ui/react ^1.9.0, remover sonner e atualizar pnpm-lock.yaml.
- Preservar showNotification(message: string, kind: Exclude<StatusKind, "idle"> = "ok"): void. Usar tabela de despacho com ok -> success, warn -> warning e error -> error; chamar toast.add com title: message e timeout: 2400.
- Manter o canto inferior direito em desktop e margens seguras em telas estreitas. Permitir quebra de referências e mensagens longas; preservar fechamento, empilhamento e recursos de acessibilidade do Base UI.
- Traduzir rótulos de fechamento e da região na camada src/ui e repassá-los ao componente. Adicionar apenas as chaves necessárias ao catálogo en-US.
- Atualizar docs/ui-and-daemon.md para registrar Base UI, o componente local e o adaptador de notificações.
- Markdown continua sendo a fonte de verdade. A tarefa altera apresentação; não altera persistência, daemon, MCP ou localização técnica.

## Tarefa única e escopo autorizado

Executar uma tarefa atômica: migrar notificações, integrar, testar e documentar. Paths de escrita exclusivos do desenvolvedor:

- Criar src/components/ui/toast.tsx.
- Criar src/components/ui/toast-manager.ts somente para o singleton compartilhado, conforme ajuste de integração documentado na atividade.
- Remover src/components/ui/sonner.tsx.
- Alterar src/ui/notifications.ts e src/ui/app.tsx.
- Alterar package.json e pnpm-lock.yaml somente para a troca de dependências.
- Alterar public/locales/en_US/translation.json somente para rótulos do Toast.
- Criar test/ui-notifications.test.ts.
- Alterar docs/ui-and-daemon.md somente para a migração das notificações.

O principal mantém os artefatos de plano e atividade. Outros paths, alterações em Button, infraestrutura de testes ou mudanças de comportamento adicionais exigem informar conflito ao principal antes de editar. Não usar Git; não instalar hooks ou configuração de cliente; não fazer limpeza ou revert amplo.

## Execução e checkpoints

1. Principal registra o plano com metadata de artefato e executa workspace_audit scope preflight.
2. Desenvolvedor lê fontes, bootstrapa independentemente e devolve OK_BOOTSTRAP antes de editar.
3. Principal verifica identidade, regras, configuração, paths e estado dos alvos; registra a verificação na atividade e comunica autorização no canal entre agentes.
4. Desenvolvedor cria teste de regressão do adaptador antes da implementação, observa a falha, incorpora o componente, integra e verifica o teste novamente. Não depender de APIs privadas do gerenciador para testar.
5. Executar validação e Playwright CLI. Relatar paths e linhas, comandos e resultados, documentação, riscos e desvios ao principal.
6. Principal revisa todo o estado integrado de forma independente; devolve correções ao mesmo desenvolvedor e repete revisão/checks afetados após mudanças.
7. Principal registra veredito substantivo na atividade e publica entrega após auditoria de mensagens. Thread continua aberta até autorização humana de fechamento.

## Validação e critérios de aceite

- Teste Node do adaptador: mensagem preservada, sucesso padrão, mapeamento dos três tipos e timeout 2400 ms.
- Playwright CLI: sucesso, alerta e erro; fechamento manual; expiração; pausa durante hover/foco; empilhamento; teclado; referência longa; desktop e viewport estreita. Não usar Playwright MCP.
- pnpm validate, pnpm build e pnpm test via context-mode. validate executa correções automáticas: comparar os arquivos afetados, preservar trabalho existente e comunicar qualquer alteração fora do escopo antes de corrigir ou ampliar a tarefa.
- Não restam importações, dependência direta ou componente Sonner.
- Rótulos acessíveis localizados na UI, fonte visual consistente e nenhum aviso cortado em tela estreita.
- Código novo em en-US; comunicação em pt-BR; sem else ou if aninhado; guardas usam early return e variações usam despacho.
- Revisão integrada confirma comportamento, integração, manutenção, regras, documentação, escopo e limites das evidências reais.

## Configuração e pressupostos

Perfis existentes reutilizados: codex-software-architect como principal, gpt-6.1-sol/high conforme perfil humano-confirmado; codex-dev como desenvolvedor, gpt-6-luna/xhigh confirmado no chat. A configuração é confirmação humana, não introspecção de runtime. Uma instância desenvolvedora por vez, conforme o ensaio sequencial vigente. Subagentes não delegam.

A implementação ocorre no workspace solicitado C:\Projetos\marc, sem comandos Git, worktrees ou commits. Artefatos e mensagens mARC são mantidos; o protocolo local substitui o ledger e scripts Git genéricos das skills.
