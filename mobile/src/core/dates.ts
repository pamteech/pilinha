// Datas "yyyy-MM-dd" tratadas como meia-noite de Brasília (UTC-3, sem horário de verão desde 2019).
const OFFSET = 3 * 3600_000;
export function parseISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.slice(0, 10));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], t = Date.UTC(y, mo - 1, d);
  const x = new Date(t); if (x.getUTCFullYear() !== y || x.getUTCMonth() !== mo - 1 || x.getUTCDate() !== d) return null; // ex.: 2026-02-31
  return new Date(t + OFFSET);
}
export function parseBR(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? parseISO(`${m[3]}-${m[2]}-${m[1]}`) : null;
}
const parts = (d: Date) => { const x = new Date(d.getTime() - OFFSET); return [x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()]; };
const p2 = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => { const [y, m, dd] = parts(d); return `${y}-${p2(m)}-${p2(dd)}`; };
export const toBR = (d: Date) => { const [y, m, dd] = parts(d); return `${p2(dd)}/${p2(m)}/${y}`; };
export function daysBetween(a: Date, b: Date): number {
  return Math.round((parseISO(toISO(b))!.getTime() - parseISO(toISO(a))!.getTime()) / 86_400_000);
}

/** Data segura para o calendário nativo do iPhone: sempre uma Date válida, dentro de [min, max]; min/max inválidos ou invertidos são ignorados. */
export function pickerBounds(value?: string, min?: string, max?: string): { value: Date; min?: Date; max?: Date } {
  const at = (iso?: string) => { const d = typeof iso === 'string' && iso ? parseISO(iso) : null; return d && Number.isFinite(d.getTime()) ? new Date(d.getTime() + 12 * 3600_000) : undefined; };
  let lo = at(min), hi = at(max); if (lo && hi && lo.getTime() > hi.getTime()) { lo = undefined; hi = undefined; }
  let v = at(value) ?? new Date(); if (!Number.isFinite(v.getTime())) v = new Date();
  if (hi && v.getTime() > hi.getTime()) v = hi;
  if (lo && v.getTime() < lo.getTime()) v = lo;
  return { value: v, ...(lo ? { min: lo } : {}), ...(hi ? { max: hi } : {}) };
}
