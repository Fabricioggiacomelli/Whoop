# APEX 4 — Plano Técnico

**Compete. Recover. Evolve.**

Documento de referência mestre. Os detalhes profundos de cada área vivem em documentos
próprios — este arquivo amarra tudo: requisitos, decisões, riscos, suposições, wireframes
textuais e comandos operacionais. Mantenha-o atualizado a cada fase.

Documentos relacionados: [ARCHITECTURE.md](./ARCHITECTURE.md) ·
[DATABASE.md](./DATABASE.md) · [SCORING.md](./SCORING.md) ·
[WHOOP_INTEGRATION.md](./WHOOP_INTEGRATION.md) · [SECURITY.md](./SECURITY.md) ·
[ROADMAP.md](./ROADMAP.md)

---

## 1. Resumo do produto

APEX 4 é uma plataforma **privada** (4 usuários, acesso só por convite) que transforma dados
da WHOOP em uma competição diária de evolução física entre amigos. Não é rede social: sem
chat, sem feed, sem posts. É telemetria + pontuação + ranking + provocação.

Pilares: sono, recovery, treino/strain, consistência, evolução pessoal, hábitos. Cada um vira
uma fatia de uma nota diária de 100 pontos-base (que pode ir negativa). A engine compara cada
atleta contra sua própria linha de base, não contra os outros — vantagens fisiológicas
naturais (ex: HRV alto de nascença) não devem virar vantagem competitiva.

## 2. Análise dos requisitos (síntese)

O brief do usuário (39 seções) especifica um produto completo de produção. Os requisitos se
agrupam em 7 blocos, cada um com dono claro:

| Bloco | Conteúdo | Documento dono |
|---|---|---|
| Produto & UX | visão, direção visual, páginas, mobile, acessibilidade | este arquivo + `ARCHITECTURE.md` |
| Identidade & acesso | convite, papéis, onboarding | `ARCHITECTURE.md` + `SECURITY.md` |
| Integração WHOOP | OAuth, sync, webhooks, importação histórica | `WHOOP_INTEGRATION.md` |
| Engine de pontuação | regras, versionamento, explicabilidade | `SCORING.md` |
| Dados | schema, migrations, seed | `DATABASE.md` |
| Segurança | tokens, sessões, CSRF, rate limit | `SECURITY.md` |
| Execução | fases, critérios de aceite, testes | `ROADMAP.md` |

Requisitos explicitamente **fora de escopo** (seção 36 do brief), tratados como restrições
permanentes de produto: chat, comentários, feed, fotos, notificações push externas, treino
manual, edição manual de pontuação, cadastro público, temporadas, apostas, pagamentos.

## 3. Decisões tomadas para não bloquear o desenvolvimento

O brief pede explicitamente para não travar em dúvidas — decidir com bom senso e documentar.
Decisões tomadas:

1. **Monorepo único Next.js** (App Router) hospedando frontend + backend via Route Handlers e
   Server Actions. Não criar backend separado no MVP — reduz superfície e é suficiente para
   4 usuários. Reavaliar apenas se jobs em background precisarem de um worker dedicado.
2. **Banco**: Postgres via **Neon** (serverless, branch de dev grátis, bom fit com Vercel).
   Supabase também atende; Neon foi escolhido por já embutir connection pooling serverless
   sem exigir o restante da suíte Supabase que não usaremos (Auth, Storage) — auth própria
   será usada de qualquer forma dado o modelo de convite fechado.
3. **Auth**: Auth.js (NextAuth v5) com provider Credentials (email + senha, hash Argon2) +
   sessões em banco (não JWT) para permitir revogação imediata pelo admin. Convite = token
   de uso único gravado em `Invite`, resgatado no cadastro.
4. **ORM**: Prisma. Migrations versionadas em `prisma/migrations`.
5. **Fila/cache/rate-limit**: Upstash Redis (REST, serverless-friendly, funciona em edge e
   em cron do Vercel).
6. **Cron/jobs**: Vercel Cron Jobs chamando Route Handlers protegidas por segredo. Webhooks
   da WHOOP processados de forma idempotente e enfileirados via Upstash (QStash ou uma
   tabela `WhoopSyncJob` como fila pobre — ver `ARCHITECTURE.md`).
