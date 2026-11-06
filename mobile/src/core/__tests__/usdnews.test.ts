import { NewsItem, decodeEntities, defaultUsdAlert, parseRSS, pickUsdNews, safeNewsLink, usdCloseDue, usdCloseSchedule, usdDirection, usdNewsPageURL, usdNewsURL, usdNotification, usdReminder, usdReminderTime, usdSessionDay } from '..';
// Aviso "dólar fechou em queda" com a manchete do motivo. RSS de exemplo no formato do Google Notícias (dados fictícios).
const item = (title: string, src: string, pub: string, link = 'https://news.google.com/rss/articles/CBMiAbc?oc=5') =>
  `<item><title>${title} - ${src}</title><link>${link}</link><guid isPermaLink="false">x</guid><pubDate>${pub}</pubDate><description>&lt;a href="${link}"&gt;${title}&lt;/a&gt;</description><source url="https://exemplo.com">${src}</source></item>`;
const NOW = new Date('2026-11-05T20:30:00Z'); // 17h30 de Brasília, quinta
const xml = `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0"><channel><title>"dólar hoje" - Google Notícias</title>
${item('Dólar fecha em queda de 0,8% com derrota de Trump no Senado', 'InfoMoney', 'Thu, 05 Nov 2026 20:05:00 GMT')}
${item('Dólar sobe e Ibovespa cai com tensão fiscal', 'Valor Econômico', 'Thu, 05 Nov 2026 14:00:00 GMT')}
${item('Dólar turismo: onde comprar mais barato', 'Portal X', 'Thu, 05 Nov 2026 12:00:00 GMT')}
${item('Dólar cai pelo 3º dia após dados de inflação nos EUA', 'G1', 'Wed, 04 Nov 2026 21:00:00 GMT')}
<item><title><![CDATA[Bolsa &amp; c&#226;mbio: d&#xF3;lar recua &lt;b&gt;forte&lt;/b&gt; - CNN Brasil]]></title><link>https://news.google.com/rss/articles/CBMiXyz?oc=5</link><pubDate>Thu, 05 Nov 2026 20:10:00 GMT</pubDate><source url="https://cnnbrasil.com.br">CNN Brasil</source></item>
<item><title>Sem link</title><pubDate>Thu, 05 Nov 2026 20:10:00 GMT</pubDate></item>
<item><title>Link estranho</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

test('parseRSS lê título, fonte, data e link (CDATA, entidades, " - Fonte" fora)', () => {
  const it = parseRSS(xml);
  expect(it).toHaveLength(5);
  expect(it[0]).toMatchObject({ title: 'Dólar fecha em queda de 0,8% com derrota de Trump no Senado', source: 'InfoMoney', link: 'https://news.google.com/rss/articles/CBMiAbc?oc=5' });
  expect(it[0].publishedAt?.toISOString()).toBe('2026-11-05T20:05:00.000Z');
  expect(it[4].title).toBe('Bolsa & câmbio: dólar recua forte'); expect(it[4].source).toBe('CNN Brasil');
  expect(parseRSS('')).toEqual([]); expect(parseRSS('<html>erro 502</html>')).toEqual([]);
  expect(decodeEntities('a &amp; b &lt;c&gt; &#39;d&#39; &#x41;')).toBe("a & b <c> 'd' A");
});
test('escolhe a manchete que explica a queda (não a da alta, nem turismo, nem a de ontem)', () => {
  const n = pickUsdNews(parseRSS(xml), 'down', NOW)!;
  expect(n.title).toBe('Dólar fecha em queda de 0,8% com derrota de Trump no Senado');
  expect(pickUsdNews(parseRSS(xml), 'up', NOW)?.title).toBe('Dólar sobe e Ibovespa cai com tensão fiscal');
  // só a de ontem: velha demais (> 36 h) não serve; de ontem à noite ainda serve
  const old: NewsItem[] = [{ title: 'Dólar cai com alívio externo', link: 'https://x.y/z', source: 'A', publishedAt: new Date('2026-11-03T20:00:00Z') }];
  expect(pickUsdNews(old, 'down', NOW)).toBeNull();
  expect(pickUsdNews([{ ...old[0], publishedAt: new Date('2026-11-04T21:00:00Z') }], 'down', NOW)?.title).toBe('Dólar cai com alívio externo');
  expect(pickUsdNews([], 'down', NOW)).toBeNull();
  expect(pickUsdNews([{ title: 'Ibovespa fecha em alta', link: 'https://x.y/z', source: null, publishedAt: null }], 'down', NOW)).toBeNull();
});
test('janela do fechamento: 17h–23h59 vale hoje; 0h–8h59 vale ontem; pregão aberto e fim de semana não', () => {
  expect(usdSessionDay(new Date('2026-11-05T20:30:00Z'))).toBe('2026-11-05'); // qui 17h30
  expect(usdSessionDay(new Date('2026-11-06T02:59:00Z'))).toBe('2026-11-05'); // qui 23h59
  expect(usdSessionDay(new Date('2026-11-06T10:00:00Z'))).toBe('2026-11-05'); // sex 7h → fechamento de quinta
  expect(usdSessionDay(new Date('2026-11-05T15:00:00Z'))).toBeNull(); // qui 12h, aberto
  expect(usdSessionDay(new Date('2026-11-07T13:00:00Z'))).toBeNull(); // sáb 10h
  expect(usdSessionDay(new Date('2026-11-07T05:00:00Z'))).toBe('2026-11-06'); // sáb 2h → fechamento de sexta
  expect(usdSessionDay(new Date('2026-11-09T05:00:00Z'))).toBeNull(); // seg 2h → "ontem" é domingo
});
test('usdCloseDue: ligado, depois do fechamento, uma vez por sessão, alta ou queda; "só quedas" opcional', () => {
  const cfg = defaultUsdAlert(); expect(cfg).toEqual({ enabled: true, onlyDrops: false });
  expect(usdCloseDue({ changePct: -0.8 }, cfg, null, NOW)).toBe('2026-11-05');
  expect(usdCloseDue({ changePct: 0.3 }, cfg, null, NOW)).toBe('2026-11-05'); // subiu: avisa também
  expect(usdCloseDue({ changePct: 0 }, cfg, null, NOW)).toBe('2026-11-05'); // estável: avisa
  expect(usdCloseDue({ changePct: -0.8 }, cfg, '2026-11-05', NOW)).toBeNull(); // já avisou
  expect(usdCloseDue({ changePct: -0.8 }, cfg, '2026-11-04', NOW)).toBe('2026-11-05');
  expect(usdCloseDue({ changePct: null }, cfg, null, NOW)).toBeNull();
  expect(usdCloseDue({ changePct: -0.8 }, { enabled: false }, null, NOW)).toBeNull();
  expect(usdCloseDue({ changePct: 0.3 }, { enabled: true, onlyDrops: true }, null, NOW)).toBeNull(); // só quedas
  expect(usdCloseDue({ changePct: -0.3 }, { enabled: true, onlyDrops: true }, null, NOW)).toBe('2026-11-05');
  expect(usdCloseDue({ changePct: -0.8 }, cfg, null, new Date('2026-11-05T15:00:00Z'))).toBeNull(); // meio-dia
  // ajuste antigo (build 23/24) ainda abre
  expect(usdCloseDue({ changePct: 0.5 }, { enabled: true, minDropPct: 1 } as any, null, NOW)).toBe('2026-11-05');
  expect(usdDirection(-0.5)).toBe('down'); expect(usdDirection(0.004)).toBe('flat'); expect(usdDirection(0.2)).toBe('up');
});
test('lembretes locais: 17h10 de Brasília nos próximos dias úteis, hoje só se ainda não passou', () => {
  const s = usdCloseSchedule(new Date('2026-11-05T15:00:00Z'), 3); // qui 12h
  expect(s.map(x => x.day)).toEqual(['2026-11-05', '2026-11-06', '2026-11-09']); // qui, sex, seg
  expect(s[0].date.toISOString()).toBe('2026-11-05T20:10:00.000Z');
  expect(usdCloseSchedule(new Date('2026-11-05T20:30:00Z'), 2).map(x => x.day)).toEqual(['2026-11-06', '2026-11-09']); // qui 17h30: hoje já passou
  expect(usdCloseSchedule(new Date('2026-11-07T13:00:00Z'), 10)).toHaveLength(10); // sábado: 10 dias úteis à frente
  expect(usdReminder('2026-11-06')).toEqual({ id: 'usd-close-2026-11-06', title: 'Dólar fechou hoje', body: 'Toque para ver a cotação de fechamento e o motivo.' });
  expect(usdReminderTime('2026-11-06').toISOString()).toBe('2026-11-06T20:10:00.000Z');
});
test('texto do aviso com e sem notícia; só https vai para o navegador', () => {
  const n = usdNotification({ bid: 5.3212, changePct: -0.82 }, parseRSS(xml)[0]);
  expect(n.title).toBe('Dólar fechou em queda (−0,82%)');
  expect(usdNotification({ bid: 5.5, changePct: 0.41 }, parseRSS(xml)[1]).title).toBe('Dólar fechou em alta (+0,41%)');
  expect(usdNotification({ bid: 5.5, changePct: 0.41 }, parseRSS(xml)[1]).body).toContain('Possível motivo: Dólar sobe e Ibovespa cai');
  expect(usdNotification({ bid: 5.5, changePct: 0 }, parseRSS(xml)[0]).title).toBe('Dólar fechou estável (+0,00%)');
  expect(usdNotification({ bid: 5.5, changePct: 0 }, parseRSS(xml)[0]).body).toBe('R$ 5,50 · Toque para ver as notícias do dia.');
  expect(n.body).toBe('R$ 5,32 · Possível motivo: Dólar fecha em queda de 0,8% com derrota de Trump no Senado (InfoMoney). Toque para ler.');
  expect(n.url).toBe('https://news.google.com/rss/articles/CBMiAbc?oc=5');
  const s = usdNotification({ bid: 5.3212, changePct: -0.5 }, null);
  expect(s.body).toBe('R$ 5,32 · Toque para ver as notícias do dia.'); expect(s.url).toBe(usdNewsPageURL);
  expect(usdNewsURL()).toBe('https://news.google.com/rss/search?q=d%C3%B3lar%20hoje%20when%3A1d&hl=pt-BR&gl=BR&ceid=BR:pt-419');
  expect(safeNewsLink('https://news.google.com/x')).toBe('https://news.google.com/x'); expect(safeNewsLink('http://x')).toBeNull(); expect(safeNewsLink(1)).toBeNull();
});
