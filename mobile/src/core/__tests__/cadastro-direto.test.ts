import fs from 'fs';
import path from 'path';
const src = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/cadastro.tsx'), 'utf8');
const add = fs.readFileSync(path.join(__dirname, '../../app/adicionar.tsx'), 'utf8');
describe('aba Cadastro abre direto nos cards do passo 1', () => {
  test('renderiza a grade de tipos sem botão Adicionar investimento', () => {
    expect(src).toMatch(/<TypeStep onPick=/);
    expect(src).not.toMatch(/accessibilityLabel="Adicionar investimento"/);
    expect(add).toMatch(/export function TypeStep/);
  });
  test('tocar num card abre o passo 2 com o tipo', () => {
    expect(src).toMatch(/pathname: '\/adicionar', params: \{ type: t \}/);
    expect(add).toMatch(/useState\(editing \|\| params\.type \? 2 : 1\)/);
  });
  test('lista, proventos e Quero comprar continuam abaixo dos cards', () => {
    const i = src.indexOf('<TypeStep');
    for (const k of ['Seus investimentos', 'Proventos lançados à mão', 'Quero comprar']) expect(src.indexOf(k)).toBeGreaterThan(i);
  });
});
describe('splash sem quadrado', () => {
  test('splash usa o ícone com cantos arredondados (PNG com transparência)', () => {
    const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../app.json'), 'utf8'));
    const sp = app.expo.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-splash-screen')[1];
    expect(sp.image).toBe('./assets/images/splash-icon.png');
    const png = fs.readFileSync(path.join(__dirname, '../../..', sp.image));
    expect(png[25]).toBe(6); // RGBA
  });
});
