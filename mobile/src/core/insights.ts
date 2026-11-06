import { LineItem } from './engine';
import { HistoryPoint } from './history';
import { Mood } from './mood';

export const isMarket = (i: LineItem) => i.category === 'acao' || i.category === 'fii' || i.category === 'cripto';
/** Variação do dia em % de um item (null sem dado). */
export function itemDayPct(i: LineItem): number | null {
  if (i.dayChange == null) return null;
  const prev = i.current - i.dayChange;
  return prev > 0 ? (i.dayChange / prev) * 100 : null;
}
/** Cor da cotação frente ao preço médio: 'up' se >= PM, 'down' se abaixo, 'neutral' sem PM. */
export function priceVsAvg(i: Pick<LineItem, 'unitPrice' | 'avgPrice'>): 'up' | 'down' | 'neutral' {
  if (i.unitPrice == null || i.avgPrice == null || !(i.avgPrice > 0)) return 'neutral';
  return i.unitPrice >= i.avgPrice ? 'up' : 'down';
}
export interface Mover { name: string; category: string; pct: number }
/** Maiores altas e quedas do dia (só ações, FIIs e cripto). */
export function topMovers(items: LineItem[], n = 3): { up: Mover[]; down: Mover[] } {
  const all = items.filter(isMarket).map(i => ({ name: i.name, category: i.category, pct: itemDayPct(i) })).filter((m): m is Mover => m.pct != null);
  return {
    up: all.filter(m => m.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, n),
    down: all.filter(m => m.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, n),
  };
}
export type GroupKey = 'renda' | 'acoes' | 'cripto' | 'dolar';
export interface Group { key: GroupKey; title: string; total: number; items: LineItem[]; dayPct: number | null }
const groupOf = (c: string): GroupKey => (c === 'acao' || c === 'fii' ? 'acoes' : c === 'cripto' ? 'cripto' : c === 'dolar' ? 'dolar' : 'renda');
const titles: Record<GroupKey, string> = { renda: 'Renda fixa', acoes: 'Ações e FIIs', cripto: 'Cripto', dolar: 'Dólar' };
/** Agrupa a carteira em Renda fixa, Ações e FIIs, Cripto e Dólar (grupo próprio; grupos vazios somem). */
export function groupItems(items: LineItem[]): Group[] {
  return (['renda', 'acoes', 'cripto', 'dolar'] as GroupKey[]).map(key => {
    const it = items.filter(i => groupOf(i.category) === key);
    const w = it.filter(i => i.dayChange != null), d = w.reduce((a, i) => a + (i.dayChange as number), 0), prev = w.reduce((a, i) => a + i.current, 0) - d;
    return { key, title: titles[key], items: it, total: it.reduce((a, i) => a + i.current, 0), dayPct: w.length && prev > 0 ? (d / prev) * 100 : null };
  }).filter(g => g.items.length);
}
/** Últimos n dias do histórico (por data, não por quantidade de pontos). */
export function lastDays(h: HistoryPoint[], n = 7, now: Date = new Date()): HistoryPoint[] {
  const cut = new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);
  return h.filter(p => p.day > cut);
}
/** Ícone (MaterialCommunityIcons), tom e frase do humor do porquinho. */
export type MoodTone = 'up' | 'down' | 'neutral';
export function moodBadge(m: Mood): { icon: string; tone: MoodTone; text: string } {
  switch (m) {
    case 'feliz': case 'ganhou': return { icon: 'trending-up', tone: 'up', text: 'Dia positivo, oinc!' };
    case 'triste': return { icon: 'trending-down', tone: 'down', text: 'Dia no vermelho…' };
    case 'dormindo': return { icon: 'sync', tone: 'neutral', text: 'Buscando cotações…' };
    case 'erro': return { icon: 'alert-circle-outline', tone: 'down', text: 'Algo deu errado' };
    default: return { icon: 'trending-neutral', tone: 'neutral', text: 'Dia estável' };
  }
}
/** Busca com falha vira só um aviso discreto de "dados atrasados"; o texto técnico fica no detalhe (toque). */
export function staleInfo(errors: string[] | undefined): { stale: boolean; title: string; detail: string } {
  const e = errors ?? [];
  return { stale: e.length > 0, title: 'Dados atrasados', detail: e.length ? `Algumas cotações não chegaram agora (${e.length}). O Pilinvest mostra o último valor conhecido e tenta de novo sozinho.\n\n${e.join('\n')}` : '' };
}
/** Resumo da semana: a porcentagem é o rendimento (patrimônio/aplicado), então novos aportes não viram "alta".
 *  O valor é o ganho em reais no período, também sem contar aportes. O traço segue o rendimento quando escondido. */
