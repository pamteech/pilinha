import React from 'react';
import { Pressable, TextStyle, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from './ui';
import { Snapshot, UsdClose, splitTotals } from '../core';
import { S, T, R } from '../lib/theme';

/** Texto que cabe numa linha só, reduzindo a fonte se preciso (iPhone estreito ou valor grande). */
function Fit({ children, style, minScale = 0.55 }: { children: string; style?: TextStyle; minScale?: number }) {
  return (
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={minScale} style={[{ width: '100%' }, style]}>{children}</Text>
  );
}

/** Dois cartões no topo: Meus investimentos (sem o dólar) e Em dólar. Variante hero no Início, page na Carteira. */
export function TotalsSplit({ snap, hidden, close, variant, cdiAnnual, onToggleHidden }: {
  snap: Snapshot; hidden: boolean; close?: UsdClose | null; variant: 'hero' | 'page';
  cdiAnnual?: number | null; onToggleHidden?: () => void;
}) {
  const v = splitTotals(snap, hidden, close);
  if (!v.investments.show && !v.usd) return null;
  const hero = variant === 'hero';
  const both = v.investments.show && !!v.usd;
  const wrap = both ? { flex: 1 as const, minWidth: 0 } : { flex: 1 as const };
  const bg = hero ? T.navy : T.card;
  const titleColor = hero ? T.onDarkDim : T.dim;
  const text = hero ? T.onDark : T.text;
  const dim = hero ? T.onDarkDim : T.dim;
  const up = hero ? T.upOnDark : T.up;
  const down = hero ? T.downOnDark : T.down;
  const tone = (t: 'up' | 'down' | 'neutral') => (t === 'up' ? up : t === 'down' ? down : text);
  const valueSize = both ? 22 : hero ? 32 : 24;
  const valueLh = both ? 28 : hero ? 40 : 30;
  const box = (children: React.ReactNode, key: string) => (
    <View key={key} style={{ ...wrap, backgroundColor: bg, borderRadius: R.card, padding: both ? S.lg : S.xl, justifyContent: 'flex-start', borderWidth: hero ? 0 : 1, borderColor: T.line }}>
      {children}
    </View>
  );
  const title = (label: string) => (
    <Fit minScale={0.7} style={{ color: titleColor, fontSize: 11, lineHeight: 14, letterSpacing: both ? 0.6 : 1.6, textTransform: 'uppercase', fontWeight: '600' }}>{label}</Fit>
  );
  const body = (
    <View style={{ gap: S.sm }}>
      {onToggleHidden && hero ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <MaterialCommunityIcons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={T.onDarkDim} accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: S.md }}>
        {v.investments.show ? box(<>
          {title(v.investments.title + (hero && hidden && !both ? ' · toque para mostrar' : ''))}
          <Fit style={{ color: text, fontSize: valueSize, lineHeight: valueLh, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{v.investments.total}</Fit>
          {v.investments.dayPct ? <Fit minScale={0.65} style={{ color: tone(v.investments.tone), fontWeight: '700', fontSize: 15, lineHeight: 20, marginTop: 4 }}>{v.investments.dayPct}{v.investments.dayChange ? `  ${v.investments.dayChange}` : ''}</Fit> : null}
          {v.investments.net ? <Fit minScale={0.7} style={{ color: dim, fontSize: 12, lineHeight: 16, marginTop: 4 }}>{v.investments.net}</Fit> : null}
          {cdiAnnual != null ? <Fit minScale={0.7} style={{ color: dim, fontSize: 12, lineHeight: 16, marginTop: 2 }}>CDI {cdiAnnual.toFixed(2).replace('.', ',')}% a.a.</Fit> : null}
        </>, 'inv') : null}
        {v.usd ? box(<>
          {title(v.usd.title)}
          <Fit style={{ color: text, fontSize: valueSize, lineHeight: valueLh, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{v.usd.usd}</Fit>
          <Fit minScale={0.7} style={{ color: dim, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{v.usd.brl}</Fit>
          {v.usd.dayPct ? <Fit minScale={0.7} style={{ color: tone(v.usd.tone), fontWeight: '700', fontSize: 15, lineHeight: 20, marginTop: 4 }}>{v.usd.dayPct}</Fit> : null}
        </>, 'usd') : null}
      </View>
      {v.combined ? <Fit minScale={0.7} style={{ color: T.dim, fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{`${v.combined.label}  ${v.combined.value}`}</Fit> : null}
    </View>
  );
  if (!onToggleHidden) return body;
  return <Pressable onPress={onToggleHidden} accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}>{body}</Pressable>;
}
