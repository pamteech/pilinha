import { LineItem, topMovers, groupItems, priceVsAvg, itemDayPct, lastDays, weekSummary, moodBadge, moodFrom } from '..';
const it = (name: string, category: string, current: number, dayChange: number | null, extra: Partial<LineItem> = {}): LineItem =>
  ({ name, category, invested: null, current, dayChange, net: null, ...extra });
describe('Insights', () => {
  const items = [it('Caixinha', 'caixinha', 1000, 5), it('A', 'acao', 110, 10), it('B', 'acao', 90, -10), it('C', 'fii', 102, 2), it('D', 'acao', 99, -1),
    it('E', 'acao', 105, 5), it('BTC', 'cripto', 200, 20), it('Z', 'acao', 50, null)];
  test('top movers ignora renda fixa e limita a 3', () => {
    const m = topMovers(items);
    expect(m.up.map(x => x.name)).toEqual(['BTC', 'A', 'E']); expect(m.down.map(x => x.name)).toEqual(['B', 'D']);
    expect(topMovers([]).up).toEqual([]);
  });
  test('item day pct', () => { expect(itemDayPct(it('x', 'acao', 110, 10))).toBeCloseTo(10); expect(itemDayPct(it('x', 'acao', 1, null))).toBeNull(); });
  test('agrupamento com totais e ordem', () => {
    const g = groupItems(items);
    expect(g.map(x => x.title)).toEqual(['Renda fixa', 'Ações e FIIs', 'Cripto']);
    expect(g[1].items.length).toBe(6); expect(g[1].total).toBe(556); expect(g[0].total).toBe(1000);
    expect(groupItems([it('BTC', 'cripto', 1, 0)]).map(x => x.key)).toEqual(['cripto']);
  });
  test('cotação vs PM', () => {
    expect(priceVsAvg({ unitPrice: 10, avgPrice: 10 })).toBe('up'); expect(priceVsAvg({ unitPrice: 9, avgPrice: 10 })).toBe('down');
    expect(priceVsAvg({ unitPrice: 9, avgPrice: null })).toBe('neutral'); expect(priceVsAvg({ unitPrice: 9 })).toBe('neutral');
  });
  test('últimos 7 dias', () => {
    const h = ['2026-10-10', '2026-10-19', '2026-10-20', '2026-10-26'].map(day => ({ day, total: 1, invested: 1 }));
    expect(lastDays(h, 7, new Date('2026-10-26T12:00:00Z')).map(p => p.day)).toEqual(['2026-10-20', '2026-10-26']);
  });
  test('semana: aporte novo não vira alta, escondido ou não', () => {
    const pts = [{ total: 1010, invested: 1000 }, { total: 3030, invested: 3000 }];
    for (const h of [true, false]) { const w = weekSummary(pts, h); expect(w.pct).toBeCloseTo(0); expect(w.gain).toBeCloseTo(20); }
    expect(weekSummary(pts, false).ys).toEqual([1010, 3030]);
    expect(weekSummary([{ total: 100, invested: 100 }, { total: 110, invested: 100 }], false).pct).toBeCloseTo(10);
    expect(weekSummary([{ total: 1, invested: 1 }], false)).toMatchObject({ pct: null, gain: null });
    expect(weekSummary([{ total: NaN, invested: 1 }, { total: 5, invested: 0 }], false).pct).toBeNull();
  });
  test('humor do porquinho', () => {
    expect(moodBadge(moodFrom(1, false, false))).toMatchObject({ icon: 'trending-up', tone: 'up' }); expect(moodBadge(moodFrom(-1, false, false))).toMatchObject({ icon: 'trending-down', tone: 'down' });
    expect(moodBadge(moodFrom(null, false, false))).toMatchObject({ icon: 'trending-neutral', tone: 'neutral' });
  });
});