export function weekSummary(points: { total: number; invested: number }[], hidden: boolean): { ys: number[]; pct: number | null; gain: number | null } {
  const ok = points.filter(p => Number.isFinite(p.total) && Number.isFinite(p.invested));
  const ratio = (p: { total: number; invested: number }) => (p.invested > 0 ? p.total / p.invested : null);
  const ys = ok.map(p => (hidden ? ratio(p) ?? 0 : p.total));
  if (ok.length < 2) return { ys, pct: null, gain: null };
  const a = ok[0], b = ok[ok.length - 1], ra = ratio(a), rb = ratio(b);
  const pct = ra != null && rb != null && ra > 0 ? (rb / ra - 1) * 100 : null;
  return { ys, pct, gain: (b.total - b.invested) - (a.total - a.invested) };
}

/**
 * Distribuição por tipo (landing: renda fixa, Tesouro, ações, FIIs, bitcoin; mais dólar). Ordem e cores fixas por
 * categoria, nunca pela posição: a cor segue o tipo mesmo quando algum deles não existe na carteira.
 * Paleta validada (OKLCH, daltonismo, contraste) pelo validador do skill de dataviz: a legenda com % e valor é o
 * canal de apoio para os tons claros (aqua, amarelo, magenta) sobre o card branco.
 */
export type AllocKey = 'renda' | 'tesouro' | 'acoes' | 'fiis' | 'bitcoin' | 'dolar';
export interface AllocSlice { key: AllocKey; title: string; color: string; total: number; pct: number }
export const ALLOC_ORDER: AllocKey[] = ['renda', 'tesouro', 'acoes', 'fiis', 'bitcoin', 'dolar'];
export const ALLOC_COLORS: Record<AllocKey, string> = { renda: '#6250d6', tesouro: '#eb6834', acoes: '#1baf7a', fiis: '#eda100', bitcoin: '#2a78d6', dolar: '#e87ba4' };
/** Mesmas cores em passos para fundo escuro (validadas sobre o card escuro). */
export const ALLOC_COLORS_DARK: Record<AllocKey, string> = { renda: '#9085e9', tesouro: '#d95926', acoes: '#199e70', fiis: '#c98500', bitcoin: '#3987e5', dolar: '#d55181' };
const ALLOC_TITLES: Record<AllocKey, string> = { renda: 'Renda fixa', tesouro: 'Tesouro', acoes: 'Ações', fiis: 'FIIs', bitcoin: 'Bitcoin', dolar: 'Dólar' };
const allocOf = (c: string): AllocKey => (c === 'tesouro' ? 'tesouro' : c === 'acao' ? 'acoes' : c === 'fii' ? 'fiis' : c === 'cripto' ? 'bitcoin' : c === 'dolar' ? 'dolar' : 'renda');
export function allocation(items: LineItem[], dark = false): AllocSlice[] {
  const colors = dark ? ALLOC_COLORS_DARK : ALLOC_COLORS;
  const sum = items.reduce((a, i) => a + Math.max(0, i.current), 0); if (!(sum > 0)) return [];
  return ALLOC_ORDER.flatMap(key => {
    const it = items.filter(i => allocOf(i.category) === key); const total = it.reduce((a, i) => a + Math.max(0, i.current), 0);
    if (!(total > 0)) return [];
    const title = key === 'bitcoin' && it.some(i => i.name.toUpperCase() !== 'BTC') ? 'Cripto' : ALLOC_TITLES[key];
    return [{ key, title, color: colors[key], total, pct: (total / sum) * 100 }];
  });
}
/** "45%" ou "7,5%" (sem sinal; abaixo de 10% com uma casa). */
export const sharePct = (p: number) => `${(p >= 10 || p === 0 ? p.toFixed(0) : p.toFixed(1)).replace('.', ',')}%`;
