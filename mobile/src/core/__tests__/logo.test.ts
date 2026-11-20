import fs from 'fs';
import path from 'path';
import { KV, LOGO_BASE, LOGO_TTL_MS, assetCardView, logoCacheKey, logoUrl, loadLogo, normalizeLogoSvg, parseLogoBody, peekLogo, resetLogoCache } from '..';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><path fill="#005DA4" d="M0 0h56v56H0z"/></svg>';
const countedKv = () => {
  const store: Record<string, string> = {};
  let sets = 0;
  const k: KV & { store: typeof store; sets: () => number } = {
    store,
    sets: () => sets,
    get: async key => store[key] ?? null,
    set: async (key, v) => { sets += 1; store[key] = v; },
  };
  return k;
};

beforeEach(() => resetLogoCache());

describe('URL do logo e fallback', () => {
  test('monta a URL pública sem token, só com o ticker', () => {
    expect(logoUrl('petr4')).toBe(`${LOGO_BASE}/PETR4.svg`);
    expect(logoUrl(' petr4.sa ')).toBe(`${LOGO_BASE}/PETR4.svg`);
    expect(logoUrl('MXRF11')).toBe(`${LOGO_BASE}/MXRF11.svg`);
    expect(logoUrl('AAPL34')).toBe(`${LOGO_BASE}/AAPL34.svg`);
    expect(logoUrl('B3SA3')).toBe(`${LOGO_BASE}/B3SA3.svg`);
    expect(logoUrl('PETR4')).not.toMatch(/token|apikey|authorization|key=/i);
    expect(LOGO_BASE).toBe('https://icons.brapi.dev/icons');
  });
  test('ticker inválido não gera URL (cai no ícone do tipo)', () => {
    expect(logoUrl('XYZ')).toBeNull(); expect(logoUrl('')).toBeNull(); expect(logoUrl('PETROBRAS')).toBeNull();
  });
  test('200 com SVG vale; 404, HTML e corpo vazio viram fallback', () => {
    expect(parseLogoBody(200, svg)).toMatch(/<svg/);
    expect(parseLogoBody(404, '<!DOCTYPE html><html>not found</html>')).toBeNull();
    expect(parseLogoBody(200, '<!DOCTYPE html><html>ok</html>')).toBeNull();
    expect(parseLogoBody(200, '')).toBeNull();
    expect(parseLogoBody(500, svg)).toBeNull();
  });
  test('normaliza viewBox e style=fill para o iPhone', () => {
    const out = normalizeLogoSvg('<svg width="56" height="56"><path style="fill:#1b51a3" d="M0 0h1v1H0z"/></svg>');
    expect(out).toMatch(/viewBox="0 0 56 56"/);
    expect(out).toMatch(/fill="#1b51a3"/);
    expect(out).not.toMatch(/style=/);
    const keep = normalizeLogoSvg('<svg viewBox="0 0 56 56" width="56" height="56"><path fill="#fff" d="M0 0h1v1H0z"/></svg>');
    expect(keep.match(/viewBox/g)).toHaveLength(1);
  });
  test('a ficha do cartão leva a URL do logo', () => {
    const v = assetCardView({ name: 'PETR4', category: 'acao', invested: 1, current: 1, dayChange: null, net: null }, false);
    expect(v.logoUrl).toBe(`${LOGO_BASE}/PETR4.svg`);
    expect(assetCardView({ name: 'FAKE', category: 'acao', invested: null, current: 1, dayChange: null, net: null }, false).logoUrl).toBeNull();
  });
});

describe('cache memória/disco e erros', () => {
  test('acerto grava memória e disco e não busca de novo', async () => {
    let calls = 0;
    const fetchLogo = async () => { calls += 1; return { status: 200, body: svg }; };
    const disk = countedKv();
    const a = await loadLogo('WEGE3', fetchLogo, disk);
    const b = await loadLogo('wege3', fetchLogo, disk);
    expect(a).toEqual(b); expect(a.ok).toBe(true); if (a.ok) expect(a.xml).toMatch(/viewBox="0 0 56 56"/);
    expect(calls).toBe(1); expect(disk.sets()).toBe(1); expect(peekLogo('WEGE3')).toMatch(/<svg/);
    expect(JSON.parse(disk.store[logoCacheKey('WEGE3')]).xml).toMatch(/<svg/);
  });
  test('disco fresco evita a rede', async () => {
    let calls = 0;
    const disk = countedKv();
    await disk.set(logoCacheKey('VALE3'), JSON.stringify({ at: 1_000, xml: normalizeLogoSvg(svg) }));
    const r = await loadLogo('VALE3', async () => { calls += 1; return { status: 200, body: svg }; }, disk, 1_000 + 60_000);
    expect(r.ok).toBe(true); expect(calls).toBe(0);
  });
  test('404 cai no fallback e não insiste na sessão; ticker inválido também', async () => {
    let calls = 0;
    const fetchLogo = async () => { calls += 1; return { status: 404, body: '<!DOCTYPE html><html>nope</html>' }; };
    expect(await loadLogo('DEVA11', fetchLogo)).toEqual({ ok: false });
    expect(await loadLogo('DEVA11', fetchLogo)).toEqual({ ok: false });
    expect(calls).toBe(1); expect(peekLogo('DEVA11')).toBe('miss');
    expect(await loadLogo('XYZ', fetchLogo)).toEqual({ ok: false }); expect(calls).toBe(1);
  });
  test('sem internet usa o disco vencido; falha sem cache vira fallback (não marca miss)', async () => {
    const disk = countedKv();
    await disk.set(logoCacheKey('B3SA3'), JSON.stringify({ at: 1, xml: normalizeLogoSvg(svg) }));
    const stale = await loadLogo('B3SA3', async () => { throw new Error('Network request failed'); }, disk, 1 + LOGO_TTL_MS + 1);
    expect(stale.ok).toBe(true);
    const fail = await loadLogo('GGBR4', async () => { throw new Error('Network request failed'); });
    expect(fail).toEqual({ ok: false }); expect(peekLogo('GGBR4')).toBeNull();
  });
  test('duas chamadas juntas compartilham o mesmo fetch', async () => {
    let calls = 0, go: () => void;
    const wait = new Promise<void>(r => { go = r; });
    const fetchLogo = async () => { calls += 1; await wait; return { status: 200, body: svg }; };
    const a = loadLogo('VIVT3', fetchLogo), b = loadLogo('VIVT3', fetchLogo);
    go!();
    expect((await a).ok).toBe(true); expect((await b).ok).toBe(true); expect(calls).toBe(1);
  });
});

describe('tela usa o logo e cai no ícone do tipo', () => {
  test('AssetLogo no cartão, SvgXml já do projeto, sem token', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../../components/ui.tsx'), 'utf8');
    const src = fs.readFileSync(path.join(__dirname, '../logo.ts'), 'utf8');
    expect(ui).toMatch(/export function AssetLogo/);
    expect(ui).toMatch(/SvgXml/);
    expect(ui).toMatch(/peekLogo|loadLogo/);
    expect(ui).toMatch(/T\.pink/);
    expect(ui).toMatch(/52/);
    expect(ui).toMatch(/<AssetLogo /);
    expect(src + ui).not.toMatch(/Authorization|Bearer|brapiToken|apikey/i);
    expect(src).toMatch(/icons\.brapi\.dev/);
  });
});
