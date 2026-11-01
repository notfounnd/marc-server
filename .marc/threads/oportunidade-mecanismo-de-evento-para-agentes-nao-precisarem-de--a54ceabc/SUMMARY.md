# Oportunidade - Mecanismo de evento para agentes não precisarem de intermédio humano quando estiverem em colaboração conjuta

Thread: marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc

Closed: `2026-11-01T14:33:04.574Z`

---

Esta thread partiu da oportunidade de os agentes perceberem menções sem o humano intermediar e terminou no desenho do programa de ativação por menção. O escopo cresceu de avisar uma sessão aberta para manter uma sessão persistente por thread e perfil, que é acordada, retomada ou criada por menção, sob autorização humana e com limite de ciclos. O desenho foi aprovado por marc://@codex-software-architect para decisão humana, as decisões foram confirmadas pelo humano e a revisão de encerramento concluiu "pronta para encerramento". Nada foi implementado: a continuidade está nas threads F0 a F6, e nenhuma delas está autorizada a começar.

## Conclusões

- **Despertar em sessão aberta já funciona no Claude Code**, com processo em background e sem inferência durante a espera. Em teste real, a sessão esperou 28 minutos e detectou a mensagem 217 ms depois do timestamp dela. Falta construir o comando no mARC, não uma capacidade do cliente. No Codex, o despertar de um chat aberto não foi demonstrado.
- **Sem sessão aberta, é preciso um supervisor** externo às sessões. Ele fica no daemon, opt-in por thread.
- **Processo novo não é sessão nova.** O Open Design persiste e retoma sessões nativas; o Tucano não. Nenhum dos dois injeta eventos em uma sessão interativa aberta de outro processo.
- **A CLI não protege contra retomada dupla.** Duas retomadas simultâneas foram aceitas no Claude Code, e o transcript bifurcou em silêncio. A exclusão precisa ser do mARC.
- **Menção que ativa deixa de ser só sinal.** Isso exige ADR substituta da parte incompatível da ADR 0004, sem roteamento por similaridade, texto livre ou LLM.

## Desenho

Quatro autoridades separadas:

- **Presença** observa, a partir da lease do MCP estendida. Não prova posse nem encerramento.
- **Posse** exclui, em registro próprio com geração. Encerramento é comprovado pelo adaptador do cliente.
- **Reserva** autoriza cada ativação, e supervisor e `marc wait` disputam a mesma reserva.
- **Orçamento** limita: por estágio, só entre arquitetos, com 3 passagens por padrão e a proposta como estágio próprio.

O agente só avança de estágio com saldo e citando a condição do plano. Estágio esgotado exige decisão humana. O engineer loop entre arquiteto e devs não muda.

## Decisões do humano

- Supervisor no daemon, sem inicialização no login; sessão sem daemon bloqueia automação na thread.
- F1 e F2 primeiro; ativação começa em modo confirmar; dev fixo por último.
- Risco de restauração antiga do registro aceito, com criticidade baixa.
- Quatro ideias do Tucano incluídas: passagem gravada na mensagem, "Pausar tudo", limite de menções por mensagem e avisos úteis. Elas vieram depois da aprovação do Codex e serão revisadas nos planos das fases.
- Run ao vivo na UI e outras CLIs adiados para marc://$oportunidade-acompanhar-run-ao-vivo-na-ui-e-suporte-a-outras-cli-d04d2f9b.
- marc://$oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5 absorvida e encerrada.
- O limite de 2 a 3 passagens vale para o mecanismo; esta thread exploratória não é parâmetro para ele.

## Registros

Para continuar, leia nesta ordem:

1. Adendo de decisões em marc://#msg_a8f30eba070549569f, que prevalece sobre a v3.
2. Proposta v3 em marc://#msg_b57b3747c091448bbd.
3. Seções 2, 3, 6, 7 e 9 da proposta v2 em marc://#msg_ee987db8d43e4d78bd.
4. Seção 6.2 da proposta v1 em marc://#msg_4e3983d72aa84db387, para o contrato de `marc wait`.
5. Revisões do Codex em marc://#msg_7f797357f0b34e0099, marc://#msg_ba62c220ffbc45a082, marc://#msg_49dfcd6a7f884644ab e marc://#msg_5268a035e779494ab6.

A pesquisa de repositórios, com fontes fixadas em SHA, está em marc://#msg_54d3931f55d84f4e84.

## Observações para os planos das fases

Vêm da revisão de encerramento e não bloquearam o fechamento:

- **F2:** presença no Codex depende das células B2 e B4 da F0. F2 entrega infraestrutura, e a integração específica do Codex fica na F5.
- **F3:** contar passagens pelo Markdown não pode apagar reservas sem mensagem nem tentativas locais. O carimbo nasce da reserva. A mudança de formato cobre campos opcionais, registros antigos e todos os escritores, com validação completa. Avisos não viram despacho nem consomem passagem. Estado mínimo e segurança do supervisor continuam na F3, mesmo com o painel de run adiado.
- **F4:** o aceite do risco não dispensa dados de custo, ausência de laço, plano e autorização.
- **F5:** não depende da F4 para o modo confirmar. A retomada real depende da célula E4, e automático no Codex exige a capacidade específica e a liberação da F4.

## Limites

Nada foi testado em sessão interativa com retomada. Os testes de identidade e retomada no Claude Code foram em `-p`, versão 2.1.316, em sessão pequena. No Codex, 0.161.0 e 0.166.0, sem turno de modelo. O custo de cache frio não foi medido. O protótipo de lease, posse e reserva não existe. Essas lacunas estão na matriz de marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf.

## Continuidade

O programa segue em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf, marc://$ativacao-por-mencao-f1-nucleo-e-marc-wait-manual-5b4a0ab1, marc://$ativacao-por-mencao-f2-vinculo-presenca-posse-e-menu-134b5983, marc://$ativacao-por-mencao-f3-adr-politica-orcamento-reserva-e-supervis-c046c598, marc://$ativacao-por-mencao-f4-automatico-limitado-944287aa, marc://$ativacao-por-mencao-f5-adaptador-codex-a54fb9ae e marc://$ativacao-por-mencao-f6-dev-fixo-6e40fdba. Cada fase depende de plano e autorização do humano.

Esta thread foi encerrada por autorização explícita do humano, depois do veredito "pronta para encerramento" do Codex. Isso encerra a elaboração e não aprova implementação.
