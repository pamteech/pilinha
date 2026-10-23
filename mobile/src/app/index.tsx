import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Pig } from '../components/Pig';
import { Card, Txt, colorFor, money } from '../components/ui';
import { Mood, dayChange, dayChangePct, moodFrom, pct, shouldCelebrate, total, totalNet } from '../core';
import { usePilinha } from '../lib/store';
import { T } from '../lib/theme';
export default function Home() {
  const { snap, loading, refresh, hidden, setHidden, portfolio } = usePilinha();
  const d = snap ? dayChangePct(snap) : null, tot = snap ? total(snap) : 0;
  const base = moodFrom(d, loading && !snap, !!snap?.errors.length);
  const [mood, setMood] = useState<Mood>(base); const prev = useRef<number | null>(null);
  useEffect(() => {
    if (snap && shouldCelebrate(prev.current, tot, d)) { setMood('ganhou'); const t = setTimeout(() => setMood(base), 37 / 24 * 1000); prev.current = tot; return () => clearTimeout(t); }
    if (snap) prev.current = tot; setMood(base);
  }, [snap, base]);
  const empty = !portfolio.fixedIncome.length && !portfolio.stocks.length && !portfolio.crypto.length;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ padding: 16, gap: 12, alignItems: 'stretch' }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={T.pink} />}>
      <View style={{ alignItems: 'center' }}><Pig mood={mood} size={180} /></View>
      <Pressable onPress={() => setHidden(!hidden)}>
        <Card style={{ alignItems: 'center' }}>
          <Txt dim>Total {hidden ? '(toque para mostrar)' : ''}</Txt>
          <Txt style={{ fontSize: 34, fontWeight: '700' }}>{money(tot, hidden)}</Txt>
          <Txt style={{ color: colorFor(d), fontSize: 18 }}>Hoje {pct(d)} {snap && !hidden ? `(${money(dayChange(snap), false)})` : ''}</Txt>
          {snap && <Txt dim>Líquido se resgatar hoje: {money(totalNet(snap), hidden)}</Txt>}
          {snap?.cdiAnnual != null && <Txt dim>CDI {snap.cdiAnnual.toFixed(2).replace('.', ',')}% a.a.</Txt>}
        </Card>
      </Pressable>
      {empty && <Card><Txt>Cadastre a carteira na aba Cadastro. Tudo fica só neste iPhone.</Txt></Card>}
      {snap?.errors.map(e => <Txt key={e} style={{ color: T.down, fontSize: 13 }}>⚠︎ {e}</Txt>)}
      {snap && <Txt dim style={{ textAlign: 'center', fontSize: 12 }}>Atualizado {snap.updatedAt.toLocaleTimeString('pt-BR')} · puxe para atualizar</Txt>}
    </ScrollView>
  );
}
