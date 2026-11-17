import { HistoryPoint, MILESTONES, aporteStreak, milestoneLabel, newMilestones, nextMilestone, reachedMilestones, streakLabel, topMilestones } from '..';
// Sequência de aportes e marcos, pelo histórico (um ponto por dia de uso) e pelo patrimônio de hoje. Dados fictícios.
const NOW = new Date('2026-11-14T15:00:00Z'); // 14 de novembro, 12h em Brasília
const pt = (day: string, invested: number, total = invested): HistoryPoint => ({ day, total, invested });
describe('sequência de aportes', () => {
  test('meses seguidos com aporte, terminando no mês atual', () => {
    const h = [pt('2026-07-31', 1000), pt('2026-08-15', 1500), pt('2026-09-20', 2000), pt('2026-10-10', 2500), pt('2026-11-05', 3000)];
    expect(aporteStreak(h, NOW)).toBe(4); // agosto a novembro; julho só tem um ponto, não dá para saber se houve aporte
    expect(aporteStreak([], NOW)).toBe(0); expect(aporteStreak([pt('2026-11-05', 3000)], NOW)).toBe(0);
  });
  test('primeiro mês do histórico conta quando o último ponto dele está acima do primeiro', () => {
    expect(aporteStreak([pt('2026-10-05', 1000), pt('2026-10-25', 1500), pt('2026-11-03', 2000)], NOW)).toBe(2);
    expect(aporteStreak([pt('2026-10-05', 1000), pt('2026-10-25', 1000), pt('2026-11-03', 2000)], NOW)).toBe(1);
    expect(aporteStreak([pt('2026-11-02', 1000), pt('2026-11-10', 1800)], NOW)).toBe(1); // tudo no mês atual
  });
  test('buraco: um mês sem aporte no meio quebra a sequência', () => {
    const h = [pt('2026-07-31', 1000), pt('2026-08-15', 1500), pt('2026-09-20', 1500), pt('2026-10-10', 2000), pt('2026-11-05', 2500)];
    expect(aporteStreak(h, NOW)).toBe(2); // setembro parou: valem outubro e novembro
  });
  test('mês sem ponto carrega o valor anterior: conta como sem aporte', () => {
    const h = [pt('2026-08-31', 1000), pt('2026-09-30', 1500), pt('2026-11-10', 2500)]; // app fechado em outubro
    expect(aporteStreak(h, NOW)).toBe(1); // só novembro
    expect(aporteStreak([pt('2026-08-31', 1000), pt('2026-09-30', 1500)], NOW)).toBe(0); // outubro e novembro sem ponto
  });
  test('mês atual ainda sem aporte não quebra: vale a sequência que terminou no mês passado', () => {
    const h = [pt('2026-08-31', 1000), pt('2026-09-30', 1500), pt('2026-10-31', 2000)];
    expect(aporteStreak(h, NOW)).toBe(2); // novembro sem ponto
    expect(aporteStreak([...h, pt('2026-11-03', 2000)], NOW)).toBe(2); // novembro com ponto, sem aporte
    expect(aporteStreak([...h, pt('2026-11-03', 2000), pt('2026-11-12', 2400)], NOW)).toBe(3); // aportou: novembro entra
    expect(aporteStreak(h, new Date('2026-12-15T15:00:00Z'))).toBe(0); // só o mês atual tem essa folga: novembro já fechou sem aporte
  });
  test('mês com resgate não conta', () => {
    const h = [pt('2026-07-31', 5000), pt('2026-08-20', 6000), pt('2026-09-20', 4000), pt('2026-10-10', 4500), pt('2026-11-05', 5000)];
    expect(aporteStreak(h, NOW)).toBe(2); // setembro foi resgate
    expect(aporteStreak([pt('2026-09-30', 5000), pt('2026-10-31', 6000), pt('2026-11-05', 5500)], NOW)).toBe(1); // resgate no mês atual: vale outubro
  });
  test('diferença de até um centavo é ruído de arredondamento, não aporte', () => {
    expect(aporteStreak([pt('2026-10-31', 1000), pt('2026-11-05', 1000.005)], NOW)).toBe(0);
    expect(aporteStreak([pt('2026-10-31', 1000), pt('2026-11-05', 1000.02)], NOW)).toBe(1);
  });
  test('mês atual pelo dia de Brasília, e virada de ano', () => {
    const h = [pt('2026-09-30', 1000), pt('2026-10-10', 1500), pt('2026-11-01', 1500)];
    expect(aporteStreak(h, new Date('2026-11-01T02:00:00Z'))).toBe(1); // 23h de 31/10 em Brasília: outubro é o mês atual
    expect(aporteStreak([pt('2026-11-30', 1000), pt('2026-12-20', 1500), pt('2027-01-10', 2000)], new Date('2027-01-15T15:00:00Z'))).toBe(2);
  });
  test('histórico fora de ordem ou com ponto estragado dá o mesmo resultado e não é alterado', () => {
    const h = [pt('2026-10-10', 2500), pt('2026-11-05', 3000), pt('2026-08-15', 1500), pt('2026-07-31', 1000), pt('2026-09-20', 2000), pt('2026-10-20', NaN)], before = JSON.stringify(h);
    h.forEach(Object.freeze); Object.freeze(h); // ordenar no lugar daria erro
    expect(aporteStreak(h, NOW)).toBe(4);
    expect(JSON.stringify(h)).toBe(before);
  });
});
describe('marcos', () => {
  test('lista: patrimônio, fração da meta e sequência, com ids estáveis (ficam guardados nos ajustes)', () => {
    expect(MILESTONES.map(m => m.id)).toEqual(['total-1000', 'total-5000', 'total-10000', 'total-25000', 'total-50000', 'total-100000', 'total-250000', 'total-500000', 'total-1000000',
      'goal-25', 'goal-50', 'goal-75', 'goal-100', 'streak-3', 'streak-6', 'streak-12', 'streak-24']);
    expect(MILESTONES.map(m => m.kind)).toEqual([...Array(9).fill('total'), ...Array(4).fill('goal'), ...Array(4).fill('streak')]);
  });
  test('alcançados: vale exatamente no limite', () => {
    expect(reachedMilestones({ total: 10000, goal: null, streak: 0 })).toEqual(['total-1000', 'total-5000', 'total-10000']);
    expect(reachedMilestones({ total: 9999.99, goal: null, streak: 0 })).toEqual(['total-1000', 'total-5000']);
    expect(reachedMilestones({ total: 999.99, goal: null, streak: 0 })).toEqual([]);
    expect(reachedMilestones({ total: 1e6, goal: null, streak: 0 })).toHaveLength(9);
    expect(reachedMilestones({ total: 0, goal: null, streak: 3 })).toEqual(['streak-3']);
    expect(reachedMilestones({ total: 0, goal: null, streak: 2 })).toEqual([]);
    expect(reachedMilestones({ total: 0, goal: null, streak: 30 })).toEqual(['streak-3', 'streak-6', 'streak-12', 'streak-24']);
    expect(reachedMilestones({ total: NaN, goal: 100, streak: 0 })).toEqual([]);
  });
  test('alcançados: os de meta só com meta definida', () => {
    expect(reachedMilestones({ total: 500, goal: 2000, streak: 0 })).toEqual(['goal-25']); // 25% exatos
    expect(reachedMilestones({ total: 499.99, goal: 2000, streak: 0 })).toEqual([]);
    expect(reachedMilestones({ total: 900, goal: 900, streak: 0 })).toEqual(['goal-25', 'goal-50', 'goal-75', 'goal-100']);
    for (const goal of [null, undefined, 0, -500, NaN]) expect(reachedMilestones({ total: 5e6, goal, streak: 0 }).filter(id => id.startsWith('goal'))).toEqual([]);
  });
  test('novos: os alcançados que ainda não foram vistos; na primeira vez (null) nenhum, para não despejar tudo de uma vez', () => {
    const reached = Object.freeze(['total-1000', 'total-5000', 'goal-25', 'streak-3']) as string[], seen = Object.freeze(['total-1000', 'goal-25']) as string[];
    expect(newMilestones(reached, null)).toEqual([]);
    expect(newMilestones(reached, undefined)).toEqual([]);
    expect(newMilestones(reached, [])).toEqual(['total-1000', 'total-5000', 'goal-25', 'streak-3']);
    expect(newMilestones(reached, seen)).toEqual(['total-5000', 'streak-3']);
    expect(newMilestones(reached, reached)).toEqual([]);
    expect(newMilestones([], seen)).toEqual([]);
  });
  test('vários de uma vez: o maior de cada tipo', () => {
    const ids = Object.freeze(['streak-3', 'total-1000', 'goal-25', 'total-5000', 'streak-6', 'marco-antigo']) as string[];
    expect(topMilestones(ids)).toEqual(['total-5000', 'goal-25', 'streak-6']);
    expect(topMilestones(['goal-50'])).toEqual(['goal-50']); expect(topMilestones([])).toEqual([]);
  });
  test('nome do marco com valores à mostra', () => {
    expect(milestoneLabel('total-1000', false)).toBe('Primeiros R$ 1 mil');
    expect(milestoneLabel('total-10000', false)).toBe('Primeiros R$ 10 mil');
    expect(milestoneLabel('total-250000', false)).toBe('Primeiros R$ 250 mil');
    expect(milestoneLabel('total-1000000', false)).toBe('Primeiro R$ 1 milhão');
    expect(milestoneLabel('goal-25', false)).toBe('25% da meta'); expect(milestoneLabel('goal-50', false)).toBe('Metade da meta');
    expect(milestoneLabel('goal-75', false)).toBe('75% da meta'); expect(milestoneLabel('goal-100', false)).toBe('Meta alcançada');
    expect(milestoneLabel('streak-6', false)).toBe('6 meses seguidos aportando');
    expect(milestoneLabel('marco-antigo', false)).toBe('');
  });
  test('nome do marco com valores escondidos: o de patrimônio sai sem o valor; meta e sequência ficam', () => {
    for (const m of MILESTONES) {
      const l = milestoneLabel(m.id, true);
      if (m.kind === 'total') { expect(l).toBe('Novo marco de patrimônio'); expect(l).not.toMatch(/R\$|\d/); } else expect(l).toBe(milestoneLabel(m.id, false));
    }
  });
  test('texto da sequência', () => {
    expect(streakLabel(0)).toBe('Aporte este mês para começar uma sequência');
    expect(streakLabel(1)).toBe('1 mês aportando');
    expect(streakLabel(3)).toBe('3 meses seguidos aportando');
  });
  test('próximo marco: o que pede menos patrimônio, com o quanto já foi', () => {
    expect(nextMilestone({ total: 4000, goal: null })).toEqual({ id: 'total-5000', kind: 'total', pct: 80 });
    expect(nextMilestone({ total: 5000, goal: null })).toEqual({ id: 'total-10000', kind: 'total', pct: 50 }); // no limite já foi alcançado: o próximo é o seguinte
    expect(nextMilestone({ total: 0, goal: null })).toEqual({ id: 'total-1000', kind: 'total', pct: 0 });
    expect(nextMilestone({ total: 4000, goal: 16000 })).toMatchObject({ id: 'total-5000', pct: 80 }); // 25% da meta (4.000) já foi; metade (8.000) fica depois dos 5 mil
    const g = nextMilestone({ total: 4500, goal: 19000 })!; // 25% da meta = 4.750, antes dos 5 mil
    expect(g).toMatchObject({ id: 'goal-25', kind: 'goal' }); expect(g.pct).toBeCloseTo((4500 / 4750) * 100);
    expect(nextMilestone({ total: 2e6, goal: 5e6 })).toEqual({ id: 'goal-50', kind: 'goal', pct: 80 }); // acabou o de patrimônio, segue o de meta
    expect(nextMilestone({ total: 1e6, goal: null })).toBeNull(); expect(nextMilestone({ total: 2e6, goal: 2e6 })).toBeNull();
    expect(nextMilestone({ total: NaN, goal: 1000 })).toBeNull();
  });
  test('próximo marco com valores escondidos: só os de meta (o caminho até um valor em R$ revelaria o tamanho da carteira)', () => {
    expect(nextMilestone({ total: 4000, goal: 16000, hidden: true })).toEqual({ id: 'goal-50', kind: 'goal', pct: 50 });
    expect(nextMilestone({ total: 4000, goal: null, hidden: true })).toBeNull();
    expect(nextMilestone({ total: 4000, goal: 3000, hidden: true })).toBeNull();
    for (const total of [0, 900, 4999, 12345, 999999]) for (const goal of [null, 2000, 80000, 3e6]) expect(nextMilestone({ total, goal, hidden: true })?.kind ?? 'goal').toBe('goal');
  });
});
import { aportesKnown, reseedGoalMilestones } from '..';
test('aporte só é confiável com custo conhecido em todos os ativos (sem preço médio, o aplicado acompanha o mercado)', () => {
  expect(aportesKnown([])).toBe(true);
  expect(aportesKnown([{ invested: 1000 }, { invested: 0 }])).toBe(true);
  expect(aportesKnown([{ invested: 1000 }, { invested: null }])).toBe(false);
});
test('meta criada ou alterada: os marcos de meta viram os já alcançados com a meta nova, sem comemorar', () => {
  expect(reseedGoalMilestones(null, 80000, 100000)).toBeNull(); // primeira vez: quem semeia é o Início
  const seen = ['total-50000', 'streak-3'], antes = JSON.stringify(seen);
  const a = reseedGoalMilestones(seen, 80000, 100000)!;
  expect(a).toEqual(['total-50000', 'streak-3', 'goal-25', 'goal-50', 'goal-75']);
  expect(newMilestones(reachedMilestones({ total: 80000, goal: 100000, streak: 0 }), a).filter(id => id.startsWith('goal-'))).toEqual([]);
  expect(reseedGoalMilestones(a, 80000, 500000)).toEqual(['total-50000', 'streak-3']); // meta maior (16%): as frações voltam a valer
  expect(reseedGoalMilestones(a, 80000, null)).toEqual(['total-50000', 'streak-3']); // meta removida
  expect(JSON.stringify(seen)).toBe(antes);
});
