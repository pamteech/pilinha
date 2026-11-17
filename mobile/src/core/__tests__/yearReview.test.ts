import { HistoryPoint, LineItem, bestAsset, reviewYear, showYearReview, yearReview, yearShareText } from '..';
// Retrospectiva do ano: resumo do ano pelo histórico (um ponto por dia de uso). Dados fictícios.
const DEZ = new Date('2026-12-20T15:00:00Z'), JAN = new Date('2027-01-10T15:00:00Z'); // 20 de dezembro e 10 de janeiro, 12h em Brasília
const pt = (day: string, total: number, invested: number): HistoryPoint => ({ day, total, invested });
const item = (name: string, invested: number | null, current: number): LineItem => ({ name, category: 'acao', invested, current, dayChange: null, net: null });
// Ano inteiro: base em 30/12/2025, um ponto no fim de cada mês de 2026 (aporte de 1.000 em todos menos abril) e um ponto já em 2027.
const FULL = [pt('2025-12-30', 10000, 10000),
  pt('2026-01-31', 11100, 11000), pt('2026-02-28', 12250, 12000), pt('2026-03-31', 13600, 13000), pt('2026-04-30', 13650, 13000),
  pt('2026-05-31', 14700, 14000), pt('2026-06-30', 15800, 15000), pt('2026-07-31', 16900, 16000), pt('2026-08-31', 18000, 17000),
  pt('2026-09-30', 19100, 18000), pt('2026-10-31', 20200, 19000), pt('2026-11-30', 21300, 20000), pt('2026-12-31', 22400, 21000), pt('2027-01-05', 23000, 21500)];
