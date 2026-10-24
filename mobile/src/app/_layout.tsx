import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { Text } from 'react-native';
import { PilinhaProvider } from '../lib/store';
import { T } from '../lib/theme';
// SF Symbols no iOS; emoji como reserva onde o SymbolView não existe (web/preview).
const icon = (name: SFSymbol, fallback: string) => ({ color, size }: { color: any; size: number }) => (
  <SymbolView name={name} tintColor={color} size={size} fallback={<Text style={{ fontSize: size - 4 }}>{fallback}</Text>} />
);
export default function Layout() {
  return (
    <PilinhaProvider>
      <StatusBar style="light" />
      <Tabs screenOptions={{ headerStyle: { backgroundColor: T.bg }, headerTintColor: T.text, tabBarStyle: { backgroundColor: T.bg, borderTopColor: T.line }, tabBarActiveTintColor: T.pink, tabBarInactiveTintColor: T.dim }}>
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
