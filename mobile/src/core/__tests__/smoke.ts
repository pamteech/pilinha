// Teste de rede real. Só imprime status, nunca valores.
import { cdiRates, stockQuote, cryptoBRL } from '..';
(async () => {
  const r = await cdiRates(new Date(Date.now() - 20 * 86400000), new Date()); console.log('BCB CDI:', r.length > 0 ? 'ok' : 'vazio');
  for (const t of ['BBAS3', 'MXRF11', 'PETR4']) { try { const q = await stockQuote(t, null); console.log(t, q.price > 0 ? `ok (${q.source})` : 'sem preço'); } catch (e) { console.log(t, 'ERRO', (e as Error).message); } }
  const c = await cryptoBRL(['bitcoin']); console.log('CoinGecko BTC:', c.bitcoin?.price > 0 ? 'ok' : 'falhou');
})();
