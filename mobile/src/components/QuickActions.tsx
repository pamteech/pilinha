import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from './ui';
import { S, T, TY } from '../lib/theme';

const ACTIONS: { label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; href: string }[] = [
  { label: 'Carteira', icon: 'wallet-outline', href: '/carteira' },
  { label: 'Proventos', icon: 'cash-multiple', href: '/proventos' },
  { label: 'Cadastro', icon: 'pencil-box-outline', href: '/cadastro' },
  { label: 'Meu plano', icon: 'flag-checkered', href: '/plano' },
];

/** Atalhos do Início: Carteira, Proventos, Cadastro e Meu plano. Sem operação de compra ou venda. */
export function QuickActions() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: S.sm }} accessibilityRole="toolbar" accessibilityLabel="Atalhos">
      {ACTIONS.map(a => (
        <Pressable key={a.href} onPress={() => router.navigate(a.href as any)} accessibilityRole="button" accessibilityLabel={a.label} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: S.sm }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.champLight, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={a.icon} size={22} color={T.pink} />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: T.text, ...TY.label, textAlign: 'center', width: '100%' }}>{a.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
