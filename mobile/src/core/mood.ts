export type Mood = 'feliz' | 'neutro' | 'triste' | 'dormindo' | 'erro' | 'ganhou';
export const frameCount: Record<Mood, number> = { feliz: 24, erro: 24, neutro: 48, triste: 48, dormindo: 48, ganhou: 37 };
export const FPS = 24, HAPPY = 0.05, SAD = -0.05;
export function moodFrom(dayChangePct: number | null | undefined, loading: boolean, hasError: boolean): Mood {
  if (loading) return 'dormindo';
  if (hasError) return 'erro';
  if (dayChangePct == null) return 'neutro';
  if (dayChangePct > HAPPY) return 'feliz';
  if (dayChangePct < SAD) return 'triste';
  return 'neutro';
}
export function shouldCelebrate(prev: number | null | undefined, next: number, dayChangePct: number | null | undefined) {
  if (prev == null || dayChangePct == null) return false;
  return next > prev + 0.005 && dayChangePct > HAPPY;
}
