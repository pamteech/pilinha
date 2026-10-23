// IR regressivo + IOF (CDB, caixinhas, Tesouro). LCI/LCA isentas.
export function irRate(days: number): number {
  if (days < 181) return 0.225;
  if (days < 361) return 0.2;
  if (days < 721) return 0.175;
  return 0.15;
}
const IOF = [96, 93, 90, 86, 83, 80, 76, 73, 70, 66, 63, 60, 56, 53, 50, 46, 43, 40, 36, 33, 30, 26, 23, 20, 16, 13, 10, 6, 3];
export function iofRate(days: number): number {
  if (days < 1) return 1;
  return days < 30 ? IOF[days - 1] / 100 : 0;
}
export interface Breakdown { gross: number; iof: number; ir: number; net: number }
export function breakdown(principal: number, gross: number, days: number, exempt: boolean): Breakdown {
  const y = Math.max(0, gross - principal);
  if (exempt || y <= 0) return { gross, iof: 0, ir: 0, net: gross };
  const iof = y * iofRate(days), ir = (y - iof) * irRate(days);
  return { gross, iof, ir, net: gross - iof - ir };
}
