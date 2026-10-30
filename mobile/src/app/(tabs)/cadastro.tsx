import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { Card, Screen, Txt } from '../../components/ui';
import { FixedIncomeKind, Portfolio, kindLabel, parsePortfolio, mergePortfolio, serializePortfolio, parseNumberBR, isPositive, validPastDate, normTicker, validTicker } from '../../core';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { usePilinha } from '../../lib/store';
import { T, S, R } from '../../lib/theme';
import { SectionTitle } from '../../components/ui';
const num = parseNumberBR;
const Input = (p: React.ComponentProps<typeof TextInput>) => <TextInput placeholderTextColor={T.dim} maxFontSizeMultiplier={1.3} keyboardAppearance="light" {...p} style={{ color: T.text, fontFamily: 'Manrope_400Regular', backgroundColor: T.bg, borderRadius: R.inner, paddingHorizontal: S.md, paddingVertical: S.md, fontSize: 15, borderWidth: 1, borderColor: T.line }} />;
const Btn = ({ title, onPress }: { title: string; onPress: () => void }) => <Pressable onPress={onPress} style={{ backgroundColor: T.pink, paddingVertical: S.md + 2, borderRadius: R.pill, alignItems: 'center', marginTop: S.xs }}><Txt style={{ color: T.bg, fontWeight: '700' }}>{title}</Txt></Pressable>;
const Row = ({ label, onDelete }: { label: string; onDelete: () => void }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.md, paddingVertical: S.xs }}><Txt style={{ flex: 1 }}>{label}</Txt><Pressable onPress={onDelete} hitSlop={8}><Txt style={{ color: T.down, fontWeight: '600' }}>remover</Txt></Pressable></View>);
const kinds = Object.keys(kindLabel) as FixedIncomeKind[];
export default function Cadastro() {
  const { portfolio: p, update, setToken, hasToken, sync, connectMac, disconnectMac, syncNow } = usePilinha();
  const save = (np: Portfolio) => update(np);
  const [fi, setFi] = useState({ name: '', kind: 'caixinha' as FixedIncomeKind, cdi: '100', date: '', amount: '' });
  const [st, setSt] = useState({ ticker: '', qty: '', avg: '' });
  const [btc, setBtc] = useState({ qty: '', avg: '' });
  const [usd, setUsd] = useState({ qty: '', avg: '' });
  const [tok, setTok] = useState('');
  const [code, setCode] = useState('');
  const [dv, setDv] = useState({ ticker: '', date: '', amount: '' });
  const addDv = () => {
    const t = normTicker(dv.ticker), a = num(dv.amount);
    if (!validTicker(t) || !validPastDate(dv.date) || !isPositive(a)) return bad('Código (ex. MXRF11), data até hoje (AAAA-MM-DD) e valor que caiu na conta.');
    save({ ...p, manualDividends: [...(p.manualDividends ?? []), { ticker: t, date: dv.date, amount: a }] }); setDv({ ticker: '', date: '', amount: '' });
  };
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
      Alert.alert('Importar do Mac', 'Na próxima tela, abra iCloud Drive > Pilinha > carteira.json (o Pilinha do Mac atualiza esse arquivo sozinho).', [
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
  const bad = (m: string) => Alert.alert('Confere aí', m);
  const addFI = () => {
    const amount = num(fi.amount), cdi = num(fi.cdi);
    if (!fi.name.trim() || !validPastDate(fi.date) || !isPositive(amount) || !isPositive(cdi)) return bad('Nome, data até hoje (AAAA-MM-DD), valor e % do CDI.');
    const list = [...p.fixedIncome]; const i = list.findIndex(a => a.name.trim().toLowerCase() === fi.name.trim().toLowerCase());
    if (i >= 0) list[i] = { ...list[i], deposits: [...list[i].deposits, { date: fi.date, amount }] };
    else list.push({ name: fi.name.trim(), kind: fi.kind, cdiPercent: cdi, deposits: [{ date: fi.date, amount }] });
    save({ ...p, fixedIncome: list }); setFi({ ...fi, date: '', amount: '' });
  };
  const addSt = () => {
    const t = normTicker(st.ticker), q = num(st.qty), avg = st.avg ? num(st.avg) : p.stocks.find(s => s.ticker.toUpperCase() === t)?.averagePrice; // sem PM digitado, mantém o anterior
    if (avg != null && !isPositive(avg)) return bad('Preço médio inválido (ex. 32,10).');
    if (!validTicker(t) || !isPositive(q)) return bad('Código (ex. PETR4, MXRF11) e quantidade.');
    save({ ...p, stocks: [...p.stocks.filter(s => s.ticker.toUpperCase() !== t), { ticker: t, quantity: q, averagePrice: avg }] }); setSt({ ticker: '', qty: '', avg: '' });
  };
  const addBtc = () => {
    const q = num(btc.qty); if (!isPositive(q)) return bad('Quantidade de bitcoin (ex. 0,0015).');
    if (btc.avg && !isPositive(num(btc.avg))) return bad('Preço médio inválido.');
    save({ ...p, crypto: [...p.crypto.filter(c => c.coinId !== 'bitcoin'), { coinId: 'bitcoin', symbol: 'BTC', quantity: q, averagePriceBRL: btc.avg ? num(btc.avg) : p.crypto.find(c => c.coinId === 'bitcoin')?.averagePriceBRL }] }); setBtc({ qty: '', avg: '' });
  };
  const addUsd = () => {
    const q = num(usd.qty); if (!isPositive(q)) return bad('Quantos dólares você tem (ex. 1500,00).');
    if (usd.avg && !isPositive(num(usd.avg))) return bad('Cotação média inválida (ex. 5,10).');
    const avg = usd.avg ? num(usd.avg) : p.usd?.averageRateBRL ?? undefined;
    save({ ...p, usd: { amount: q, ...(avg != null ? { averageRateBRL: avg } : {}) } }); setUsd({ qty: '', avg: '' });
  };
  return (
    <Screen>
      <Card>
        <SectionTitle first>Conectar ao Mac</SectionTitle>
        {sync.connected ? <>
          <Txt dim>{sync.status === 'syncing' ? 'Buscando a carteira do Mac…' : sync.status === 'ok' ? `Conectado. A carteira do Mac chega sozinha (${sync.message}${sync.macUpdatedAt ? `, enviada ${new Date(sync.macUpdatedAt).toLocaleString('pt-BR')}` : ''}). O que só existe no iPhone fica.` : sync.message ?? 'Conectado.'}</Txt>
          <Btn title="Buscar agora" onPress={async () => { const r = await syncNow(); if (r.status === 'error') bad(r.message ?? 'Não deu.'); }} />
          <Btn title="Desconectar do Mac" onPress={() => Alert.alert('Desconectar do Mac', 'A carteira deste iPhone fica como está, mas para de receber as mudanças do Mac.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Desconectar', style: 'destructive', onPress: () => disconnectMac() }])} />
        </> : <>
          <Txt dim>No Mac: menu do cofrinho ▸ Conectar ao iPhone… Digite o código que aparecer (ou aponte a Câmera do iPhone para o QR). A carteira vai cifrada: só este iPhone e o Mac conseguem ler.</Txt>
          {sync.status === 'error' && sync.message ? <Txt dim>{sync.message}</Txt> : null}
          <Input placeholder="Código do Mac (ex. ABCD-EFGH-2345-6789)" autoCapitalize="characters" autoCorrect={false} value={code} onChangeText={setCode} />
          <Btn title="Conectar" onPress={async () => { const r = await connectMac(code); if (r.status !== 'error') setCode(''); else bad(r.message ?? 'Não deu.'); if (r.status === 'ok') Alert.alert('Pronto', `Conectado ao Mac: ${r.message}.`); }} />
        </>}
      </Card>
      <Txt dim>Só leitura: nada aqui conecta ao banco. Os dados ficam só neste iPhone.</Txt>
      <Card>
        <SectionTitle first>Renda fixa (caixinha, CDB, Tesouro, LCI/LCA)</SectionTitle>
        {p.fixedIncome.map(a => <Row key={a.name} label={`${a.name} · ${kindLabel[a.kind]} · ${a.cdiPercent}% CDI · ${a.deposits.length} aporte(s)`} onDelete={() => save({ ...p, fixedIncome: p.fixedIncome.filter(x => x.name !== a.name) })} />)}
        <Input placeholder="Nome (ex. Caixinha Viagem)" value={fi.name} onChangeText={name => setFi({ ...fi, name })} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {kinds.map(k => <Pressable key={k} onPress={() => setFi({ ...fi, kind: k })} style={{ paddingVertical: S.xs + 2, paddingHorizontal: S.md, borderRadius: R.pill, borderWidth: 1, borderColor: fi.kind === k ? T.pink : T.line, backgroundColor: fi.kind === k ? T.pink : T.bg }}><Txt style={{ color: fi.kind === k ? T.bg : T.text }}>{kindLabel[k]}</Txt></Pressable>)}
        </View>
        <Input placeholder="% do CDI (ex. 100)" keyboardType="decimal-pad" value={fi.cdi} onChangeText={cdi => setFi({ ...fi, cdi })} />
        <Input placeholder="Data do aporte AAAA-MM-DD" value={fi.date} onChangeText={date => setFi({ ...fi, date })} />
        <Input placeholder="Valor aplicado" keyboardType="decimal-pad" value={fi.amount} onChangeText={amount => setFi({ ...fi, amount })} />
        <Btn title="Adicionar aporte" onPress={addFI} />
      </Card>
      <Card>
        <SectionTitle first>Ações e FIIs</SectionTitle>
        {p.stocks.map(s => <Row key={s.ticker} label={s.ticker} onDelete={() => save({ ...p, stocks: p.stocks.filter(x => x.ticker !== s.ticker) })} />)}
        <Input placeholder="Código (ex. PETR4)" autoCapitalize="characters" value={st.ticker} onChangeText={ticker => setSt({ ...st, ticker })} />
        <Input placeholder="Quantidade" keyboardType="decimal-pad" value={st.qty} onChangeText={qty => setSt({ ...st, qty })} />
        <Input placeholder="Preço médio (opcional)" keyboardType="decimal-pad" value={st.avg} onChangeText={avg => setSt({ ...st, avg })} />
        <Btn title="Salvar ação" onPress={addSt} />
      </Card>
      <Card>
        <SectionTitle first>Bitcoin</SectionTitle>
        {p.crypto.map(c => <Row key={c.coinId} label={c.symbol} onDelete={() => save({ ...p, crypto: p.crypto.filter(x => x.coinId !== c.coinId) })} />)}
        <Input placeholder="Quantidade (ex. 0,0015)" keyboardType="decimal-pad" value={btc.qty} onChangeText={qty => setBtc({ ...btc, qty })} />
        <Input placeholder="Preço médio em R$ (opcional)" keyboardType="decimal-pad" value={btc.avg} onChangeText={avg => setBtc({ ...btc, avg })} />
        <Btn title="Salvar bitcoin" onPress={addBtc} />
      </Card>
      <Card>
        <SectionTitle first>Dólar (USD)</SectionTitle>
        <Txt dim>Só digite quantos dólares você tem. A cotação é automática (dólar ao vivo, atualiza sozinha) e a conversão entra no total.</Txt>
        {p.usd ? <Row label={`US$ ${p.usd.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${p.usd.averageRateBRL ? ` · média R$ ${p.usd.averageRateBRL.toFixed(2).replace('.', ',')}` : ''}`} onDelete={() => { const { usd: _u, ...rest } = p; save(rest as Portfolio); }} /> : null}
        <Input placeholder="Quantidade em US$ (ex. 1500,00)" keyboardType="decimal-pad" value={usd.qty} onChangeText={qty => setUsd({ ...usd, qty })} />
        <Input placeholder="Opcional: quanto pagou por dólar (só p/ ganho/perda)" keyboardType="decimal-pad" value={usd.avg} onChangeText={avg => setUsd({ ...usd, avg })} />
        <Btn title="Salvar dólar" onPress={addUsd} />
      </Card>
      <Card>
        <SectionTitle first>Proventos lançados à mão</SectionTitle>
        <Txt dim>O valor que caiu na conta. Para o código, o lançamento manual substitui o da brapi.</Txt>
        {(p.manualDividends ?? []).map((m, i) => <Row key={i} label={`${m.ticker} · ${m.date}`} onDelete={() => save({ ...p, manualDividends: (p.manualDividends ?? []).filter((_, j) => j !== i) })} />)}
        <Input placeholder="Código (ex. MXRF11)" autoCapitalize="characters" value={dv.ticker} onChangeText={ticker => setDv({ ...dv, ticker })} />
        <Input placeholder="Data AAAA-MM-DD" value={dv.date} onChangeText={date => setDv({ ...dv, date })} />
        <Input placeholder="Valor recebido" keyboardType="decimal-pad" value={dv.amount} onChangeText={amount => setDv({ ...dv, amount })} />
        <Btn title="Adicionar provento" onPress={addDv} />
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
    </Screen>
  );
}
