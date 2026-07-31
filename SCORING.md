# SCORING.md — Engine de Pontuação

## 1. Princípios

1. Base diária = **100 pontos**, sem piso — pode ficar negativa.
2. Distribuição-base fixa entre usuários (todos competem pelo mesmo teto), mas os **critérios
   internos** se adaptam a objetivo, histórico, linha de base e modo recuperação.
3. Comparação é sempre **contra a própria linha de base**, nunca contra os outros
   participantes diretamente (seção 11/15 do brief) — HRV absoluto nunca é fator principal.
4. Todo cálculo é determinístico, versionado e explicável — o usuário sempre pode ver
   exatamente de onde veio cada ponto.
5. Falha técnica (sem dados por culpa do sistema/WHOOP) nunca penaliza. Falha do usuário
   (esqueceu a pulseira, não respondeu Journal) pode penalizar.

## 2. Distribuição-base

| Categoria | Pontos possíveis |
|---|---|
| Sono | 25 |
| Recovery | 20 |
| Treino e Strain | 25 |
| Consistência | 15 |
| Evolução pessoal | 10 |
| Hábitos | 5 |
| **Total** | **100** |

Penalidades (overtraining, álcool, ausência de dados por culpa do usuário) subtraem do total
e **não** são limitadas por categoria — podem levar o total abaixo de zero.

## 3. Módulos (1 scorer = 1 responsabilidade, todos funções puras testáveis)

`SleepScorer · RecoveryScorer · StrainScorer · ConsistencyScorer · EvolutionScorer ·
HabitScorer · OvertrainingPenalty · MissingDataPenalty · RecoveryModeAdjustment`

Assinatura comum (pseudo-TS):

```ts
type ScorerInput = {
  performance: DailyPerformanceData; // WHOOP normalizado + Journal do dia
  baseline: UserBaseline;
  rules: ScoringRule[];              // da ScoringVersion vigente
  recoveryMode?: RecoveryModeData;
};

type ScorerResult = {
  pointsPossible: number;
  pointsEarned: number;
  adjustments: Array<{ type: "BONUS" | "PENALTY"; reason: string; points: number; ruleKey: string }>;
  metricUsed: string;
  baselineComparison: Record<string, number>;
  explanation: string;
  recommendation: string;
};

type Scorer = (input: ScorerInput) => ScorerResult;
```

`engine.ts` chama os 6 scorers principais, depois aplica os 3 ajustadores
(`OvertrainingPenalty`, `MissingDataPenalty`, `RecoveryModeAdjustment`) sobre o resultado
agregado, e persiste `DailyScore` + `ScoreComponent[]` + `ScoreAdjustment[]`.

## 4. Sono (25 pts)

Nunca premia duração absoluta isolada. Composição sugerida (pesos configuráveis via
`ScoringRule`, versão `v1`):

- Sleep Performance da WHOOP vs. necessidade individual — até 12 pts.
- Consistência de horário de dormir/acordar (desvio da média pessoal) — até 4 pts.
- Eficiência de sono — até 3 pts.
- Dívida de sono acumulada — penalidade até -3 pts.
- Proporção REM/profundo vs. linha de base pessoal — até 3 pts.
- Interrupções vs. linha de base — até 2 pts (pode ser negativo se muito acima do normal).
- Hábito correlato (cafeína à noite, do Journal) — penalidade até -1,5 pts.

Exemplo de saída (igual ao brief): `Sono: 20,5 de 25` com detalhamento
`Sleep Performance +12 · consistência +4 · eficiência +3 · dívida de sono -2 · cafeína
noturna -1,5`.

## 5. Recovery (20 pts)

- Recovery Score do dia, mas **relativizado** contra a média móvel pessoal (não contra 0–100%
  absoluto) — até 10 pts.
- HRV relativo (desvio da própria baseline, não valor absoluto) — até 5 pts.
- FC de repouso relativa à baseline — até 3 pts.
- Tendência (7 dias) — até 2 pts.

Nunca premia Recovery alta isolada sem contexto — se a Recovery está alta mas muito acima do
normal *sem explicação* (ex: sem correlação com sono/descanso), o componente de tendência não
soma bônus extra (evita "sorte" pontuar mais que consistência real).

## 6. Treino, Strain e overtraining (25 pts)

