import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Card, Measure, Screen, Txt, colorFor } from '../components/ui';
import { HistoryRange, gainPct, inRange, pct } from '../core';
import { usePilinha } from '../lib/store';
import { T, S, R } from '../lib/theme';
const ranges: HistoryRange[] = ['Dia', 'Semana', 'Mês', 'Tudo'];
export default function Evolucao() {
  const { history, hidden } = usePilinha(); const [r, setR] = useState<HistoryRange>('Mês');
  const pts = inRange(history, r); const H = 180;
  // No modo discreto o gráfico mostra o ganho em %, nunca R$.
  const ys = pts.map(p => (hidden ? gainPct(p) : p.total));
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const path = (W: number) => ys.map((y, i) => `${i ? 'L' : 'M'}${2 + (i / Math.max(1, ys.length - 1)) * (W - 4)},${H - ((y - min) / span) * (H - 10) - 5}`).join(' ');
  const g = pts.length ? gainPct(pts[pts.length - 1]) : null;
  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
        {ranges.map(x => <Pressable key={x} onPress={() => setR(x)} style={{ paddingVertical: S.sm, paddingHorizontal: S.lg, borderRadius: R.pill, borderWidth: 1, borderColor: x === r ? T.pink : T.line, backgroundColor: x === r ? T.pink : T.card }}><Txt style={{ color: x === r ? T.bg : T.text }}>{x}</Txt></Pressable>)}
      </View>
      <Card>
        {pts.length < 2 ? <Txt dim>O gráfico aparece a partir do segundo dia de uso (um ponto por dia, guardado só no iPhone).</Txt>
          : <Measure height={H}>{W => <Svg width={W} height={H}><Path d={path(W)} stroke={T.pink} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" /></Svg>}</Measure>}
        <Txt style={{ color: colorFor(g) }}>Ganho sobre o investido: {pct(g)}</Txt>
      </Card>
    </Screen>
  );
}
