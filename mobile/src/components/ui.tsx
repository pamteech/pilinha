import React from 'react';
import { ScrollView, StyleSheet, Text as RNText, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { T, fontFor } from '../lib/theme';
// Text com Manrope (a família muda conforme o peso).
export const Text = ({ style, ...p }: TextProps) => { const f = StyleSheet.flatten(style) || {}; return <RNText {...p} style={[style, { fontFamily: fontFor(f.fontWeight), fontWeight: undefined }]} />; };
export const Eyebrow = ({ children, color = T.champ }: { children: React.ReactNode; color?: string }) => (
  <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color, fontWeight: '600' }}>{children}</Text>);
export const Screen = ({ children }: { children: React.ReactNode }) => (
  <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ padding: 20, gap: 14 }} contentInsetAdjustmentBehavior="automatic">{children}</ScrollView>);
export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ backgroundColor: T.card, borderRadius: 18, padding: 14, gap: 6, borderWidth: 1, borderColor: T.line }, style]}>{children}</View>);
export const Txt = ({ children, style, dim }: { children: React.ReactNode; style?: TextStyle; dim?: boolean }) => (
  <Text style={[{ color: dim ? T.dim : T.text, fontSize: 15 }, style]}>{children}</Text>);
export const money = (v: number, hidden: boolean) => (hidden ? 'R$ ••••' : require('../core').brl(v));
export const colorFor = (v: number | null | undefined) => (v == null ? T.dim : v >= 0 ? T.up : T.down);
// Linha compacta de um ativo: renda fixa mostra a % do dia; ações/FIIs/cripto mostram a cotação e o PM.
export function AssetRow({ item, hidden, label }: { item: import('../core').LineItem; hidden: boolean; label?: string }) {
  const C = require('../core');
  const market = C.isMarket(item), dp = C.itemDayPct(item), vs = C.priceVsAvg(item);
  const qColor = vs === 'up' ? T.up : vs === 'down' ? T.down : T.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>{item.name}{label ? <Text style={{ color: T.dim, fontWeight: '400', fontSize: 12 }}>  {label}</Text> : null}</Text>
        <Text style={{ color: T.dim, fontSize: 12 }}>{money(item.current, hidden)}{item.net != null && !hidden ? ` · líq. ${money(item.net, false)}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {market && item.unitPrice != null
          ? <Text style={{ color: qColor, fontSize: 15, fontWeight: '600' }}>{C.brl(item.unitPrice)}</Text>
          : <View style={{ backgroundColor: dp == null ? T.neutralLight : dp >= 0 ? T.upLight : T.downLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: colorFor(dp), fontSize: 12, fontWeight: '600' }}>{C.pct(dp)}</Text></View>}
        {market && item.avgPrice != null && <Text style={{ color: T.dim, fontSize: 11 }}>PM {money(item.avgPrice, hidden)}</Text>}
      </View>
    </View>
  );
}
