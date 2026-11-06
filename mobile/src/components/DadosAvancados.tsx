import { useState } from 'react';
import { Alert, TextInput } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Card, SectionTitle, Txt, Button as Btn } from './ui';
import { Portfolio, parsePortfolio, mergePortfolio, serializePortfolio } from '../core';
import { usePilinha } from '../lib/store';
import { T, S, R } from '../lib/theme';
// Antes ficava no Cadastro: conectar ao Mac, exportar/importar e token da brapi (agora nos Ajustes).
const Input = (p: React.ComponentProps<typeof TextInput>) => <TextInput placeholderTextColor={T.dim} maxFontSizeMultiplier={1.3} keyboardAppearance="light" {...p} style={{ color: T.text, fontFamily: 'Manrope_400Regular', backgroundColor: T.bg, borderRadius: R.inner, paddingHorizontal: S.md, paddingVertical: S.md, fontSize: 15, borderWidth: 1, borderColor: T.line }} />;
export function DadosAvancados() {
  const { portfolio: p, update, setToken, hasToken, sync, connectMac, disconnectMac, syncNow } = usePilinha();
  const save = (np: Portfolio) => update(np);
  const [tok, setTok] = useState('');
  const [code, setCode] = useState('');
  const bad = (m: string) => Alert.alert('Confere aí', m);
  const exportar = async () => {
    try {
      const f = new File(Paths.cache, 'portfolio.json'); if (f.exists) f.delete(); f.create(); f.write(serializePortfolio(p));
      await Sharing.shareAsync(f.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Exportar carteira' });
    } catch (e) { bad(`Não deu para exportar: ${(e as Error).message}`); }
  };
  const importar = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const np = parsePortfolio(await new File(r.assets[0].uri).text());
      Alert.alert('Importar carteira', 'Isso substitui a carteira deste iPhone. Continuar?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Importar', onPress: () => save(np) }]);
    } catch (e) { bad((e as Error).message); }
  };
  const importarDoMac = async () => {
    try {
      Alert.alert('Importar do Mac', 'Na próxima tela, abra iCloud Drive > Pilinha > carteira.json (o Pilinvest do Mac atualiza esse arquivo sozinho).', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Escolher arquivo', onPress: async () => {
          try {
            const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true });
            if (r.canceled || !r.assets?.[0]) return;
            const mac = parsePortfolio(await new File(r.assets[0].uri).text());
            const n = mac.stocks.length + mac.crypto.length + mac.fixedIncome.length;
            save(mergePortfolio(p, mac));
            Alert.alert('Pronto', `${n} item(ns) do Mac atualizados aqui. O que só existe no iPhone foi mantido.`);
          } catch (e) { bad((e as Error).message); }
        } },
      ]);
    } catch (e) { bad((e as Error).message); }
  };
  return (
    <>
      <Card>
        <SectionTitle first>Conectar ao Mac</SectionTitle>
        {sync.connected ? <>
          <Txt dim>{sync.status === 'syncing' ? 'Buscando a carteira do Mac…' : sync.status === 'ok' ? `Conectado. A carteira do Mac chega sozinha (${sync.message}${sync.macUpdatedAt ? `, enviada ${new Date(sync.macUpdatedAt).toLocaleString('pt-BR')}` : ''}). O que você edita aqui fica salvo; o Mac só substitui um item quando ele muda lá. O que só existe no iPhone fica.` : sync.message ?? 'Conectado.'}</Txt>
          <Btn title="Buscar agora" onPress={async () => { const r = await syncNow(); if (r.status === 'error') bad(r.message ?? 'Não deu.'); }} />
          <Btn title="Desconectar do Mac" onPress={() => Alert.alert('Desconectar do Mac', 'A carteira deste iPhone fica como está, mas para de receber as mudanças do Mac.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desconectar', style: 'destructive', onPress: () => disconnectMac() }])} />
        </> : <>
          <Txt dim>No Mac: menu do cofrinho ▸ Conectar ao iPhone… Digite o código que aparecer (ou aponte a Câmera do iPhone para o QR). A carteira vai cifrada: só este iPhone e o Mac conseguem ler.</Txt>
          {sync.status === 'error' && sync.message ? <Txt dim>{sync.message}</Txt> : null}
          <Input placeholder="Código do Mac (ex. ABCD-EFGH-2345-6789)" autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} />
          <Btn title="Conectar" onPress={async () => { const r = await connectMac(code); if (r.status !== 'error') setCode(''); else bad(r.message ?? 'Não deu.'); if (r.status === 'ok') Alert.alert('Pronto', `Conectado ao Mac: ${r.message}.`); }} />
        </>}
      </Card>
      <Card>
        <SectionTitle first>Levar a carteira entre Mac e iPhone</SectionTitle>
        <Txt dim>Mesmo formato do portfolio.json do Mac (~/.notchinvest). O arquivo tem os valores: mande só por AirDrop ou guarde no Arquivos.</Txt>
        <Btn title="Exportar arquivo" onPress={exportar} />
        <Btn title="Importar do Mac (iCloud Drive)" onPress={importarDoMac} />
        <Btn title="Importar arquivo (substitui tudo)" onPress={importar} />
      </Card>
      <Card>
        <SectionTitle first>Token da brapi (opcional, só para proventos)</SectionTitle>
        <Txt dim>{hasToken ? 'Token salvo no Keychain.' : 'Sem token: cotações pelo Yahoo Finance.'}</Txt>
        <Input placeholder="Colar token" secureTextEntry value={tok} onChangeText={setTok} />
        <Btn title={tok ? 'Salvar token' : 'Apagar token'} onPress={() => { setToken(tok); setTok(''); }} />
      </Card>
    </>
  );
}
