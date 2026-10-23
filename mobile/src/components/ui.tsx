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
