# Correção do teste de lock stale e diagnóstico do cliente Codex

## Escopo e decisão preservada

Continuação da migração na thread 3b4a8787, após o usuário reiniciar os clientes e reportar falha no teste de recuperação de lock stale. A decisão humana continua sendo aceitar somente MCP `2026-07-28`, sem suporte ao handshake legado. A thread permanece aberta.

O plano aprovado desta correção é `artifacts/plano-correcao-teste-lock-stale.md`, associado à mensagem `msg_03e89102b880408a8d`. A entrega e a revisão da migração permanecem registradas em `artifacts/atividade-migracao-mcp-2026-07-28.md`.

## Diagnóstico e alteração

O teste definia `timeoutMs: 100`, embora sua finalidade fosse demonstrar recuperação de um lock antigo. Em `src/core/write-coordination.ts:116`, o prazo é calculado antes do `mkdir` assíncrono da pasta de locks, na linha 123. Um atraso de I/O pode consumir esse prazo antes da primeira tentativa de aquisição.

O principal reproduziu a mesma falha sem editar arquivos: atrasou em memória por 120 ms somente o `mkdir` recursivo da pasta pai de locks. Antes da correção, o arquivo teve 5 testes aprovados e uma falha, exclusivamente no caso de recuperação stale. Isso demonstra a fragilidade do orçamento de tempo; não mede retrospectivamente a latência exata da máquina do usuário.

A única edição manual autorizada ocorreu em `test/core-write-coordination.test.ts`:
- Linha 165: prazo do caso de recuperação alterado de 100 para 5.000 ms.
- Linha 169: asserção `ENOENT` após a execução confirma que o lock foi liberado.
- Preservados o lock artificialmente antigo, `retryDelayMs: 1`, `staleAfterMs: 10`, a asserção de execução do escritor e o teste separado de contenção com timeout curto.

Não houve mudança na implementação de locks nem no protocolo, nas dependências ou nas configurações dos clientes.

## Execução e validação

Executor compartilhado: perfil `codex-dev`, runtime `/root/stale_lock_test_fix`, modelo solicitado `gpt-6-luna`, reasoning `xhigh`, conforme configuração humana previamente confirmada. O executor realizou bootstrap independente de `marc-dd422176e1` em `C:\Projetos\marc`, leu o contrato completo e as fontes do brief e recebeu autorização explícita do principal antes da edição. Execução sequencial, um developer por vez.

Evidências do executor, por context-mode:
- Arquivo isolado: 6/6.
- Reprodução controlada com atraso de 120 ms: 6/6.
- `pnpm validate`: exit 0.
- `pnpm build`: exit 0.
- `pnpm test`: 226/226, zero falhas, skips ou cancelamentos.

Evidências independentes do principal após a última alteração:
- Leitura do teste final e da implementação de aquisição.
- Reprodução controlada de 120 ms: 6/6, exit 0.
- Nova execução de `pnpm test`: 226/226, exit 0, zero falhas, skips ou cancelamentos.
- Hashes de `src/core/write-coordination.ts`, `src/mcp/server.ts`, `package.json` e `pnpm-lock.yaml` iguais ao baseline anterior à correção.

O snapshot do executor durante validate identificou alteração em `.marc/cache/thread-index.json`. O principal conferiu que é JSON válido, com 59 entradas, e autorizou preservá-lo como estado derivado, sem atribuir sua origem ao comando sem evidência. Nenhum revert foi realizado. Os snapshots posteriores de build e teste, abrangendo 885 arquivos fora de dependências, distribuição e Git, não identificaram novas alterações.

O build concluiu com aviso não bloqueante do Vite sobre um chunk de aproximadamente 671 kB. Não foi ampliado o escopo para tratar esse aviso.

## Documentação e fontes

Foram revisados `docs/development.md` e `docs/mcp-migration-2026-07-28.md`. A mudança corrige o orçamento de tempo de uma fixture e acrescenta verificação de liberação; não altera o contrato de produção e não requer alteração de documentação técnica.

O principal conferiu os quatro links fornecidos pelo usuário: a especificação, o changelog, o registro de depreciações e a arquitetura de MCP 2026-07-28. Também conferiu [Versioning and Compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle). A implementação dual-era é opcional; clientes legados não têm mecanismo de avanço automático. Um servidor exclusivamente moderno deve informar as versões aceitas no erro ao pedido de initialize.

## Revisão final independente do principal

**Escopo e fontes:** plano desta correção, evidências da entrega da migração, teste final, implementação de aquisição e liberação, hashes dos componentes MCP e dependências, documentos técnicos e resultados reais de validação. O estado integrado autorizado foi avaliado após a última edição.

**Critérios e integração:** a recuperação continua usando a implementação real, sem mocks persistentes, skips ou relaxamento da política stale. O orçamento de 5 segundos dá margem ao I/O necessário ao cenário; a reprodução de 120 ms que falhava antes agora passa. O teste separado continua verificando o timeout sob contenção. A nova asserção de ausência do diretório confirma a liberação após o callback, além da execução. A suíte integrada confirma que os contratos de locks e da migração MCP continuam cobertos.

**Arquitetura e manutenção:** a alteração permanece no teste e evita ampliar o escopo para modificar prazos de produção ou introduzir compatibilidade. Não foram adicionadas ramificações, guards, estratégias ou dependências. Conteúdo técnico mantido em en-US. Bootstrap, autorização, preservação de trabalho existente e validação seguiram o contrato local. Documentação adequada ao comportamento final.

**Achados e limites:** nenhum achado técnico bloqueante na correção. A reprodução demonstra sensibilidade a I/O, não a causa temporal exata da execução anterior do usuário. O aviso de chunk e o cache derivado preservado não afetam o critério de recuperação. A validação por subprocesso moderno comprova o servidor, mas não comprova a conexão do host Codex.

