import { EyeToggle } from '../../components/EyeToggle';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card, Eyebrow, Measure, Screen, SectionTitle, Txt, money } from '../../components/ui';
import { CashDividend, DividendSource, MonthlyDividends, defaultFetcher, dividendCalendar, dividendsByMonth, parseYahooDividends, toBR, yahooDivURL, BROWSER_UA } from '../../core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePilinha } from '../../lib/store';
import { T, S } from '../../lib/theme';
// Proventos em linguagem simples: quanto caiu nos últimos 12 meses (um número só), por mês, de qual ativo, próximos e últimos pagamentos.
// Fontes (brapi, Yahoo, lançamento manual) viram só "estimado" ou "lançado por você".
const srcLabel = (s: DividendSource) => (s === 'manual' ? 'lançado por você' : 'estimado');
const dateBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const Row = ({ date, title, sub, value, last }: { date: string; title: string; sub: string; value: string; last: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line }}>
    <View style={{ width: 64 }}><Txt style={{ fontWeight: '600', fontSize: 14 }}>{date.slice(0, 5)}</Txt><Txt dim style={{ fontSize: 11 }}>{date.slice(6)}</Txt></View>
    <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>{title}</Txt><Txt dim style={{ fontSize: 12 }}>{sub}</Txt></View>
    <Txt style={{ fontWeight: '600', textAlign: 'right' }}>{value}</Txt>
  </View>);
export default function Proventos() {
  const { snap, hidden, hasToken, portfolio } = usePilinha();
  const qty = useMemo(() => Object.fromEntries(portfolio.stocks.map(x => [x.ticker.toUpperCase(), x.quantity])), [portfolio]);
  const [yahoo, setYahoo] = useState<CashDividend[]>([]);
  // Sem dados da brapi para um ticker, busca o histórico de proventos do Yahoo (só passado, data ex aproximada).
  useEffect(() => {
    let alive = true; const have = new Set((snap?.cash ?? []).map(c => c.ticker));
    const need = Object.keys(qty).filter(t => !have.has(t));
    Promise.allSettled(need.map(async t => parseYahooDividends(await defaultFetcher(yahooDivURL(t), { 'User-Agent': BROWSER_UA }), t)))
      .then(rs => { if (alive) setYahoo(rs.flatMap(r => (r.status === 'fulfilled' ? r.value : []))); });
    return () => { alive = false; };
  }, [qty, snap?.cash]);
  const cash = useMemo(() => [...(snap?.cash ?? []), ...yahoo], [snap?.cash, yahoo]);
  const m = useMemo(() => dividendsByMonth(portfolio.stocks, cash, portfolio.manualDividends ?? []), [portfolio, cash]);
  const upcoming = dividendCalendar(cash, qty).upcoming;
  const nx = upcoming[0];
  if (!snap) return <Screen><Txt dim>Carregando…</Txt></Screen>;
  return (
    <Screen>
      <EyeToggle />
      <Card>
        <Eyebrow color={T.text}>Proventos nos últimos 12 meses</Eyebrow>
        <Txt style={{ fontSize: 30, lineHeight: 38, fontWeight: '700' }}>{money(m.total, hidden)}</Txt>
        <Txt dim style={{ fontSize: 13 }}>{m.total > 0 ? `Cerca de ${money(m.average, hidden)} por mês${m.best ? ` · melhor mês: ${m.best.label}` : ''}` : 'Nenhum provento nos últimos 12 meses. Cadastre ações ou FIIs, ou lance um provento à mão no Cadastro.'}</Txt>
        {m.total > 0 ? <MonthlyChart m={m} /> : null}
        {nx ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xs }}><MaterialCommunityIcons name="calendar-clock" size={18} color={T.lilacDeep} /><Txt style={{ flex: 1 }}>Próximo: {nx.ticker} em {toBR(nx.date)}</Txt><Txt style={{ fontWeight: '600' }}>{nx.total > 0 ? money(nx.total, hidden) : ''}</Txt></View> : null}
        <Txt dim style={{ fontSize: 12 }}>Dividendos e rendimentos de ações e FIIs, pela data em que caíram na conta.</Txt>
      </Card>
      {m.byTicker.length > 0 && <Card style={{ gap: 0 }}>
        <SectionTitle first>De qual ativo</SectionTitle>
        {m.byTicker.map((x, i, arr) => (
          <View key={x.ticker} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: T.line }}>
            <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700' }}>{x.ticker}</Txt><Txt dim style={{ fontSize: 12 }}>{srcLabel(x.source)}</Txt></View>
            <Txt style={{ fontWeight: '600', textAlign: 'right' }}>{money(x.total, hidden)}</Txt>
          </View>))}
        <Txt dim style={{ fontSize: 12, marginTop: S.sm }}>Estimado: calculado pela internet com a quantidade que você tem hoje. Para o valor exato, lance o provento no Cadastro: ele passa a valer no lugar da estimativa daquele ativo.</Txt>
      </Card>}
      {upcoming.length > 0 && <Card style={{ gap: 0 }}>
        <SectionTitle first>Próximos pagamentos</SectionTitle>
        {upcoming.map((e, i) => <Row key={`u${i}`} date={toBR(e.date)} title={e.ticker} sub={`R$ ${e.perShare.toFixed(2).replace('.', ',')} por cota`} value={e.total > 0 ? money(e.total, hidden) : '—'} last={i === upcoming.length - 1} />)}
      </Card>}
      {m.entries.length > 0 && <Card style={{ gap: 0 }}>
        <SectionTitle first>Últimos pagamentos</SectionTitle>
        {m.entries.slice(0, 12).map((e, i, arr) => <Row key={`${e.date}${e.ticker}${i}`} date={dateBR(e.date)} title={e.ticker} sub={e.source === 'manual' ? 'lançado por você' : `R$ ${(e.perShare ?? 0).toFixed(2).replace('.', ',')} por cota · estimado`} value={money(e.total, hidden)} last={i === arr.length - 1} />)}
      </Card>}
      {!hasToken && <Txt dim style={{ fontSize: 12 }}>Quer ver as datas dos próximos pagamentos? Cadastre o token gratuito da brapi em Ajustes.</Txt>}
    </Screen>
  );
}
/** Barras finas por mês (uma série só), melhor mês em destaque. */
function MonthlyChart({ m }: { m: MonthlyDividends }) {
  const H = 100, GAP = 3, R4 = 4, max = Math.max(...m.months.map(x => x.total), 0) || 1;
  const bar = (x: number, w: number, h: number) => { const y = H - h, r = Math.min(R4, w / 2, h); return `M${x},${H} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${H} Z`; };
  return (<>
    <Measure height={H}>{W => { const w = (W - GAP * (m.months.length - 1)) / m.months.length; return (
      <Svg width={W} height={H}>
        <Path d={`M0,${H - 0.5} L${W},${H - 0.5}`} stroke={T.line} strokeWidth={1} />
        {m.months.map((x, i) => x.total > 0 ? <Path key={x.month} d={bar(i * (w + GAP), w, Math.max(3, (x.total / max) * (H - 6)))} fill={m.best?.month === x.month ? T.pink : T.lilac} /> : null)}
      </Svg>); }}</Measure>
    <View style={{ flexDirection: 'row' }}>{m.months.map(x => <Txt key={x.month} dim style={{ flex: 1, fontSize: 10, lineHeight: 14, textAlign: 'center' }}>{x.label}</Txt>)}</View>
  </>);
}
