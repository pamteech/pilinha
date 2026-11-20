import fs from 'fs';
import path from 'path';
import { greetingAt } from '..';

const at = (h: number, m = 0) => {
  const d = new Date(2026, 10, 20, h, m, 0, 0);
  return d;
};

describe('saudação do Início', () => {
  test('divide o dia em Bom dia, Boa tarde e Boa noite', () => {
    expect(greetingAt(at(5))).toBe('Bom dia');
    expect(greetingAt(at(11, 59))).toBe('Bom dia');
    expect(greetingAt(at(12))).toBe('Boa tarde');
    expect(greetingAt(at(17, 59))).toBe('Boa tarde');
    expect(greetingAt(at(18))).toBe('Boa noite');
    expect(greetingAt(at(0))).toBe('Boa noite');
    expect(greetingAt(at(4, 59))).toBe('Boa noite');
  });
  test('Início usa a saudação, o porquinho, os atalhos e o skeleton; Carteira tem skeleton e estado vazio', () => {
    const home = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/index.tsx'), 'utf8');
    const carteira = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/carteira.tsx'), 'utf8');
    const actions = fs.readFileSync(path.join(__dirname, '../../components/QuickActions.tsx'), 'utf8');
    const ui = fs.readFileSync(path.join(__dirname, '../../components/ui.tsx'), 'utf8');
    const totals = fs.readFileSync(path.join(__dirname, '../../components/TotalsSplit.tsx'), 'utf8');
    expect(home).toMatch(/greetingAt\(\)/);
    expect(home).toMatch(/<Pig /);
    expect(home).toMatch(/<QuickActions \/>/);
    expect(home).toMatch(/<TotalsSkeleton \/>/);
    expect(carteira).toMatch(/<TotalsSkeleton \/>/);
    expect(carteira).toMatch(/Nada cadastrado ainda/);
    expect(actions).toMatch(/Carteira/);
    expect(actions).toMatch(/Proventos/);
    expect(actions).toMatch(/Cadastro/);
    expect(actions).toMatch(/Meu plano/);
    expect(actions).not.toMatch(/Comprar|Vender|Saldo disponível/);
    expect(ui).toMatch(/\btabular\b/);
    const theme = fs.readFileSync(path.join(__dirname, '../../lib/theme.ts'), 'utf8');
    expect(theme).toMatch(/tabular-nums/);
    expect(ui).toMatch(/StyleSheet\.hairlineWidth/);
    expect(ui).toMatch(/export function Skeleton/);
    expect(totals).toMatch(/TY\.valueHero/);
    expect(home + carteira + actions + ui + totals).not.toMatch(/nubank|Nubank|820AD1/i);
  });
});
