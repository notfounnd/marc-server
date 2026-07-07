# Experiência - uso da memory como pesquisa de conhecimento sobre UI

## Contexto

Após o desenvolvimento do tuning de recall/ranking da memory, a ferramenta foi usada em uma consulta real de conhecimento do projeto. A pergunta não era sobre implementação imediata, mas sobre recuperar decisões históricas já registradas nas threads do mARC.

O objetivo foi validar se a memory ajudaria a reconstruir rapidamente o entendimento histórico sobre regras de UI e organização das informações.

## Consultas usadas

Foram feitas consultas semânticas sobre:

- regras implementadas no desenvolvimento da estrutura da UI;
- layout de três colunas;
- navegação, workspaces, threads, conteúdo e CSS;
- organização das informações na UI;
- hierarquia entre threads, mensagens, artifacts, referências, autocomplete e Markdown.

## Threads recuperadas como fontes principais

A memory apontou com boa relevância para threads diretamente relacionadas ao tema:

- marc://$oportunidade-esquemas-de-visualizacao-das-colunas-da-ui-604ad99b
- marc://$oportunidade-estilo-neo-brutalism-para-a-ui-024e05b1
- marc://$oportunidade-organizar-css-da-ui-por-dominio-aa4c94ba
- marc://$oportunidade-autocomplete-de-referencias-no-composer-2341bc9f
- marc://$oportunidade-referencias-internas-e-mencoes-direcionadas-3c4261b4
- marc://$oportunidade-popup-para-postar-artifacts-pela-ui-c04986bd
- marc://$oportunidade-politica-de-concorrencia-e-escritas-no-markdown-sot-3d40719f
- marc://$oportunidade-encerramento-de-threads-por-summary-e-indice-json-ce47939a

As threads mais relevantes foram lidas antes da síntese, seguindo a orientação da própria memory de consultar a fonte original antes de consolidar ou contradizer decisões históricas.

## Síntese recuperada sobre estrutura da UI

A memory permitiu reconstruir uma visão consistente:

- A UI é um painel operacional denso de três colunas, não uma landing page ou interface decorativa.
- A coluna do meio tem modos explícitos: Threads, Marckers e arquivo.
- Marckers é uma visualização exclusiva da coluna do meio, não uma lista fixa subordinada às threads.
- Cada coluna tem rolagem própria.
- A terceira coluna mantém footer fixo, com header e conteúdo na área rolável.
- O footer de atalhos pertence à terceira coluna de conteúdo, não ao composer.
- Overlays têm contrato próprio: atalhos em dialog central; artifacts em sheet/modal na área de conteúdo à direita.
- O background deve ficar bloqueado enquanto modal está aberta.
- CSS é organizado por domínio funcional: foundation, shell/navigation, thread/content, overlays, composer/footer e responsive.
- src/ui/styles.css funciona como entrypoint agregador, preservando a ordem da cascata.
- A linguagem visual definida combina neobrutalism/shadcn local com Tailwind, mantendo teal, superfícies neutras e tipografia monoespaçada.

## Síntese recuperada sobre organização das informações

A experiência também evidenciou uma regra conceitual importante: cada informação deve ficar perto do seu dono semântico, não apenas onde é conveniente renderizar.

Modelo consolidado:

- Thread é o eixo de navegação.
- Message é o eixo da conversa.
- Artifact pertence à Message, não diretamente à Thread.
- SUMMARY.md representa a síntese/encerramento da thread.
- Índices e caches são derivados; Markdown continua fonte da verdade.

Decisões de organização recuperadas:

- Conteúdo longo não deve poluir o CHAT.md.
- Mensagens curtas ficam no transcript.
- Conteúdo longo vai para artifact .md.
- O artifact é vinculado na metadata da mensagem.
- O menu de artifacts aparece no header da thread.
- A lista de artifacts respeita a ordem das mensagens.
- Referências marc:// preservam href canônico, mas exibem labels curtos e consistentes.
- Threads abertas são ordenadas por createdAt descendente.
- Threads fechadas são ordenadas por closedAt descendente.
- Mensagens seguem a ordem do CHAT.md, da mais antiga para a mais nova.
- Artifacts aparecem imediatamente abaixo da mensagem pai no autocomplete.
- Busca cross-thread só ocorre quando há referência explícita para outra thread.

## Resultado da experiência

A experiência validou o valor prático da memory para pesquisa de conhecimento histórico:

- A ferramenta recuperou threads diretamente relacionadas ao tema.
- O ranking priorizou decisões de UI e organização informacional em vez de apenas matches genéricos.
- A leitura dos summaries permitiu transformar resultados dispersos em regras operacionais aplicáveis a futuras evoluções.
- O fluxo confirmou que a memory funciona como camada de orientação histórica para agentes: primeiro encontra fontes prováveis, depois exige leitura da thread original antes de consolidar entendimento.

## Observação para continuidade

Esta experiência deve ser considerada evidência prática para evoluções futuras da memory:

- consultas de arquitetura e produto se beneficiam de bons summaries;
- as razões de ranking ajudam a explicar por que uma thread foi recuperada;
- a ferramenta é útil não só para evitar decisões repetidas, mas também para reconstruir princípios de design e organização do projeto;
- novas threads deveriam manter summaries ricos em decisões, regras e continuidade, porque esse material vira a principal superfície de pesquisa histórica.
