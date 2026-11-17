import { HistoryPoint, monthClose, prevMonth, showMonthClose } from '..';
// Fechamento do mês: resumo do mês anterior pelo histórico (um ponto por dia de uso). Dados fictícios.
const NOW = new Date('2026-11-03T15:00:00Z'); // 3 de novembro, 12h em Brasília
const pt = (day: string, total: number, invested: number): HistoryPoint => ({ day, total, invested });
test('mês anterior: no meio do ano, virada de ano e dia de Brasília', () => {
  expect(prevMonth(NOW)).toBe('2026-10');
  expect(prevMonth(new Date('2027-01-05T15:00:00Z'))).toBe('2026-12'); // janeiro → dezembro do ano anterior
  expect(prevMonth(new Date('2026-03-31T15:00:00Z'))).toBe('2026-02');
  expect(prevMonth(new Date('2026-11-01T02:00:00Z'))).toBe('2026-09'); // 23h de 31/10 em Brasília: ainda é outubro
});
test('card só na primeira semana: dias 1 a 7', () => {
  expect(showMonthClose(new Date('2026-11-01T15:00:00Z'))).toBe(true);
  expect(showMonthClose(new Date('2026-11-07T15:00:00Z'))).toBe(true);
  expect(showMonthClose(new Date('2026-11-08T15:00:00Z'))).toBe(false);
  expect(showMonthClose(new Date('2026-11-08T02:00:00Z'))).toBe(true); // 23h do dia 7 em Brasília
  expect(showMonthClose(new Date('2026-11-30T15:00:00Z'))).toBe(false);
});
test('mês normal: base é o último ponto antes do mês, fim é o último ponto do mês', () => {
  const h = [pt('2026-09-15', 9000, 9000), pt('2026-09-30', 10000, 9000), pt('2026-10-10', 10050, 9000), pt('2026-10-31', 10100, 9000), pt('2026-11-02', 10300, 9000)];
  const c = monthClose(h, '2026-10')!;
  expect(c).toMatchObject({ month: '2026-10', label: 'outubro de 2026', aportes: 0, gain: 100 });
  expect(c.gainPct).toBeCloseTo(1); // 10.000 → 10.100 sem aporte
  expect(Object.keys(c).sort()).toEqual(['aportes', 'gain', 'gainPct', 'label', 'month']);
  expect(monthClose(h, '2026-03')).toBeNull(); expect(monthClose(h, '2026-12')).toBeNull(); // mês sem ponto
});
test('mês com aporte: o aporte não entra no rendimento, e a porcentagem tem o mesmo sinal do ganho em reais', () => {
  const a = pt('2026-09-30', 10000, 10000), b = pt('2026-10-30', 12100, 12000);
  const c = monthClose([a, pt('2026-10-15', 12040, 12000), b], '2026-10')!;
  expect(c.aportes).toBe(2000); expect(c.gain).toBe(100); // subiu 2.100, mas 2.000 foram aporte
  expect(c.gainPct).toBeCloseTo((100 / 11000) * 100); // sobre o saldo de base + metade do aporte (aporte no meio do mês)
  // carteira que já tinha ganho acumulado e recebe aporte: rendeu R$ 120, a porcentagem não pode sair negativa
  const d = monthClose([pt('2026-09-30', 10000, 9000), pt('2026-10-31', 12120, 11000)], '2026-10')!;
  expect(d.gain).toBe(120); expect(d.gainPct).toBeCloseTo((120 / 11000) * 100); expect(d.gainPct!).toBeGreaterThan(0);
});
test('mês com resgate: aportes negativo e rendimento sem contar a saída', () => {
  const c = monthClose([pt('2026-09-30', 10000, 9000), pt('2026-10-31', 8080, 7000)], '2026-10')!;
  expect(c.aportes).toBe(-2000); expect(c.gain).toBe(80); // caiu 1.920, mas 2.000 foram resgate
  expect(c.gainPct).toBeCloseTo((80 / 9000) * 100); // base 10.000 − metade do resgate
});
test('sem ponto antes do mês: a base é o primeiro ponto dentro dele', () => {
  const c = monthClose([pt('2026-10-05', 5000, 5000), pt('2026-10-20', 5600, 5500), pt('2026-11-01', 9999, 9000)], '2026-10')!;
  expect(c).toMatchObject({ aportes: 500, gain: 100 }); expect(c.gainPct).toBeCloseTo((100 / 5250) * 100);
});
test('dados de menos: histórico vazio, um ponto só, só ponto antes ou só depois do mês', () => {
  expect(monthClose([], '2026-10')).toBeNull();
  expect(monthClose([pt('2026-10-05', 5000, 5000)], '2026-10')).toBeNull();
  expect(monthClose([pt('2026-09-30', 5000, 5000)], '2026-10')).toBeNull();
  expect(monthClose([pt('2026-11-01', 5000, 5000), pt('2026-11-02', 5010, 5000)], '2026-10')).toBeNull();
  // ponto estragado (ex. null vindo do armazenamento) não conta
  expect(monthClose([pt('2026-09-30', NaN, 5000), pt('2026-10-31', 5000, null as any)], '2026-10')).toBeNull();
  expect(monthClose([pt('2026-09-30', NaN, 5000), pt('2026-10-01', 5000, 5000), pt('2026-10-31', 5050, 5000)], '2026-10')).toMatchObject({ aportes: 0, gain: 50 });
});
test('porcentagem que não dá para calcular fica null (sem saldo de base), o resto continua', () => {
  expect(monthClose([pt('2026-09-30', 0, 0), pt('2026-10-31', 50, 0)], '2026-10')).toEqual({ month: '2026-10', label: 'outubro de 2026', aportes: 0, gain: 50, gainPct: null });
  expect(monthClose([pt('2026-09-30', 100, 0), pt('2026-10-31', 150, 0)], '2026-10')!.gainPct).toBeCloseTo(50); // aplicado zerado não impede: a base é o patrimônio
});
test('rótulo do mês por extenso, com virada de ano', () => {
  const h = [pt('2025-11-30', 100, 100), pt('2025-12-31', 101, 100), pt('2026-03-31', 102, 100)];
  expect(monthClose(h, prevMonth(new Date('2026-01-02T15:00:00Z')))!.label).toBe('dezembro de 2025');
  expect(monthClose(h, '2026-03')!.label).toBe('março de 2026');
});
test('histórico fora de ordem dá o mesmo resultado e não é alterado', () => {
  const h = [pt('2026-10-31', 10100, 9000), pt('2026-11-02', 10300, 9000), pt('2026-09-30', 10000, 9000), pt('2026-10-10', 10050, 9000)], before = JSON.stringify(h);
  h.forEach(Object.freeze); Object.freeze(h); // ordenar no lugar daria erro
  expect(monthClose(h, '2026-10')).toMatchObject({ aportes: 0, gain: 100 });
  expect(JSON.stringify(h)).toBe(before);
});
