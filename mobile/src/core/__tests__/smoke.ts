// Teste de rede real. Só imprime status, nunca valores.
import { cdiRates, stockQuote, cryptoBRL, parseRSS, pickUsdNews, usdNewsURL, usdQuote } from '..';
(async () => {
  const r = await cdiRates(new Date(Date.now() - 20 * 86400000), new Date()); console.log('BCB CDI:', r.length > 0 ? 'ok' : 'vazio');
  for (const t of ['BBAS3', 'MXRF11', 'PETR4']) { try { const q = await stockQuote(t, null); console.log(t, q.price > 0 ? `ok (${q.source})` : 'sem preço'); } catch (e) { console.log(t, 'ERRO', (e as Error).message); } }
  const c = await cryptoBRL(['bitcoin']); console.log('CoinGecko BTC:', c.bitcoin?.price > 0 ? 'ok' : 'falhou');
  try { const u = await usdQuote(); console.log('Dólar:', u.bid > 0 ? `ok (${u.source})` : 'sem preço'); } catch (e) { console.log('Dólar ERRO', (e as Error).message); }
  try { const r = await fetch(usdNewsURL()); const items = parseRSS(await r.text()); console.log('Google Notícias RSS:', r.ok ? `ok (${items.length} manchetes; queda: ${pickUsdNews(items, 'down') ? 'achou' : 'nenhuma'}; alta: ${pickUsdNews(items, 'up') ? 'achou' : 'nenhuma'})` : `HTTP ${r.status}`); } catch (e) { console.log('Google Notícias ERRO', (e as Error).message); }
})();
