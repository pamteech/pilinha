import * as fs from 'fs'; import * as path from 'path';
import { MOODS, PIG_COLORS, baseMood, dividendToday, frameCount, moodBadge, moodFrom, validPigColor } from '..';
// As folhas de cada cor (personagem/opcao2d/variantes.py) precisam existir para todos os humores, com o mesmo número de quadros da roxa.
const dir = path.join(__dirname, '../../../assets/pig');
const widthOf = (f: string) => { const b = fs.readFileSync(f); return `${b.readUIntLE(24, 3) + 1}x${b.readUIntLE(27, 3) + 1}`; }; // WebP VP8X: largura x altura
test('todas as cores têm os 12 humores com a mesma grade da folha roxa', () => {
  for (const m of MOODS) {
    const base = widthOf(path.join(dir, `porco2d_${m}.webp`)); expect([m, base]).toEqual([m, `${8 * 384}x${Math.ceil(frameCount[m] / 8) * 384}`]);
    for (const c of PIG_COLORS.filter(x => x.key !== 'roxo')) expect([c.key, m, widthOf(path.join(dir, c.key, `porco2d_${m}.webp`))]).toEqual([c.key, m, base]);
    for (const c of PIG_COLORS) expect(fs.existsSync(path.join(dir, `still_${c.key}.png`))).toBe(true);
  }
  expect(validPigColor('rosa')).toBe(true); expect(validPigColor('verde')).toBe(false);
});

test('humores novos: quando cada um aparece', () => {
  const ctx = { hasData: true, marketOpen: true };
  expect(moodFrom(0.5, true, false, ctx)).toBe('pensando');
  expect(moodFrom(0.5, false, true, ctx)).toBe('preocupado'); expect(moodFrom(0.5, false, true, { hasData: false })).toBe('erro');
  expect(moodFrom(-3, false, false, { ...ctx, goalReached: true })).toBe('rico');
  expect(moodFrom(-3, false, false, { ...ctx, dividendToday: true })).toBe('apaixonado');
  expect(moodFrom(2.5, false, false, ctx)).toBe('surpreso'); expect(moodFrom(-2, false, false, ctx)).toBe('chorando');
  expect(moodFrom(1, false, false, ctx)).toBe('feliz'); expect(moodFrom(-1, false, false, ctx)).toBe('triste');
  expect(moodFrom(0, false, false, { ...ctx, marketOpen: false })).toBe('dormindo'); expect(moodFrom(0, false, false, ctx)).toBe('neutro');
  expect(moodFrom(0, false, false)).toBe('neutro'); // sem contexto, regra antiga
  for (const m of MOODS) { expect(moodBadge(m).text.length).toBeGreaterThan(3); expect(['feliz', 'neutro', 'triste', 'dormindo', 'erro', 'ganhou']).toContain(baseMood(m)); }
  expect(baseMood('rico')).toBe('ganhou'); expect(baseMood('chorando')).toBe('triste');
});
test('provento hoje: manual de hoje ou pagamento de hoje de ação que tenho', () => {
  const hoje = '2026-11-07';
  expect(dividendToday([], [{ date: '2026-11-07' }], [], hoje)).toBe(true);
  expect(dividendToday([{ ticker: 'PETR4', paymentDate: new Date('2026-11-07T03:00:00Z') }], [], ['petr4'], hoje)).toBe(true);
  expect(dividendToday([{ ticker: 'VALE3', paymentDate: new Date('2026-11-07T03:00:00Z') }], [], ['PETR4'], hoje)).toBe(false);
  expect(dividendToday([{ ticker: 'PETR4', paymentDate: new Date('2026-11-06T03:00:00Z') }], [{ date: '2026-11-06' }], ['PETR4'], hoje)).toBe(false);
});