const SAQUES = [pt('2025-12-31', 10000, 9000), pt('2026-02-28', 10600, 9500), pt('2026-07-31', 7700, 6500), pt('2026-12-31', 7900, 6500)];
test('ano da retrospectiva: em janeiro é o ano anterior, no resto é o atual (dia de Brasília)', () => {
  expect(reviewYear(DEZ)).toBe(2026); expect(reviewYear(JAN)).toBe(2026);
  expect(reviewYear(new Date('2026-06-15T15:00:00Z'))).toBe(2026);
  expect(reviewYear(new Date('2027-02-01T15:00:00Z'))).toBe(2027); // fevereiro: já é o ano novo
  expect(reviewYear(new Date('2027-01-01T02:00:00Z'))).toBe(2026); // 23h de 31/12 em Brasília: ainda dezembro de 2026
  expect(reviewYear(new Date('2027-02-01T02:00:00Z'))).toBe(2026); // 23h de 31/01 em Brasília: ainda janeiro
});
test('card da retrospectiva: de 1º de dezembro a 31 de janeiro', () => {
  expect(showYearReview(new Date('2026-11-30T15:00:00Z'))).toBe(false);
  expect(showYearReview(new Date('2026-12-01T15:00:00Z'))).toBe(true);
  expect(showYearReview(new Date('2026-12-01T02:00:00Z'))).toBe(false); // 23h de 30/11 em Brasília
  expect(showYearReview(DEZ)).toBe(true); expect(showYearReview(JAN)).toBe(true);
  expect(showYearReview(new Date('2027-01-31T15:00:00Z'))).toBe(true);
  expect(showYearReview(new Date('2027-02-01T02:00:00Z'))).toBe(true); // 23h de 31/01 em Brasília
  expect(showYearReview(new Date('2027-02-01T15:00:00Z'))).toBe(false);
  expect(showYearReview(new Date('2026-06-15T15:00:00Z'))).toBe(false);
});
test('ano inteiro: base é o último ponto antes do ano, fim é o último ponto do ano', () => {
  const r = yearReview(FULL, 2026, JAN)!;
  expect(r).toMatchObject({ year: 2026, aportes: 11000, gain: 1400, monthsWithAporte: 11, monthsTracked: 12, partial: false }); // subiu 12.400, mas 11.000 foram aporte
  expect(r.gainPct).toBeCloseTo((1400 / 15500) * 100); // mesma conta do fechamento do mês: base + metade do aporte
  expect(r.bestMonth!.label).toBe('março'); expect(r.bestMonth!.pct).toBeCloseTo((350 / 12750) * 100);
  expect(Object.keys(r).sort()).toEqual(['aportes', 'bestMonth', 'gain', 'gainPct', 'monthsTracked', 'monthsWithAporte', 'partial', 'year']);
  expect(yearReview(FULL, 2027, JAN)).toMatchObject({ aportes: 500, gain: 100, monthsTracked: 1, partial: true }); // o ponto de 2027 não entra em 2026, e vice-versa
});
test('primeiro ponto dentro do ano: a base é ele', () => {
  const r = yearReview([pt('2026-03-10', 5000, 5000), pt('2026-03-25', 5100, 5000), pt('2026-06-30', 6400, 6000)], 2026, DEZ)!;
  expect(r).toMatchObject({ aportes: 1000, gain: 400, monthsWithAporte: 1, monthsTracked: 2 }); // só março e junho têm fechamento
  expect(r.gainPct).toBeCloseTo((400 / 5500) * 100);
  expect(r.bestMonth!.label).toBe('junho'); expect(r.bestMonth!.pct).toBeCloseTo((300 / 5600) * 100);
});
test('meses sem dado não contam; aporte é só mês em que o aplicado subiu', () => {
  const r = yearReview([pt('2025-11-10', 1000, 1000), pt('2026-08-15', 1300, 1200)], 2026, DEZ)!; // app aberto uma vez no ano
  expect(r).toMatchObject({ aportes: 200, gain: 100, monthsWithAporte: 1, monthsTracked: 1, bestMonth: { label: 'agosto' } });
  // ruído de arredondamento no aplicado (menos de meio centavo) não vira mês com aporte
  expect(yearReview([pt('2025-12-31', 1000, 1000), pt('2026-01-31', 1010, 1000.004)], 2026, DEZ)).toMatchObject({ monthsWithAporte: 0, monthsTracked: 1 });
});
test('ano com resgate: aportes negativo, rendimento sem contar a saída, e mês de resgate não é mês de aporte', () => {
  const r = yearReview(SAQUES, 2026, JAN)!;
  expect(r).toMatchObject({ aportes: -2500, gain: 400, monthsWithAporte: 1, monthsTracked: 3 }); // caiu 2.100, mas 2.500 foram resgate
  expect(r.gainPct).toBeCloseTo((400 / 8750) * 100); // base 10.000 − metade do resgate
  expect(r.bestMonth!.label).toBe('dezembro'); expect(r.bestMonth!.pct).toBeCloseTo((200 / 7700) * 100);
});
test('ano no vermelho: porcentagem negativa e o melhor mês é o menos pior', () => {
  const r = yearReview([pt('2025-12-31', 10000, 10000), pt('2026-01-31', 9800, 10000), pt('2026-02-28', 9700, 10000)], 2026, DEZ)!;
  expect(r.gain).toBe(-300); expect(r.gainPct).toBeCloseTo(-3); expect(r.monthsWithAporte).toBe(0);
  expect(r.bestMonth!.label).toBe('fevereiro'); expect(r.bestMonth!.pct).toBeCloseTo((-100 / 9800) * 100);
});
test('dados de menos: histórico vazio, um ponto só no ano, só pontos antes ou só depois do ano, ponto estragado', () => {
  expect(yearReview([], 2026, DEZ)).toBeNull();
  expect(yearReview([pt('2026-05-05', 5000, 5000)], 2026, DEZ)).toBeNull();
  expect(yearReview([pt('2025-05-05', 5000, 5000), pt('2025-12-31', 5100, 5000)], 2026, DEZ)).toBeNull();
  expect(yearReview([pt('2027-01-02', 5000, 5000), pt('2027-01-03', 5010, 5000)], 2026, JAN)).toBeNull();
  expect(yearReview([pt('2025-12-31', NaN, 5000), pt('2026-10-31', 5000, null as any)], 2026, DEZ)).toBeNull();
  expect(yearReview([pt('2025-12-31', NaN, 5000), pt('2026-10-01', 5000, 5000), pt('2026-10-31', 5050, 5000)], 2026, DEZ)).toMatchObject({ aportes: 0, gain: 50 });
});
test('porcentagem que não dá para calcular fica null (sem saldo de base), sem melhor mês', () => {
  expect(yearReview([pt('2025-12-31', 0, 0), pt('2026-01-31', 50, 0)], 2026, JAN)).toEqual({ year: 2026, aportes: 0, gain: 50, gainPct: null, monthsWithAporte: 0, monthsTracked: 1, bestMonth: null, partial: false });
});
test('parcial: o ano ainda não acabou em `now` (dia de Brasília)', () => {
  expect(yearReview(FULL, 2026, DEZ)!.partial).toBe(true);
  expect(yearReview(FULL, 2026, new Date('2027-01-01T02:00:00Z'))!.partial).toBe(true); // 23h de 31/12 em Brasília
  expect(yearReview(FULL, 2026, new Date('2027-01-01T03:00:00Z'))!.partial).toBe(false); // meia-noite de 1º de janeiro
  expect(yearReview(FULL, 2026, JAN)!.partial).toBe(false);
});
test('maior ganho desde a compra: maior porcentagem sobre o aplicado, só itens com aplicado positivo', () => {
  expect(bestAsset([])).toBeNull();
  expect(bestAsset([item('SEM PM', null, 500), item('ZERADO', 0, 500), item('NEGATIVO', -10, 500), item('QUEBRADO', 100, NaN)])).toBeNull();
  // maior porcentagem, não maior valor em reais: XPTO3 ganhou R$ 500 (+50%), CDB X ganhou R$ 10.000 (+10%)
  const b = bestAsset([item('CDB X', 100000, 110000), item('XPTO3', 1000, 1500), item('SEM PM', null, 999999)])!;
  expect(b.name).toBe('XPTO3'); expect(b.pct).toBeCloseTo(50); expect(Object.keys(b).sort()).toEqual(['name', 'pct']);
  expect(bestAsset([item('AAAA3', 100, 120), item('BBBB3', 200, 240)])!.name).toBe('AAAA3'); // empate: fica o primeiro
  const perda = bestAsset([item('AAAA3', 100, 80), item('BBBB3', 100, 95)])!; // tudo no prejuízo: o menos pior, com porcentagem negativa
  expect(perda.name).toBe('BBBB3'); expect(perda.pct).toBeCloseTo(-5);
});
test('texto para compartilhar: só porcentagens e contagens', () => {
  expect(yearShareText(yearReview(FULL, 2026, JAN)!)).toBe('Meu 2026 no Pilinvest: rendeu +9,03%, aportei em 11 de 12 meses, melhor mês: março (+2,75%).');
  expect(yearShareText(yearReview(FULL, 2026, DEZ)!)).toBe('Meu 2026 no Pilinvest até agora: rendeu +9,03%, aportei em 11 de 12 meses, melhor mês: março (+2,75%).');
  expect(yearShareText(yearReview([pt('2025-11-10', 1000, 1000), pt('2026-08-15', 1300, 1200)], 2026, JAN)!)).toBe('Meu 2026 no Pilinvest: rendeu +9,09%, aportei em 1 de 1 mês, melhor mês: agosto (+9,09%).');
  expect(yearShareText(yearReview([pt('2025-12-31', 10000, 10000), pt('2026-01-31', 9800, 10000), pt('2026-02-28', 9700, 10000)], 2026, JAN)!)).toBe('Meu 2026 no Pilinvest: rendeu -3,00%, aportei em 0 de 2 meses, melhor mês: fevereiro (-1,02%).');
  expect(yearShareText(yearReview([pt('2025-12-31', 0, 0), pt('2026-01-31', 50, 0)], 2026, JAN)!)).toBe('Meu 2026 no Pilinvest: aportei em 0 de 1 mês.'); // sem porcentagem: a parte some
});
test('texto para compartilhar nunca tem R$ nem valor em reais', () => {
  for (const [h, now] of [[FULL, JAN], [FULL, DEZ], [SAQUES, JAN], [SAQUES, DEZ]] as const) {
    const r = yearReview(h, 2026, now)!, t = yearShareText(r);
    expect(t).not.toMatch(/R\$/);
    // tirando o ano, as porcentagens e a contagem de meses, não sobra número nenhum
    expect(t.replace(`Meu ${r.year}`, '').replace(/[+-]\d+,\d{2}%/g, '').replace(/\d+ de \d+ m/, '')).not.toMatch(/\d/);
  }
});
test('histórico e itens fora de ordem dão o mesmo resultado e não são alterados', () => {
  const h = [FULL[5], FULL[13], FULL[0], ...FULL.slice(6, 13), ...FULL.slice(1, 5)].map(p => ({ ...p })), before = JSON.stringify(h);
  h.forEach(Object.freeze); Object.freeze(h); // ordenar no lugar daria erro
  expect(yearReview(h, 2026, JAN)).toEqual(yearReview(FULL, 2026, JAN));
  expect(JSON.stringify(h)).toBe(before);
  const items = [item('CDB X', 100000, 110000), item('XPTO3', 1000, 1500)], antes = JSON.stringify(items);
  items.forEach(Object.freeze); Object.freeze(items);
  expect(bestAsset(items)!.name).toBe('XPTO3'); expect(JSON.stringify(items)).toBe(antes);
  const r = yearReview(FULL, 2026, JAN)!, rs = JSON.stringify(r); Object.freeze(r);
  yearShareText(r); expect(JSON.stringify(r)).toBe(rs);
});
test('compartilhar sem a parte dos aportes quando o custo de algum ativo é desconhecido', () => {
  const r = yearReview(FULL, 2026, JAN)!, t = yearShareText(r, false);
  expect(yearShareText(r)).toContain('aportei em'); expect(t).not.toContain('aportei'); expect(t).not.toContain('R$');
  expect(t.startsWith('Meu 2026 no Pilinvest')).toBe(true);
});
