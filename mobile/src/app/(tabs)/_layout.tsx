import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Header, icon } from '../../components/Header';
import { T } from '../../lib/theme';
const TITLES: Record<string, string> = { index: 'Início', carteira: 'Carteira', evolucao: 'Evolução', proventos: 'Proventos', graficos: 'Gráficos', cadastro: 'Cadastro' };
// Nunca mostra nome de arquivo/rota cru no cabeçalho.
const tabTitle = (t: string | undefined, name: string) => t ?? TITLES[name] ?? 'Pilinvest';
export const unstable_settings = { initialRouteName: 'index' };
export default function TabsLayout() {
  return (
    <Tabs backBehavior="history" screenOptions={{ header: ({ options, route }) => <Header title={tabTitle(options.title, route.name)} />, headerShadowVisible: false, sceneStyle: { backgroundColor: T.bg }, tabBarStyle: { backgroundColor: T.card, borderTopColor: T.line, borderTopWidth: 1, ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8, paddingTop: 6 } : null) }, tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 10 }, tabBarItemStyle: { paddingHorizontal: 0 }, tabBarActiveTintColor: T.pink, tabBarInactiveTintColor: T.dim }}>
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('piggy-bank-outline') }} />
        <Tabs.Screen name="carteira" options={{ title: 'Carteira', tabBarIcon: icon('wallet-outline') }} />
        <Tabs.Screen name="evolucao" options={{ title: 'Evolução', tabBarIcon: icon('chart-line') }} />
        <Tabs.Screen name="proventos" options={{ title: 'Proventos', tabBarIcon: icon('cash-multiple') }} />
        <Tabs.Screen name="graficos" options={{ title: 'Gráficos', tabBarIcon: icon('chart-box-outline') }} />
        <Tabs.Screen name="cadastro" options={{ title: 'Cadastro', tabBarIcon: icon('pencil-box-outline') }} />
    </Tabs>
  );
}
