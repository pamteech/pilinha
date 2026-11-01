import React from 'react';
import { Stack } from 'expo-router';
import { Header } from '../components/Header';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppState, Pressable, View } from 'react-native';
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Text } from '../components/ui';
import { PilinhaProvider, usePilinha } from '../lib/store';
import { authenticate } from '../lib/auth';
import '../lib/alerts'; // registra a tarefa de segundo plano no início do app
import { T, S } from '../lib/theme';
// Exige Face ID ao abrir (e ao voltar do segundo plano) quando ligado nos Ajustes.
function Lock({ children }: { children: React.ReactNode }) {
  const { settings, ready } = usePilinha(); const [ok, setOk] = React.useState(false); const busy = React.useRef(false);
  const ask = React.useCallback(async () => { if (busy.current) return; busy.current = true; setOk(await authenticate('Abrir o Pilinvest')); busy.current = false; }, []);
  React.useEffect(() => { if (ready && settings.faceOnOpen && !ok) ask(); }, [ready, settings.faceOnOpen]);
  React.useEffect(() => { const sub = AppState.addEventListener('change', st => { if (st === 'background' && settings.faceOnOpen) setOk(false); if (st === 'active' && settings.faceOnOpen && !ok) ask(); }); return () => sub.remove(); }, [settings.faceOnOpen, ok, ask]);
  // O navegador (Tabs) fica sempre montado: trocar a árvore antes de carregar perdia a rota (ia sempre para o Início).
  const locked = !ready || (settings.faceOnOpen && !ok);
  return (<View style={{ flex: 1 }}>{children}{locked && (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: T.navy, alignItems: 'center', justifyContent: 'center', gap: S.lg, padding: S.xl }}>{ready && <>
      <MaterialCommunityIcons name="lock-outline" size={48} color={T.champ} />
      <Text style={{ color: T.onDark, fontSize: 20, lineHeight: 26, fontWeight: '700' }}>Pilinvest bloqueado</Text>
      <Pressable onPress={ask} style={{ backgroundColor: T.champ, borderRadius: 999, paddingVertical: S.md, paddingHorizontal: S.xl }}>
        <Text style={{ color: T.navy, fontWeight: '700' }}>Desbloquear com Face ID</Text>
      </Pressable></>}
    </View>)}</View>
  );
}
// Garante que abrir o app (ou um link) sempre tenha as abas por baixo.
export const unstable_settings = { initialRouteName: '(tabs)', anchor: '(tabs)' };
export default function Layout() {
  const [fontsOk] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  if (!fontsOk) return null;
  return (
    <PilinhaProvider><Lock>
      <StatusBar style="light" />
      {/* Raiz: as abas ficam embaixo e só Ajustes/Alertas sobem por cima com voltar. Qualquer outra rota fica sem header próprio. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="alertas" options={{ headerShown: true, header: () => <Header title="Alertas de preço" back /> }} />
        <Stack.Screen name="ajustes" options={{ headerShown: true, header: () => <Header title="Ajustes" back /> }} />
      </Stack>
    </Lock></PilinhaProvider>
  );
}
