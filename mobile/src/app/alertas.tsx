import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Chip, Field, Screen, SectionTitle, Txt } from '../components/ui';
import { AlertKind, alertLabel, isPositive, newAlertId, parseNumberBR } from '../core';
import { usePilinha } from '../lib/store';
import { permissionGranted, requestPermission } from '../lib/alerts';
import { T, S } from '../lib/theme';
const kinds: { k: AlertKind; label: string; ph: string }[] = [
  { k: 'above', label: 'Acima de', ph: 'Preço em R$ (ex. 40,00)' }, { k: 'below', label: 'Abaixo de', ph: 'Preço em R$ (ex. 30,00)' }, { k: 'dropPct', label: 'Cair % no dia', ph: 'Queda em % (ex. 3)' }];
export default function Alertas() {
  const { portfolio: p, alerts, setAlerts, snap } = usePilinha();
  const tickers = useMemo(() => [...new Set([...p.stocks.map(s => s.ticker.toUpperCase()), ...p.crypto.map(c => c.symbol.toUpperCase())])], [p]);
  const [t, setT] = useState<string | null>(null); const [kind, setKind] = useState<AlertKind>('below'); const [val, setVal] = useState('');
  const [perm, setPerm] = useState<boolean | null>(null);
  useEffect(() => { permissionGranted().then(setPerm); }, []);
  const cur = t ?? tickers[0] ?? null;
  const price = cur ? snap?.items.find(i => i.name.toUpperCase() === cur)?.unitPrice : null;
  const add = async () => {
    const v = parseNumberBR(val);
    if (!cur || !isPositive(v)) return Alert.alert('Confere aí', 'Escolha o ativo e digite o valor.');
    if (kind === 'dropPct' && v >= 100) return Alert.alert('Confere aí', 'A queda tem que ser menor que 100%.');
    if (!perm) setPerm(await requestPermission());
    await setAlerts([...alerts, { id: newAlertId(), ticker: cur, kind, value: v, enabled: true }]); setVal('');
  };
  return (
    <Screen>
      {perm === false && <Card style={{ backgroundColor: T.champLight, borderColor: T.champ }}>
        <Txt style={{ fontWeight: '600' }}>Notificações desligadas</Txt>
        <Txt dim style={{ fontSize: 13 }}>Para receber os alertas, permita as notificações. Se já recusou, ative em Ajustes do iPhone › Pilinha.</Txt>
        <Button title="Permitir notificações" onPress={async () => setPerm(await requestPermission())} />
      </Card>}
      <Card>
        <SectionTitle first>Novo alerta</SectionTitle>
        {!tickers.length ? <Txt dim>Cadastre ações ou bitcoin para criar alertas.</Txt> : <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{tickers.map(x => <Chip key={x} label={x} on={x === cur} onPress={() => setT(x)} />)}</View>
          {price != null && <Txt dim style={{ fontSize: 13 }}>Cotação agora: R$ {price.toFixed(2).replace('.', ',')}</Txt>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.xs }}>{kinds.map(x => <Chip key={x.k} label={x.label} on={x.k === kind} onPress={() => setKind(x.k)} />)}</View>
          <Field placeholder={kinds.find(x => x.k === kind)!.ph} keyboardType="decimal-pad" value={val} onChangeText={setVal} />
          <Button title="Criar alerta" onPress={add} />
        </>}
      </Card>
      <Card>
        <SectionTitle first>Seus alertas</SectionTitle>
        {!alerts.length && <Txt dim>Nenhum alerta ainda.</Txt>}
        {alerts.map((a, i) => (
          <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
            <MaterialCommunityIcons name={a.kind === 'above' ? 'arrow-up-bold-circle-outline' : a.kind === 'below' ? 'arrow-down-bold-circle-outline' : 'trending-down'} size={22} color={a.enabled ? (a.kind === 'above' ? T.up : T.down) : T.dim} />
            <Txt style={{ flex: 1, color: a.enabled ? T.text : T.dim }}>{alertLabel(a)}</Txt>
            <Pressable hitSlop={8} accessibilityLabel={a.enabled ? 'Pausar' : 'Ativar'} onPress={() => setAlerts(alerts.map(x => x.id === a.id ? { ...x, enabled: !x.enabled } : x))}>
              <MaterialCommunityIcons name={a.enabled ? 'bell-ring-outline' : 'bell-off-outline'} size={22} color={T.pink} />
            </Pressable>
            <Pressable hitSlop={8} accessibilityLabel="Remover" onPress={() => setAlerts(alerts.filter(x => x.id !== a.id))}>
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={T.down} />
            </Pressable>
          </View>))}
        <Txt dim style={{ fontSize: 12, marginTop: S.xs }}>Um aviso por alerta por dia. Em segundo plano o iPhone decide quando checar (em geral a cada 15 min ou mais).</Txt>
      </Card>
    </Screen>
  );
}
