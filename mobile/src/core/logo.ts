import { KV } from './cache';
import { normTicker } from './numbers';

/**
 * Logos públicos dos tickers da B3 (SVG), sem chave.
 * Só o código do papel sai do aparelho — o mesmo padrão das cotações; nada da carteira.
 * A API /api/quote da brapi pede token e não é usada aqui.
 */
export const LOGO_BASE = 'https://icons.brapi.dev/icons';
export const LOGO_TTL_MS = 30 * 24 * 3600_000;
export const logoCacheKey = (ticker: string) => `pilinha.logo.v1.${normTicker(ticker)}`;

/** Papel da B3 para logo: 4 caracteres (pode ter número, ex. B3SA3) + dígitos do tipo + F opcional. */
export const isLogoTicker = (t: string) => /^[A-Z0-9]{4}\d{1,2}F?$/.test(normTicker(t));

export function logoUrl(ticker: string): string | null {
  const t = normTicker(ticker);
  return isLogoTicker(t) ? `${LOGO_BASE}/${t}.svg` : null;
}

/** Garante viewBox e fill em atributo, para o react-native-svg escalar e pintar no iPhone. */
export function normalizeLogoSvg(xml: string): string {
  let s = xml.trim();
  s = s.replace(/\sstyle=(["'])fill:\s*([^;"']+)\1/gi, ' fill="$2"');
  if (!/\bviewBox=/i.test(s)) s = s.replace(/<svg\b/i, '<svg viewBox="0 0 56 56"');
  return s;
}

/** 200 com <svg> vale; 404, HTML de erro ou corpo vazio caem no ícone do tipo. */
export function parseLogoBody(status: number, body: string): string | null {
  if (status !== 200 || typeof body !== 'string') return null;
  const s = body.trim();
  if (!s || /<!DOCTYPE|<html/i.test(s) || !/<svg[\s>]/i.test(s)) return null;
  return normalizeLogoSvg(s);
}

export type LogoFetcher = (url: string) => Promise<{ status: number; body: string }>;
export type LogoResult = { ok: true; xml: string } | { ok: false };

const MEM_OK = new Map<string, string>();
const MEM_MISS = new Set<string>();
const INFLIGHT = new Map<string, Promise<LogoResult>>();

/** Cache em memória: o XML, 'miss' (404 confirmado) ou null (ainda não tentou). */
export function peekLogo(ticker: string): string | 'miss' | null {
  const t = normTicker(ticker);
  if (MEM_MISS.has(t)) return 'miss';
  return MEM_OK.get(t) ?? null;
}

export function resetLogoCache() { MEM_OK.clear(); MEM_MISS.clear(); INFLIGHT.clear(); }

export async function defaultLogoFetch(url: string): Promise<{ status: number; body: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const r = await fetch(url, { headers: { Accept: 'image/svg+xml' }, signal: ctl.signal });
    return { status: r.status, body: await r.text() };
  } finally { clearTimeout(t); }
}

/**
 * Busca o SVG do logo. Fallback imediato é responsabilidade da tela (mostra o ícone do tipo
 * enquanto isto roda). Acerto vai para memória e disco; 404 fica só na memória da sessão.
 * Sem internet, reaproveita o disco mesmo vencido.
 */
export async function loadLogo(ticker: string, fetchLogo: LogoFetcher, kv?: KV, now = Date.now()): Promise<LogoResult> {
  const url = logoUrl(ticker);
  if (!url) return { ok: false };
  const t = normTicker(ticker);
  if (MEM_OK.has(t)) return { ok: true, xml: MEM_OK.get(t)! };
  if (MEM_MISS.has(t)) return { ok: false };
  const pending = INFLIGHT.get(t);
  if (pending) return pending;

  const job = (async (): Promise<LogoResult> => {
    const key = logoCacheKey(t);
    const readDisk = async (): Promise<{ at: number; xml: string } | null> => {
      if (!kv) return null;
      try {
        const j = JSON.parse((await kv.get(key)) ?? 'null');
        return j && typeof j.xml === 'string' && j.xml && typeof j.at === 'number' ? j : null;
      } catch { return null; }
    };
    const disk = await readDisk();
    if (disk && now - disk.at < LOGO_TTL_MS) {
      MEM_OK.set(t, disk.xml);
      return { ok: true, xml: disk.xml };
    }
    try {
      const r = await fetchLogo(url);
      const xml = parseLogoBody(r.status, r.body);
      if (xml) {
        MEM_OK.set(t, xml);
        await kv?.set(key, JSON.stringify({ at: now, xml })).catch(() => {});
        return { ok: true, xml };
      }
      if (disk) { MEM_OK.set(t, disk.xml); return { ok: true, xml: disk.xml }; }
      MEM_MISS.add(t);
      return { ok: false };
    } catch {
      if (disk) { MEM_OK.set(t, disk.xml); return { ok: true, xml: disk.xml }; }
      return { ok: false };
    }
  })();
  INFLIGHT.set(t, job);
  try { return await job; } finally { INFLIGHT.delete(t); }
}
