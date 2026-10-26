import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pig } from '../components/Pig';
import { Card, Eyebrow, Measure, SectionTitle, Txt, colorFor, money, screenPad } from '../components/ui';
import { Mood, lastDays, topMovers, Mover, dayChange, dayChangePct, moodFrom, pct, shouldCelebrate, total, totalNet } from '../core';
import { usePilinha } from '../lib/store';
import { liveActivityAvailable, liveActivityRunning, startLiveActivity, stopLiveActivity } from '../lib/widget';
import { isTradingHours } from '../core';
import { T, S, R } from '../lib/theme';
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
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={screenPad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={T.pink} />}>
      <View style={{ alignItems: 'center' }}><Pig mood={mood} size={170} badge /></View>
      <Pressable onPress={() => setHidden(!hidden)}>
        <View style={{ backgroundColor: T.navy, borderRadius: R.card, padding: S.xl, gap: S.xs }}>
          <Eyebrow>Seu patrimônio {hidden ? '· toque para mostrar' : ''}</Eyebrow>
          <Txt style={{ color: T.onDark, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>{money(tot, hidden)}</Txt>
          {snap && <Txt style={{ color: T.onDarkDim, fontSize: 13 }}>Líquido se resgatar hoje: {money(totalNet(snap), hidden)}</Txt>}
          <View style={{ flexDirection: 'row', gap: S.md, marginTop: S.md }}>
            <View style={{ flex: 1, backgroundColor: T.navy2, borderRadius: 12, padding: 10, gap: 2 }}>
              <Eyebrow color={T.onDarkDim}>Hoje</Eyebrow>
              <Txt style={{ color: d == null ? T.onDark : d >= 0 ? T.upOnDark : T.downOnDark, fontWeight: '700' }}>{pct(d)}</Txt>
              {snap && !hidden && <Txt style={{ color: T.onDarkDim, fontSize: 12, lineHeight: 16 }}>{money(dayChange(snap), false)}</Txt>}
            </View>
            {snap?.cdiAnnual != null && <View style={{ flex: 1, backgroundColor: T.navy2, borderRadius: 12, padding: 10, gap: 2 }}>
              <Eyebrow color={T.onDarkDim}>CDI</Eyebrow>
              <Txt style={{ color: T.onDark, fontWeight: '700' }}>{snap.cdiAnnual.toFixed(2).replace('.', ',')}% a.a.</Txt>
            </View>}
          </View>
        </View>
      </Pressable>
      {liveActivityAvailable() && snap && (
        <Pressable onPress={toggleLive} style={{ backgroundColor: live ? T.card : T.pink, padding: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: live ? T.line : T.navy }}>
          <Txt style={{ color: live ? T.text : T.bg, fontWeight: '700' }}>{live ? 'Tirar o Pilinha da Ilha Dinâmica' : 'Acompanhar na Ilha Dinâmica'}</Txt>
          {!live && !isTradingHours() && <Txt style={{ color: T.bg, fontSize: 12 }}>A bolsa está fechada agora</Txt>}
        </Pressable>
      )}
      {empty && <Card><Txt>Cadastre a carteira na aba Cadastro. Tudo fica só neste iPhone.</Txt></Card>}
      {snap?.errors.map(e => <View key={e} style={{ flexDirection: 'row', gap: S.sm, alignItems: 'center', paddingHorizontal: S.xs }}><MaterialCommunityIcons name="alert-outline" size={16} color={T.down} /><Txt style={{ color: T.down, fontSize: 13, flex: 1 }}>{e}</Txt></View>)}
      <Week points={lastDays(history, 7)} hidden={hidden} />
      {snap && <Movers m={topMovers(snap.items, 3)} />}
      {snap && <Txt dim style={{ textAlign: 'center', fontSize: 12 }}>Atualizado {snap.updatedAt.toLocaleTimeString('pt-BR')} · puxe para atualizar</Txt>}
    </ScrollView>
  );
}

function Week({ points, hidden }: { points: { total: number; invested: number }[]; hidden: boolean }) {
  const H = 72;
  const ys = points.map(p => (hidden ? (p.invested > 0 ? p.total / p.invested : 0) : p.total));
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const path = (W: number) => ys.map((y, i) => `${i ? 'L' : 'M'}${2 + (i / Math.max(1, ys.length - 1)) * (W - 4)},${H - ((y - min) / span) * (H - 8) - 4}`).join(' ');
  const ch = ys.length >= 2 && ys[0] > 0 ? (ys[ys.length - 1] / ys[0] - 1) * 100 : null;
  return (
    <Card>
      <SectionTitle first right={<Txt style={{ color: colorFor(ch), fontWeight: '600' }}>{pct(ch)}</Txt>}>Últimos 7 dias</SectionTitle>
      {ys.length < 2 ? <Txt dim>O gráfico aparece a partir do segundo dia de uso.</Txt>
        : <Measure height={H}>{W => <Svg width={W} height={H}><Path d={path(W)} stroke={colorFor(ch)} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" /></Svg>}</Measure>}
    </Card>
  );
}
function Movers({ m }: { m: { up: Mover[]; down: Mover[] } }) {
  if (!m.up.length && !m.down.length) return null;
  const col = (title: string, xs: Mover[], up: boolean) => (
    <View style={{ flex: 1, gap: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MaterialCommunityIcons name={up ? 'arrow-up-bold' : 'arrow-down-bold'} size={14} color={up ? T.up : T.down} /><Txt dim style={{ fontSize: 13 }}>{title}</Txt></View>
      {xs.length ? xs.map(x => <View key={x.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt style={{ fontWeight: '600' }}>{x.name}</Txt><Txt style={{ color: colorFor(x.pct), textAlign: 'right' }}>{pct(x.pct)}</Txt></View>) : <Txt dim>—</Txt>}
    </View>
  );
  return (
    <Card>
      <SectionTitle first>Maiores altas e quedas do dia</SectionTitle>
      <View style={{ flexDirection: 'row', gap: S.xl }}>{col('Altas', m.up, true)}{col('Quedas', m.down, false)}</View>
    </Card>
  );
}
