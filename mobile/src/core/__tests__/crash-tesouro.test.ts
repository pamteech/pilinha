import * as fs from 'fs'; import * as path from 'path';
import {
  Portfolio, applyDraft, draftFor, emptyDraft, forEachLine, latestTreasuryOffers, offerRateText, parsePortfolio, pickerBounds, preview,
  removeItem, sanitizeOffers, serializePortfolio, toISO, validateDraft,
} from '..';
// Crash do build 20 ao ficar no cadastro do Tesouro IPCA+ e "caixinhas sumiram" (valores fictícios).
const base = (): Portfolio => ({
  owner: 'exemplo',
  fixedIncome: [
    { name: 'Caixinha Viagem', kind: 'caixinha', cdiPercent: 100, deposits: [{ date: '2026-01-05', amount: 1000 }] },
    { name: 'Caixinha Reserva', kind: 'caixinha', cdiPercent: 102.5, deposits: [{ date: '2025-06-01', amount: 10 }, { date: '2026-02-01', amount: 20 }], extra: { x: 1 } } as any,
    { name: 'CDB Banco', kind: 'cdb', cdiPercent: 110, maturity: '2028-01-01', deposits: [{ date: '2026-03-01', amount: 50 }] },
    { name: 'Tesouro IPCA+ 2035', kind: 'tesouro', cdiPercent: 0, indexer: 'ipca', realRate: 7.5, maturity: '2035-05-15', deposits: [{ date: '2026-03-02', amount: 200 }] },
  ],
  stocks: [], crypto: [], manualDividends: [],
} as any);
const caixinhas = (p: Portfolio) => p.fixedIncome.filter(a => a.kind === 'caixinha' || a.kind === 'cdb').map(a => JSON.stringify(a));

describe('calendário nunca recebe data inválida', () => {
  test('valor vazio, inválido ou fora do limite vira data válida dentro de [min, max]', () => {
    for (const v of [undefined, '', 'abc', '2026-02-31', 'NaN-NaN-NaN', '2026-10-15']) {
      const b = pickerBounds(v as any, undefined, '2026-11-01');
      expect(Number.isFinite(b.value.getTime())).toBe(true);
      expect(b.value.getTime()).toBeLessThanOrEqual(b.max!.getTime());
    }
    const fut = pickerBounds('2030-01-01', undefined, '2026-11-01'); expect(toISO(fut.value)).toBe('2026-11-01');
    const past = pickerBounds('2020-01-01', '2026-11-01'); expect(toISO(past.value)).toBe('2026-11-01');
    expect(toISO(pickerBounds('2035-05-15').value)).toBe('2035-05-15');
  });
  test('min depois do max (ou inválidos) são ignorados em vez de travar o calendário', () => {
    const b = pickerBounds('2026-10-01', '2027-01-01', '2026-01-01'); expect(b.min).toBeUndefined(); expect(b.max).toBeUndefined();
    const c = pickerBounds('2026-10-01', 'x', 'y'); expect(c.min).toBeUndefined(); expect(c.max).toBeUndefined();
  });
  test('calendário do iPhone só monta dentro da janela aberta por toque, com pickerBounds', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../components/DateField.native.tsx'), 'utf8');
    expect(src).toMatch(/<Modal visible=\{open\}/); expect(src).toMatch(/\{open \? <DateTimePicker/); expect(src).toMatch(/pickerBounds/);
    expect(src).not.toMatch(/display="inline"/);
  });
  test('tela de cadastro e raiz têm ErrorBoundary (erro vira aviso, não fecha o app)', () => {
    for (const f of ['adicionar.tsx', '_layout.tsx']) expect(fs.readFileSync(path.join(__dirname, '../../app', f), 'utf8')).toMatch(/export function ErrorBoundary/);
  });
});