7. **Timezone**: fixo em `America/Sao_Paulo` no MVP, mas armazenado como configuração
   (`AppSetting`) para não exigir migration quando for necessário mudar.
8. **Sem app nativo**: PWA instalável cobre o requisito mobile-first sem custo de build
   nativo.
9. **IA nas provocações**: MVP usa apenas templates determinísticos (seção 21 do brief exige
   isso explicitamente). Gancho para IA fica documentado em `ROADMAP.md` (Fase 5+) e não é
   implementado agora.
10. **Sem cadastro público**: única via de entrada é `/invite/[token]`.
11. **UI**: Tailwind + shadcn/ui (Radix) + Framer Motion + Recharts. Design tokens dark-first
    documentados em `ARCHITECTURE.md §5`.

## 4. Suposições

Suposições assumidas por não haver como validar sem credenciais reais da WHOOP ou decisão do
grupo:

- A API da WHOOP v2 expõe os recursos: `cycle`, `recovery`, `sleep`, `workout`,
  `body_measurement`, com OAuth2 Authorization Code + refresh token e webhooks por recurso
  (`cycle.updated`, `recovery.updated`, `sleep.updated`, `workout.updated`). **Isso será
  revalidado contra a documentação oficial e a resposta real da API antes da Fase 3** — o
  brief exige isso explicitamente (seção 6). Até lá, `WhoopNormalizer` trabalha sobre tipos
  próprios e mocks, isolando o resto do sistema do formato exato.
- WHOOP não fornece "meta de Strain" via API da mesma forma que exibe no app — assumimos que
  a recomendação de Strain é 100% calculada pelo APEX 4 (`StrainRecommendation`), nunca lida
  da WHOOP.
- Um "dia competitivo" fecha quando sleep + recovery do ciclo estão presentes E marcados como
  `scored`/completos pela WHOOP (campo de score-state, a confirmar no payload real).
- Sem app store: instalação via PWA (Add to Home Screen) atende "instalação na tela inicial".
- O compartilhamento de respostas do Journal entre os 4 participantes é aceito pelo grupo
  (confirmado no brief §18), mas o schema já modela `JournalEntry.visibility` para restringir
  no futuro sem migration.
- "Recuperação de senha" no login (seção 23.1) assume fluxo de e-mail — como não há serviço
  de e-mail definido, Fase 1 implementa reset via link assinado gerado pelo admin
  (`AuditLog` registra a ação); integração com provedor de e-mail transacional fica para
  quando houver domínio de produção.
- Quatro usuários fictícios de seed: Rafa, Bia, Theo e Manu (nomes fictícios, sem relação com
  os usuários reais) — cores: laranja, ciano, violeta, verde-limão.

## 5. Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Formato real da API WHOOP diverge do assumido | Alto — quebra normalizer | `WhoopNormalizer` isola o formato externo; testes de contrato antes de sair do mock |
| Webhooks da WHOOP sem assinatura verificável documentada publicamente | Médio | Tratar todo webhook como "sinal para buscar", nunca como fonte de verdade — sempre re-busca o objeto via API autenticada antes de gravar |
| Fechamento de dia ambíguo (sono cruza meia-noite, ciclos assíncronos) | Alto — afeta pontuação e ranking | Dia associado ao `WhoopCycle`, não à data civil; estados explícitos (`aguardando sono`, `aguardando recovery`) em vez de fechamento cego por horário |
| Rate limit da WHOOP durante importação histórica de 4 usuários | Médio | Backoff exponencial + fila persistente (`WhoopSyncJob`) com retomada por cursor (`WhoopSyncCursor`) |
| Refresh token expira/é revogado sem o usuário perceber | Médio | Status de conexão visível na Home/Perfil + job de verificação diária |
| Engine de pontuação recalculada incorretamente após reprocessamento retroativo | Alto — quebra confiança no ranking | Versionamento (`ScoringVersion`) + `DailyScore` sempre recalculável e idempotente por (usuário, dia, versão) |
| Vercel Hobby/free tier limita duração de cron e concorrência de functions | Médio | Jobs divididos em lotes pequenos e idempotentes; documentar necessidade de plano pago se volume crescer |
| 4 usuários = amostra pequena para qualquer "linha de base" estatística | Baixo/aceito pelo produto | Baseline usa janela móvel (28–90 dias) por indivíduo, não comparação entre usuários |

