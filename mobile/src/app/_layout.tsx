import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PilinhaProvider } from '../lib/store';
import { T } from '../lib/theme';
export default function Layout() {
  return (
    <PilinhaProvider>
      <StatusBar style="light" />
      <Tabs screenOptions={{ headerStyle: { backgroundColor: T.bg }, headerTintColor: T.text, tabBarStyle: { backgroundColor: T.bg, borderTopColor: T.line }, tabBarActiveTintColor: T.pink, tabBarInactiveTintColor: T.dim }}>
        <Tabs.Screen name="index" options={{ title: 'Pilinha' }} />
        <Tabs.Screen name="carteira" options={{ title: 'Carteira' }} />
        <Tabs.Screen name="evolucao" options={{ title: 'Evolução' }} />
        <Tabs.Screen name="proventos" options={{ title: 'Proventos' }} />
        <Tabs.Screen name="cadastro" options={{ title: 'Cadastro' }} />
      </Tabs>
    </PilinhaProvider>
  );
}