describe('planilha do Tesouro', () => {
  const csv = ['Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha',
    'Tesouro IPCA+;15/05/2035;30/10/2026;7,88;8,00;2000,00;1990,00;1990,00',
    'Tesouro IPCA+;15/05/2035;30/10/2026;7,88;8,00;2000,00;1990,00;1990,00', // linha repetida
    'Tesouro IPCA+;15/08/2040;30/10/2026;;;;;', // sem taxa
    'Tesouro Selic;01/03/2029;30/10/2026;0,06;0,07;20185,67;20170,66;20170,66',
    'Tesouro IPCA+;15/05/2035;29/10/2026;7,80;7,9;1,0;1,0;1,0', 'lixo;;', ''].join('\r\n');
  test('lê CRLF sem split, sem repetir título e sem taxa não quebra o texto', () => {
    const lines: string[] = []; forEachLine('a\r\nb\nc', l => lines.push(l)); expect(lines).toEqual(['a', 'b', 'c']);
    const o = latestTreasuryOffers(csv, '2026-11-01').filter(x => x.type === 'ipca');
    expect(o.map(x => x.maturity)).toEqual(['2035-05-15', '2040-08-15']);
    expect(o.map(offerRateText)).toEqual(['Hoje: IPCA + 7,88% ao ano', 'sem taxa hoje']);
    expect(offerRateText({ type: 'ipca', buyRate: undefined })).toBe('sem taxa hoje');
    expect(offerRateText({ type: 'ipca', buyRate: NaN })).toBe('sem taxa hoje');
  });
  test('cache corrompido de ofertas é filtrado', () => {
    expect(sanitizeOffers(null)).toEqual([]);
    expect(sanitizeOffers([{ title: 'Tesouro IPCA+', maturity: '2035-05-15', type: 'ipca', buyRate: 7.8, day: '2026-10-30' }, { title: 1 }, { title: 'x', maturity: 'bad', type: 'ipca' }, { title: 'x', maturity: '2035-05-15', type: 'ipca', buyRate: 'a' }])).toHaveLength(1);
  });
  const real = '/tmp/t.csv';
  (fs.existsSync(real) ? test : test.skip)('planilha real (pública) do Tesouro: todas as ofertas IPCA+ geram prévia e texto sem erro', () => {
    const offers = latestTreasuryOffers(fs.readFileSync(real, 'latin1'), '2026-11-01');
    expect(offers.filter(o => o.type === 'ipca').length).toBeGreaterThan(5);
    for (const o of offers) {
      expect(typeof offerRateText(o)).toBe('string');
      const dr = { ...emptyDraft('tesouro', '2026-10-15'), treasury: o.type, maturity: o.maturity, rate: o.buyRate != null ? String(o.buyRate).replace('.', ',') : '', amount: '1000' };
      expect(() => preview(dr, { cdiAnnual: 14.9, now: new Date('2026-11-01T15:00:00Z') })).not.toThrow();
      expect(Number.isFinite(pickerBounds(o.maturity).value.getTime())).toBe(true);
    }
  });
});

describe('caixinhas nunca somem', () => {
  test('editar/salvar o Tesouro IPCA+ mantém todas as caixinhas idênticas', () => {
    const p = base(); const before = caixinhas(p);
    const dr = draftFor(p, { category: 'tesouro', name: 'Tesouro IPCA+ 2035' })!;
    expect(dr.treasury).toBe('ipca'); expect(validateDraft(dr, p, new Date('2026-11-01T15:00:00Z'))).toEqual([]);
    const out = applyDraft(p, { ...dr, rate: '7,9' }).portfolio;
    expect(caixinhas(out)).toEqual(before);
    const novo = applyDraft(p, { ...emptyDraft('tesouro', '2026-10-15'), treasury: 'ipca', maturity: '2040-08-15', rate: '7,5', amount: '100' }).portfolio;
    expect(caixinhas(novo)).toEqual(before); expect(novo.fixedIncome).toHaveLength(5);
  });
  test('remover o Tesouro não tira caixinhas; ida e volta pelo JSON preserva tudo byte a byte', () => {
    const p = base();
    expect(caixinhas(removeItem(p, { category: 'tesouro', name: 'Tesouro IPCA+ 2035' }))).toEqual(caixinhas(p));
    const s = serializePortfolio(p); expect(serializePortfolio(parsePortfolio(s))).toBe(s);
  });
  test('lista do Cadastro mostra toda a renda fixa (sem filtro por tipo)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/cadastro.tsx'), 'utf8');
    expect(src).toMatch(/\.\.\.p\.fixedIncome\.map\(a =>/);
  });
});
