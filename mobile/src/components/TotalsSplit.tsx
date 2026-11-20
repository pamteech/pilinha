import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CardRow, Fit, Skeleton, Text, cardSurface } from './ui';
import { Snapshot, UsdClose, splitTotals } from '../core';
import { S, T, TY, tabular } from '../lib/theme';

/** Cartões empilhados em largura total: Meus investimentos (sem o dólar) e Em dólar. variant mantido por compatibilidade (Início e Carteira usam o mesmo acabamento). */
export function TotalsSplit({ snap, hidden, close, variant: _variant, cdiAnnual, onOpenCarteira }: {
  snap: Snapshot; hidden: boolean; close?: UsdClose | null; variant: 'hero' | 'page';
  cdiAnnual?: number | null; onOpenCarteira?: () => void;
}) {
  const v = splitTotals(snap, hidden, close);
  if (!v.investments.show && !v.usd) return null;
  const tone = (t: 'up' | 'down' | 'neutral') => (t === 'up' ? T.up : t === 'down' ? T.down : T.text);
  const netValue = v.investments.net ? v.investments.net.replace(/^Líquido se resgatar hoje:\s*/, '') : null;
  const box = (children: React.ReactNode, key: string, onPress?: () => void) => {
    const inner = <View style={cardSurface({ padding: S.xl, gap: 0 })}>{children}</View>;
    if (!onPress) return <View key={key}>{inner}</View>;
    return <Pressable key={key} onPress={onPress} accessibilityRole="button" accessibilityLabel="Abrir a Carteira" accessibilityHint="Mostra o detalhe dos investimentos">{inner}</Pressable>;
  };
  return (
    <View style={{ gap: S.lg }}>
      {v.investments.show ? box(<>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm }}>
          <Text numberOfLines={1} style={{ color: T.dim, ...TY.label, flex: 1 }}>{v.investments.title}</Text>
          {onOpenCarteira ? <MaterialCommunityIcons name="chevron-right" size={22} color={T.dim} /> : null}
        </View>
        <Fit style={{ color: T.text, ...TY.valueHero, marginTop: S.sm, marginBottom: S.sm }}>{v.investments.total}</Fit>
        {v.investments.dayPct || v.investments.dayChange ? (
          <CardRow label="Rendimento do dia">
            {v.investments.dayChange ? <Fit minScale={0.65} style={{ color: tone(v.investments.tone), ...TY.value, textAlign: 'right' }}>{v.investments.dayChange}</Fit> : null}
            {v.investments.dayPct ? <Text numberOfLines={1} style={{ color: tone(v.investments.tone), ...TY.pct, ...tabular }}>{v.investments.dayPct}</Text> : null}
          </CardRow>
        ) : null}
        {cdiAnnual != null ? (
          <CardRow label="CDI hoje">
            <Fit minScale={0.7} style={{ color: T.text, ...TY.value, textAlign: 'right' }}>{`${cdiAnnual.toFixed(2).replace('.', ',')}% a.a.`}</Fit>
          </CardRow>
        ) : null}
        {netValue ? (
          <CardRow label="Líquido se resgatar hoje">
            <Fit minScale={0.65} style={{ color: T.text, ...TY.value, textAlign: 'right' }}>{netValue}</Fit>
          </CardRow>
        ) : null}
      </>, 'inv', onOpenCarteira) : null}
      {v.usd ? box(<>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.lg }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.champLight, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="currency-usd" size={22} color={T.pink} />
          </View>
          <Text numberOfLines={1} style={{ color: T.dim, ...TY.label, flex: 1 }}>{v.usd.title}</Text>
        </View>
        <Fit style={{ color: T.text, ...TY.valueHero, marginTop: S.sm, marginBottom: S.sm }}>{v.usd.usd}</Fit>
        <CardRow label="Em reais">
          <Fit minScale={0.65} style={{ color: T.text, ...TY.value, textAlign: 'right' }}>{v.usd.brl}</Fit>
        </CardRow>
        {v.usd.dayPct ? (
          <CardRow label="Variação do dólar hoje">
            <Text numberOfLines={1} style={{ color: tone(v.usd.tone), ...TY.pct, ...tabular }}>{v.usd.dayPct}</Text>
          </CardRow>
        ) : null}
      </>, 'usd') : null}
      {v.combined ? <Fit minScale={0.7} style={{ color: T.dim, fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{`${v.combined.label}  ${v.combined.value}`}</Fit> : null}
    </View>
  );
}

/** Placeholder dos dois cartões enquanto as cotações carregam (sem valor real). */
export function TotalsSkeleton() {
  const bar = (w: number | `${number}%`, h: number) => <Skeleton width={w} height={h} />;
  const card = (key: string) => (
    <View key={key} style={cardSurface({ padding: S.xl, gap: S.lg })}>
      {bar(128, 12)}
      {bar(200, 32)}
      <View style={{ gap: S.lg }}>
        {bar('100%', 12)}
        {bar('100%', 12)}
      </View>
    </View>
  );
  return <View style={{ gap: S.lg }} accessibilityLabel="Carregando os totais">{card('a')}{card('b')}</View>;
}
