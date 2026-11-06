import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Chip, Field, Screen, SectionTitle, ToggleRow, Txt } from '../components/ui';
import { AlertKind, BROWSER_UA, BTC_TICKER, USD_DROP_STEPS, USD_TICKER, TickerHit, alertAssetName, alertLabel, brl, cryptoBRL, defaultFetcher, isPositive, localSearch, mergeHits, newAlertId, normTicker, parseNumberBR, parseYahooSearch, stockQuote, usdQuote, validAlertTicker, validTicker, yahooSearchURL } from '../core';
import { usePilinha } from '../lib/store';
import { permissionGranted, requestPermission, usdAlertOf } from '../lib/alerts';
import * as St from '../lib/storage';
import { T, S } from '../lib/theme';
// Alertas valem para qualquer ação ou FII (busca por nome ou código, mesmo sem ter na carteira), dólar e bitcoin.
const kinds: { k: AlertKind; label: string; ph: string }[] = [
  { k: 'below', label: 'Abaixo de', ph: 'Preço em R$ (ex. 30,00)' }, { k: 'above', label: 'Acima de', ph: 'Preço em R$ (ex. 40,00)' }, { k: 'dropPct', label: 'Cair % no dia', ph: 'Queda em % (ex. 3)' }, { k: 'risePct', label: 'Subir % no dia', ph: 'Alta em % (ex. 3)' }];
