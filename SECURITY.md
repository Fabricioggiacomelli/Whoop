# SECURITY.md

## 1. Modelo de ameaça

Superfície pequena (4 usuários, acesso fechado por convite), mas dados sensíveis: tokens
OAuth de uma API de saúde/fisiológica, dados corporais e de hábitos (inclusive álcool). Trata-
se com o mesmo rigor de um produto de saúde, apesar da escala pequena.

## 2. Autenticação e sessão

- Senhas com **Argon2id** (nunca bcrypt puro para novo código, nunca MD5/SHA sozinho).
- Sessões em banco (Auth.js `session strategy: "database"`), não JWT stateless — permite
  revogação instantânea pelo admin ("remover participante").
- Cookies de sessão: `HttpOnly`, `Secure` (produção), `SameSite=Lax`.
- Rate limiting em `/login` e endpoints de auth (Upstash, ex: 5 tentativas / 5 min / IP+email)
  — proteção contra brute force.
- Sem cadastro público: único caminho é `/invite/[token]`, token de uso único com expiração.
- Reset de senha via link assinado de TTL curto, de uso único, invalidado após uso.

## 3. Autorização

- Papel (`ADMIN`/`PARTICIPANT`) checado **no servidor** (Server Component/Server
  Action/Route Handler), nunca só escondendo botão no client.
- Middleware protege `admin/*` e `(app)/*`; `display/*` decide separadamente se exige sessão
  (recomendado: sim, mesmo sendo "modo TV", para não expor dados publicamente).
- Isolamento de dados: cada usuário só grava/edita seus próprios `Profile`, `Goal`,
  `JournalEntry`, `RecoveryMode`; leitura de dados de outros é permitida conforme o brief
  (não é rede social privada por-usuário, é competição com visibilidade de grupo) mas sempre
  via camada de serviço que decide o que é público entre os 4.
- Admin **nunca** tem endpoint que escreva em `DailyScore`/`ScoreComponent` diretamente —
  única ação admin sobre pontuação é disparar reprocessamento da engine (auditado), nunca
  editar valores manualmente (restrição explícita do produto).

## 4. Tokens e segredos WHOOP

- `WHOOP_CLIENT_SECRET` só em variável de ambiente do servidor.
- Tokens de usuário (`WhoopToken`) criptografados em repouso com AES-256-GCM,
  `TOKEN_ENCRYPTION_KEY` fora do banco (env/secret manager).
- Nunca inclusos em respostas de API para o client, nunca em logs — o logger
  (`src/lib/logger.ts`) tem uma lista de chaves redigidas (`accessToken`, `refreshToken`,
  `password`, `token`, `secret`, `authorization`) aplicada a todo objeto logado.

## 5. Webhooks

- Validação de autenticidade quando o provedor suportar (assinatura HMAC do payload contra
  segredo compartilhado).
- Idempotência por `externalEventId` único no banco — proteção contra replay e reentrega
  duplicada.
- Payload do webhook nunca é gravado diretamente como fato — sempre dispara re-busca
  autenticada do objeto (mitiga payload forjado/adulterado).

## 6. Variáveis de ambiente (`.env.example`)

```
# App
NEXT_PUBLIC_APP_URL=
NODE_ENV=development
APP_TIMEZONE=America/Sao_Paulo

# Banco
DATABASE_URL=
DIRECT_URL=

# Auth.js
AUTH_SECRET=
AUTH_TRUST_HOST=true

# Criptografia de tokens WHOOP
TOKEN_ENCRYPTION_KEY=

# WHOOP OAuth
WHOOP_MODE=mock            # mock | live
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=
WHOOP_WEBHOOK_SECRET=

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron
CRON_SECRET=

# E-mail (futuro — reset de senha transacional)
EMAIL_FROM=
EMAIL_SERVER=
```

Nunca commitar `.env`. `.env.example` documenta chaves sem valores reais.

## 7. Headers e proteção web

- CSP restritiva (sem `unsafe-inline` para scripts; permitir apenas origens necessárias:
  próprio domínio, domínio da WHOOP para OAuth redirect).
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (exceto
  `/display` se algum dia precisar embutir — decisão futura).
- CSRF: Server Actions do Next.js já mitigam via same-origin checks nativos; endpoints de
  Route Handler sensíveis (OAuth callback, webhooks) validam `state`/assinatura como
  descrito em `WHOOP_INTEGRATION.md`.
- Validação de todo input externo com **Zod** — nunca confiar em payload de formulário ou
  webhook sem schema.

## 8. Auditoria e logs

- `AuditLog` para: criação/revogação de convite, remoção de usuário, ativação/edição de modo
  recuperação, reprocessamento manual de pontuação, alteração de `ScoringRule`/
  `ScoringVersion`, login falho repetido, revogação de conexão WHOOP.
- Logs estruturados (JSON), sem PII desnecessária, sem segredos — nível `info`/`warn`/`error`
  claros, com `requestId` para correlação.

## 9. Backup e recuperação

- Backups automáticos do Postgres gerenciado (Neon point-in-time restore).
- Migrations sempre reversíveis quando possível; nunca `DROP` destrutivo sem backup
  confirmado antes de aplicar em produção.

## 10. Dependências e build

- Sem credenciais hardcoded em código-fonte (checado em code review/CI).
- Lint bloqueia `console.log` de objetos crus em código de produção (usar o logger).
- `npm audit`/Dependabot habilitado no repositório.