**Veredito da correção: APROVADA TECNICAMENTE.** Aceitação humana permanece separada; a thread não foi fechada. A conexão operacional do Codex tem diagnóstico e pendência próprios, registrados abaixo.

## Diagnóstico do Codex e configuração necessária

O usuário forneceu evidência de uma conversa nova: o painel F2 de warnings do Codex mostra uma falha de handshake, com erro JSON-RPC `-32022`, `requested: "2025-06-18"` e `supported: ["2026-07-28"]`. Isso demonstra que o cliente dessa execução tentou o fluxo legado; não demonstra defeito no formato de lançamento do processo mARC.

A conclusão inicial de que não havia configuração a ajustar ficou incompleta: foi conferida a ausência de um seletor por servidor, mas ainda faltava conferir as features do cliente. O agente zero solicitado pelo usuário encontrou a opção correta, e o principal a verificou independentemente.

### Evidência independente do agente zero e do principal

O runtime `/root/agent_zero_mcp_client`, perfil compartilhado `codex-dev`, modelo solicitado `gpt-6-luna/xhigh`, recebeu somente escopo de leitura. Realizou bootstrap independente do workspace correto, leu o contrato completo e fontes, confirmou o cursor da thread e recebeu autorização explícita. Não houve escrita de arquivos, administração de perfis, instalação, sessão de modelo adicional ou alteração de configuração.

Resultados locais:
- Executável encontrado em `/c/nvm4w/nodejs/codex`.
- `codex --version`: `codex-cli 0.162.1`.
- `codex features list`: `mcp_2026_07_28` em estágio `under development`, efetiva `false`.
- O principal repetiu essa leitura e executou `codex --enable mcp_2026_07_28 features list`: a feature passou a `true` somente nesse processo, exit 0, sem gravar configuração.
- A ajuda local documenta `--enable <FEATURE>` como equivalente a `-c features.<name>=true`.
- Os três arquivos locais de configuração continuam com o comando e argumentos de lançamento do mARC. Segredos foram redigidos na inspeção; nenhum token foi publicado ou alterado.
- O principal confirmou que o arquivo de projeto `.codex/config.toml` ainda não contém seção `[features]`.

Fontes oficiais cruzadas:
- [Codex MCP](https://developers.openai.com/codex/mcp): configuração de projeto em `.codex/config.toml`, sujeita à confiança do projeto.
- [Schema de configuração](https://developers.openai.com/codex/config-schema.json): existe `features.mcp_2026_07_28` booleana. O objeto de configuração por servidor não expõe `protocolVersion`; essa ausência não elimina a feature do cliente.
- [README oficial do app-server](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md): `mcp_2026_07_28` controla servidores elegíveis externos; a flag distinta `codex_apps_mcp_2026_07_28` é destinada ao servidor Apps hospedado.
- [Adapter oficial de conformidade](https://github.com/openai/codex/blob/main/scripts/mcp_conformance/codex_conformance_adapter.py) e [runner oficial](https://github.com/openai/codex/blob/main/scripts/mcp_conformance/run_codex_compliance.py): ativam essa feature antes da inicialização de cenários modernos, incluindo stdio. A variável `CODEX_MCP_PROTOCOL_VERSION` desses testes configura o fixture servidor e não é uma opção de protocolo do cliente Codex.

### Revisão adicional de protocolo no servidor compilado

Diante dos links fornecidos e da pergunta sobre uma correção ausente, o principal releu `src/mcp/server.ts` e cruzou seus mecanismos com os trechos normativos de changelog, arquitetura, versionamento e descoberta. Executou uma nova prova JSON-RPC contra `node dist/cli.js mcp`, sem credenciais de daemon herdadas:

- `initialize` legado com revisão `2025-06-18`: erro `-32022`, com versões aceitas e solicitada, igual ao diagnóstico do painel.
- `tools/list` moderno diretamente, sem handshake e sem `clientInfo`: 24 ferramentas, `resultType: complete`, `cacheScope: private`, `ttlMs: 0` e identidade `marc 0.3.0`.
- `server/discover`: revisão aceita `2026-07-28`, capacidades de ferramentas e identidade corretas.
- Nova requisição com revisão `2025-06-18` após a listagem moderna: novamente `-32022`, confirmando verificação independente por requisição.

**Revisão adicional do servidor: APROVADA nos critérios investigados.** Não foi identificada correção de implementação necessária para o aviso reportado. A prova é delimitada aos contratos relevantes à migração e ao startup; não é certificação de todo recurso opcional da especificação.

### Ajuste concreto para o usuário e pendência operacional

Conforme o acordo de que o usuário reconfigura e reinicia os clientes, nenhum arquivo de configuração foi modificado pelo agente. Acrescentar ao arquivo de projeto `.codex/config.toml`:

```toml
[features]
mcp_2026_07_28 = true
```

Manter os argumentos existentes de `mcp-marc`. Não acrescentar essa sintaxe TOML aos arquivos JSON do Claude ou VS Code: a feature é do cliente Codex. A ativação é experimental no CLI instalado; sua presença e a aceitação do override foram verificadas.

**Estado da conexão do host: PENDENTE do ajuste humano, reinício e nova verificação.** A versão do executável local e o subprocesso moderno não comprovam, sozinhos, a conexão da sessão que exibiu o painel F2. A alteração não foi persistida e não foi executada sessão de modelo para simular esse reinício. O warning separado de `context7` não foi diagnosticado e não se atribui a ele a mesma causa sem evidência.

A decisão de não oferecer compatibilidade legada no mARC permanece integralmente preservada.