export default function Alertas() {
  const { portfolio: p, alerts, setAlerts, snap, settings, setSettings } = usePilinha();
  const [perm, setPerm] = useState<boolean | null>(null);
  useEffect(() => { permissionGranted().then(setPerm); }, []);
  const usd = usdAlertOf(settings);
  const setUsd = async (x: Partial<typeof usd>) => { const nx = { ...usd, ...x }; if (nx.enabled && !perm) setPerm(await requestPermission()); await setSettings({ ...settings, usdAlert: nx }); };
  const stepLabel = (v: number) => (v === 0 ? 'Qualquer queda' : `${String(v).replace('.', ',')}% ou mais`);
  // Atalhos: dólar, bitcoin, o que está na carteira e os favoritos; o resto pela busca.
  const quick = useMemo(() => [USD_TICKER, BTC_TICKER, ...new Set([...p.stocks.map(s => s.ticker.toUpperCase()), ...(p.watchlist ?? []).map(w => w.ticker.toUpperCase())])], [p]);
  const [t, setT] = useState<string>(quick[2] ?? USD_TICKER); const [kind, setKind] = useState<AlertKind>('below'); const [val, setVal] = useState('');
  const [q, setQ] = useState(''); const [hits, setHits] = useState<TickerHit[]>([]);
  useEffect(() => {
    const local = localSearch(q); setHits(local);
    if (q.trim().length < 2) return;
    let alive = true;
    const h = setTimeout(async () => { try { const r = parseYahooSearch(await defaultFetcher(yahooSearchURL(q), { 'User-Agent': BROWSER_UA })); if (alive) setHits(mergeHits(local, r)); } catch {} }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [q]);
  const choose = (x: string) => { setT(x); setQ(''); setHits([]); };
  // Cotação do ativo escolhido: do snapshot se estiver lá; senão busca na hora (ação fora da carteira, dólar, bitcoin).
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    const fromSnap = t === USD_TICKER ? snap?.usdBRL ?? null : snap?.items.find(i => i.name.toUpperCase() === t)?.unitPrice ?? snap?.watch?.find(w => w.ticker === t)?.price ?? null;
    if (fromSnap != null) { setPrice(fromSnap); return; }
    setPrice(null); let alive = true;
    (async () => {
      try {
        const v = t === USD_TICKER ? (await usdQuote()).bid : t === BTC_TICKER ? (await cryptoBRL(['bitcoin'])).bitcoin?.price ?? null : validTicker(t) ? (await stockQuote(t, await St.loadToken())).price : null;
        if (alive) setPrice(v);
      } catch { if (alive) setPrice(null); }
    })();
    return () => { alive = false; };
  }, [t, snap]);
  const add = async () => {
    const v = parseNumberBR(val);
    if (!validAlertTicker(t)) return Alert.alert('Confere aí', 'Escolha o ativo: dólar, bitcoin ou uma ação/FII pelo código (ex. PETR4).');
    if (!isPositive(v)) return Alert.alert('Confere aí', 'Digite o valor do alerta.');
    if ((kind === 'dropPct' || kind === 'risePct') && v >= 100) return Alert.alert('Confere aí', 'A variação tem que ser menor que 100%.');
    if (!perm) setPerm(await requestPermission());
    await setAlerts([...alerts, { id: newAlertId(), ticker: normTicker(t), kind, value: v, enabled: true }]); setVal('');
    Alert.alert('Alerta criado', `${alertLabel({ id: '', ticker: normTicker(t), kind, value: v, enabled: true })}. Você recebe uma notificação quando acontecer.`);
  };
  return (
    <Screen>
      {perm === false && <Card style={{ backgroundColor: T.champLight, borderColor: T.champ }}>
        <Txt style={{ fontWeight: '600' }}>Notificações desligadas</Txt>
        <Txt dim style={{ fontSize: 13 }}>Para receber os alertas, permita as notificações. Se já recusou, ative em Ajustes do iPhone › Pilinvest.</Txt>
        <Button title="Permitir notificações" onPress={async () => setPerm(await requestPermission())} />
      </Card>}
      <Card>
        <SectionTitle first>Criar alerta de preço</SectionTitle>
        <Txt dim style={{ fontSize: 13 }}>O Pilinvest avisa quando o ativo chegar no preço ou variar no dia. Vale para qualquer ação ou FII, mesmo que você ainda não tenha, para o dólar e para o bitcoin.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{quick.map(x => <Chip key={x} label={alertAssetName(x)} on={x === t} onPress={() => choose(x)} />)}</View>
        <Field placeholder="Outra ação ou FII (ex. PETR4 ou Petrobras)" autoCapitalize="characters" autoCorrect={false} value={q}
          onChangeText={x => { setQ(x); const n = normTicker(x); if (validTicker(n)) setT(n); }} />
        {hits.length > 0 && <Card style={{ padding: S.sm, gap: 0 }}>
          {hits.map((h, i) => (
            <Pressable key={h.ticker} onPress={() => choose(h.ticker)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.sm + 2, paddingHorizontal: S.sm, borderBottomWidth: i === hits.length - 1 ? 0 : 1, borderBottomColor: T.line }}>
              <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700', fontSize: 14 }}>{h.ticker}</Txt><Txt dim style={{ fontSize: 12 }}>{h.name}</Txt></View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={T.dim} />
            </Pressable>))}
        </Card>}
        <Txt style={{ fontWeight: '600' }}>{alertAssetName(t)}{price != null ? <Txt dim style={{ fontSize: 13 }}>{`  · cotação agora ${brl(price)}`}</Txt> : null}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{kinds.map(x => <Chip key={x.k} label={x.label} on={x.k === kind} onPress={() => setKind(x.k)} />)}</View>
        <Field placeholder={kinds.find(x => x.k === kind)!.ph} keyboardType="decimal-pad" value={val} onChangeText={setVal} />
        <Button title="Criar alerta" onPress={add} />
      </Card>
      <Card>
        <SectionTitle first>Seus alertas</SectionTitle>
        {!alerts.length && <Txt dim>Nenhum alerta ainda. Os favoritos de "Quero comprar" avisam sozinhos quando chegam no preço.</Txt>}
        {alerts.map((a, i) => (
          <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
            <MaterialCommunityIcons name={a.kind === 'above' ? 'arrow-up-bold-circle-outline' : a.kind === 'below' ? 'arrow-down-bold-circle-outline' : a.kind === 'risePct' ? 'trending-up' : 'trending-down'} size={22} color={a.enabled ? (a.kind === 'above' || a.kind === 'risePct' ? T.up : T.down) : T.dim} />
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
      <Card>
        <SectionTitle first>Fechamento do dólar</SectionTitle>
        <ToggleRow label="Avisar quando o dólar fechar em queda" hint="No fechamento (depois das 17h, dias úteis), com a manchete do motivo. Toque no aviso para ler a notícia." value={usd.enabled} onChange={v => setUsd({ enabled: v })} />
        {usd.enabled ? <>
          <Txt dim style={{ fontSize: 13 }}>Avisar quando cair:</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{USD_DROP_STEPS.map(v => <Chip key={v} label={stepLabel(v)} on={usd.minDropPct === v} onPress={() => setUsd({ minDropPct: v })} />)}</View>
          {snap?.usdBRL != null ? <Txt dim style={{ fontSize: 13 }}>Dólar agora: R$ {snap.usdBRL.toFixed(2).replace('.', ',')}{snap.usdChangePct != null ? ` (${(snap.usdChangePct >= 0 ? '+' : '') + snap.usdChangePct.toFixed(2).replace('.', ',')}% hoje)` : ''}</Txt> : null}
          <Txt dim style={{ fontSize: 12 }}>A manchete vem do Google Notícias (busca fixa por "dólar hoje"; nada da sua carteira é enviado). O motivo é o que a imprensa apontou, não uma análise do Pilinvest.</Txt>
        </> : null}
      </Card>
    </Screen>
  );
}
