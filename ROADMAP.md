# ROADMAP.md

Cinco fases, cada uma entregando algo executável. Não pular fase. Atualizar as caixas de
seleção conforme o trabalho avança.

## Fase 1 — Fundação

- [x] Documentação inicial (`PLAN.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SCORING.md`,
      `WHOOP_INTEGRATION.md`, `SECURITY.md`, `ROADMAP.md`)
- [x] Projeto Next.js (App Router, TS estrito, Tailwind, ESLint/Prettier)
- [x] Banco + Prisma: schema completo (todas as entidades da seção 25 do brief) + migration
      inicial
- [x] Autenticação (Auth.js, credentials, sessão em banco) + convite (`/invite/[token]`)
- [x] Perfis (`Profile`, `UserColor`) + onboarding multi-step
- [x] Layout e design system (tokens dark, shadcn/ui, tipografia, motion)
- [x] Seed com 4 atletas fictícios (perfis, cores, contas) + esqueleto de 90 dias de dados
      correlacionados
- [x] Navegação mobile (bottom nav: Home, Ranking, Evolução, Metas, Perfil)

## Fase 2 — MVP com dados simulados

- [x] Engine de pontuação real (`src/server/scoring/*`): baseline por janela móvel, 6
      scorers, OvertrainingPenalty, MissingDataPenalty, RecoveryModeAdjustment — rodando
      sobre os 90 dias simulados dos 4 atletas (`npm run backfill-scores`)
- [x] Home (nota atual, posição, Recovery/Sleep/Strain, faixa recomendada, aviso de
      overtraining, sequência, progresso semanal, provocação do dia, conquistas recentes)
- [x] Ranking diário/semanal/mensal/geral (`RankingSnapshot`, `npm run recompute-rankings`)
- [x] Detalhe do cálculo (`/ranking/[date]/score`) usando dados simulados
- [x] Journal (fluxo de cartões, hábitos da seção 18, histórico)
- [x] Metas (criação, sugestão automática a partir da baseline real, aprovação com edição
      inline, rejeição, pausar/retomar/concluir/encerrar, progresso do ciclo de 14 dias)
- [x] Modo recuperação (ativação com data de término obrigatória, extensão, encerramento
      automático por data, ajuste real na engine — Strain reduzido, consistência adaptada)
- [x] Provocações determinísticas (`roast.service.ts`, `npm run generate-roasts`)
- [x] Conquistas (catálogo de 19 badges do brief + avaliação sobre o histórico, página
      Categorias com campeão por categoria e títulos de grupo)
- [x] Gráficos de evolução (Recharts: 7/14/30/90/desde o início, 9 métricas)
- [x] Modo telão (`/display`, 7 telas em carrossel, atualização via polling, auto-hide de
      controles, teclado/toque, tela cheia)

Observação de calibração: durante o backfill, a faixa recomendada de Strain e a detecção
de excesso repetido usavam inicialmente uma média que incluía dias de descanso (Strain=0),
diluindo o teto e disparando a penalidade de overtraining quase sempre. Corrigido para usar
a intensidade média só dos dias de treino — o arquétipo "overtrainer" do seed passou a ter,
corretamente, a menor pontuação média do grupo. Pontuação negativa por categoria já ocorre
no dataset atual (ex: Hábitos chegou a -4,8 num dia); o total do dia ainda não ficou
negativo nos 90 dias simulados porque as demais categorias compensam — o mecanismo (sem
piso em lugar nenhum do código) está correto e será mais visível com dados reais ou
arquétipos mais extremos.

## Fase 3 — Integração WHOOP

- [ ] Confirmar contra documentação oficial: endpoints, scopes exatos, formato de payload,
      suporte a assinatura de webhook
- [ ] OAuth real (`WhoopAuthService`) substituindo o mock
- [ ] `WhoopSyncService` + `WhoopHistoricalImporter` contra API real
- [ ] `WhoopWebhookService` + endpoint público validado
- [ ] Job de reconciliação diária
- [ ] Estados de conexão completos na UI (Perfil/Home)
- [ ] Tratamento de erro de auth/rate limit end-to-end

## Fase 4 — Engine real

- [ ] `UserBaseline` calculado a partir de dados reais (janela móvel)
- [ ] Fechamento de dia competitivo real (ligado a ciclos WHOOP reais)
- [ ] Engine de pontuação rodando sobre dados reais (todos os scorers)
- [ ] `StrainRecommendation` real + penalidades de overtraining
- [ ] Ajuste de modo recuperação sobre dados reais
- [ ] Evolução pessoal e hábitos com dados reais
- [ ] Recalculo de rankings incremental (sem reprocessar histórico inteiro a cada evento)
- [ ] Reprocessamento administrativo (nova `ScoringVersion`, auditado)

## Fase 5 — Qualidade

- [ ] Suite de testes completa (unit, integração, e2e — seção 27 do brief)
- [ ] Revisão de segurança fim a fim (`SECURITY.md` como checklist de auditoria)
- [ ] Performance (cache, paginação, agregações, processamento incremental)
- [ ] Acessibilidade (contraste, teclado, `prefers-reduced-motion`, semântica)
- [ ] PWA completo (manifest, ícones, instalação, offline básico da shell)
- [ ] Observabilidade (painel de saúde da integração, alertas internos)
- [ ] Tratamento de edge cases (timezone, DST, ciclos que cruzam meses/semanas)

## Rastreio de critérios de aceite do MVP (seção 30 do brief)

| # | Critério | Fase que entrega |
|---|---|---|
| 1 | Entrar por convite | 1 |
| 2 | Criar perfil | 1 |
| 3 | Visualizar quatro atletas | 1 |
| 4 | Usar dados simulados | 1 (seed) / 2 (uso) |
| 5 | Responder ao Journal | 2 |
| 6 | Calcular nota diária | 2 (simulado) / 4 (real) |
| 7 | Mostrar cálculo completo | 2 |
| 8–11 | Rankings diário/semanal/mensal/geral | 2 |
| 12 | Pontuação negativa | 2 (mecanismo sem piso, comprovado a nível de categoria; total do dia ainda não ficou negativo neste dataset) |
| 13 | Mostrar overtraining | 2 |
| 14 | Premiar descanso inteligente | 2 |
| 15 | Modo recuperação com data final | 2 |
| 16 | Criar/aprovar metas | 2 |
| 17 | Provocações | 2 |
| 18 | Conquistas | 2 |
| 19 | Gráficos | 2 |
| 20–21 | Modo telão + carrossel | 2 |
| 22 | Funcionar no celular | todas |

## Fora de escopo permanente

Chat, feed, comentários, fotos, notificações push externas, treino manual, edição manual de
pontuação, cadastro público, temporadas, apostas, pagamentos, IA externa não moderada para
provocações.
