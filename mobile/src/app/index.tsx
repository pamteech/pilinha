import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useEffect, useRef, useState } from 'react';
import { Pig } from '../components/Pig';
import { Card, Txt, colorFor, money } from '../components/ui';
import { Mood, lastDays, topMovers, Mover, dayChange, dayChangePct, moodFrom, pct, shouldCelebrate, total, totalNet } from '../core';
import { usePilinha } from '../lib/store';
import { liveActivityAvailable, liveActivityRunning, startLiveActivity, stopLiveActivity } from '../lib/widget';
import { isTradingHours } from '../core';
import { T } from '../lib/theme';
export default function Home() {
  const { snap, loading, refresh, hidden, setHidden, portfolio, history } = usePilinha();
  const d = snap ? dayChangePct(snap) : null, tot = snap ? total(snap) : 0;
  const base = moodFrom(d, loading && !snap, !!snap?.errors.length);
  const [mood, setMood] = useState<Mood>(base); const prev = useRef<number | null>(null);
  useEffect(() => {
    if (snap && shouldCelebrate(prev.current, tot, d)) { setMood('ganhou'); const t = setTimeout(() => setMood(base), 37 / 24 * 1000); prev.current = tot; return () => clearTimeout(t); }
    if (snap) prev.current = tot; setMood(base);
  }, [snap, base]);
  const [live, setLive] = useState(liveActivityRunning());
  const toggleLive = async () => {
    try { if (live) await stopLiveActivity(); else if (snap) await startLiveActivity(snap, hidden); } catch {}
    setLive(liveActivityRunning());
  };
  const empty = !portfolio.fixedIncome.length && !portfolio.stocks.length && !portfolio.crypto.length;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ padding: 16, gap: 12, alignItems: 'stretch' }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={T.pink} />}>
      <View style={{ alignItems: 'center' }}><Pig mood={mood} size={170} badge /></View>
      <Pressable onPress={() => setHidden(!hidden)}>
        <Card style={{ alignItems: 'center' }}>
          <Txt dim>Total {hidden ? '(toque para mostrar)' : ''}</Txt>
          <Txt style={{ fontSize: 34, fontWeight: '700' }}>{money(tot, hidden)}</Txt>
          <Txt style={{ color: colorFor(d), fontSize: 18 }}>Hoje {pct(d)} {snap && !hidden ? `(${money(dayChange(snap), false)})` : ''}</Txt>
          {snap && <Txt dim>Líquido se resgatar hoje: {money(totalNet(snap), hidden)}</Txt>}
          {snap?.cdiAnnual != null && <Txt dim>CDI {snap.cdiAnnual.toFixed(2).replace('.', ',')}% a.a.</Txt>}
        </Card>
      </Pressable>
      {liveActivityAvailable() && snap && (
        <Pressable onPress={toggleLive} style={{ backgroundColor: live ? T.card : T.pink, padding: 12, borderRadius: 12, alignItems: 'center' }}>
          <Txt style={{ color: live ? T.text : T.bg, fontWeight: '700' }}>{live ? 'Tirar o Pilinha da Ilha Dinâmica' : 'Acompanhar na Ilha Dinâmica'}</Txt>
          {!live && !isTradingHours() && <Txt style={{ color: T.bg, fontSize: 12 }}>A bolsa está fechada agora</Txt>}
        </Pressable>
      )}
      {empty && <Card><Txt>Cadastre a carteira na aba Cadastro. Tudo fica só neste iPhone.</Txt></Card>}
      <Week points={lastDays(history, 7)} hidden={hidden} />
      {snap && <Movers m={topMovers(snap.items, 3)} />}
      {snap?.errors.map(e => <Txt key={e} style={{ color: T.down, fontSize: 13 }}>⚠︎ {e}</Txt>)}
      {snap && <Txt dim style={{ textAlign: 'center', fontSize: 12 }}>Atualizado {snap.updatedAt.toLocaleTimeString('pt-BR')} · puxe para atualizar</Txt>}
    </ScrollView>
  );
}

function Week({ points, hidden }: { points: { total: number; invested: number }[]; hidden: boolean }) {
  const W = 330, H = 70;
  const ys = points.map(p => (hidden ? (p.invested > 0 ? p.total / p.invested : 0) : p.total));
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const d = ys.map((y, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, ys.length - 1)) * W},${H - ((y - min) / span) * (H - 8) - 4}`).join(' ');
  const ch = ys.length >= 2 && ys[0] > 0 ? (ys[ys.length - 1] / ys[0] - 1) * 100 : null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt style={{ fontWeight: '700' }}>Últimos 7 dias</Txt><Txt style={{ color: colorFor(ch) }}>{pct(ch)}</Txt></View>
      {ys.length < 2 ? <Txt dim>O gráfico aparece a partir do segundo dia de uso.</Txt>
        : <Svg width={W} height={H}><Path d={d} stroke={colorFor(ch)} strokeWidth={3} fill="none" strokeLinejoin="round" /></Svg>}
    </Card>
  );
}
function Movers({ m }: { m: { up: Mover[]; down: Mover[] } }) {
  if (!m.up.length && !m.down.length) return null;
  const col = (title: string, xs: Mover[]) => (
    <View style={{ flex: 1, gap: 4 }}>
      <Txt dim style={{ fontSize: 13 }}>{title}</Txt>
      {xs.length ? xs.map(x => <View key={x.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt style={{ fontWeight: '600' }}>{x.name}</Txt><Txt style={{ color: colorFor(x.pct) }}>{pct(x.pct)}</Txt></View>) : <Txt dim>—</Txt>}
    </View>
  );
  return (
    <Card>
      <Txt style={{ fontWeight: '700' }}>Maiores altas e quedas do dia</Txt>
      <View style={{ flexDirection: 'row', gap: 16 }}>{col('▲ Altas', m.up)}{col('▼ Quedas', m.down)}</View>
    </Card>
  );
}
