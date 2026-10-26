import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppState, Platform, Pressable, View } from 'react-native';
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Eyebrow, Text } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PilinhaProvider, usePilinha } from '../lib/store';
import { authenticate } from '../lib/auth';
import '../lib/alerts'; // registra a tarefa de segundo plano no início do app
import { T, S } from '../lib/theme';
// Ícones vetoriais (MaterialCommunityIcons): iguais no iPhone e na web.
const icon = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name']) => ({ color, size }: { color: any; size: number }) => (
  <MaterialCommunityIcons name={name} color={color} size={size} />
);
// Cabeçalho no estilo Lastro: faixa roxa escura, selo com cofrinho em lilás, eyebrow e título.
function Header({ title, back }: { title: string; back?: boolean }) {
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
        <Eyebrow>Pilinha</Eyebrow>
        <Text numberOfLines={1} style={{ color: T.onDark, fontSize: 21, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 }}>{title}</Text>
      </View>
      {!back && <View style={{ flexDirection: 'row', gap: S.sm }}>{btn('bell-outline', 'Alertas', () => router.navigate('/alertas'))}{btn('cog-outline', 'Ajustes', () => router.navigate('/ajustes'))}</View>}
    </View>
  );
}
// Exige Face ID ao abrir (e ao voltar do segundo plano) quando ligado nos Ajustes.
function Lock({ children }: { children: React.ReactNode }) {
  const { settings, ready } = usePilinha(); const [ok, setOk] = React.useState(false); const busy = React.useRef(false);
  const ask = React.useCallback(async () => { if (busy.current) return; busy.current = true; setOk(await authenticate('Abrir o Pilinha')); busy.current = false; }, []);
  React.useEffect(() => { if (ready && settings.faceOnOpen && !ok) ask(); }, [ready, settings.faceOnOpen]);
  React.useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st === 'background' && settings.faceOnOpen) setOk(false); if (st === 'active' && settings.faceOnOpen && !ok) ask(); }); return () => sub.remove(); }, [settings.faceOnOpen, ok, ask]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: T.navy }} />;
  if (!settings.faceOnOpen || ok) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: T.navy, alignItems: 'center', justifyContent: 'center', gap: S.lg, padding: S.xl }}>
      <MaterialCommunityIcons name="lock-outline" size={48} color={T.champ} />
      <Text style={{ color: T.onDark, fontSize: 20, lineHeight: 26, fontWeight: '700' }}>Pilinha bloqueado</Text>
      <Pressable onPress={ask} style={{ backgroundColor: T.champ, borderRadius: 999, paddingVertical: S.md, paddingHorizontal: S.xl }}>
        <Text style={{ color: T.navy, fontWeight: '700' }}>Desbloquear com Face ID</Text>
      </Pressable>
    </View>
  );
}
export default function Layout() {
  const [fontsOk] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  if (!fontsOk) return null;
  return (
    <PilinhaProvider><Lock>
      <StatusBar style="light" />
      <Tabs screenOptions={{ header: ({ options, route }) => <Header title={options.title ?? route.name} back={route.name === 'alertas' || route.name === 'ajustes'} />, headerShadowVisible: false, sceneStyle: { backgroundColor: T.bg }, tabBarStyle: { backgroundColor: T.card, borderTopColor: T.line, borderTopWidth: 1, ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8, paddingTop: 6 } : null) }, tabBarLabelStyle: { fontFamily: 'Manrope_600SemiBold', fontSize: 10 }, tabBarItemStyle: { paddingHorizontal: 0 }, tabBarActiveTintColor: T.pink, tabBarInactiveTintColor: T.dim }}>
        <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icon('piggy-bank-outline') }} />
        <Tabs.Screen name="carteira" options={{ title: 'Carteira', tabBarIcon: icon('wallet-outline') }} />
        <Tabs.Screen name="evolucao" options={{ title: 'Evolução', tabBarIcon: icon('chart-line') }} />
        <Tabs.Screen name="proventos" options={{ title: 'Proventos', tabBarIcon: icon('cash-multiple') }} />
        <Tabs.Screen name="graficos" options={{ title: 'Gráficos', tabBarIcon: icon('chart-box-outline') }} />
        <Tabs.Screen name="cadastro" options={{ title: 'Cadastro', tabBarIcon: icon('pencil-box-outline') }} />
        <Tabs.Screen name="alertas" options={{ title: 'Alertas de preço', href: null }} />
        <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', href: null }} />
      </Tabs>
    </Lock></PilinhaProvider>
  );
}
