import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';
import { usePilinha } from '../lib/store';
import { T } from '../lib/theme';
// Link do QR do Mac (pilinha://sync?code=... ou pilinha:///sync?code=...): conecta e volta para o app.
export default function SyncLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { connectMac } = usePilinha();
  useEffect(() => {
    (async () => {
      if (code) {
        const r = await connectMac(String(code));
        Alert.alert(r.status === 'error' ? 'Não deu para conectar' : 'Conectado ao Mac', r.status === 'error' ? r.message ?? '' : 'A carteira do Mac vai aparecer aqui sozinha.');
      }
      if (router.canGoBack()) router.back(); else router.replace('/cadastro');
    })();
  }, [code]);
  return <View style={{ flex: 1, backgroundColor: T.bg }} />;
}
