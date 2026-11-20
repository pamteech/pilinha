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
  purple: '#3E2A55', purpleDeep: '#FFFFFF', /** texto sobre a cor primária (botões, chips ligados) */ onPrimary: '#FFFFFF',
  /** selo sobre o porquinho */ badge: 'rgba(255,255,255,0.85)', /** barras de gráfico: destaque e normal */ bar: '#3E2A55', barSoft: '#B58BC7', thumb: '#FFFFFF',
  /** placeholder de carregamento */ skeleton: '#EDE6F2',
};
// Modo escuro de alto contraste: fundo quase preto, cards bem mais claros que o fundo, bordas visíveis, cabeçalho e barra de abas
// destacados, texto branco; a cor primária é o violeta da landing com texto branco.
const DARK: typeof LIGHT = {
  scheme: 'dark',
  bg: '#0B0712', card: '#1F1F23', text: '#FFFFFF', dim: '#C8C8D0', line: '#3A3A42', pink: '#8B5CF6', navy: '#3E2A55', navy2: '#5A3F72', champ: '#D8C4FF', champLight: '#2C2C32', lilac: '#C4B5FD', lilacDeep: '#D8C4FF', up: '#5FE0A0', upLight: '#163A2A', down: '#FF8A96', downLight: '#4A1F2A', neutralLight: '#2C2C32', onDark: '#FFFFFF', onDarkDim: '#E3D6EC', upOnDark: '#9EE0BC', downOnDark: '#F2AEB8', purple: '#8B5CF6', purpleDeep: '#0B0712', onPrimary: '#FFFFFF', badge: 'rgba(36,26,51,0.9)', bar: '#C4B5FD', barSoft: '#6B57A0', thumb: '#FFFFFF', skeleton: '#2C2C32',
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
export const R = { card: 24, inner: 12, pill: 999 } as const;
// No iOS, Manrope com lineHeight menor que ~1.2x o tamanho corta o topo do texto.
// Regra única: nunca abaixo de 1.25x o fontSize (textos grandes como o patrimônio).
export const MIN_LH = 1.25;
export const lineHeightFor = (fontSize = 15, lineHeight?: number) => Math.max(lineHeight ?? 0, Math.ceil(fontSize * MIN_LH));

/** Hierarquia tipográfica dos valores e rótulos (grade de 8 pt na altura de linha). */
export const TY = {
  label: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  greeting: { fontSize: 24, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.4 },
  valueHero: { fontSize: 32, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.8 },
  value: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  pct: { fontSize: 13, lineHeight: 16, fontWeight: '600' as const },
} as const;
/** Alinha os dígitos em colunas, para valores e porcentagens não “pularem”. */
export const tabular = { fontVariant: ['tabular-nums'] as ('tabular-nums')[] };
