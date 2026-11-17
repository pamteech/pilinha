import { closeAt, easterISO, fxHolidays, isFxBusinessDay, parseUsdClose, prevFxBusinessDay, sessionUsdClose, usdCloseDue, usdCloseQuote, usdCloseTime, usdIntradayURL, usdSessionDay, defaultUsdAlert, UsdClose, USD_CLOSE_HOUR, USD_CLOSE_MINUTE, USD_REMINDER_HOUR, USD_REMINDER_MINUTE } from '..';
// Fechamento do dólar às 17h de Brasília (dados fictícios no formato do Yahoo chart, barras de 5 min).
const BRT = (day: string, hh: number, mm = 0) => Date.parse(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-03:00`);
/** Série de barras de 5 min de `from` a `to` (horário de Brasília) com preço dado por `px(minutoDoDia)`. */
function bars(day: string, from: [number, number], to: [number, number], px: (min: number) => number | null) {
  const out: { t: number; v: number | null }[] = [];
  for (let m = from[0] * 60 + from[1]; m <= to[0] * 60 + to[1]; m += 5) out.push({ t: BRT(day, Math.floor(m / 60), m % 60), v: px(m) });
  return out;
}
const yahoo = (pts: { t: number; v: number | null }[]) => ({ chart: { result: [{ meta: { symbol: 'BRL=X' }, timestamp: pts.map(p => p.t / 1000), indicators: { quote: [{ close: pts.map(p => p.v) }] } }], error: null } });
// Ontem (seg 16/11): fecha 17h a 5,00; depois das 17h o mercado externo sobe para 5,20 (não é fechamento).
// Hoje (ter 17/11): 17h a 5,05 (+1%); às 18h o "agora" está em 4,90 (cairia!), mas o fechamento foi em alta.
const mon = bars('2026-11-16', [9, 0], [19, 0], m => (m < 17 * 60 ? 5 : 5.2));
const tue = (until: [number, number]) => bars('2026-11-17', [9, 0], until, m => (m < 16 * 60 + 55 ? 5.02 : m < 17 * 60 ? 5.05 : 4.9));

test('horário adotado: fechamento 17h00 e lembrete 17h05 de Brasília', () => {
  expect([USD_CLOSE_HOUR, USD_CLOSE_MINUTE, USD_REMINDER_HOUR, USD_REMINDER_MINUTE]).toEqual([17, 0, 17, 5]);
  expect(usdCloseTime('2026-11-17').toISOString()).toBe('2026-11-17T20:00:00.000Z');
  expect(usdIntradayURL()).toBe('https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?interval=5m&range=5d');
});
test('feriados nacionais (Páscoa, Carnaval, Sexta Santa, Corpus Christi, Consciência Negra, 31/12)', () => {
  expect(easterISO(2026)).toBe('2026-04-05'); expect(easterISO(2027)).toBe('2027-03-28'); expect(easterISO(2025)).toBe('2025-04-20');
  const h = fxHolidays(2026);
  for (const d of ['2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21', '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02', '2026-11-20', '2026-12-25', '2026-12-31']) expect(h.has(d)).toBe(true);
  expect(isFxBusinessDay('2026-02-18')).toBe(true); // Quarta de Cinzas tem sessão
  expect(isFxBusinessDay('2026-11-20')).toBe(false); expect(isFxBusinessDay('2026-11-21')).toBe(false); expect(isFxBusinessDay('2026-11-22')).toBe(false);
  expect(isFxBusinessDay('2026-11-17')).toBe(true); expect(isFxBusinessDay('lixo')).toBe(false);
  expect(fxHolidays(2023).has('2023-11-20')).toBe(false); // antes da lei de 2023 valer
  expect(prevFxBusinessDay('2026-11-23')).toBe('2026-11-19'); // seg depois do feriado de sexta → quinta
  expect(prevFxBusinessDay('2026-02-18')).toBe('2026-02-13'); // Cinzas → sexta antes do Carnaval
  expect(prevFxBusinessDay('2027-01-04')).toBe('2026-12-30');
});
test('fechamento = preço das 17h, não o de depois; variação contra as 17h do dia útil anterior', () => {
  const c = parseUsdClose(yahoo([...mon, ...tue([18, 0])]), '2026-11-17')!;
  expect(c).toMatchObject({ day: '2026-11-17', close: 5.05, prevDay: '2026-11-16', prevClose: 5 });
  expect(c.changePct).toBeCloseTo(1, 6); // em alta, mesmo com o "agora" (4,90) abaixo
  expect(parseUsdClose(yahoo(mon), '2026-11-16')).toBeNull(); // sem a sexta na série: sem base, não inventa
});
test('antes das 17h e com a fonte atrasada: espera (null), nunca usa preço do meio do pregão', () => {
  expect(parseUsdClose(yahoo([...mon, ...tue([16, 30])]), '2026-11-17')).toBeNull(); // 16h30
  expect(parseUsdClose(yahoo([...mon, ...tue([16, 55])]), '2026-11-17')).toBeNull(); // barra das 16h55 ainda aberta
  expect(parseUsdClose(yahoo([...mon, ...tue([17, 0])]), '2026-11-17')?.close).toBe(5.05); // série chegou às 17h
  // buraco: último preço às 15h e nada até depois das 17h → fechamento duvidoso, espera
  const gap = [...mon, ...bars('2026-11-17', [9, 0], [15, 0], () => 5.02), ...bars('2026-11-17', [17, 30], [18, 0], () => 4.9)];
  expect(parseUsdClose(yahoo(gap), '2026-11-17')).toBeNull();
  // preço nulo na barra das 16h55: usa o último válido dentro dos 30 min
  const holes = [...mon, ...bars('2026-11-17', [9, 0], [18, 0], m => (m === 16 * 60 + 55 ? null : m < 17 * 60 ? 5.04 : 4.9))];
  expect(parseUsdClose(yahoo(holes), '2026-11-17')?.close).toBe(5.04);
});
test('sábado e feriado não têm fechamento, mesmo com o mercado externo cotando', () => {
  const sat = bars('2026-11-21', [9, 0], [19, 0], () => 5.1);
  expect(closeAt(sat, '2026-11-21')).toBeNull();
  const hol = bars('2026-11-20', [9, 0], [19, 0], () => 5.1);
  expect(parseUsdClose(yahoo(hol), '2026-11-20')).toBeNull();
  // segunda 23/11: base é quinta 19/11 (pula o feriado de sexta e o fim de semana)
  const thu = bars('2026-11-19', [9, 0], [18, 0], () => 5), mon23 = bars('2026-11-23', [9, 0], [18, 0], m => (m < 17 * 60 ? 4.95 : 5.3));
  const c = parseUsdClose(yahoo([...thu, ...hol, ...mon23]), '2026-11-23')!;
  expect(c.prevDay).toBe('2026-11-19'); expect(c.changePct).toBeCloseTo(-1, 6);
});
test('fuso do aparelho não muda nada (Tóquio, Nova York, Lisboa)', () => {
  const old = process.env.TZ, json = yahoo([...mon, ...tue([18, 0])]);
  const ref = { day: usdSessionDay(new Date('2026-11-17T20:30:00Z')), c: parseUsdClose(json, '2026-11-17') };
  try {
    for (const tz of ['Asia/Tokyo', 'America/New_York', 'Europe/Lisbon', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      expect(usdSessionDay(new Date('2026-11-17T20:30:00Z'))).toBe(ref.day); // 17h30 de Brasília = 05h30 de quarta em Tóquio
      expect(usdSessionDay(new Date('2026-11-17T19:30:00Z'))).toBeNull(); // 16h30 de Brasília
      expect(parseUsdClose(json, '2026-11-17')).toEqual(ref.c);
      expect(isFxBusinessDay('2026-11-21')).toBe(false); expect(isFxBusinessDay('2026-11-17')).toBe(true);
    }
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  expect(ref.day).toBe('2026-11-17');
});
test('sessionUsdClose: espera a fonte, ignora fechamento de outro dia, não roda fora da janela', async () => {
  const good: UsdClose = { day: '2026-11-17', close: 5.05, prevDay: '2026-11-16', prevClose: 5, changePct: 1, source: 't' };
  const after = new Date('2026-11-17T20:10:00Z'), before = new Date('2026-11-17T19:50:00Z');
  let calls = 0; const f = async (d: string) => { calls++; return d === '2026-11-17' ? good : null; };
  expect(await sessionUsdClose(before, f)).toBeNull(); expect(calls).toBe(0); // 16h50: nem consulta
  expect(await sessionUsdClose(after, f)).toEqual(good);
  expect(await sessionUsdClose(after, async () => null)).toBeNull(); // ainda não publicou: tenta depois
  expect(await sessionUsdClose(after, async () => { throw new Error('rede'); })).toBeNull();
  expect(await sessionUsdClose(after, async () => ({ ...good, day: '2026-11-16' }))).toBeNull();
  expect(await sessionUsdClose(new Date('2026-11-21T21:00:00Z'), f)).toBeNull(); // sábado
  // ciclo completo: null às 17h02 (não avisa) → fechamento às 17h10 (avisa uma vez)
  const cfg = defaultUsdAlert();
  expect(usdCloseDue(await sessionUsdClose(new Date('2026-11-17T20:02:00Z'), async () => null), cfg, null, new Date('2026-11-17T20:02:00Z'))).toBeNull();
  expect(usdCloseDue(await sessionUsdClose(after, f), cfg, null, after)).toBe('2026-11-17');
  expect(usdCloseDue(await sessionUsdClose(after, f), cfg, '2026-11-17', after)).toBeNull();
});
test('usdCloseQuote: tenta query1 e query2; resposta quebrada vira null (sem exceção)', async () => {
  const json = yahoo([...mon, ...tue([18, 0])]), seen: string[] = [];
  expect((await usdCloseQuote('2026-11-17', async u => { seen.push(u); if (u.includes('query1')) throw new Error('429'); return json; }))?.close).toBe(5.05);
  expect(seen.map(u => u.slice(8, 14))).toEqual(['query1', 'query2']);
  expect(await usdCloseQuote('2026-11-17', async () => ({ chart: { result: null, error: { code: 'Not Found' } } }))).toBeNull();
  expect(await usdCloseQuote('2026-11-17', async () => '<html>')).toBeNull();
  expect(await usdCloseQuote('2026-11-17', async () => { throw new Error('offline'); })).toBeNull();
  // salto absurdo (dado quebrado) não vira aviso
  const broken = yahoo([...mon, ...bars('2026-11-17', [9, 0], [18, 0], () => 50)]);
  expect(parseUsdClose(broken, '2026-11-17')).toBeNull();
});
