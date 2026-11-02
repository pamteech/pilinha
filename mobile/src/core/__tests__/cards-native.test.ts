import fs from 'fs';
import path from 'path';
import { ASSET_TYPES, emptyDraft } from '../index';
// Build 21: no iPhone o Metro resolve './DateField' para DateField.native.tsx. O .native importava longDate de './DateField'
// (ele mesmo) => longDate undefined => "algo deu errado" nos cards que mostram data (Caixinha/CDB, Tesouro, LCI/LCA, Provento).
const comp = path.join(__dirname, '../../components');
const resolveNative = (from: string, spec: string) => {
  const base = path.resolve(path.dirname(from), spec);
  for (const ext of ['.native.tsx', '.ios.tsx', '.native.ts', '.ios.ts', '.tsx', '.ts']) if (fs.existsSync(base + ext)) return base + ext;
  return null;
};
const imports = (file: string) => [...fs.readFileSync(file, 'utf8').matchAll(/from\s+'(\.[^']+)'/g)].map(m => m[1]);

describe('arquivos .native não importam a si mesmos (resolução do iPhone)', () => {
  const natives = fs.readdirSync(comp).filter(f => /\.(native|ios)\.tsx?$/.test(f)).map(f => path.join(comp, f));
  it('existe o DateField.native', () => expect(natives.some(f => f.endsWith('DateField.native.tsx'))).toBe(true));
  for (const f of natives) it(path.basename(f), () => {
    for (const spec of imports(f)) expect(resolveNative(f, spec)).not.toBe(f);
  });
  it('longDate chega definido pelo caminho do iPhone', () => {
    const exp = fs.readFileSync(path.join(comp, 'DateField.native.tsx'), 'utf8');
    expect(exp).toMatch(/from '\.\/dateFormat'/);
    const { longDate } = require('../../components/dateFormat');
    expect(longDate('2026-11-02')).toBe('2 de novembro de 2026');
  });
});

describe('os 8 cards do passo 1 abrem um rascunho válido para o passo 2', () => {
  it('são 8 tipos', () => expect(ASSET_TYPES.map(a => a.type).sort()).toEqual(['acao', 'bitcoin', 'dolar', 'fii', 'lcilca', 'provento', 'renda', 'tesouro']));
  for (const a of ASSET_TYPES) it(a.title, () => {
    const d = emptyDraft(a.type, '2026-11-02');
    expect(d.type).toBe(a.type);
    expect(d.date).toBe('2026-11-02');
    if (['renda', 'tesouro', 'lcilca', 'provento'].includes(a.type)) {
      const { longDate } = require('../../components/dateFormat');
      expect(typeof longDate).toBe('function');
      expect(longDate(d.date)).not.toBe('Escolher data');
    }
  });
});
