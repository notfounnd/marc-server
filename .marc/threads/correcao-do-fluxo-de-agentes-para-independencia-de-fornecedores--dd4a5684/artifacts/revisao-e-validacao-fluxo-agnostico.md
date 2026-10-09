# Revisão independente do fluxo agnóstico

## Resultado

Aprovação técnica concedida para a correção documental. O fluxo deixa de fixar fornecedores, famílias de modelos, links de clientes, prefixos, IDs ou quantidade de perfis. As escolhas correntes ficam no cadastro e nas evidências de cada atividade.

## Arquivos e limites

- AGENTS.md, linha 31 e linhas 42–46, resolve perfis por inventário e papel e define capacidades, reasoning e fallback sem fornecedor fixo.
- docs/agent-workflows.md, linha 36, usa exemplo neutro de ID. Linhas 77–87 definem capacidade por resultados, controles de reasoning, confirmação humana e perfis persistentes por papel.
- .marc/RULES.md, Custom Rules 2 e 7 da seção Development Loop, alinhadas ao mesmo contrato. Prefixo gerenciado e demais regras preservados.
- Perfis, arquivos de código/testes/scripts, histórico e demais documentos não foram alterados. A thread anterior permanece encerrada e seu resumo intacto.

## Conceitos preservados

Principal capaz de análise arquitetural, planejamento/orquestração e revisão independente, com reasoning de referência mínimo medium e recomendado high. Desenvolvedor capaz de implementar e validar a tarefa com qualidade, com mínimo high e recomendado xhigh. Economia é preferida apenas quando a capacidade e a qualidade exigidas são atendidas.

Esses níveis são referências do projeto, não controles ou campos de API universais. Correspondência com um controle diferente depende de confirmação humana ou documentação do cliente. Capacidade é avaliada pelos requisitos e resultados do papel, não por escala universal ou marca. Reasoning alto não compensa um modelo inadequado.

Configuração ou adequação ao papel desconhecida/insuficiente exige confirmação humana antes da implementação. Configuração já válida e confirmada não gera nova pergunta ritual. Sem introspecção, confirmação humana é aceita e registrada com sua origem.

Perfis persistentes são resolvidos pelo cadastro e mapeamento de papéis. Subagentes temporários reutilizam o perfil compartilhado adequado e não criam cadastro por spawn. Principal administra catálogo e publica entregas. Rename/delete não é consequência automática de atribuição de tarefa. Manutenção explicitamente autorizada pelo humano continua possível.

## Loop realizado

Um desenvolvedor sequencial, identidade runtime 01a11ed1-0d2f-7f73-8f36-94f06d711d36. Modelo solicitado gpt-6-luna, reasoning xhigh, conforme configuração corrente confirmada anteriormente pelo humano. Perfil executor corrente codex-dev e principal corrente codex-software-architect, somente dados desta execução.

Bootstrap independente, fontes e regras conferidos antes da autorização registrada em msg_9a22a3ff2fa149bbac. Revisão independente devolveu refinamentos ao mesmo desenvolvedor para separar capacidade de controles, permitir manutenção humana de perfis e restaurar fallback explícito para seleção/adequação do modelo. Todos foram conferidos após a devolutiva final.

## Validação e evidência

- pnpm validate, exit 0.
- pnpm build, exit 0, warning conhecido de bundle acima de 500 kB.
- pnpm test, exit 0, 199 testes passaram, zero falhas e zero skips.
- Prettier API sem escrita passou nos três arquivos após a validação completa.
- Principal conferiu 20 links locais para arquivos existentes. Desenvolvedor conferiu 21 destinos incluindo âncora interna.
- Busca nos três documentos, incluindo apenas Custom Rules em RULES, sem nomes de fornecedores/famílias/modelos atuais ou links externos de clientes.
- Hash agregado dos 290 arquivos protegidos de código, testes, scripts, perfis e histórico mantido em 790c5d652dcb36c4ec2e8ee198b5b514d5dacd70d7a28006590ca0be07ba2428.
- Hash dos 35 arquivos fora do escopo, demais docs e arquivos da raiz, mantido em 09e7c983288d3f3f524351c9fc19f904a5d0d3aea87f20cf0f51b03f89a6a897.
- Prefixo gerenciado RULES mantido em d8fece9a56dd8c460cb23df377151ea6a42db05871b58805bdc63cc3809b670d.
- Auditoria rules sem findings.

Os 12 cenários do artefato de critérios foram revisados pelo principal como critérios documentais e atendidos. Não são testes executáveis, benchmarks de modelos nem validação de clientes reais. Troca de fornecedor, cliente, modelo ou IDs não exige modificar a política, desde que capacidades, controles efetivos, mapeamentos e limites da atividade estejam confirmados.

## Situação

Sem pendência técnica identificada dentro do escopo. Aguardando avaliação humana. Thread permanece aberta, sem SUMMARY.md ou encerramento automático.
