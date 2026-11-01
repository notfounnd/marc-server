# Plano F0 — provas de cliente

Autor: marc://@claude-software-architect
Data: 31/10/2026
Origem: marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc, proposta v3 (seção 8) e adendo de decisões.
Estado: plano. Execução não autorizada.

## Objetivo

Trocar por teste as hipóteses de que o desenho depende, separando por cliente. Ao final, cada célula da matriz fica **testada** ou com **limite declarado**, e cada fase seguinte sabe o que mudou.

**Fora de escopo:** código de produto, ADR, hooks, configuração de projeto, `marc wait` real. Protótipos ficam descartáveis e fora do repositório.

## O que já se sabe

Testado em `-p` no Claude Code 2.1.316: identidade e vida do processo MCP, ID estável em `--resume`, bifurcação silenciosa em retomada simultânea, duplicidade visível, aproveitamento de cache em sessão pequena, início sem shell.

Testado no Codex 0.161.0 e 0.166.0, sem turno de modelo: identidade em `_meta.threadId`, MCP distinto por thread, processos de descoberta, início por Node com launcher ou `codex.exe`.

Essas células não são repetidas, exceto para mudança de versão.

## Matriz

C é Claude Code e X é Codex. "Humano" significa que a célula exige alguém operando uma sessão interativa real, porque os agentes não conseguem conduzir uma TUI.

### A. Sessão aberta contra retomada

| ID | Cliente | Pergunta | Humano | Afeta |
| --- | --- | --- | --- | --- |
| A1 | C, X | Sessão interativa ociosa e retomada em outro processo: a CLI recusa? O que a sessão aberta vê depois? | Sim | F2 |
| A2 | C, X | Alternar modo não interativo (`-p` no Claude; exec ou App Server no Codex) e interativo na mesma sessão preserva a continuidade? | Sim | F2, F3 |
| A3 | C, X | Depois de uma bifurcação, qual ramo a retomada seguinte escolhe? Fica não aplicável se a CLI recusar a bifurcação | Não | F2 |

### B. Identidade e vida do MCP

| ID | Cliente | Pergunta | Humano | Afeta |
| --- | --- | --- | --- | --- |
| B1 | C | Em modo interativo, o processo MCP recebe o ID da sessão? | Sim | F2 |
| B2 | X | Em turno real de modelo, `_meta.threadId` chega à chamada MCP? | Não | F2, F5 |
| B3 | C, X | Vida do MCP entre abertura, ociosidade, `/clear`, compactação, reconexão e saída. O ID muda em algum desses eventos? | Sim | F2 |
| B4 | C, X | O handler de ferramenta do SDK 2.3.1 acessa `_meta` da requisição? | Não | F2 |
| B5 | C | Claude também gera processos MCP de descoberta? | Não | F2 |

### C. Abertura pelo terminal

| ID | Cliente | Pergunta | Humano | Afeta |
| --- | --- | --- | --- | --- |
| C1 | C, X | Um wrapper que herda stdio abre a TUI corretamente no mintty? Controle em Windows Terminal e PowerShell | Sim | F2 |
| C2 | C, X | O diretório errado impede a retomada? Como o erro aparece? | Não | F2 |

### D. Despertar e ciclo de vida

| ID | Cliente | Pergunta | Humano | Afeta |
| --- | --- | --- | --- | --- |
| D1 | C | Compactação enquanto o waiter espera: o despertar continua e a saída se explica sozinha? | Não | F1 |
| D2 | C | `/clear` com waiter ativo | Sim | F1 |
| D3 | C, X | Encerrar a sessão com waiter ativo: o processo fica órfão? | Sim | F1 |
| D4 | C | Sessão acordada com aprovação pendente | Sim | F1, F3 |
| D5 | C | Suspensão da máquina durante a espera | Sim | F1, F2 |
| D6 | X | Término de processo em background acorda uma sessão ociosa? | Sim | F1, F5 |

### E. Execução sem humano presente

| ID | Cliente | Pergunta | Humano | Afeta |
| --- | --- | --- | --- | --- |
| E1 | C, X | Retomada sem supervisão encontra pedido de permissão: o que acontece e como isso é detectado? | Não | F3 |
| E2 | C, X | Existe forma documentada de encaminhar a aprovação ao humano, sem política permissiva? | Não | F3 |
| E3 | C | Limite real de background em `-p`, em turno longo com subagente | Não | F3 |
| E4 | X | Retomada com turno real pelo App Server, partindo do launcher validado | Não | F5 |

### G. Custo

| ID | Cliente | Pergunta | Humano | Afeta |
| --- | --- | --- | --- | --- |
| G1 | C, X | Input, cache lido e gravado, output, latência e cota por despertar, com sessão pequena e grande, cache quente e frio | Não | F3, F4 |

Sessão grande significa uma sessão descartável preparada até um tamanho declarado no relatório. Cache frio exige esperar o TTL do plano em uso.

## Método

- Sessões descartáveis, em diretório temporário exclusivo, sem settings do usuário quando a célula permitir.
- Sem `bypassPermissions` ou equivalente.
- Sem alterar `.claude`, `.codex`, hooks ou configuração do projeto.
- Sem encerrar processo por nome. Limpar apenas sessões e diretórios criados no teste, depois de conferi-los.
- Registrar versão, comando, resultado e limite de cada célula. Leitura estática nunca conta como teste.

**Custo:** cada execução registra o gasto. Antes da célula G1 com sessão grande, apresentar a estimativa ao humano.

## Responsáveis

- **Células de Claude:** marc://@claude-software-architect orquestra, e marc://@claude-dev executa o que não exigir humano.
- **Células de Codex:** marc://@codex-software-architect e marc://@codex-dev.
- **Células com humano:** roteiro curto para o humano, com uma ação por passo.

Vale o ensaio de um desenvolvedor por vez. A configuração do desenvolvedor será confirmada no despacho.

## Entregáveis

1. Matriz preenchida, com evidência sanitizada, em artefato desta thread.
2. Impacto por fase, dizendo o que mudou na v3 e o que segue válido.
3. Entrega de autoria do desenvolvedor, nos termos das regras do workspace.
4. Revisão integrada do principal.

## Critérios de saída

- Nenhuma célula sem classificação.
- A1, A2, B1, B3 e C1 têm resultado de teste nos dois clientes aplicáveis. Sem eles, a F2 não abre.
- G1 tem ao menos um par quente e frio em cada cliente. Sem isso, a F4 não abre.
- Limite declarado não vira suposição positiva nas fases seguintes.
- O impacto é declarado por capacidade e por cliente, conforme a revisão de encerramento do Codex em marc://#msg_5268a035e779494ab6: B2 e B4 condicionam a presença no Codex, D6 condiciona o despertar no Codex, E1 e E2 condicionam aprovação sem humano em cada cliente, e E4 condiciona a retomada real no Codex. Limitação de um cliente não bloqueia o outro nem vira paridade.

## Pendências

- Autorização humana para iniciar.
- Disponibilidade do humano para as células interativas.
- Ordem entre F0 e F1, que podem correr em paralelo pelo desenho, mas seguem o ensaio de um desenvolvedor por vez.
