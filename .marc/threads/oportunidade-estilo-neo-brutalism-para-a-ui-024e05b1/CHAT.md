# Oportunidade - Estilo neo-brutalism para a UI

Thread: `oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1`
Created: `2026-05-24T23:44:59.980Z`

<!-- marc-message
id: msg_abb2014a7310460093
threadId: oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
timestamp: 2026-05-24T23:46:06.745Z
agentId: codex-dev
role: developer
-->

Oportunidade registrada para reavaliar a linguagem visual da UI do mARC com referência em https://www.neobrutalism.dev/.

Objetivo:

- Migrar a aparência da interface para uma direção neo-brutalism mais expressiva, consistente e reconhecível, sem degradar os fluxos operacionais de leitura, navegação e colaboração.

Referência e contexto atual:

- A referência apresenta componentes neo-brutalism baseados em `shadcn/ui`, construídos com Tailwind, licenciados sob MIT e declarados como aderentes a padrões WAI-ARIA.
- A UI atual do mARC é React com CSS próprio e `lucide-react`, sem Tailwind ou shadcn; a avaliação deve decidir entre reproduzir a linguagem visual no CSS existente ou adotar infraestrutura adicional de forma justificada.

Pontos para investigar:

- Vocabulário visual desejado: bordas marcantes, sombras sólidas, contraste, tipografia, cores e estados interativos.
- Impacto nos componentes operacionais existentes: sidebar, colunas de threads/markers, mensagens, modais, menus de artifacts, composer, badges, scrollbars e estados de sincronização.
- Manutenção dos comportamentos já consolidados: colunas com rolagem estável, footer fixo da coluna de conteúdo, modal com scroll lock e controles compactos para uso contínuo.
- Acessibilidade, contraste, foco visível, densidade de informação, responsividade e consistência de localização en-US.
- Estratégia técnica: tokens CSS/componentes atuais versus inclusão de Tailwind/shadcn, considerando custo de manutenção e aderência à stack do projeto.

Valor esperado:

- Dar identidade visual mais forte ao mARC sem converter a ferramenta em uma interface promocional ou reduzir sua eficiência como painel de trabalho.
- Tornar componentes e estados mais legíveis e consistentes, com uma base visual reaproveitável para futuras evoluções da UI.

Critérios de sucesso:

- Proposta visual validada em telas reais da UI antes da migração completa.
- Fluxos existentes preservados e verificados em desktop e viewport reduzida.
- Componentes interativos mantêm acessibilidade, estabilidade de layout e clareza operacional.
- Escolha de integração com a referência documentada, incluindo o que será inspirado/adaptado e o que não será incorporado.

<!-- /marc-message -->

<!-- marc-message
id: msg_4855c74fac804ba583
threadId: oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
timestamp: 2026-05-25T00:37:07.752Z
agentId: ui-user
role: user
artifacts: artifacts/neobrutalism-bootstrap.md
-->

Gosto do esquema de cores atuais do projeto, não quero descaracterizar a identidade atual da ferramenta. Contudo, estou aberto a avaliar mudanças para conformidade do estilo.

Registrei como artefato bootstrap que peguei no site da lib (está na cor teal de lá, mas a cor teal do projeto parece melhor).

<!-- /marc-message -->

<!-- marc-message
id: msg_6feded6fdbe74efba5
threadId: oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
timestamp: 2026-05-25T01:58:11.652Z
agentId: codex-dev
role: developer
artifacts: artifacts/plano-migracao-neo-brutalism-ampla-controlada-ui.md
-->

Plano detalhado registrado. A execução seguirá a migração ampla controlada: componentes oficiais neobrutalism/shadcn na camada visual, palette teal e tipografia monoespaçada atuais preservadas, estrutura operacional das três colunas mantida e contrato consolidado das modais preservado.

<!-- /marc-message -->

<!-- marc-message
id: msg_64ae6443a61a4c53b3
threadId: oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
timestamp: 2026-05-26T01:21:45.129Z
agentId: codex-dev
role: developer
-->

Desenvolvimento concluído e validado após a rodada de refinamentos visuais.

Realizado:

- Migração da camada visual para componentes locais baseados em neobrutalism/shadcn com Tailwind, preservando palette teal, superfícies neutras e tipografia monoespaçada do mARC.
- Ajustes de consistência em cards, badges, menus de artifacts, autocomplete, Markdown renderizado, footer e referências copiáveis.
- Correção do contrato das modais: dialog central para atalhos, sheet de artifact na área de conteúdo, scroll lock, fechamento animado e controles coerentes.
- Documentação atualizada em `docs/ui-and-daemon.md` para refletir a stack visual e os comportamentos da UI.
- Registrada oportunidade separada para modularização futura do CSS por domínio: marc://$oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba.

Validação executada via context-mode:

- `pnpm run validate`: passou.
- `pnpm test`: passou (`84` testes, `0` falhas).
- `pnpm build`: passou; permanece o aviso conhecido do chunk inicial de `610.01 kB` (`191.49 kB gzip`), analisado como aceitável para o aplicativo local.

Aguardo feedback para orientar a finalização da thread.

<!-- /marc-message -->

<!-- marc-message
id: msg_d8ac8a86d8fe4c539c
threadId: oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
timestamp: 2026-05-26T01:32:44.597Z
agentId: codex-dev
role: developer
-->

Validação pós-restart executada após rebuild e reinício do daemon/MCP.

- `workspace_bootstrap`: conexão e contrato do workspace confirmados.
- `workspace_status`: índice de threads em estado `ready`, sem rebuild pendente ou erro.
- Smoke HTTP via context-mode: `GET /`, asset JavaScript atual e asset CSS atual responderam `200` e foram servidos com os tamanhos esperados.

Observação: requisições `HEAD` aos assets retornam `404`, mas `GET` funciona corretamente; isso não bloqueia a carga da UI e não altera a validação desta evolução.

<!-- /marc-message -->
