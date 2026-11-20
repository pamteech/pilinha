import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Fit, Text, cardSurface } from './ui';
import { Snapshot, UsdClose, splitTotals } from '../core';
import { S, T } from '../lib/theme';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.md, paddingTop: S.md, marginTop: 0, borderTopWidth: 1, borderTopColor: T.line }}>
      <Text numberOfLines={1} style={{ color: T.dim, fontSize: 14, lineHeight: 18, flex: 1, minWidth: 0 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 1, minWidth: 0, maxWidth: '58%' }}>{children}</View>
    </View>
  );
}

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
    <View style={{ gap: S.md }}>
      {v.investments.show ? box(<>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.md }}>
          <Text numberOfLines={1} style={{ color: T.dim, fontSize: 14, lineHeight: 18, flex: 1 }}>{v.investments.title}</Text>
          {onOpenCarteira ? <MaterialCommunityIcons name="chevron-right" size={22} color={T.dim} /> : null}
        </View>
        <Fit style={{ color: T.text, fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, marginTop: S.sm, marginBottom: S.sm }}>{v.investments.total}</Fit>
        {v.investments.dayPct || v.investments.dayChange ? (
          <Row label="Rendimento do dia">
            {v.investments.dayChange ? <Fit minScale={0.65} style={{ color: tone(v.investments.tone), fontSize: 15, lineHeight: 20, fontWeight: '700', textAlign: 'right' }}>{v.investments.dayChange}</Fit> : null}
            {v.investments.dayPct ? <Text numberOfLines={1} style={{ color: tone(v.investments.tone), fontSize: 15, lineHeight: 20, fontWeight: '700' }}>{v.investments.dayPct}</Text> : null}
          </Row>
        ) : null}
        {cdiAnnual != null ? (
          <Row label="CDI hoje">
            <Fit minScale={0.7} style={{ color: T.text, fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'right' }}>{`${cdiAnnual.toFixed(2).replace('.', ',')}% a.a.`}</Fit>
          </Row>
        ) : null}
        {netValue ? (
          <Row label="Líquido se resgatar hoje">
            <Fit minScale={0.65} style={{ color: T.text, fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'right' }}>{netValue}</Fit>
          </Row>
        ) : null}
      </>, 'inv', onOpenCarteira) : null}
      {v.usd ? box(<>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: T.champLight, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="currency-usd" size={22} color={T.pink} />
          </View>
          <Text numberOfLines={1} style={{ color: T.dim, fontSize: 14, lineHeight: 18, flex: 1 }}>{v.usd.title}</Text>
        </View>
        <Fit style={{ color: T.text, fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, marginTop: S.sm, marginBottom: S.sm }}>{v.usd.usd}</Fit>
        <Row label="Em reais">
          <Fit minScale={0.65} style={{ color: T.text, fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'right' }}>{v.usd.brl}</Fit>
        </Row>
        {v.usd.dayPct ? (
          <Row label="Variação do dólar hoje">
            <Text numberOfLines={1} style={{ color: tone(v.usd.tone), fontSize: 15, lineHeight: 20, fontWeight: '700' }}>{v.usd.dayPct}</Text>
          </Row>
        ) : null}
      </>, 'usd') : null}
      {v.combined ? <Fit minScale={0.7} style={{ color: T.dim, fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{`${v.combined.label}  ${v.combined.value}`}</Fit> : null}
    </View>
  );
}
