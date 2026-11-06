import { parseISO, toISO } from './dates';
import { brl, pct } from './format';
/**
 * Dólar fechou em queda → aviso com a notícia do porquê (ex. "Dólar fecha em queda com derrota de Trump no Senado").
 * As manchetes vêm do RSS público do Google Notícias com uma busca FIXA ("dólar hoje"): nada da carteira sai do aparelho.
 * O link abre a matéria no navegador; o Pilinvest não lê nem guarda o conteúdo.
 */
export const GNEWS_HOST = 'news.google.com';
const GN_Q = 'dólar hoje';
export const usdNewsURL = (when = '1d') => `https://${GNEWS_HOST}/rss/search?q=${encodeURIComponent(`${GN_Q} when:${when}`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
/** Página de busca (abre no navegador) quando nenhuma manchete serviu. */
export const usdNewsPageURL = `https://${GNEWS_HOST}/search?q=${encodeURIComponent(GN_Q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

export interface NewsItem { title: string; link: string; source: string | null; publishedAt: Date | null }
export type UsdDirection = 'down' | 'up';
/** Aviso do fechamento do dólar (Alertas): todo dia útil, caiu ou subiu; `onlyDrops` limita às quedas. */
export interface UsdAlert { enabled: boolean; onlyDrops?: boolean; /** antigo (build 23/24): queda mínima em %; ignorado */ minDropPct?: number }
export const defaultUsdAlert = (): UsdAlert => ({ enabled: true, onlyDrops: false });
/** Hora do lembrete local (Brasília): o dólar comercial fecha às 17h. */
export const USD_CLOSE_HOUR = 17, USD_CLOSE_MINUTE = 10;

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
const tag = (block: string, name: string): string | null => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i').exec(block); if (!m) return null;
  const raw = m[1].trim(), cd = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw);
  const strip = (x: string) => x.replace(/<[^>]+>/g, '');
  return strip(decodeEntities(strip(cd ? cd[1] : raw))).replace(/\s+/g, ' ').trim(); // HTML escapado dentro do texto também sai
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Lê um RSS 2.0 (Google Notícias e similares) sem depender de parser XML nativo. Itens sem título ou link são ignorados. */
export function parseRSS(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of String(xml ?? '').matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const b = m[1]; let title = tag(b, 'title'), link = tag(b, 'link'); const source = tag(b, 'source');
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    // O Google põe " - Fonte" no fim do título.
    if (source) title = title.replace(new RegExp(`\\s+-\\s+${escapeRe(source)}$`, 'i'), '').trim();
    else { const i = title.lastIndexOf(' - '); if (i > 10) title = title.slice(0, i).trim(); }
    const d = tag(b, 'pubDate'); const t = d ? new Date(d) : null;
    out.push({ title, link, source, publishedAt: t && Number.isFinite(t.getTime()) ? t : null });
  }
  return out;
}
const DOWN = /\b(queda|cai|caiu|recua|recuou|cede|cedeu|desvaloriza|despenca|despencou|baixa|perde força|em baixa|devolve)\b/i;
const UP = /\b(alta|sobe|subiu|avan[cç]a|avan[cç]ou|dispara|disparou|valoriza|ganha força|em alta|salta|saltou)\b/i;
const CLOSE = /\b(fecha|fechou|fechamento|encerra|encerrou|termina|terminou)\b/i;
const NOISE = /\b(turismo|euro hoje|bitcoin|previs[aã]o para|como investir|o que [eé]|hor[oó]scopo)\b/i;
/** Pontua a manchete para a direção pedida; null = não serve (fala de alta quando caiu, não é sobre dólar, etc.). */
export function scoreUsdNews(n: NewsItem, dir: UsdDirection, now: Date): number | null {
  const t = n.title; if (!/d[oó]lar/i.test(t) || NOISE.test(t)) return null;
  const same = (dir === 'down' ? DOWN : UP).test(t), other = (dir === 'down' ? UP : DOWN).test(t);
  if (other && !same) return null;
  let s = same ? 3 : 0;
  if (CLOSE.test(t)) s += 2;
  if (/\b(com|ap[oó]s|por|em meio|diante|de olho|em dia de|reflet|repercut|press)/i.test(t)) s += 1; // tem o motivo
  if (n.publishedAt) {
    const age = (now.getTime() - n.publishedAt.getTime()) / 3600_000;
    if (age > 36 || age < -2) return null; // velha demais (ou relógio errado)
    if (toISO(n.publishedAt) === toISO(now)) s += 1;
    s += Math.max(0, 1 - age / 24); // mais recente, melhor (desempate)
  }
  return s;
}
/** A manchete que melhor explica a queda (ou a alta) do dólar; null se nenhuma serve. */
export function pickUsdNews(items: NewsItem[], dir: UsdDirection, now = new Date()): NewsItem | null {
  let best: { n: NewsItem; s: number } | null = null;
  for (const n of items) { const s = scoreUsdNews(n, dir, now); if (s != null && s > 0 && (!best || s > best.s)) best = { n, s }; }
  return best?.n ?? null;
}

