// Linguagem visual do Lastro: navy + champagne sobre off-white, cards brancos com borda fina, Manrope.
// As chaves antigas (pink/bg) continuam: pink = cor primária (navy), bg = fundo off-white.
export const T = {
  bg: '#F6F5F1', card: '#FFFFFF', text: '#1E232B', dim: '#636B78', line: '#E3E1DA',
  pink: '#0B1F3A', navy: '#0B1F3A', navy2: '#132B4F', champ: '#B7975A', champLight: '#F3ECDF',
  up: '#2E7D57', upLight: '#E6F1EA', down: '#8A2E3B', downLight: '#F4E6E8', neutralLight: '#E9EEF3',
  purple: '#0B1F3A', purpleDeep: '#FFFFFF',
};
export const F = { regular: 'Manrope_400Regular', semi: 'Manrope_600SemiBold', bold: 'Manrope_700Bold', black: 'Manrope_800ExtraBold' };
export const fontFor = (w?: string | number) => { const n = Number(w ?? 400) || (w === 'bold' ? 700 : 400); return n >= 800 ? F.black : n >= 700 ? F.bold : n >= 600 ? F.semi : F.regular; };
