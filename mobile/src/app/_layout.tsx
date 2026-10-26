import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PilinhaProvider } from '../lib/store';
import { T } from '../lib/theme';
// SF Symbols no iOS; emoji como reserva onde o SymbolView não existe (web/preview).
const icon = (name: SFSymbol, fallback: string) => ({ color, size }: { color: any; size: number }) => (
  <SymbolView name={name} tintColor={color} size={size} fallback={<Text style={{ fontSize: size - 4 }}>{fallback}</Text>} />
);
// Cabeçalho roxo, no tom do porquinho, sem a linha branca.
function Header({ title }: { title: string }) {
  const top = useSafeAreaInsets().top;
  return (
    <View style={{ backgroundColor: T.purple, paddingTop: top + 8, paddingBottom: 12, paddingHorizontal: 18, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 22 }}>🐷</Text>
      <Text style={{ color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.3 }}>{title}</Text>
    </View>
  );
}
export default function Layout() {
  return (
    <PilinhaProvider>
      <StatusBar style="light" />
      <Tabs screenOptions={{ header: ({ options, route }) => <Header title={options.title ?? route.name} />, headerShadowVisible: false, sceneStyle: { backgroundColor: T.bg }, tabBarStyle: { backgroundColor: T.purpleDeep, borderTopWidth: 0 }, tabBarActiveTintColor: T.pink, tabBarInactiveTintColor: T.dim }}>
        <Tabs.Screen name="index" options={{ title: 'Pilinha', tabBarIcon: icon('house.fill', '🐷') }} />
        <Tabs.Screen name="carteira" options={{ title: 'Carteira', tabBarIcon: icon('list.bullet.rectangle.fill', '📋') }} />
        <Tabs.Screen name="evolucao" options={{ title: 'Evolução', tabBarIcon: icon('chart.line.uptrend.xyaxis', '📈') }} />
        <Tabs.Screen name="proventos" options={{ title: 'Proventos', tabBarIcon: icon('dollarsign.circle.fill', '💰') }} />
        <Tabs.Screen name="graficos" options={{ title: 'Gráficos', tabBarIcon: icon('chart.xyaxis.line', '📊') }} />
        <Tabs.Screen name="cadastro" options={{ title: 'Cadastro', tabBarIcon: icon('square.and.pencil', '✏️') }} />
      </Tabs>
    </PilinhaProvider>
  );
}
