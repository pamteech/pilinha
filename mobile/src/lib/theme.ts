// Layout do Lastro com a paleta lilás/roxa amostrada do próprio porquinho, cards brancos com borda fina, Manrope.
// As chaves antigas (pink/bg) continuam: pink = cor primária (roxo escuro), bg = fundo off-white.
export const T = {
  bg: '#F7F3FA', card: '#FFFFFF', text: '#241B2E', dim: '#6B5F78', line: '#E6DCEE',
  pink: '#3E2A55', navy: '#3E2A55', navy2: '#5A3F72', champ: '#D0B0E0', champLight: '#EEE2F4', lilac: '#B58BC7', lilacDeep: '#7A5590',
  up: '#2E7D57', upLight: '#E6F1EA', down: '#8A2E3B', downLight: '#F4E6E8', neutralLight: '#EEE2F4',
  onDark: '#FFFFFF', onDarkDim: '#E3D6EC', upOnDark: '#9EE0BC', downOnDark: '#F2AEB8',
  purple: '#3E2A55', purpleDeep: '#FFFFFF',
};
export const F = { regular: 'Manrope_400Regular', semi: 'Manrope_600SemiBold', bold: 'Manrope_700Bold', black: 'Manrope_800ExtraBold' };
export const fontFor = (w?: string | number) => { const n = Number(w ?? 400) || (w === 'bold' ? 700 : 400); return n >= 800 ? F.black : n >= 700 ? F.bold : n >= 600 ? F.semi : F.regular; };
