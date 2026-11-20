import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Eyebrow, Text, Txt } from './ui';
import { Snapshot, UsdClose, splitTotals } from '../core';
import { S, T, R } from '../lib/theme';

/** Dois cartões no topo: Meus investimentos (sem o dólar) e Em dólar. Variante hero no Início, page na Carteira. */
export function TotalsSplit({ snap, hidden, close, variant, cdiAnnual, onToggleHidden }: {
  snap: Snapshot; hidden: boolean; close?: UsdClose | null; variant: 'hero' | 'page';
  cdiAnnual?: number | null; onToggleHidden?: () => void;
}) {
  const v = splitTotals(snap, hidden, close);
  if (!v.investments.show && !v.usd) return null;
  const hero = variant === 'hero';
  const both = v.investments.show && !!v.usd;
  const wrap = both ? { flex: 1 as const, minWidth: 148 } : { flex: 1 as const };
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
    <View key={key} style={{ ...wrap, backgroundColor: bg, borderRadius: R.card, padding: both ? S.lg : S.xl, gap: S.xs, borderWidth: hero ? 0 : 1, borderColor: T.line }}>
      {children}
    </View>
  );
  const body = (
    <View style={{ gap: S.sm }}>
      {onToggleHidden && hero ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <MaterialCommunityIcons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={T.onDarkDim} accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: S.md }}>
        {v.investments.show ? box(<>
          <Eyebrow color={titleColor}>{v.investments.title}{hero && hidden && !both ? ' · toque para mostrar' : ''}</Eyebrow>
          <Text style={{ color: text, fontSize: valueSize, lineHeight: valueLh, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{v.investments.total}</Text>
          {v.investments.dayPct ? <Text style={{ color: tone(v.investments.tone), fontWeight: '700', fontSize: 15, lineHeight: 20 }}>{v.investments.dayPct}{v.investments.dayChange ? `  ${v.investments.dayChange}` : ''}</Text> : null}
          {v.investments.net ? <Text style={{ color: dim, fontSize: 12, lineHeight: 16 }}>{v.investments.net}</Text> : null}
          {cdiAnnual != null ? <Text style={{ color: dim, fontSize: 12, lineHeight: 16 }}>CDI {cdiAnnual.toFixed(2).replace('.', ',')}% a.a.</Text> : null}
        </>, 'inv') : null}
        {v.usd ? box(<>
          <Eyebrow color={titleColor}>{v.usd.title}</Eyebrow>
          <Text style={{ color: text, fontSize: valueSize, lineHeight: valueLh, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{v.usd.usd}</Text>
          <Text style={{ color: dim, fontSize: 13, lineHeight: 18 }}>{v.usd.brl}</Text>
          {v.usd.dayPct ? <Text style={{ color: tone(v.usd.tone), fontWeight: '700', fontSize: 15, lineHeight: 20 }}>{v.usd.dayPct}</Text> : null}
        </>, 'usd') : null}
      </View>
      {v.combined ? <Txt style={{ color: T.dim, fontSize: 12, textAlign: 'center' }}>{v.combined.label}  {v.combined.value}</Txt> : null}
    </View>
  );
  if (!onToggleHidden) return body;
  return <Pressable onPress={onToggleHidden} accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}>{body}</Pressable>;
}