// Fechamento do dólar comercial: ~17h de Brasília, dias úteis (sem feriados: dia sem pregão a cotação não muda e não há queda).
const bsb = (now: Date) => new Date(now.getTime() - 3 * 3600_000);
const weekday = (d: Date) => { const w = d.getUTCDay(); return w >= 1 && w <= 5; };
/**
 * Dia (AAAA-MM-DD) da sessão cujo fechamento esta cotação representa, ou null fora da janela:
 * das 17h às 23h59 é o dia de hoje; da 0h às 8h59 ainda vale o fechamento de ontem (a cotação não muda de noite).
 */
export function usdSessionDay(now: Date): string | null {
  const b = bsb(now), h = b.getUTCHours();
  if (h >= 17 && weekday(b)) return toISO(now);
  if (h < 9) { const y = new Date(b.getTime() - 86400_000); if (weekday(y)) return toISO(new Date(now.getTime() - 86400_000)); }
  return null;
}
/** Direção do dia: abaixo de 0,01% em módulo conta como estável. */
export const usdDirection = (changePct: number): UsdDirection | 'flat' => (changePct <= -0.01 ? 'down' : changePct >= 0.01 ? 'up' : 'flat');
/**
 * Dia da sessão a avisar, ou null: aviso ligado, cotação com variação do dia, depois do fechamento e ainda não avisado.
 * Com `onlyDrops`, só quando caiu.
 */
export function usdCloseDue(q: { changePct: number | null | undefined }, cfg: UsdAlert, firedDay: string | null | undefined, now = new Date()): string | null {
  if (!cfg?.enabled || q.changePct == null || !Number.isFinite(q.changePct)) return null;
  if (cfg.onlyDrops && usdDirection(q.changePct) !== 'down') return null;
  const day = usdSessionDay(now); if (!day || firedDay === day) return null;
  return day;
}
export interface UsdNotification { title: string; body: string; url: string }
/** Texto do aviso. Ex.: "Dólar fechou em queda (−0,82%)" / "R$ 5,32 · Possível motivo: Dólar cai com derrota de Trump no Senado (InfoMoney). Toque para ler." */
export function usdNotification(q: { bid: number | null | undefined; changePct: number | null | undefined }, news: NewsItem | null): UsdNotification {
  const px = q.bid != null ? brl(q.bid) : null, dir = q.changePct != null ? usdDirection(q.changePct) : 'flat';
  const title = `Dólar fechou ${dir === 'down' ? 'em queda' : dir === 'up' ? 'em alta' : 'estável'} (${pct(q.changePct).replace('-', '−')})`;
  const body = news && dir !== 'flat'
    ? `${px ? `${px} · ` : ''}Possível motivo: ${news.title}${news.source ? ` (${news.source})` : ''}. Toque para ler.`
    : `${px ? `${px} · ` : ''}Toque para ver as notícias do dia.`;
  return { title, body, url: news?.link ?? usdNewsPageURL };
}
/** Lembrete genérico agendado no iPhone (vale mesmo com o app fechado); o app troca pelo completo quando consegue buscar o fechamento antes. */
export const USD_REMINDER_PREFIX = 'usd-close-';
export const usdReminder = (day: string) => ({ id: `${USD_REMINDER_PREFIX}${day}`, title: 'Dólar fechou hoje', body: 'Toque para ver a cotação de fechamento e o motivo.' });
/** Instante do lembrete do dia (17h10 de Brasília), para um AAAA-MM-DD. */
export const usdReminderTime = (day: string) => new Date(parseISO(day)!.getTime() + (USD_CLOSE_HOUR * 60 + USD_CLOSE_MINUTE) * 60_000);
/** Próximos `count` dias úteis cujo lembrete ainda está no futuro (hoje incluído se ainda não deu 17h10). */
export function usdCloseSchedule(now: Date, count = 10): { day: string; date: Date }[] {
  const out: { day: string; date: Date }[] = [];
  for (let i = 0; out.length < count && i < count * 2 + 7; i++) {
    const d = new Date(now.getTime() + i * 86400_000), b = bsb(d);
    if (!weekday(b)) continue;
    const day = toISO(d), date = usdReminderTime(day);
    if (date.getTime() > now.getTime()) out.push({ day, date });
  }
  return out;
}
/** Título do card do Início. */
export const usdNewsTitle = (dir: UsdDirection) => (dir === 'down' ? 'Por que o dólar caiu hoje' : 'Por que o dólar subiu hoje');
/** Só links https saem para o navegador (o RSS é conteúdo externo). */
export const safeNewsLink = (u: unknown): string | null => (typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u) ? u : null);