`StrainRecommendation` é calculada **antes** do treino, considerando: Recovery do dia, carga
aguda (7d) vs. crônica (28d) — proxy de ACWR —, sono, frequência recente, dias consecutivos
de esforço, tendência de HRV/FC repouso, objetivo pessoal, modo recuperação e histórico.

Pontuação de Strain compara o Strain real contra a faixa recomendada:

| Desvio acima da faixa | Consequência |
|---|---|
| dentro da faixa | pontuação máxima da categoria |
| até 10% acima | tolerância, sem perda |
| 10%–20% acima | -3 pts |
| 20%–35% acima | -7 pts |
| acima de 35% | -12 pts |
| excesso repetido (≥3 dias nos últimos 7) | penalidade adicional configurável (`OvertrainingPenalty`, default -5 extra) |

Essas faixas são `ScoringRule` (`key: "strain.overage.*"`) — ajustáveis sem deploy.

**Descanso inteligente**: quando a Recovery está baixa e a recomendação é descansar/atividade
leve, cumprir essa recomendação pontua tão bem quanto treinar dentro da faixa em dia de
Recovery alta. Não treinar não é punido quando é a decisão certa — treino diário nunca é
pré-requisito para nota máxima.

## 7. Consistência (15 pts)

- Sequência de dias com dados completos — bônus progressivo, mas perdido (não penalizado
  duas vezes) ao quebrar (seção 17 do brief: quebrar sequência tira o bônus, não gera punição
  adicional só por isso).
- Regularidade de horário de sono e de treino nas últimas 2–4 semanas.
- Um dia sem dados por responsabilidade do usuário: perde o bônus de sequência e pode perder
  pontos por **falta de dados** (`MissingDataPenalty`), nunca por "quebrar sequência" como
  penalidade própria — são conceitos separados no schema (`ScoreAdjustment.ruleKey`
  distingue `"consistency.streak_lost"` de `"missing_data.user_fault"`).

## 8. Evolução pessoal (10 pts)

Compara janela recente (7–14d) contra baseline de médio prazo (28–90d) do próprio usuário:
tendência de HRV, FC repouso, Sleep Performance, Strain adequado. Estritamente relativo ao
indivíduo — dois usuários com trajetórias idênticas em % recebem nota igual, independente dos
valores absolutos.

## 9. Hábitos (5 pts)

Baseado no Journal do dia (ver seção Journal). Sem resposta ao Journal → 0 na categoria.
Água/alimentação/mobilidade/fisioterapia/meditação somam proporcionalmente às respostas.
Álcool e cafeína noturna geram penalidade dentro da categoria **e** uma penalidade adicional
proporcional na pontuação geral fora da categoria de hábitos (seção 18 do brief:
"aplicar penalidade adicional na pontuação geral").

## 10. Modo recuperação — ajuste

`RecoveryModeAdjustment` roda por último e reescreve as metas internas dos scorers acima
(nunca o teto de 100): reduz a meta de Strain, ajusta o que conta como "consistência"
(atividade leve conta), e remove a elegibilidade a penalidades de overtraining/ausência que
seriam aplicadas a um usuário saudável. Não congela o campeonato — o usuário continua
pontuando, só que com critérios adaptados à recuperação.

## 11. Versionamento

Toda mudança de regra cria uma nova `ScoringVersion` (`v1` → `v1.1`), nunca edita uma versão
já usada em cálculos existentes. Reprocessar histórico com uma nova versão é uma operação
explícita e auditada (admin, `admin/pontuacao`), nunca automática silenciosa.

## 12. Dados simulados (seed) — lógica de correlação

Para o seed de 90 dias (seção 28 do brief) não gerar números soltos, aplicar regras simples
de correlação ao gerar os dados sintéticos:

- Álcool à noite (Journal) → reduz Sleep Performance e HRV do dia seguinte.
- Poucas horas de sono → reduz Recovery do dia seguinte.
- Recovery baixa + Strain alto no mesmo dia → aumenta chance de Recovery baixa nos 2 dias
  seguintes (fadiga acumulada).
- Sequência de bons hábitos (água, mobilidade, sono regular) → melhora gradualmente a
  baseline (HRV sobe lentamente, FC repouso cai lentamente) ao longo das semanas.
- Cada um dos 4 atletas fictícios recebe um "perfil" (ex: um mais consistente, um mais
  volátil, um "guerreiro de fim de semana") para o ranking simulado parecer plausível.
