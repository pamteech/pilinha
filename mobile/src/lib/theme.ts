// Layout do Lastro com a paleta lilás/roxa amostrada do próprio porquinho, cards brancos com borda fina, Manrope.
// As chaves antigas (pink/bg) continuam: pink = cor primária (roxo escuro), bg = fundo off-white.
export type Appearance = 'auto' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';
const LIGHT = {
  scheme: 'light' as Scheme,
  bg: '#F7F3FA', card: '#FFFFFF', text: '#241B2E', dim: '#6B5F78', line: '#E6DCEE',
  pink: '#3E2A55', navy: '#3E2A55', navy2: '#5A3F72', champ: '#D0B0E0', champLight: '#EEE2F4', lilac: '#B58BC7', lilacDeep: '#7A5590',
  up: '#2E7D57', upLight: '#E6F1EA', down: '#8A2E3B', downLight: '#F4E6E8', neutralLight: '#EEE2F4',
  onDark: '#FFFFFF', onDarkDim: '#E3D6EC', upOnDark: '#9EE0BC', downOnDark: '#F2AEB8',
  purple: '#3E2A55', purpleDeep: '#FFFFFF',
  /** selo sobre o porquinho */ badge: 'rgba(255,255,255,0.85)', /** barras de gráfico: destaque e normal */ bar: '#3E2A55', barSoft: '#B58BC7', thumb: '#FFFFFF',
};
// Modo escuro: mesmo roxo, fundo quase preto arroxeado, texto claro; a cor primária vira lilás claro (botões com texto escuro).
const DARK: typeof LIGHT = {
  scheme: 'dark',
  bg: '#120B1C', card: '#1C1329', text: '#F1EAF8', dim: '#B3A6C4', line: '#2E2240',
  pink: '#C9A8FF', navy: '#2A1A3F', navy2: '#3E2A55', champ: '#D0B0E0', champLight: '#2A1F3B', lilac: '#B58BC7', lilacDeep: '#C9A8FF',
  up: '#6FD3A0', upLight: '#1A3328', down: '#F29AA6', downLight: '#3B1E25', neutralLight: '#2A1F3B',
  onDark: '#FFFFFF', onDarkDim: '#E3D6EC', upOnDark: '#9EE0BC', downOnDark: '#F2AEB8',
  purple: '#C9A8FF', purpleDeep: '#120B1C',
  badge: 'rgba(28,19,41,0.85)', bar: '#C9A8FF', barSoft: '#5E4680', thumb: '#FFFFFF',
};
export const PALETTES = { light: LIGHT, dark: DARK };
/**
 * Paleta em uso. É um objeto mutável de propósito: todas as telas leem `T.x` na hora de renderizar, e o `_layout`
 * troca os valores (applyTheme) e remonta a árvore ao mudar o esquema. Nunca guarde `T.x` em constante de módulo.
 */
export const T = { ...LIGHT };
export const applyTheme = (scheme: Scheme) => { Object.assign(T, PALETTES[scheme]); };
/** Esquema efetivo: Automático segue o iPhone. */
export const resolveScheme = (appearance: Appearance | undefined, system: string | null | undefined): Scheme =>
  appearance === 'dark' ? 'dark' : appearance === 'light' ? 'light' : system === 'dark' ? 'dark' : 'light';
export const F = { regular: 'Manrope_400Regular', semi: 'Manrope_600SemiBold', bold: 'Manrope_700Bold', black: 'Manrope_800ExtraBold' };
export const fontFor = (w?: string | number) => { const n = Number(w ?? 400) || (w === 'bold' ? 700 : 400); return n >= 800 ? F.black : n >= 700 ? F.bold : n >= 600 ? F.semi : F.regular; };
// Escala de espaçamento única (4/8/12/16/24/32) usada em todas as telas.
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { card: 18, inner: 12, pill: 999 } as const;
// No iOS, Manrope com lineHeight menor que ~1.2x o tamanho corta o topo do texto.
// Regra única: nunca abaixo de 1.25x o fontSize (textos grandes como o patrimônio).
export const MIN_LH = 1.25;
export const lineHeightFor = (fontSize = 15, lineHeight?: number) => Math.max(lineHeight ?? 0, Math.ceil(fontSize * MIN_LH));
