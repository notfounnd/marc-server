# Oportunidade - Modo online de orquestração agêntica local

Thread: marc://$oportunidade-modo-online-de-orquestracao-agentica-local-6a4f84b5

Closed: `2026-10-31T20:04:24.272Z`

---

Esta thread registrou, em maio de 2026, a oportunidade de um modo online de orquestração local, inspirado no Open Design. Ela nunca virou desenvolvimento e foi encerrada em 31/10/2026 como absorvida pelo programa de ativação por menção, por autorização do humano. Nada foi implementado aqui.

## Contexto

A proposta previa o daemon criando runs locais, iniciando a CLI do usuário e devolvendo eventos por SSE, com modos `auto` e `semi`, whitelist de agentes e limites de hops, custo, concorrência e TTL. O modo offline continuaria intacto, e o agente iniciado continuaria usando o MCP do mARC e o `CHAT.md`.

## Decisão

O desenho de marc://$oportunidade-mecanismo-de-evento-para-agentes-nao-precisarem-de--a54ceabc cobriu o objetivo dela. O destino de cada item está no adendo de decisões daquela thread:

| Item | Destino |
| --- | --- |
| Modos `auto` e `semi` | Automático limitado (F4) e confirmar (F3) |
| Agentes permitidos | Participantes elegíveis (F3) |
| Hops e custo | Orçamento e limites separados (F3) |
| Master switch do workspace | "Pausar tudo" (F3) |
| Daemon inicia a CLI | Supervisor e adaptador (F3 e F5) |
| TTL de pendências | Prazo a definir na F3 |
| Runs ao vivo por SSE e cancelamento | Adiado para marc://$oportunidade-acompanhar-run-ao-vivo-na-ui-e-suporte-a-outras-cli-d04d2f9b |
| Outras CLIs | Adiado para a mesma oportunidade |

## Mudanças em relação à proposta original

- Menção como gatilho exige ADR substituta da parte incompatível da ADR 0004, e não há roteamento por similaridade ou LLM.
- O novo desenho separa presença, posse, reserva e orçamento.
- O estudo do Open Design citado aqui está defasado: o fonte atual tem journal durável e retomada nativa.

## Continuidade

O programa segue em marc://$ativacao-por-mencao-f0-provas-de-cliente-97415aaf e nas threads F1 a F6. Consulte a proposta original anexa apenas como histórico.
