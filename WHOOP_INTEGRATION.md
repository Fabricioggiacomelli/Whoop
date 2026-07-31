# WHOOP_INTEGRATION.md

## 1. API real — confirmado contra a documentação oficial (developer.whoop.com)

A suposição do `PLAN.md §4` foi validada na Fase 3. Registro aqui os fatos confirmados —
`WhoopClient`/`WhoopNormalizer` (`src/server/whoop/*`) são a única camada que os conhece.

- **Host da API**: `https://api.prod.whoop.com`
- **Authorize**: `https://api.prod.whoop.com/oauth/oauth2/auth`
- **Token**: `https://api.prod.whoop.com/oauth/oauth2/token`
- **Revoke**: `DELETE /developer/v2/user/access`
- **Scopes confirmados**: `read:profile`, `read:body_measurement`, `read:cycles`,
  `read:sleep`, `read:recovery`, `read:workout`, `offline` (obrigatório para refresh token).
  Não existe scope de escrita — a API é somente leitura.
- **Fluxo OAuth confidencial**: Authorization Code padrão (RFC 6749) com `client_id` +
  `client_secret`. A documentação oficial **não menciona PKCE/`code_challenge`** — só
  `state` para CSRF. Não implementar PKCE especulativamente; se a WHOOP passar a exigir,
  é uma mudança isolada em `whoop.auth.ts`.
- **Endpoints** (todos `GET`, todos sob `/developer/v2/`, paginados):

  | Recurso | Path | Scope |
  |---|---|---|
  | Ciclos | `/cycle` (+ `/{id}`, `/{id}/recovery`, `/{id}/sleep`) | `read:cycles` |
  | Recovery | `/recovery` | `read:recovery` |
  | Sono | `/activity/sleep` (+ `/{id}`) | `read:sleep` |
  | Treino | `/activity/workout` (+ `/{id}`) | `read:workout` |
  | Perfil | `/user/profile/basic` | `read:profile` |
  | Medidas corporais | `/user/measurement/body` | `read:body_measurement` |

- **Paginação**: query params `limit` (máx. **25**, default 10), `start`/`end` (ISO 8601,
  `start` inclusivo, `end` exclusivo), `nextToken` (da resposta anterior). Resposta:
  `{ records: [...], next_token }`.
- **Unidades**: durações vêm em **milissegundos** (`total_rem_sleep_time_milli`,
  `zone_zero_milli` etc.) — `WhoopNormalizer` converte para minutos ao gravar no nosso
  schema. IDs de `cycle` e `user` são inteiros; IDs de `sleep`/`workout` são UUID (v2).
- **`score_state`**: cada recurso vem com um campo `score_state` (`SCORED` /
  `PENDING_SCORE` / `UNSCORABLE`, conforme a doc) — é esse campo, não um "processed"
  genérico, que decide se um dado está pronto para pontuar (seção 6).
- **`sleep_needed`**: a WHOOP não devolve um único "sleepNeedMinutes" — devolve
  `baseline_milli + need_from_sleep_debt_milli + need_from_recent_strain_milli +
  need_from_recent_nap_milli`. O normalizer soma os quatro.
