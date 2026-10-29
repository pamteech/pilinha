import { deriveKeys, decryptPortfolioJSON, mergePortfolio, parsePortfolio, Portfolio, SYNC_URL } from '../core';
export type SyncResult = { kind: 'ok'; portfolio: Portfolio; items: number; updatedAt: number | null } | { kind: 'waiting' } | { kind: 'error'; message: string };
/** Baixa a carteira cifrada que o Mac enviou, decifra aqui e junta com a do iPhone (Mac vence no mesmo ativo). */
export async function pullFromMac(code: string, phone: Portfolio): Promise<SyncResult> {
  try {
    const { id } = deriveKeys(code);
    const r = await fetch(`${SYNC_URL}/v1/sync/${id}`, { headers: { 'cache-control': 'no-store' } });
    if (r.status === 404) return { kind: 'waiting' };
    if (!r.ok) return { kind: 'error', message: `Servidor respondeu ${r.status}.` };
    const blob = new Uint8Array(await r.arrayBuffer());
    let json: string;
    try { json = decryptPortfolioJSON(code, blob); } catch { return { kind: 'error', message: 'Não deu para abrir os dados do Mac. Confira o código.' }; }
    const mac = parsePortfolio(json);
    const t = Number(r.headers.get('x-updated-at')); 
    return { kind: 'ok', portfolio: mergePortfolio(phone, mac), items: mac.stocks.length + mac.crypto.length + mac.fixedIncome.length, updatedAt: t > 0 ? t : null };
  } catch (e) { return { kind: 'error', message: (e as Error).message || 'Sem internet.' }; }
}
/** Lê o código de um link pilinha://sync?code=XXXX-XXXX-XXXX-XXXX (QR do Mac). */
export function codeFromURL(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/^pilinha:\/\/+sync\?(?:.*&)?code=([A-Za-z0-9-]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
