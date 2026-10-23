import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { Card, Screen, Txt } from '../components/ui';
import { FixedIncomeKind, Portfolio, kindLabel, parseISO } from '../core';
import { usePilinha } from '../lib/store';
import { T } from '../lib/theme';
const num = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));
const Input = (p: React.ComponentProps<typeof TextInput>) => <TextInput placeholderTextColor={T.dim} {...p} style={{ color: T.text, backgroundColor: T.bg, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: T.line }} />;
const Btn = ({ title, onPress }: { title: string; onPress: () => void }) => <Pressable onPress={onPress} style={{ backgroundColor: T.pink, padding: 10, borderRadius: 10, alignItems: 'center' }}><Txt style={{ color: T.bg, fontWeight: '700' }}>{title}</Txt></Pressable>;
const Row = ({ label, onDelete }: { label: string; onDelete: () => void }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt>{label}</Txt><Pressable onPress={onDelete}><Txt style={{ color: T.down }}>remover</Txt></Pressable></View>);
const kinds = Object.keys(kindLabel) as FixedIncomeKind[];
export default function Cadastro() {
  const { portfolio: p, update, setToken, hasToken } = usePilinha();
  const save = (np: Portfolio) => update(np);
  const [fi, setFi] = useState({ name: '', kind: 'caixinha' as FixedIncomeKind, cdi: '100', date: '', amount: '' });
  const [st, setSt] = useState({ ticker: '', qty: '', avg: '' });
  const [btc, setBtc] = useState({ qty: '', avg: '' });
  const [tok, setTok] = useState('');
  const bad = (m: string) => Alert.alert('Confere aí', m);
  const addFI = () => {
    const amount = num(fi.amount), cdi = num(fi.cdi);
    if (!fi.name.trim() || !parseISO(fi.date) || !(amount > 0) || !(cdi > 0)) return bad('Nome, data (AAAA-MM-DD), valor e % do CDI.');
    const list = [...p.fixedIncome]; const i = list.findIndex(a => a.name === fi.name.trim());
    if (i >= 0) list[i] = { ...list[i], deposits: [...list[i].deposits, { date: fi.date, amount }] };
    else list.push({ name: fi.name.trim(), kind: fi.kind, cdiPercent: cdi, deposits: [{ date: fi.date, amount }] });
    save({ ...p, fixedIncome: list }); setFi({ ...fi, date: '', amount: '' });
  };
  const addSt = () => {
    const q = num(st.qty), avg = st.avg ? num(st.avg) : undefined, t = st.ticker.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,7}$/.test(t) || !(q > 0)) return bad('Código (ex. PETR4, MXRF11) e quantidade.');
    save({ ...p, stocks: [...p.stocks.filter(s => s.ticker !== t), { ticker: t, quantity: q, averagePrice: avg }] }); setSt({ ticker: '', qty: '', avg: '' });
  };
  const addBtc = () => {
    const q = num(btc.qty); if (!(q > 0)) return bad('Quantidade de bitcoin (ex. 0,0015).');
    save({ ...p, crypto: [...p.crypto.filter(c => c.coinId !== 'bitcoin'), { coinId: 'bitcoin', symbol: 'BTC', quantity: q, averagePriceBRL: btc.avg ? num(btc.avg) : undefined }] }); setBtc({ qty: '', avg: '' });
  };
  return (
    <Screen>
      <Txt dim>Só leitura: nada aqui conecta ao banco. Os dados ficam só neste iPhone.</Txt>
      <Card>
        <Txt style={{ fontWeight: '700' }}>Renda fixa (caixinha, CDB, Tesouro, LCI/LCA)</Txt>
        {p.fixedIncome.map(a => <Row key={a.name} label={`${a.name} · ${kindLabel[a.kind]} · ${a.cdiPercent}% CDI · ${a.deposits.length} aporte(s)`} onDelete={() => save({ ...p, fixedIncome: p.fixedIncome.filter(x => x.name !== a.name) })} />)}
        <Input placeholder="Nome (ex. Caixinha Viagem)" value={fi.name} onChangeText={name => setFi({ ...fi, name })} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {kinds.map(k => <Pressable key={k} onPress={() => setFi({ ...fi, kind: k })} style={{ padding: 6, borderRadius: 8, backgroundColor: fi.kind === k ? T.pink : T.bg }}><Txt style={{ color: fi.kind === k ? T.bg : T.text }}>{kindLabel[k]}</Txt></Pressable>)}
        </View>
        <Input placeholder="% do CDI (ex. 100)" keyboardType="decimal-pad" value={fi.cdi} onChangeText={cdi => setFi({ ...fi, cdi })} />
        <Input placeholder="Data do aporte AAAA-MM-DD" value={fi.date} onChangeText={date => setFi({ ...fi, date })} />
        <Input placeholder="Valor aplicado" keyboardType="decimal-pad" value={fi.amount} onChangeText={amount => setFi({ ...fi, amount })} />
        <Btn title="Adicionar aporte" onPress={addFI} />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '700' }}>Ações e FIIs</Txt>
        {p.stocks.map(s => <Row key={s.ticker} label={s.ticker} onDelete={() => save({ ...p, stocks: p.stocks.filter(x => x.ticker !== s.ticker) })} />)}
        <Input placeholder="Código (ex. PETR4)" autoCapitalize="characters" value={st.ticker} onChangeText={ticker => setSt({ ...st, ticker })} />
        <Input placeholder="Quantidade" keyboardType="decimal-pad" value={st.qty} onChangeText={qty => setSt({ ...st, qty })} />
        <Input placeholder="Preço médio (opcional)" keyboardType="decimal-pad" value={st.avg} onChangeText={avg => setSt({ ...st, avg })} />
        <Btn title="Salvar ação" onPress={addSt} />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '700' }}>Bitcoin</Txt>
        {p.crypto.map(c => <Row key={c.coinId} label={c.symbol} onDelete={() => save({ ...p, crypto: p.crypto.filter(x => x.coinId !== c.coinId) })} />)}
        <Input placeholder="Quantidade (ex. 0,0015)" keyboardType="decimal-pad" value={btc.qty} onChangeText={qty => setBtc({ ...btc, qty })} />
        <Input placeholder="Preço médio em R$ (opcional)" keyboardType="decimal-pad" value={btc.avg} onChangeText={avg => setBtc({ ...btc, avg })} />
        <Btn title="Salvar bitcoin" onPress={addBtc} />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '700' }}>Token da brapi (opcional, só para proventos)</Txt>
        <Txt dim>{hasToken ? 'Token salvo no Keychain.' : 'Sem token: cotações pelo Yahoo Finance.'}</Txt>
        <Input placeholder="Colar token" secureTextEntry value={tok} onChangeText={setTok} />
        <Btn title={tok ? 'Salvar token' : 'Apagar token'} onPress={() => { setToken(tok); setTok(''); }} />
      </Card>
    </Screen>
  );
}
