import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card, Measure, Screen, SectionTitle, Txt, colorFor } from '../../components/ui';
import { BenchPoint, CDIDailyRate, HISTORY_RANGES, HistoryRange, benchmarkSeries, cdiRates, gainPct, inRange, parseISO, pct, selicAnnual, trMonthly } from '../../core';
import { usePilinha } from '../../lib/store';
import { T, S, R } from '../../lib/theme';
const ranges: HistoryRange[] = HISTORY_RANGES; // Semana, Mês, 6 meses, 1 ano, Tudo (como na landing)
const colors = () => ({ carteira: T.pink, cdi: T.lilac, poupanca: '#A08F5A' }); // lido na renderização: muda com o tema
const line = (ys: number[], W: number, H: number, min: number, span: number) =>
  ys.map((y, i) => `${i ? 'L' : 'M'}${2 + (i / Math.max(1, ys.length - 1)) * (W - 4)},${H - ((y - min) / span) * (H - 10) - 5}`).join(' ');
export default function Evolucao() {
  const { history, hidden } = usePilinha(); const [r, setR] = useState<HistoryRange>('Mês'); const C = colors();
  const pts = inRange(history, r); const H = 180;
  // No modo discreto o gráfico mostra o ganho em %, nunca R$.
  const ys = pts.map(p => (hidden ? gainPct(p) : p.total));
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const g = pts.length ? gainPct(pts[pts.length - 1]) : null;
  // Comparação com CDI e poupança (BCB). Sem TR, poupança usa TR = 0.
  const [rates, setRates] = useState<CDIDailyRate[] | null>(null); const [selic, setSelic] = useState<number | null>(null); const [tr, setTr] = useState<number | null>(null); const [err, setErr] = useState(false);
  const first = pts[0]?.day, last = pts[pts.length - 1]?.day;
  useEffect(() => {
    if (!first || !last || first === last) return; let alive = true; setErr(false);
    (async () => {
      try {
        const [rt, sl, t] = await Promise.all([cdiRates(parseISO(first)!, parseISO(last)!), selicAnnual().catch(() => null), trMonthly()]);
        if (alive) { setRates(rt); setSelic(sl); setTr(t); }
      } catch { if (alive) setErr(true); }
    })();
    return () => { alive = false; };
  }, [first, last]);
  const bench: BenchPoint[] = rates && pts.length >= 2 ? benchmarkSeries(pts, rates, selic, tr ?? 0) : [];
  const lastB = bench[bench.length - 1];
  const bAll = bench.flatMap(b => [b.carteira, b.cdi, ...(b.poupanca != null ? [b.poupanca] : [])]);
  const bMin = Math.min(0, ...bAll), bSpan = (Math.max(0, ...bAll) - bMin) || 1;
  const legend = (c: string, label: string, v: number | null | undefined) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
      <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: c }} /><Txt style={{ flex: 1 }}>{label}</Txt><Txt style={{ fontWeight: '600', color: colorFor(v), textAlign: 'right' }}>{pct(v)}</Txt>
    </View>);
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
        {ranges.map(x => <Pressable key={x} onPress={() => setR(x)} style={{ paddingVertical: S.sm, paddingHorizontal: S.md, borderRadius: R.pill, borderWidth: 1, borderColor: x === r ? T.pink : T.line, backgroundColor: x === r ? T.pink : T.card }}><Txt style={{ color: x === r ? T.bg : T.text }}>{x}</Txt></Pressable>)}
      </View>
      <Card>
        <SectionTitle first>{hidden ? 'Ganho sobre o investido' : 'Patrimônio'}</SectionTitle>
        {pts.length < 2 ? <Txt dim>O gráfico aparece a partir do segundo dia de uso (um ponto por dia, guardado só no iPhone).</Txt>
          : <Measure height={H}>{W => <Svg width={W} height={H}><Path d={line(ys, W, H, min, span)} stroke={T.pink} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" /></Svg>}</Measure>}
        <Txt style={{ color: colorFor(g) }}>Ganho sobre o investido: {pct(g)}</Txt>
      </Card>
      <Card>
        <SectionTitle first>Rentabilidade no período</SectionTitle>
        {pts.length < 2 ? <Txt dim>Precisa de pelo menos dois dias de histórico.</Txt>
          : err ? <Txt dim>Não deu para buscar o CDI agora. Puxe para atualizar no Início e volte aqui.</Txt>
          : !bench.length ? <Txt dim>Buscando CDI e Selic…</Txt>
          : <>
            <Measure height={140}>{W => <Svg width={W} height={140}>
              <Path d={line(bench.map(b => 0), W, 140, bMin, bSpan)} stroke={T.line} strokeWidth={1} />
              {bench.some(b => b.poupanca != null) && <Path d={line(bench.map(b => b.poupanca ?? 0), W, 140, bMin, bSpan)} stroke={C.poupanca} strokeWidth={2} fill="none" strokeDasharray="4 4" />}
              <Path d={line(bench.map(b => b.cdi), W, 140, bMin, bSpan)} stroke={C.cdi} strokeWidth={2} fill="none" />
              <Path d={line(bench.map(b => b.carteira), W, 140, bMin, bSpan)} stroke={C.carteira} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </Svg>}</Measure>
            <View style={{ gap: S.xs, marginTop: S.xs }}>
              {legend(C.carteira, 'Carteira', lastB?.carteira)}
              {legend(C.cdi, '100% do CDI', lastB?.cdi)}
              {legend(C.poupanca, 'Poupança', lastB?.poupanca)}
            </View>
            <Txt dim style={{ fontSize: 12 }}>{`Carteira descontando aportes. Poupança pela regra oficial (Selic ${selic != null ? selic.toFixed(2).replace('.', ',') + '%' : 'indisponível'})${tr == null ? ', aproximada com TR = 0' : ''}.`}</Txt>
          </>}
      </Card>
    </Screen>
  );
}
