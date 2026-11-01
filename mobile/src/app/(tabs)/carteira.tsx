import { EyeToggle } from '../../components/EyeToggle';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, SectionTitle, Screen, Txt, AssetRow, money } from '../../components/ui';
import { groupItems, pct, brl, WatchRow } from '../../core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePilinha } from '../../lib/store';
import { S, T } from '../../lib/theme';
const cat: Record<string, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA', acao: 'Ação', fii: 'FII', cripto: 'Cripto', dolar: 'Dólar' };
export default function Carteira() {
  const { snap, hidden } = usePilinha();
  const router = useRouter();
  const add = () => router.push('/adicionar');
  if (!snap?.items.length && !snap?.watch?.length) return <Screen><Txt dim>{snap ? 'Nada cadastrado ainda.' : 'Carregando…'}</Txt>{snap ? <AddButton onPress={add} /> : null}</Screen>;
  return (
    <Screen>
      <EyeToggle />
      <AddButton onPress={add} />
      {groupItems(snap!.items).map(g => (
        <Card key={g.key} style={{ paddingBottom: S.xs, gap: 0 }}>
          <SectionTitle first right={<Txt style={{ fontWeight: '700' }}>{money(g.total, hidden)}{g.dayPct != null ? <Txt style={{ fontWeight: '700', color: g.dayPct >= 0 ? T.up : T.down }}>{'  ' + pct(g.dayPct)}</Txt> : null}</Txt>}>{g.title}</SectionTitle>
          {g.items.map((i, n) => <Pressable key={i.category + i.name} accessibilityRole="button" accessibilityHint="Abre para editar" onPress={() => router.push({ pathname: '/adicionar', params: { cat: i.category, name: i.name } })}><AssetRow item={i} hidden={hidden} last={n === g.items.length - 1} label={g.key === 'renda' ? cat[i.category] : i.category === 'fii' ? 'FII' : i.category === 'dolar' && i.quantity != null && !hidden ? `US$ ${i.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined} /></Pressable>)}
        </Card>
      ))}
      {snap?.watch?.length ? <Watch rows={snap.watch} hidden={hidden} /> : null}
    </Screen>
  );
}

function Watch({ rows, hidden }: { rows: WatchRow[]; hidden: boolean }) {
  return (
    <Card style={{ gap: 0 }}>
      <SectionTitle first>Quero comprar</SectionTitle>
      {rows.map((w, i) => (
        <View key={w.ticker} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: T.line }}>
          <MaterialCommunityIcons name={w.reached ? 'star-check' : 'star-outline'} size={20} color={w.reached ? T.up : T.lilacDeep} />
          <View style={{ flex: 1 }}>
            <Txt style={{ fontWeight: '600' }}>{w.ticker}</Txt>
            <Txt dim style={{ fontSize: 12 }}>Alvo {brl(w.targetPrice)}{w.amount != null ? ` · investir ${money(w.amount, hidden)}` : ''}{w.shares != null && !hidden ? ` (~${w.shares} cotas)` : ''}</Txt>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Txt style={{ fontWeight: '600' }}>{w.price != null ? brl(w.price) : '—'}</Txt>
            <Txt style={{ fontSize: 12, color: w.reached ? T.up : T.dim }}>{w.reached ? 'no preço' : w.distancePct != null ? `falta cair ${w.distancePct.toFixed(1).replace('.', ',')}%` : 'sem cotação'}</Txt>
          </View>
        </View>))}
    </Card>);
}

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Adicionar investimento"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.sm, borderWidth: 1, borderColor: T.pink, borderRadius: 999, paddingVertical: S.sm + 2 }}>
      <MaterialCommunityIcons name="plus" size={20} color={T.pink} /><Txt style={{ color: T.pink, fontWeight: '700' }}>Adicionar</Txt>
    </Pressable>);
}
