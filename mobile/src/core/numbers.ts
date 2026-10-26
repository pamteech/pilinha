import { parseISO, toISO } from './dates';
/**
 * Número digitado no iPhone. Aceita "1.234,56", "0,0015", "1234.5", "0.0015" e "1.500" (mil e quinhentos).
 * Antes, "0.0015" virava 15 (o ponto era apagado como milhar).
 */
export function parseNumberBR(input: string): number {
  let s = (input ?? '').trim().replace(/\s|R\$/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else {
    const dots = (s.match(/\./g) ?? []).length;
    if (dots > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}
export const isPositive = (n: number) => Number.isFinite(n) && n > 0;
/** Data AAAA-MM-DD válida (rejeita 2026-02-31) e não futura. */
export function validPastDate(s: string, now: Date = new Date()): boolean {
  const d = parseISO(s);
  return !!d && s.trim() <= toISO(now);
}
export const normTicker = (t: string) => t.trim().toUpperCase().replace(/\.SA$/, '');
export const validTicker = (t: string) => /^[A-Z]{4}\d{1,2}F?$/.test(normTicker(t));
/** Contador de "só o mais recente vale" para refreshes concorrentes. */
export function latestGate() { let n = 0; return { next: () => ++n, isLatest: (id: number) => id === n }; }
