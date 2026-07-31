# WHOOP_INTEGRATION.md

## 1. Escopo de dados desejado

Perfil, Recovery, Ciclos, Treinos, Sono, Medidas corporais, acesso offline (refresh token).
**Os nomes exatos de scope/endpoint serão confirmados contra a documentação oficial da WHOOP
Developer Platform antes da Fase 3** (`PLAN.md §4` registra isso como suposição, não fato).
Até lá, todo o sistema é desenvolvido contra `WhoopClient`/`WhoopNormalizer` com fixtures
mockadas (`WHOOP_MODE=mock`), então trocar o mock pelo real não deve exigir mudanças fora de
`src/server/whoop/*`.

## 2. Fluxo OAuth

```
Usuário (Perfil) → clica "Conectar WHOOP"
  → GET /api/whoop/oauth/start
      gera `state` (assinado, TTL curto) + `code_verifier` PKCE, salva em cookie httpOnly
      redireciona para authorize URL da WHOOP com scopes + state + code_challenge
  → usuário autoriza na WHOOP
  → WHOOP redireciona para /api/whoop/oauth/callback?code=...&state=...
      valida `state` (CSRF) contra o cookie
      troca `code` por access_token/refresh_token (WhoopAuthService.exchangeCode)
      criptografa e salva em WhoopToken
      cria/atualiza WhoopConnection (status = CONNECTED)
      dispara WhoopHistoricalImporter em background (não bloqueia o redirect)
  → redireciona usuário para /perfil com status "importando histórico"
```

Proteções obrigatórias: `state` assinado com segredo do servidor + comparação de tempo
constante; `code_verifier`/PKCE; cookie do `state` com `SameSite=Lax`, `Secure`, `HttpOnly`;
validação de `redirect_uri` exata (allowlist); nunca aceitar callback sem `state` válido;
rate limit no endpoint de callback e no de start.

## 3. Armazenamento e ciclo de vida de tokens

- Tokens só existem no backend, sempre criptografados em repouso (`WhoopToken.accessTokenEnc`
  / `refreshTokenEnc`, AES-256-GCM). Nunca serializados para o client, nunca logados.
- **Refresh**: job/checagem antes de cada chamada relevante — se `expiresAt` está a menos de
  N minutos, renova primeiro. Lock via Redis (`whoop:refresh:{userId}`) previne refresh
  concorrente disparado por duas requisições simultâneas.
- **Expiração/revogação**: se o refresh falhar com erro de autenticação, `WhoopConnection`
  vai para `AUTH_ERROR`/`RECONNECT_REQUIRED`, visível na Home e no Perfil, sem penalizar o
  usuário nos dias afetados (`DailyPerformance.status = AWAITING_SYNC` até reconectar).
- **Reconexão**: refaz o fluxo OAuth; `WhoopSyncCursor` existente é preservado — a
  importação retoma de onde parou, não duplica.
- **Revogação pelo usuário**: botão em Perfil chama endpoint de revoke da WHOOP (se
  disponível) e limpa `WhoopToken` local; `WhoopConnection.status = NOT_CONNECTED`.
- Toda operação de auth grava um `AuditLog` (sem dados sensíveis) e um log estruturado.

## 4. Importação histórica

`WhoopHistoricalImporter`, por recurso (`cycle`, `recovery`, `sleep`, `workout`,
`body_measurement`), por usuário:

1. lê `WhoopSyncCursor` (se não existe, começa do início do histórico disponível);
2. busca uma página via `WhoopClient` (respeita paginação da API);
3. normaliza (`WhoopNormalizer`) e faz **upsert** por `externalId` (idempotente — reimportar
   nunca duplica);
4. grava `WhoopRawEvent` (auditoria/replay) e atualiza `WhoopSyncCursor`;
5. em erro de rate limit → backoff exponencial e reagenda via `WhoopSyncJob`;
6. em erro persistente → marca `WhoopSyncJob.status = FAILED`, loga, **não** derruba a UI —
   usuário vê "erro temporário"/"reconexão necessária" conforme o caso;
7. progresso é consultável (`WhoopConnection.status = IMPORTING_HISTORY` + contadores) para a
   UI mostrar uma barra sem bloquear a navegação.

Roda como sequência de invocações curtas de uma Route Handler protegida (compatível com
limite de duração de function do Vercel), não como processo de longa duração — cada
invocação processa um lote e se re-enfileira se houver mais.

## 5. Sincronização contínua

- **Webhooks** (`POST /api/webhooks/whoop`): valida autenticidade quando a WHOOP suportar
  (assinatura/segredo compartilhado — a confirmar), salva o evento bruto
  (`WhoopWebhookEvent`, `externalEventId` unique → idempotência garantida no banco mesmo se o
  provedor reentregar), responde 200 rápido, e **enfileira** o processamento real (nunca
  processa pesado dentro do handler do webhook).
- Processamento enfileirado: busca o objeto completo via `WhoopClient` (nunca confia só no
  payload do webhook), normaliza, salva, recalcula o `DailyPerformance`/`DailyScore` do dia
  afetado, recalcula `RankingSnapshot`, avalia `Achievement`/`Roast` novos, loga.
- **Reconciliação diária** (cron): para cada usuário conectado, compara um resumo local
  (contagem/hash por dia) contra a API; diferenças disparam re-sync pontual. Cobre lacunas de
  webhooks perdidos.
- Enquanto o sistema aguarda dado por falha técnica, o dia permanece em estado de espera
  (`AWAITING_SYNC`/`AWAITING_DATA`) — **nunca** penalizado nesse estado.

## 6. Conceito de dia competitivo — mapeamento técnico

Um `DailyPerformance` fecha quando: (a) o `WhoopSleep` principal do ciclo está presente e
processado; (b) o `WhoopRecovery` correspondente está presente; (c) demais dados necessários
para a `DailyScore` daquele dia estão disponíveis. O fechamento é avaliado por um job
(`close-days`) que roda periodicamente, não em um horário fixo de "meia-noite" — a rotina
verifica ciclo a ciclo.

Estados (`DailyPerformance.status`): `IN_PROGRESS → AWAITING_SLEEP → AWAITING_RECOVERY →
AWAITING_SYNC → CLOSED`; excepcionalmente `REPROCESSED` (reaberto e recalculado
manualmente pelo admin), `INCOMPLETE_USER_FAULT` (ex: pulseira não usada) ou
`INCOMPLETE_TECH_FAULT` (falha do sistema/WHOOP — nunca gera penalidade).

## 7. Status de conexão exibidos ao usuário

`Não conectado · Conectado · Importando histórico · Sincronizando · Atualizado · Aguardando
dados · Erro de autenticação · Erro temporário · Reconexão necessária` — mapeiam 1:1 para
`WhoopConnection.status`, exibidos na Home (resumido) e no Perfil (detalhado, com ação
sugerida quando aplicável).

## 8. Rate limiting e resiliência

`WhoopClient` implementa backoff exponencial com jitter em respostas 429/5xx, respeita
headers de rate limit quando presentes, e todas as chamadas passam por um limitador local
(Upstash) para nunca estourar o limite mesmo com 4 usuários sincronizando ao mesmo tempo.

## 9. O que NUNCA fazer

Nunca assumir a existência de um campo sem checar a resposta real; nunca tratar o payload de
um webhook como fonte de verdade sem rebuscar; nunca processar o mesmo evento duas vezes
(idempotência por `externalEventId`/`externalId`); nunca expor tokens ao client; nunca
penalizar pontuação por falha técnica.
