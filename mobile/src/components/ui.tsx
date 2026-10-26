import React from 'react';
import { ScrollView, StyleSheet, Text as RNText, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { T, S, R, fontFor, lineHeightFor } from '../lib/theme';
// Text com Manrope (a família muda conforme o peso).
export const Text = ({ style, ...p }: TextProps) => { const f = StyleSheet.flatten(style) || {}; return <RNText {...p} style={[style, { fontFamily: fontFor(f.fontWeight), fontWeight: undefined, lineHeight: lineHeightFor(f.fontSize ?? 15, f.lineHeight) }]} />; };
export const Eyebrow = ({ children, color = T.champ }: { children: React.ReactNode; color?: string }) => (
  <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color, fontWeight: '600' }}>{children}</Text>);
export const screenPad = { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.xxl, gap: S.lg } as const;
export const Screen = ({ children }: { children: React.ReactNode }) => (
  <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={screenPad} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}>{children}</ScrollView>);
// Título de seção dentro de card: mais espaço acima do que abaixo.
export const SectionTitle = ({ children, right, first }: { children: React.ReactNode; right?: React.ReactNode; first?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: first ? 0 : S.sm, marginBottom: S.xs }}>
    <Eyebrow color={T.text}>{children}</Eyebrow>{right}
  </View>);
// Mede a largura disponível (para gráficos não estourarem em telas pequenas).
export function Measure({ height, children }: { height: number; children: (w: number) => React.ReactNode }) {
  const [w, setW] = React.useState(0);
  return <View style={{ height, width: '100%' }} onLayout={e => setW(Math.floor(e.nativeEvent.layout.width))}>{w > 0 ? children(w) : null}</View>;
}
export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ backgroundColor: T.card, borderRadius: R.card, padding: S.lg, gap: S.sm, borderWidth: 1, borderColor: T.line }, style]}>{children}</View>);
export const Txt = ({ children, style, dim }: { children: React.ReactNode; style?: TextStyle; dim?: boolean }) => (
  <Text style={[{ color: dim ? T.dim : T.text, fontSize: 15 }, (StyleSheet.flatten(style)?.fontSize ?? 15) <= 16 ? { lineHeight: 22 } : null, style]}>{children}</Text>);
export const money = (v: number, hidden: boolean) => (hidden ? 'R$ ••••' : require('../core').brl(v));
export const colorFor = (v: number | null | undefined) => (v == null ? T.dim : v >= 0 ? T.up : T.down);
// Linha compacta de um ativo: renda fixa mostra a % do dia; ações/FIIs/cripto mostram a cotação e o PM.
export function AssetRow({ item, hidden, label, last }: { item: import('../core').LineItem; hidden: boolean; label?: string; last?: boolean }) {
  const C = require('../core');
  const market = C.isMarket(item), dp = C.itemDayPct(item), vs = C.priceVsAvg(item);
  const qColor = vs === 'up' ? T.up : vs === 'down' ? T.down : T.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.md, gap: S.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>{item.name}{label ? <Text style={{ color: T.dim, fontWeight: '400', fontSize: 12 }}>  {label}</Text> : null}</Text>
        <Text style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>{money(item.current, hidden)}{item.net != null && !hidden ? ` · líq. ${money(item.net, false)}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {market && item.unitPrice != null
          ? <Text style={{ color: qColor, fontSize: 15, fontWeight: '600' }}>{C.brl(item.unitPrice)}</Text>
          : <View style={{ backgroundColor: dp == null ? T.neutralLight : dp >= 0 ? T.upLight : T.downLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: colorFor(dp), fontSize: 12, fontWeight: '600' }}>{C.pct(dp)}</Text></View>}
        {market && item.avgPrice != null && <Text style={{ color: T.dim, fontSize: 11 }}>PM {money(item.avgPrice, hidden)}</Text>}
      </View>
    </View>
  );
}
