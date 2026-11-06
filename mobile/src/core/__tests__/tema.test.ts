import { PALETTES, T, applyTheme, resolveScheme } from '../../lib/theme';
import { ALLOC_COLORS, ALLOC_COLORS_DARK, allocation } from '..';
test('claro e escuro têm as mesmas chaves; applyTheme troca tudo', () => {
  expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
  applyTheme('dark'); expect(T.scheme).toBe('dark'); expect(T.bg).toBe(PALETTES.dark.bg); expect(T.pink).not.toBe(PALETTES.light.pink);
  applyTheme('light'); expect(T.scheme).toBe('light'); expect(T.bg).toBe(PALETTES.light.bg);
});
test('Automático segue o sistema; Claro/Escuro mandam', () => {
  expect(resolveScheme('auto', 'dark')).toBe('dark'); expect(resolveScheme('auto', 'light')).toBe('light'); expect(resolveScheme(undefined, null)).toBe('light');
  expect(resolveScheme('light', 'dark')).toBe('light'); expect(resolveScheme('dark', 'light')).toBe('dark');
});
test('distribuição usa a paleta escura no modo escuro', () => {
  const it = [{ name: 'PETR4', category: 'acao', current: 1, invested: null, dayChange: null, net: null }];
  expect(allocation(it)[0].color).toBe(ALLOC_COLORS.acoes); expect(allocation(it, true)[0].color).toBe(ALLOC_COLORS_DARK.acoes);
  expect(Object.keys(ALLOC_COLORS_DARK).sort()).toEqual(Object.keys(ALLOC_COLORS).sort());
});
