import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Eyebrow, Text } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PilinhaProvider } from '../lib/store';
import { T, S } from '../lib/theme';
// Ícones vetoriais (MaterialCommunityIcons): iguais no iPhone e na web.
const icon = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name']) => ({ color, size }: { color: any; size: number }) => (
  <MaterialCommunityIcons name={name} color={color} size={size} />
);
// Cabeçalho no estilo Lastro: faixa roxa escura, selo com cofrinho em lilás, eyebrow e título.
function Header({ title }: { title: string }) {
  const top = useSafeAreaInsets().top;
  return (
    <View style={{ backgroundColor: T.navy, paddingTop: top + S.md, paddingBottom: S.lg, paddingHorizontal: S.lg, flexDirection: 'row', alignItems: 'center', gap: S.md }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: T.navy2, borderWidth: 1, borderColor: 'rgba(208,176,224,0.5)', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="piggy-bank-outline" size={22} color={T.champ} />
      </View>
      <View>
        <Eyebrow>Pilinha</Eyebrow>
        <Text style={{ color: T.onDark, fontSize: 21, fontWeight: '700', letterSpacing: -0.3 }}>{title}</Text>
      </View>
    </View>
  );
}
export default function Layout() {
  const [fontsOk] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  if (!fontsOk) return null;
  return (
    <PilinhaProvider>
      <StatusBar style="light" />
      <Tabs screenOptions={{ header: ({ options, route }) => <Header title={options.title ?? route.name} />, headerShadowVisible: false, sceneStyle: { backgroundColor: T.bg }, tabBarStyle: { backgroundColor: T.card, borderTopColor: T.line, borderTopWidth: 1, ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8, paddingTop: 6 } : null) }, tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 10 }, tabBarItemStyle: { paddingHorizontal: 0 }, tabBarActiveTintColor: T.pink, tabBarInactiveTintColor: T.dim }}>
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('piggy-bank-outline') }} />
        <Tabs.Screen name="carteira" options={{ title: 'Carteira', tabBarIcon: icon('wallet-outline') }} />
        <Tabs.Screen name="evolucao" options={{ title: 'Evolução', tabBarIcon: icon('chart-line') }} />
        <Tabs.Screen name="proventos" options={{ title: 'Proventos', tabBarIcon: icon('cash-multiple') }} />
        <Tabs.Screen name="graficos" options={{ title: 'Gráficos', tabBarIcon: icon('chart-box-outline') }} />
        <Tabs.Screen name="cadastro" options={{ title: 'Cadastro', tabBarIcon: icon('pencil-box-outline') }} />
      </Tabs>
    </PilinhaProvider>
  );
}
