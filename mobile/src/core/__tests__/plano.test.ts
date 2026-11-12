import { Plan, ageLabel, ageNow, compactBRL, monthsToAge, nominal, planPath, planSummary, planTracking, validatePlan } from '..';
// "Quero R$ 5 milhões aos 60": conta em dinheiro de hoje (rendimento acima da inflação). Dados fictícios.
const NOW = new Date('2026-11-12T15:00:00Z');
const plan = (over: Partial<Plan> = {}): Plan => ({ age: 30, ageAsOf: '2026-11', targetAge: 60, monthly: 3000, profile: 'moderado', startDate: '2026-11-12', startAmount: 15000, reminderDay: 5, ...over });
test('idade anda com o tempo; meses até a idade-alvo', () => {
  expect(ageNow(plan(), NOW)).toBe(30); expect(ageNow(plan(), new Date('2027-11-20T12:00:00Z'))).toBe(31);
  expect(monthsToAge(plan(), 60, NOW)).toBe(360); expect(monthsToAge(plan(), 60, new Date('2027-05-10T12:00:00Z'))).toBe(354);
});
test('aporte necessário para R$ 5 mi aos 60 (6% acima da inflação) e idade em que chega com R$ 3 mil', () => {
  const s = planSummary(plan(), 5_000_000, 15000, NOW);
  // fórmula fechada: (5e6 − 15e3·1,06^30)·i / (1,06^30 − 1), i = 1,06^(1/12) − 1
  const i = Math.pow(1.06, 1 / 12) - 1, g = Math.pow(1.06, 30);
  expect(s.required!).toBeCloseTo(((5e6 - 15000 * g) * i) / (g - 1), 2);
  expect(Math.round(s.required!)).toBe(5042); // ~R$ 5 mil por mês
  expect(s.reachAge!).toBeGreaterThan(60); expect(s.reachAge!).toBeLessThan(70);
  expect(s.monthsLeft).toBe(360); expect(s.nominalYear).toBe(2056);
  expect(s.nominalTarget!).toBeCloseTo(5e6 * Math.pow(1.045, 30), -3); // ~R$ 18,7 mi
  expect(s.passive).toBeCloseTo(5e6 * i, 2);
  // cenários: quanto mais rende, menos precisa por mês e mais cedo chega
  const [c, m, a] = s.byProfile; expect(c.required!).toBeGreaterThan(m.required!); expect(m.required!).toBeGreaterThan(a.required!);
  expect(c.reachAge!).toBeGreaterThan(a.reachAge!);
});
test('sem idade-alvo: só idade em que chega; idade-alvo passada: sem aporte necessário', () => {
  expect(planSummary(plan({ targetAge: null }), 1e6, 0, NOW).required).toBeNull();
  expect(planSummary(plan({ targetAge: 30 }), 1e6, 0, NOW).required).toBeNull();
  expect(planSummary(plan({ monthly: 0 }), 1e6, 0, NOW).reachAge).toBeNull(); // nunca chega
});
test('caminho do plano: começa no patrimônio de hoje, sobe e passa da meta antes do fim', () => {
  const path = planPath(plan({ monthly: 6000 }), 5e6, 15000, NOW);
  expect(path[0]).toEqual({ age: 30, value: 15000 });
  for (let k = 1; k < path.length; k++) expect(path[k].value).toBeGreaterThan(path[k - 1].value);
  expect(path[path.length - 1].value).toBeGreaterThan(5e6); expect(path[path.length - 1].age).toBeLessThanOrEqual(100);
});
test('acompanhamento: aporte do mês pelo histórico e posição contra o caminho', () => {
  const hist = [{ day: '2026-10-28', total: 15000, invested: 14000 }, { day: '2026-11-03', total: 16200, invested: 15200 }, { day: '2026-11-12', total: 17100, invested: 16000 }];
  const t0 = planTracking(plan(), 17100, hist, NOW);
  expect(t0.monthsElapsed).toBe(0); expect(t0.monthAporte).toBe(2000); expect(t0.monthPlanned).toBe(3000);
  expect(t0.expected).toBe(15000); expect(t0.diff).toBe(2100);
  const t3 = planTracking(plan(), 20000, [], new Date('2027-02-15T12:00:00Z'));
  expect(t3.monthsElapsed).toBe(3); expect(t3.expected).toBeGreaterThan(15000 + 3 * 3000); expect(t3.diff).toBeLessThan(0); expect(t3.monthAporte).toBeNull();
});
test('formatação curta e validação', () => {
  expect(compactBRL(5e6)).toBe('R$ 5 mi'); expect(compactBRL(4.86e6)).toBe('R$ 4,86 mi'); expect(compactBRL(4.984912e6)).toBe('R$ 4,98 mi'); expect(compactBRL(2.5e6)).toBe('R$ 2,5 mi'); expect(compactBRL(18.7e6)).toBe('R$ 19 mi');
  expect(compactBRL(480000)).toBe('R$ 480 mil'); expect(compactBRL(950)).toBe('R$ 950'); expect(compactBRL(-2500)).toBe('−R$ 3 mil');
  expect(nominal(100, 12)).toBeCloseTo(104.5);
  expect(validatePlan({ target: 5e6, age: 30, targetAge: 60, monthly: 3000 })).toEqual([]);
  expect(validatePlan({ target: 0, age: 30, targetAge: 25, monthly: -1 }).length).toBe(3);
  expect(validatePlan({ target: 1e6, age: 30, targetAge: null, monthly: 0 })).toEqual([]);
});
test('idade com meses', () => {
  expect(ageLabel(55)).toBe('55 anos'); expect(ageLabel(55.58)).toBe('55 anos e 7 meses'); expect(ageLabel(55.09)).toBe('55 anos e 1 mês'); expect(ageLabel(55.97)).toBe('56 anos');
});
