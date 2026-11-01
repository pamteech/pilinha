import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Field, Screen, SectionTitle, Txt, money } from '../../components/ui';
import { EyeToggle } from '../../components/EyeToggle';
import { brl, isPositive, kindLabel, normTicker, parseNumberBR, rateModelOf, treasuryTypeOf, validTicker } from '../../core';
import { TypeStep } from '../adicionar';
import { usePilinha } from '../../lib/store';
import { S, T } from '../../lib/theme';
// Cadastro: a aba abre sempre nos cards do passo 1 (tocar num card abre o passo 2); tocar num item abre a mesma tela para editar.
const Row = ({ title, sub, onPress, onDelete, last }: { title: string; sub: string; onPress?: () => void; onDelete: () => void; last?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line }}>
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: S.sm }} accessibilityRole="button">
      <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>{title}</Txt><Txt dim style={{ fontSize: 12 }}>{sub}</Txt></View>
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={T.dim} /> : null}
    </Pressable>
    <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`Remover ${title}`}><MaterialCommunityIcons name="trash-can-outline" size={20} color={T.down} /></Pressable>
  </View>);
export default function Cadastro() {
  const { portfolio: p, update, hidden } = usePilinha();
  const router = useRouter();
  const edit = (cat: string, name: string) => router.push({ pathname: '/adicionar', params: { cat, name } });
  const ask = (what: string, go: () => void) => Alert.alert('Remover', `Remover ${what}?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: go }]);
  const [wl, setWl] = useState({ ticker: '', target: '', amount: '' });
  const addWl = () => {
    const t = normTicker(wl.ticker), tg = parseNumberBR(wl.target), am = wl.amount ? parseNumberBR(wl.amount) : undefined;
    if (!validTicker(t) || !isPositive(tg)) return Alert.alert('Confere aí', 'Código (ex. TAEE11) e o preço que você quer pagar.');
    if (am != null && !isPositive(am)) return Alert.alert('Confere aí', 'Valor a investir inválido (ex. 500,00).');
    update({ ...p, watchlist: [...(p.watchlist ?? []).filter(w => w.ticker.toUpperCase() !== t), { ticker: t, targetPrice: tg, ...(am != null ? { amount: am } : {}) }] }); setWl({ ticker: '', target: '', amount: '' });
  };
  const fiSub = (a: typeof p.fixedIncome[number]) => {
    const tt = treasuryTypeOf(a), rm = rateModelOf(a);
    const rate = rm === 'ipca' ? `IPCA + ${String(a.realRate ?? 0).replace('.', ',')}%` : rm === 'prefixado' ? `Prefixado ${String(a.fixedRate).replace('.', ',')}%` : tt === 'selic' ? 'Selic' : `${String(a.cdiPercent).replace('.', ',')}% do CDI`;
    return `${kindLabel[a.kind]} · ${rate} · ${money(a.deposits.reduce((s, d) => s + d.amount, 0), hidden)}${a.deposits.length > 1 ? ` em ${a.deposits.length} aportes` : ''}`;
  };
  const items = [
    ...p.fixedIncome.map(a => ({ key: 'f' + a.name, title: a.name, sub: fiSub(a), cat: a.kind, name: a.name })),
    ...p.stocks.map(s => ({ key: 's' + s.ticker, title: s.ticker, sub: `${s.ticker.endsWith('11') ? 'FII' : 'Ação'} · ${hidden ? '••••' : s.quantity.toLocaleString('pt-BR')} cota(s)${s.averagePrice != null ? ` · PM ${money(s.averagePrice, hidden)}` : ''}`, cat: s.ticker.endsWith('11') ? 'fii' : 'acao', name: s.ticker })),
    ...p.crypto.map(c => ({ key: 'c' + c.coinId, title: c.symbol === 'BTC' ? 'Bitcoin' : c.symbol, sub: `${hidden ? '••••' : c.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} ${c.symbol}`, cat: 'cripto', name: c.symbol })),
    ...(p.usd ? [{ key: 'usd', title: 'Dólar', sub: hidden ? 'US$ ••••' : `US$ ${p.usd.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, cat: 'dolar', name: 'Dólar' }] : []),
  ];
  return (
    <Screen>
      <Card>
        <TypeStep onPick={t => router.push({ pathname: '/adicionar', params: { type: t } })} />
      </Card>
      <EyeToggle />
      <Card style={{ gap: 0 }}>
        <SectionTitle first>Seus investimentos</SectionTitle>
        {items.length ? items.map((i, n) => <Row key={i.key} title={i.title} sub={i.sub} last={n === items.length - 1} onPress={() => edit(i.cat, i.name)}
          onDelete={() => ask(i.title, () => update(require('../../core').removeItem(p, { category: i.cat, name: i.name })))} />)
          : <Txt dim>Nada cadastrado ainda. Escolha um tipo acima para começar.</Txt>}
        {items.length ? <Txt dim style={{ fontSize: 12, marginTop: S.sm }}>Toque num item para editar.</Txt> : null}
      </Card>
      <Card style={{ gap: 0 }}>
        <SectionTitle first right={<Pressable onPress={() => router.push({ pathname: '/adicionar', params: { type: 'provento' } })} hitSlop={8}><MaterialCommunityIcons name="plus-circle-outline" size={22} color={T.pink} /></Pressable>}>Proventos lançados à mão</SectionTitle>
        <Txt dim style={{ fontSize: 13 }}>O valor que caiu na conta. Para o código, o lançamento manual substitui o da internet.</Txt>
        {(p.manualDividends ?? []).map((m, i, a) => <Row key={i} title={m.ticker} sub={`${m.date.split('-').reverse().join('/')} · ${money(m.amount, hidden)}`} last={i === a.length - 1}
          onDelete={() => ask(`o provento de ${m.ticker}`, () => update({ ...p, manualDividends: (p.manualDividends ?? []).filter((_, j) => j !== i) }))} />)}
      </Card>
      <Card>
        <SectionTitle first>Quero comprar</SectionTitle>
        <Txt dim style={{ fontSize: 13 }}>Ação que você pretende comprar e o preço que quer pagar. O Pilinvest mostra quanto falta e avisa quando chegar no preço.</Txt>
        {(p.watchlist ?? []).map((w, i, a) => <Row key={w.ticker} title={w.ticker} sub={`Alvo ${brl(w.targetPrice)}${w.amount != null ? ` · investir ${money(w.amount, hidden)}` : ''}`} last={i === a.length - 1}
          onDelete={() => ask(w.ticker, () => update({ ...p, watchlist: (p.watchlist ?? []).filter(x => x.ticker !== w.ticker) }))} />)}
        <Field placeholder="Código (ex. TAEE11)" autoCapitalize="characters" value={wl.ticker} onChangeText={ticker => setWl({ ...wl, ticker })} />
        <Field placeholder="Preço que quero pagar (ex. 34,50)" keyboardType="decimal-pad" value={wl.target} onChangeText={target => setWl({ ...wl, target })} />
        <Field placeholder="Quanto quero investir (opcional)" keyboardType="decimal-pad" value={wl.amount} onChangeText={amount => setWl({ ...wl, amount })} />
        <Button title="Salvar favorito" onPress={addWl} />
      </Card>
      <Txt dim style={{ fontSize: 12 }}>Conectar ao Mac, exportar ou importar a carteira e o token da brapi agora ficam nos Ajustes.</Txt>
    </Screen>
  );
}
