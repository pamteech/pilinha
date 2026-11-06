import React from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eyebrow, Text } from './ui';
import { T, S } from '../lib/theme';
export const icon = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name']) => ({ color, size }: { color: any; size: number }) => (
  <MaterialCommunityIcons name={name} color={color} size={size} />
);
// Cabeçalho no estilo Lastro: faixa roxa escura, selo com cofrinho em lilás, eyebrow e título.
export function Header({ title, back }: { title: string; back?: boolean }) {
  const top = useSafeAreaInsets().top; const router = useRouter();
  const btn = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name'], label: string, go: () => void) => (
    <Pressable onPress={go} accessibilityLabel={label} hitSlop={8} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: T.navy2 }}>
      <MaterialCommunityIcons name={name} size={22} color={T.onDark} />
    </Pressable>);
  return (
    <View style={{ backgroundColor: T.navy, paddingTop: top + S.md, paddingBottom: S.lg, paddingHorizontal: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      {back ? btn('chevron-left', 'Voltar', () => (router.canGoBack() ? router.back() : router.navigate('/'))) :
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.navy2, borderWidth: 1, borderColor: 'rgba(208,176,224,0.5)', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="piggy-bank-outline" size={22} color={T.champ} />
      </View>}
      <View style={{ flex: 1 }}>
        <Eyebrow>Pilinvest</Eyebrow>
        <Text numberOfLines={1} style={{ color: T.onDark, fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 }}>{title}</Text>
      </View>
      {!back && <View style={{ flexDirection: 'row', gap: S.sm }}>
        <Pressable onPress={() => router.navigate('/alertas')} accessibilityLabel="Alertas de preço" hitSlop={8} style={{ height: 40, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: T.navy2 }}>
          <MaterialCommunityIcons name="bell-plus-outline" size={20} color={T.onDark} /><Text style={{ color: T.onDark, fontWeight: '600', fontSize: 13 }}>Alertas</Text>
        </Pressable>
        {btn('cog-outline', 'Ajustes', () => router.navigate('/ajustes'))}</View>}
    </View>
  );
}
