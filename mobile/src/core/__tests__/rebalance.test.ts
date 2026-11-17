import { AllocTargets, aporteSuggestion, validateTargets } from '..';
// "Onde aportar este mês": distribuição ideal por tipo e sugestão só com compras (nunca vender). Dados fictícios.
const T3: AllocTargets = { renda: 50, acoes: 30, fiis: 20 };
const cents = (v: number) => Math.round(v * 100);
const sum = (rows: { suggest: number }[]) => rows.reduce((a, r) => a + cents(r.suggest), 0);
test('validação: cada valor entre 0 e 100 e soma 100 (tolerância 0,5)', () => {
  expect(validateTargets(T3)).toEqual([]);
  expect(validateTargets({ renda: 33.3, acoes: 33.3, fiis: 33.3 })).toEqual([]); // 99,9
  expect(validateTargets({ renda: 60, acoes: 39.5 })).toEqual([]); expect(validateTargets({ renda: 60, acoes: 39.4 }).length).toBe(1);
  expect(validateTargets({})).toEqual(['A soma tem que dar 100%.']);
  expect(validateTargets({ renda: 120, acoes: -20 })).toEqual(['Cada tipo tem que ficar entre 0 e 100%.']);
  expect(validateTargets({ renda: NaN, acoes: 100 }).length).toBe(1); expect(validateTargets({ renda: Infinity }).length).toBe(1);
});
test('as sugestões somam exatamente o aporte; quem está acima do ideal recebe zero', () => {
  // depois do aporte a carteira vale 11.000: ideal 5.500 / 3.300 / 2.200; faltas 0 / 1.300 / 1.200
  const r = aporteSuggestion([{ key: 'renda', total: 7000 }, { key: 'acoes', total: 2000 }, { key: 'fiis', total: 1000 }], T3, 1000);
  expect(r.map(x => x.key)).toEqual(['renda', 'acoes', 'fiis']);
  expect(r.map(x => x.suggest)).toEqual([0, 520, 480]); expect(sum(r)).toBe(100000);
  expect(r.map(x => x.currentPct)).toEqual([70, 20, 10]); expect(r.map(x => x.targetPct)).toEqual([50, 30, 20]);
  expect(r[0].afterPct).toBeCloseTo((7000 / 11000) * 100); expect(r[1].afterPct).toBeCloseTo((2520 / 11000) * 100); expect(r[2].afterPct).toBeCloseTo((1480 / 11000) * 100);
});
test('sobra de centavos vai para a maior falta e a soma fecha', () => {
  const r = aporteSuggestion([], { renda: 33.3, acoes: 33.3, fiis: 33.3 }, 100);
  expect(r.map(x => x.suggest)).toEqual([33.34, 33.33, 33.33]); expect(sum(r)).toBe(10000);
  for (const amount of [0.01, 0.05, 99.99, 1234.57, 777.77]) {
    const x = aporteSuggestion([{ key: 'renda', total: 812.37 }, { key: 'tesouro', total: 97.11 }, { key: 'bitcoin', total: 3.2 }], { renda: 35, tesouro: 25, acoes: 20, fiis: 10, bitcoin: 5, dolar: 5 }, amount);
    expect(sum(x)).toBe(cents(amount)); for (const row of x) expect(row.suggest).toBeGreaterThanOrEqual(0);
  }
});
test('carteira já no ideal divide o aporte pelos alvos', () => {
  const r = aporteSuggestion([{ key: 'renda', total: 5000 }, { key: 'acoes', total: 3000 }, { key: 'fiis', total: 2000 }], T3, 1000);
  expect(r.map(x => x.suggest)).toEqual([500, 300, 200]);
  for (const x of r) expect(x.afterPct).toBeCloseTo(x.targetPct);
  // alvos somando 99,5 (dentro da tolerância) numa carteira grande: nenhuma falta, ainda assim divide pelos alvos
  const big = aporteSuggestion([{ key: 'renda', total: 1_000_000 }], { renda: 99.5 }, 1000);
  expect(big.map(x => x.suggest)).toEqual([1000]);
});
test('carteira vazia: divide pelos alvos; tipo sem alvo aparece com zero', () => {
  const r = aporteSuggestion([], T3, 2000);
  expect(r.map(x => [x.key, x.currentPct, x.suggest])).toEqual([['renda', 0, 1000], ['acoes', 0, 600], ['fiis', 0, 400]]);
  expect(r.map(x => x.afterPct)).toEqual([50, 30, 20]);
  const d = aporteSuggestion([{ key: 'dolar', total: 500 }], { renda: 100 }, 500);
  expect(d).toEqual([{ key: 'renda', currentPct: 0, targetPct: 100, suggest: 500, afterPct: 50 }, { key: 'dolar', currentPct: 100, targetPct: 0, suggest: 0, afterPct: 50 }]);
});
test('entrada inválida: toda sugestão é zero', () => {
  const cur = [{ key: 'renda' as const, total: 7000 }, { key: 'acoes' as const, total: 3000 }];
  for (const amount of [0, -100, NaN, Infinity]) {
    const r = aporteSuggestion(cur, T3, amount);
    expect(r.map(x => x.suggest)).toEqual([0, 0, 0]); expect(r.map(x => x.currentPct)).toEqual([70, 30, 0]); expect(r.map(x => x.afterPct)).toEqual([70, 30, 0]);
  }
  expect(aporteSuggestion(cur, { renda: 50, acoes: 30 }, 1000).every(x => x.suggest === 0)).toBe(true); // soma 80
  expect(aporteSuggestion(cur, { renda: 150, acoes: -50 }, 1000).every(x => x.suggest === 0)).toBe(true);
  const nan = aporteSuggestion([{ key: 'renda', total: NaN }, { key: 'acoes', total: 3000 }], T3, 1000);
  expect(nan.every(x => x.suggest === 0 && Number.isFinite(x.currentPct) && Number.isFinite(x.afterPct))).toBe(true);
  expect(aporteSuggestion([], {}, 1000)).toEqual([]);
});
test('não altera as entradas', () => {
  const cur = [{ key: 'renda' as const, total: 7000 }, { key: 'acoes' as const, total: 2000 }], targets: AllocTargets = { ...T3 };
  const before = JSON.stringify([cur, targets]);
  aporteSuggestion(Object.freeze(cur.map(c => Object.freeze(c))) as typeof cur, Object.freeze(targets), 1000);
  expect(JSON.stringify([cur, targets])).toBe(before);
});
