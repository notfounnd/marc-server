# Brief de investigação — eventos, sessões e harness Codex

Data: 2026-10-30. Escopo autorizado pelo humano: analisar a thread a54ceabc, referências e projetos citados, investigar fontes temporariamente e publicar proposta detalhada. Não inclui implementar o mecanismo.

## Objetivo e fontes

Comparar as duas respostas anexadas à thread, revisar a oportunidade de modo online 6a4f84b5 e o aprendizado E2 c34cf4a2, verificar capacidades documentadas do Codex e confrontar os fontes atuais de eduwxyz/tucano e nexu-io/open-design. Fontes locais: RULES.md, README, docs/agent-workflows.md, docs/harness-engineering.md e ADRs 0001, 0003, 0004, 0007 e 0008.

## Divisão de responsabilidade

Principal codex-software-architect: histórico, capacidades do Codex, código atual do mARC, síntese e revisão integrada. Pesquisador delegado sob codex-dev: investigação estática dos dois repositórios, relatório próprio e entrega consolidada de autoria própria na thread. Ensaio vigente: um desenvolvedor por vez. Modelo herdado do principal gpt-6.1-sol; arquivo de configuração local declara high. A declaração não comprova reasoning efetivo; a pesquisa não inclui implementação ou execução de agentes dos projetos.

## Limites e escrita

O delegado retorna OK_BOOTSTRAP e aguarda autorização interna antes de baixar ou escrever. Escopo temporário exclusivo: C:\Users\junior\AppData\Local\Temp\marc-a54ceabc-research-20261030. Artefato de relatório e mensagem na thread por ferramentas oficiais. Sem Git, instalação de dependências, execução de scripts externos, mudanças em configuração/perfis ou código de produto. Downloads públicos fixados em SHA, podendo limitar-se a arquivos relevantes para reduzir tamanho. Limpeza apenas do diretório exclusivo, verificando caminho absoluto e ausência de processos próprios pendentes.

## Critérios e validação

Rastrear invocação CLI, identidade e reuso de sessão, eventos/menções, aprovação, limites, cancelamento e reconexão/replay. Distinguir sessão lógica da aplicação, processo e sessão nativa do agente. Citar links permanentes e linhas, data/SHA, limitações e testes apenas inspecionados. Confirmar ou refutar a informação de que Tucano não reaproveita sessão. Comparar Open Design atual à análise histórica sem tratar o estudo antigo como capacidade atual. Usar context-mode e PowerShell; não executar suítes de produto para pesquisa editorial. Preservar Markdown como fonte dos registros, formatos estruturados existentes e ADR 0004. Não criar hooks ou integração ativa.

## Entregas

Relatório delegado com evidências e limpeza; proposta principal com conclusão sobre este harness, arquitetura incremental, riscos, critérios de aceite e questões pendentes. Revisão final da coerência das fontes e auditorias focadas em artefatos, referências e mensagens. Thread permanece aberta.
