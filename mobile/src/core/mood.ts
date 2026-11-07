export type Mood = 'feliz' | 'neutro' | 'triste' | 'dormindo' | 'erro' | 'ganhou' | 'preocupado' | 'apaixonado' | 'pensando' | 'rico' | 'surpreso' | 'chorando';
export const MOODS: Mood[] = ['feliz', 'neutro', 'triste', 'dormindo', 'erro', 'ganhou', 'preocupado', 'apaixonado', 'pensando', 'rico', 'surpreso', 'chorando'];
export const frameCount: Record<Mood, number> = { feliz: 24, erro: 24, neutro: 24, triste: 24, dormindo: 24, ganhou: 37, preocupado: 24, apaixonado: 24, pensando: 24, rico: 24, surpreso: 24, chorando: 24 };
/** Loops lentos (respirar, balançar) rodam a 12 fps; os rápidos (pulo, susto) a 24. Tem que bater com personagem/opcao2d/gera_folhas.py. */
export const moodFps = (m: Mood) => (m === 'feliz' || m === 'erro' || m === 'ganhou' || m === 'rico' || m === 'surpreso' ? 24 : 12);
export const FPS = 24, HAPPY = 0.05, SAD = -0.05, BIG = 2;
/** Folhas de animação em grade (personagem/opcao2d/gera_folhas.py): quadros de 384 px, 8 por linha. */
export const SHEET_COLS = 8, SHEET_FRAME = 384;
export const sheetRows = (m: Mood) => Math.ceil(frameCount[m] / SHEET_COLS);
/** O que mais, além da variação do dia, muda o humor. Tudo opcional: sem contexto vale a regra antiga. */
export interface MoodContext {
  /** há carteira na tela (erro parcial vira "preocupado"; sem nada vira "erro") */ hasData?: boolean;
  /** meta do cofrinho batida */ goalReached?: boolean;
  /** caiu provento hoje */ dividendToday?: boolean;
  /** pregão aberto (false = noite/fim de semana: dorme quando está parado) */ marketOpen?: boolean;
}
/**
 * Humor do porquinho, do mais urgente para o mais calmo: carregando (pensando), sem dados (erro) ou cotações atrasadas (preocupado),
 * meta batida (rico), provento hoje (apaixonado), dia forte (surpreso / chorando a partir de ±2%), dia bom/ruim (feliz / triste),
 * parado fora do pregão (dormindo) ou parado (neutro).
 */
export function moodFrom(dayChangePct: number | null | undefined, loading: boolean, hasError: boolean, ctx?: MoodContext): Mood {
  if (loading) return 'pensando';
  if (hasError) return ctx?.hasData ? 'preocupado' : 'erro';
  if (ctx?.goalReached) return 'rico';
  if (ctx?.dividendToday) return 'apaixonado';
  if (dayChangePct == null) return 'neutro';
  if (dayChangePct >= BIG) return 'surpreso';
  if (dayChangePct <= -BIG) return 'chorando';
  if (dayChangePct > HAPPY) return 'feliz';
  if (dayChangePct < SAD) return 'triste';
  return ctx?.marketOpen === false ? 'dormindo' : 'neutro';
}
/** Widget e Ilha Dinâmica só têm os seis humores originais: o mais parecido. */
export const baseMood = (m: Mood): 'feliz' | 'neutro' | 'triste' | 'dormindo' | 'erro' | 'ganhou' =>
  m === 'preocupado' || m === 'chorando' ? 'triste' : m === 'apaixonado' || m === 'surpreso' ? 'feliz' : m === 'pensando' ? 'dormindo' : m === 'rico' ? 'ganhou' : m;
/** Caiu provento hoje? (pagamentos da internet com a quantidade atual, ou lançamento manual de hoje) */
export function dividendToday(cash: { ticker: string; paymentDate: Date }[] | undefined, manual: { date: string }[] | undefined, held: string[], today: string): boolean {
  const mine = new Set(held.map(t => t.toUpperCase()));
  if ((manual ?? []).some(m => m.date.slice(0, 10) === today)) return true;
  return (cash ?? []).some(c => mine.has(c.ticker.toUpperCase()) && new Date(c.paymentDate.getTime() - 3 * 3600_000).toISOString().slice(0, 10) === today);
}
export function shouldCelebrate(prev: number | null | undefined, next: number, dayChangePct: number | null | undefined) {
  if (prev == null || dayChangePct == null) return false;
  return next > prev + 0.005 && dayChangePct > HAPPY;
}
