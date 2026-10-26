import React from 'react';
import { ScrollView, Text, TextStyle, View, ViewStyle } from 'react-native';
import { T } from '../lib/theme';
export const Screen = ({ children }: { children: React.ReactNode }) => (
  <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} contentInsetAdjustmentBehavior="automatic">{children}</ScrollView>);
export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[{ backgroundColor: T.card, borderRadius: 16, padding: 14, gap: 6 }, style]}>{children}</View>);
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
          : <Text style={{ color: colorFor(dp), fontSize: 15, fontWeight: '600' }}>{C.pct(dp)}</Text>}
        {market && item.avgPrice != null && <Text style={{ color: T.dim, fontSize: 11 }}>PM {money(item.avgPrice, hidden)}</Text>}
      </View>
    </View>
  );
}
