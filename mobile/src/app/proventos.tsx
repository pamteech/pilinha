import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Card, Eyebrow, Screen, SectionTitle, Txt, money } from '../components/ui';
import { CashDividend, defaultFetcher, dividendCalendar, parseYahooDividends, toBR, yahooDivURL, BROWSER_UA, CalendarEntry } from '../core';
import { usePilinha } from '../lib/store';
import { T, S } from '../lib/theme';
const Row = ({ e, hidden, last }: { e: CalendarEntry; hidden: boolean; last: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line }}>
    <View style={{ width: 64 }}><Txt style={{ fontWeight: '600', fontSize: 14 }}>{toBR(e.date).slice(0, 5)}</Txt><Txt dim style={{ fontSize: 11 }}>{toBR(e.date).slice(6)}</Txt></View>
    <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>{e.ticker}</Txt><Txt dim style={{ fontSize: 12 }}>{e.label || 'provento'} · R$ {e.perShare.toFixed(4).replace('.', ',')}/cota</Txt></View>
    <Txt style={{ fontWeight: '600', textAlign: 'right' }}>{e.total > 0 ? money(e.total, hidden) : '—'}</Txt>
  </View>);
export default function Proventos() {
  const { snap, hidden, hasToken, portfolio } = usePilinha(); const s = snap?.dividends;
  const qty = useMemo(() => Object.fromEntries(portfolio.stocks.map(x => [x.ticker.toUpperCase(), x.quantity])), [portfolio]);
  const [yahoo, setYahoo] = useState<CashDividend[]>([]);
  // Sem dados da brapi para um ticker, busca o histórico de proventos do Yahoo (só passado, data ex).
  useEffect(() => {
    let alive = true; const have = new Set((snap?.cash ?? []).map(c => c.ticker));
    const need = Object.keys(qty).filter(t => !have.has(t));
    Promise.allSettled(need.map(async t => parseYahooDividends(await defaultFetcher(yahooDivURL(t), { 'User-Agent': BROWSER_UA }), t)))
      .then(rs => { if (alive) setYahoo(rs.flatMap(r => (r.status === 'fulfilled' ? r.value : []))); });
    return () => { alive = false; };
  }, [qty, snap?.cash]);
  const cal = dividendCalendar([...(snap?.cash ?? []), ...yahoo], qty);
  return (
    <Screen>
      <Card><Eyebrow color={T.text}>Últimos 12 meses</Eyebrow><Txt dim style={{ fontSize: 13 }}>Estimativa com a quantidade atual</Txt><Txt style={{ fontSize: 28, lineHeight: 36, fontWeight: '700' }}>{money(s?.last12m ?? 0, hidden)}</Txt></Card>
      <Card style={{ gap: 0 }}>
        <SectionTitle first>Próximos anunciados</SectionTitle>
        {cal.upcoming.length ? cal.upcoming.map((e, i) => <Row key={`u${i}`} e={e} hidden={hidden} last={i === cal.upcoming.length - 1} />)
          : <Txt dim style={{ fontSize: 13 }}>{hasToken ? 'Nenhum provento futuro anunciado para a carteira.' : 'Datas futuras só aparecem com o token da brapi (Cadastro). Sem ele, veja abaixo os últimos pagos.'}</Txt>}
      </Card>
      {cal.recent.length > 0 && <Card style={{ gap: 0 }}>
        <SectionTitle first>Últimos pagos (referência)</SectionTitle>
        {cal.recent.map((e, i) => <Row key={`r${i}`} e={e} hidden={hidden} last={i === cal.recent.length - 1} />)}
      </Card>}
      {Object.keys(s?.byTicker ?? {}).length > 0 && <Card style={{ gap: 0 }}>
        <SectionTitle first>Por ativo (12 meses)</SectionTitle>
        {Object.entries(s!.byTicker).map(([t, v], i, arr) => (
          <View key={t} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: T.line }}>
            <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700' }}>{t}</Txt><Txt dim style={{ fontSize: 12 }}>{s!.source[t] === 'manual' ? 'lançado à mão' : 'brapi'}</Txt></View>
            <Txt style={{ fontWeight: '600', textAlign: 'right' }}>{money(v, hidden)}</Txt>
          </View>))}
      </Card>}
      {!snap && <Txt dim>Carregando…</Txt>}
      {snap && !Object.keys(s?.byTicker ?? {}).length && !cal.recent.length && <Card><Txt dim>Nenhum provento nos últimos 12 meses.</Txt></Card>}
    </Screen>
  );
}