- Fontes: [OAuth 2.0](https://developer.whoop.com/docs/developing/oauth/),
  [API Reference](https://developer.whoop.com/api/),
  [Webhooks](https://developer.whoop.com/docs/developing/webhooks/).

## 2. Fluxo OAuth

```
Usuário (Perfil) → clica "Conectar WHOOP"
  → GET /api/whoop/oauth/start
      gera `state` assinado (HMAC, TTL curto), salva em cookie httpOnly
      redireciona para authorize URL da WHOOP com scopes + state
  → usuário autoriza na WHOOP
  → WHOOP redireciona para /api/whoop/oauth/callback?code=...&state=...
      valida `state` (CSRF) contra o cookie, em tempo constante
      troca `code` por access_token/refresh_token (WhoopAuthService.exchangeCode)
      criptografa e salva em WhoopToken
      cria/atualiza WhoopConnection (status = CONNECTED)
      dispara WhoopHistoricalImporter em background (não bloqueia o redirect)
  → redireciona usuário para /perfil com status "importando histórico"
```

Proteções obrigatórias: `state` assinado com segredo do servidor + comparação em tempo
constante; cookie do `state` com `SameSite=Lax`, `Secure`, `HttpOnly`; validação de
`redirect_uri` exata (allowlist, deve bater com o valor cadastrado no WHOOP Developer
Dashboard); nunca aceitar callback sem `state` válido; rate limit no endpoint de callback e
no de start.

`WHOOP_MODE=mock` (default em desenvolvimento, sem credenciais reais ainda) faz o botão
"Conectar WHOOP" pular esse fluxo inteiro e chamar uma Server Action que simula uma conexão
bem-sucedida — ver `mockConnectWhoopAction` no Perfil/Onboarding. `WHOOP_MODE=live` ativa as
rotas reais descritas acima; exige `WHOOP_CLIENT_ID`/`WHOOP_CLIENT_SECRET`/
`WHOOP_REDIRECT_URI` preenchidos.

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
- **Revogação pelo usuário**: botão em Perfil chama `DELETE /developer/v2/user/access`
  (confirmado na doc oficial) e limpa `WhoopToken` local; `WhoopConnection.status =
  NOT_CONNECTED`.
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

- **Webhooks** (`POST /api/webhooks/whoop`) — confirmado contra a doc oficial:
  - Assinatura: headers `X-WHOOP-Signature` e `X-WHOOP-Signature-Timestamp` (ms desde
    epoch). Verificação: `base64(HMAC_SHA256(timestamp + rawBody, WHOOP_WEBHOOK_SECRET))`
    deve bater com o header, comparado em tempo constante. **Precisa do corpo bruto** — a
    Route Handler lê o body como texto antes de fazer `JSON.parse`, nunca depois.
  - Payload: `{ user_id, id, type, trace_id }` — `trace_id` identifica duplicatas.
  - **Só existem 6 tipos de evento**: `recovery.updated`, `recovery.deleted`,
    `workout.updated`, `workout.deleted`, `sleep.updated`, `sleep.deleted`. **Não há webhook
    de `cycle` nem de `body_measurement`** — esses dois só chegam via importação
    histórica/reconciliação por polling, nunca por push. Criação também chega como evento
    `.updated` (não existe "created").
  - Para eventos de `recovery` em v2, o `id` do payload é o **UUID do sleep**, não um id de
    recovery próprio — documentado assim pela WHOOP, tratado explicitamente no
    `WhoopWebhookService`.
  - WHOOP reentrega até 5x em ~1h se a resposta não for 2xx — por isso idempotência por
    `trace_id` é obrigatória (`WhoopWebhookEvent.externalEventId`), e a Route Handler
    responde rápido (< poucos segundos) antes de processar.
  - Payload do webhook **nunca é gravado diretamente como fato** — sempre dispara re-busca
    autenticada do objeto completo via `WhoopClient` antes de normalizar/salvar.
- **Reconciliação diária** (cron `/api/cron/reconcile`, protegida por `CRON_SECRET`): para
  cada usuário conectado, refaz uma janela curta (últimos ~3 dias) de `cycle` e
  `body_measurement` via polling — os únicos recursos sem webhook — e faz uma segunda
  passada de `recovery`/`sleep`/`workout` para cobrir webhooks perdidos ou fora da janela
  de retry.
- Enquanto o sistema aguarda dado por falha técnica, o dia permanece em estado de espera
  (`AWAITING_SYNC`/`AWAITING_DATA`) — **nunca** penalizado nesse estado.

## 6. Conceito de dia competitivo — mapeamento técnico

Um `DailyPerformance` fecha quando: (a) o `WhoopSleep` principal do ciclo está presente **e**
seu `score_state = "SCORED"`; (b) o `WhoopRecovery` correspondente está presente e também
`SCORED`; (c) demais dados necessários para a `DailyScore` daquele dia estão disponíveis.
`score_state` vem cru da API em `WhoopRawEvent`/campo próprio do normalizer — nunca inferido
por "o registro existe, então está pronto". O fechamento é avaliado por um job
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
