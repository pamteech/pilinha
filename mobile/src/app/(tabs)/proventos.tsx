import { EyeToggle } from '../../components/EyeToggle';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card, Eyebrow, Measure, Screen, SectionTitle, Txt, money } from '../../components/ui';
import { CashDividend, MonthlyDividends, defaultFetcher, dividendCalendar, dividendsByMonth, parseYahooDividends, toBR, yahooDivURL, BROWSER_UA, CalendarEntry, receivedTotal } from '../../core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePilinha } from '../../lib/store';
import { T, S } from '../../lib/theme';
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
  const monthly = useMemo(() => dividendsByMonth(portfolio.stocks, [...(snap?.cash ?? []), ...yahoo], portfolio.manualDividends ?? []), [portfolio, snap?.cash, yahoo]);
  return (
    <Screen>
      <EyeToggle />
      {(() => { const r = receivedTotal(portfolio.manualDividends), nx = cal.upcoming[0]; return (r.count > 0 || nx) ? <Card>
        {r.count > 0 && <><Eyebrow color={T.text}>Já recebido</Eyebrow><Txt style={{ fontSize: 24, lineHeight: 32, fontWeight: '700' }}>{money(r.total, hidden)}</Txt><Txt dim style={{ fontSize: 12 }}>{r.count} lançamento(s) no Cadastro</Txt></>}
        {nx && <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: r.count ? S.sm : 0 }}><MaterialCommunityIcons name="calendar-clock" size={18} color={T.lilacDeep} /><Txt style={{ flex: 1 }}>Próximo: {nx.ticker} em {toBR(nx.date)}</Txt><Txt style={{ fontWeight: '600' }}>{nx.total > 0 ? money(nx.total, hidden) : ''}</Txt></View>}
      </Card> : null; })()}
      <Card><Eyebrow color={T.text}>Últimos 12 meses</Eyebrow><Txt dim style={{ fontSize: 13 }}>{`Estimativa com a quantidade atual${monthly.usesYahoo ? ' · datas ex do Yahoo onde não há brapi' : ''}`}</Txt><Txt style={{ fontSize: 28, lineHeight: 36, fontWeight: '700' }}>{money(monthly.total, hidden)}</Txt></Card>
      {monthly.total > 0 ? <MonthlyChart m={monthly} hidden={hidden} /> : null}
      <Card style={{ gap: 0 }}>
        <SectionTitle first>Próximos anunciados</SectionTitle>
        {cal.upcoming.length ? cal.upcoming.map((e, i) => <Row key={`u${i}`} e={e} hidden={hidden} last={i === cal.upcoming.length - 1} />)
          : <Txt dim style={{ fontSize: 13 }}>{hasToken ? 'Nenhum provento futuro anunciado para a carteira.' : 'Datas futuras só aparecem com o token da brapi (Cadastro). Sem ele, veja abaixo os últimos pagos.'}</Txt>}
      </Card>
      {cal.recent.length > 0 && <Card style={{ gap: 0 }}>
        <SectionTitle first>Últimos pagos (referência)</SectionTitle>
        {cal.recent.map((e, i) => <Row key={`r${i}`} e={e} hidden={hidden} last={i === cal.recent.length - 1} />)}
      </Card>}
      {monthly.byTicker.length > 0 && <Card style={{ gap: 0 }}>
        <SectionTitle first>Por ativo (12 meses)</SectionTitle>
        {monthly.byTicker.map((x, i, arr) => (
          <View key={x.ticker} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: T.line }}>
            <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700' }}>{x.ticker}</Txt><Txt dim style={{ fontSize: 12 }}>{x.source === 'manual' ? 'lançado à mão' : x.source === 'yahoo' ? 'Yahoo (data ex, referência)' : 'brapi'}</Txt></View>
            <Txt style={{ fontWeight: '600', textAlign: 'right' }}>{money(x.total, hidden)}</Txt>
          </View>))}
      </Card>}
      {!snap && <Txt dim>Carregando…</Txt>}
      {snap && !monthly.byTicker.length && !cal.recent.length && <Card><Txt dim>Nenhum provento nos últimos 12 meses.</Txt></Card>}
    </Screen>
  );
}

/** Dividendos por mês (landing): barras finas com topo arredondado, uma série só (sem legenda), média mensal e melhor mês. */
function MonthlyChart({ m, hidden }: { m: MonthlyDividends; hidden: boolean }) {
  const H = 110, GAP = 3, R4 = 4, max = Math.max(...m.months.map(x => x.total), 0) || 1;
  const bar = (x: number, w: number, h: number) => {
    const y = H - h, r = Math.min(R4, w / 2, h);
    return `M${x},${H} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${H} Z`;
  };
  return (
    <Card>
      <SectionTitle first right={<Txt dim style={{ fontSize: 13 }}>média {money(m.average, hidden)}/mês</Txt>}>Dividendos por mês</SectionTitle>
      <Measure height={H}>{W => { const w = (W - GAP * (m.months.length - 1)) / m.months.length; return (
        <Svg width={W} height={H}>
          <Path d={`M0,${H - 0.5} L${W},${H - 0.5}`} stroke={T.line} strokeWidth={1} />
          {m.months.map((x, i) => x.total > 0 ? <Path key={x.month} d={bar(i * (w + GAP), w, Math.max(3, (x.total / max) * (H - 6)))} fill={m.best?.month === x.month ? T.pink : T.lilac} /> : null)}
        </Svg>); }}</Measure>
      <View style={{ flexDirection: 'row' }}>{m.months.map(x => <Txt key={x.month} dim style={{ flex: 1, fontSize: 10, lineHeight: 14, textAlign: 'center' }}>{x.label}</Txt>)}</View>
      <Txt dim style={{ fontSize: 12 }}>{`${m.best ? `Melhor mês: ${m.best.label} (${money(m.best.total, hidden)}). ` : ''}Pela data em que caíram na conta; lançamento à mão vale no lugar da internet.`}</Txt>
    </Card>);
}
