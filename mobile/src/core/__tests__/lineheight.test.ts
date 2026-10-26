import * as fs from 'fs'; import * as path from 'path';
import { lineHeightFor, MIN_LH } from '../../lib/theme';
// Lint simples: no iOS, lineHeight < 1.15x fontSize corta o topo da Manrope.
const files = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === '__tests__' ? [] : files(path.join(d, e.name))) : e.name.endsWith('.tsx') ? [path.join(d, e.name)] : []);
describe('lineHeight x fontSize', () => {
  test('nenhum estilo com lineHeight < 1.15x fontSize', () => {
    const bad: string[] = [];
    for (const f of files(path.join(__dirname, '../..'))) {
      for (const obj of fs.readFileSync(f, 'utf8').match(/\{[^{}]*fontSize:\s*\d+[^{}]*\}/g) ?? []) {
        const fsz = Number(/fontSize:\s*(\d+)/.exec(obj)![1]), lh = /lineHeight:\s*(\d+)/.exec(obj);
        if (lh && Number(lh[1]) < fsz * 1.15) bad.push(`${path.basename(f)}: ${obj.slice(0, 80)}`);
        if (!lh && fsz > 16) bad.push(`${path.basename(f)}: fontSize ${fsz} sem lineHeight explícito`);
      }
    }
    expect(bad).toEqual([]);
  });
  test('lineHeightFor nunca fica abaixo de 1.25x', () => {
    expect(lineHeightFor(32, 22)).toBe(40); expect(lineHeightFor(15, 22)).toBe(22); expect(lineHeightFor(28)).toBe(35);
    for (const s of [11, 15, 21, 28, 32, 48]) expect(lineHeightFor(s, 10)).toBeGreaterThanOrEqual(s * MIN_LH);
  });
});