## 6. Wireframes textuais das páginas principais

Notação: `[topo]` `[conteúdo]` `[nav inferior]`. Mobile-first; desktop expande em grid.

```
/login
[wordmark APEX 4 + slogan]
[campo e-mail] [campo senha] [botão Entrar]
[link "Esqueci minha senha"]
[nota discreta: "Acesso somente por convite"]

/invite/[token]  (onboarding entrada)
[boas-vindas nominal: "Você foi convidado por <admin>"]
[criar senha] [aceitar termos]

/onboarding (multi-step, 1 cartão por vez, como o Journal)
1) nome, apelido  2) avatar + cor  3) data nasc., peso, altura
4) objetivo pessoal  5) Conectar WHOOP (ou pular e conectar depois)
6) tela de sincronização inicial com barra de progresso

/home
[header: avatar+cor, saudação, status de sync]
[card grande: nota de hoje + posição + diferença p/ próximo]
[3 mini-cards: Recovery | Sleep Performance | Strain atual vs faixa recomendada]
[banner condicional: risco de overtraining OU sugestão de descanso]
[linha: sequência atual (chama) + progresso semanal]
[card: provocação do dia]
[lista curta: conquistas recentes]
[CTA fixo: "Responder Journal" se pendente]
[nav inferior: Home | Ranking | Evolução | Metas | Perfil]

/ranking  (abas: Diário / Semanal / Mensal / Geral)
[tabs]
[lista ordenada: pos. | avatar/cor | apelido | pontos | Δ | seta tendência]
[toque no item expande componentes da nota + status do dia]

/ranking/[data]/score  (detalhe do cálculo)
[nota total grande]
[6 categorias em accordion: pontos obtidos/possíveis, regras aplicadas,
 bônus, penalidades, baseline comparado, recomendação textual]

/categorias
[grid de cards "campeão" por categoria — foto, apelido, métrica, período]

/evolucao
[seletor de janela: 7 / 14 / 30 / 90 / desde o início]
[seletor de métrica: pontuação, Recovery, HRV rel., FC repouso, sono, Strain,
 consistência, hábitos, posição]
[gráfico de linha/área (Recharts) + resumo de tendência]

/metas
[seção "Ativas"] [seção "Sugeridas pelo sistema" com aprovar/editar/rejeitar]
[seção "Histórico"]
[ciclo padrão: 14 dias, barra de progresso por meta]

/journal
[fluxo de cartões, 1 pergunta por vez, swipe/tap]
[barra de progresso do fluxo]
[tela de confirmação + resumo antes de enviar]
[histórico de respostas anteriores]

/perfil
[avatar, apelido, cor — editáveis]
[dados físicos, objetivo]
[card WHOOP: status de conexão, botão reconectar, últimas sincronizações]
[modo recuperação: ativar/editar/encerrar]
[configurações da conta]

/admin  (somente admin)
[convites: gerar/revogar] [usuários: listar/remover]
[parâmetros de pontuação por versão] [logs] [status de sync por usuário]
[reprocessamento manual] [config. do telão] [provocações] [conquistas]

/display  (telão, tela cheia, sem nav padrão)
[carrossel automático entre 7 telas — ver ARCHITECTURE.md §7]
[controles ocultos após alguns segundos de inatividade]
```

## 7. Comandos para iniciar o projeto

```bash
# instalar dependências
npm install

# copiar variáveis de ambiente e preencher
cp .env.example .env

# subir schema no banco (dev)
npx prisma migrate dev

# popular com os 4 atletas fictícios + 90 dias de dados simulados
npm run seed

# ambiente de desenvolvimento
npm run dev

# lint / typecheck / testes
npm run lint
npm run typecheck
npm run test

# prisma studio (inspecionar dados)
npx prisma studio
```

Variáveis de ambiente completas: ver `.env.example` e `SECURITY.md §6`.

## 8. Critérios de aceite do MVP

Ver lista completa (22 itens) na seção 30 do brief original — replicada e rastreada por fase
em `ROADMAP.md §"Rastreio de critérios de aceite"`.

## 9. Como este documento evolui

A cada fase concluída: atualizar §3 (decisões) se alguma suposição virou fato confirmado,
mover riscos mitigados para "resolvido", e apontar no `ROADMAP.md` o que foi entregue.
