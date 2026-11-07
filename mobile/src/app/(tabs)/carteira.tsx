import { EyeToggle } from '../../components/EyeToggle';
import { Pressable, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Card, Chip, SectionTitle, Screen, Txt, AssetRow, Measure, money } from '../../components/ui';
import { ALLOC_ORDERS, AllocOrder, AllocSlice, allocation, groupItems, pct, brl, sharePct, sortAllocation, WatchRow } from '../../core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePilinha } from '../../lib/store';
import { S, T } from '../../lib/theme';
const cat: Record<string, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA', acao: 'Ação', fii: 'FII', cripto: 'Cripto', dolar: 'Dólar' };
export default function Carteira() {
  const { snap, hidden, settings, setSettings } = usePilinha();
  const router = useRouter();
  const order: AllocOrder = settings.allocOrder ?? 'value'; const chart = settings.allocChart ?? 'donut';
  const add = () => router.push('/adicionar');
  if (!snap?.items.length && !snap?.watch?.length) return <Screen><Txt dim>{snap ? 'Nada cadastrado ainda.' : 'Carregando…'}</Txt>{snap ? <AddButton onPress={add} /> : null}</Screen>;
  return (
    <Screen>
      <EyeToggle />
      <AddButton onPress={add} />
      <Allocation slices={sortAllocation(allocation(snap!.items, T.scheme === 'dark'), order)} hidden={hidden} order={order} setOrder={o => setSettings({ ...settings, allocOrder: o })} chart={chart} setChart={c => setSettings({ ...settings, allocChart: c })} />
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

type AllocChart = 'donut' | 'bar';
/** Distribuição por tipo: pizza (rosca) ou barra empilhada, à escolha; cor fixa por tipo, folga entre as fatias, legenda com % e valor (a "tabela" do gráfico). */
function Allocation({ slices, hidden, order, setOrder, chart, setChart }: { slices: AllocSlice[]; hidden: boolean; order: AllocOrder; setOrder: (o: AllocOrder) => void; chart: AllocChart; setChart: (c: AllocChart) => void }) {
  if (slices.length < 1) return null;
  const SIZE = 188, R = 76, STROKE = 24, C = 2 * Math.PI * R, GAP = slices.length > 1 ? 3 : 0, BAR_H = 14, BAR_GAP = 2;
  const total = slices.reduce((a, x) => a + x.total, 0); let off = 0;
  const kinds: { k: AllocChart; icon: 'chart-donut' | 'chart-timeline'; label: string }[] = [{ k: 'donut', icon: 'chart-donut', label: 'Pizza' }, { k: 'bar', icon: 'chart-timeline', label: 'Barra' }];
  return (
    <Card>
      <SectionTitle first right={<View style={{ flexDirection: 'row', gap: S.xs }}>{kinds.map(x => (
        <Pressable key={x.k} onPress={() => setChart(x.k)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Gráfico em ${x.label.toLowerCase()}`} accessibilityState={{ selected: chart === x.k }}
          style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: chart === x.k ? T.pink : T.bg, borderWidth: 1, borderColor: chart === x.k ? T.pink : T.line }}>
          <MaterialCommunityIcons name={x.icon} size={18} color={chart === x.k ? T.onPrimary : T.dim} />
        </Pressable>))}</View>}>Distribuição por tipo</SectionTitle>
      <View style={{ flexDirection: 'row', gap: S.sm }} accessibilityLabel="Ordem da distribuição">{ALLOC_ORDERS.map(o => <Chip key={o.key} label={o.label} on={o.key === order} onPress={() => setOrder(o.key)} />)}</View>
      {chart === 'bar' ? <Measure height={BAR_H}>{W => {
        const usable = W - BAR_GAP * (slices.length - 1); let x = 0;
        return (<Svg width={W} height={BAR_H}>
          <Defs><ClipPath id="alloc-clip"><Rect x={0} y={0} width={W} height={BAR_H} rx={BAR_H / 2} /></ClipPath></Defs>
          <G clipPath="url(#alloc-clip)">
            {slices.map(sl => { const w = Math.max(0, (sl.pct / 100) * usable); const r = <Rect key={sl.key} x={x} y={0} width={w} height={BAR_H} fill={sl.color} />; x += w + BAR_GAP; return r; })}
          </G>
        </Svg>);
      }}</Measure>
      : <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: S.xs }} accessibilityLabel={`Rosca da distribuição: ${slices.map(x => `${x.title} ${sharePct(x.pct)}`).join(', ')}`}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={T.line} strokeWidth={STROKE} fill="none" />
          {slices.map(sl => {
            const len = Math.max(0, (sl.pct / 100) * C - GAP), start = off; off += (sl.pct / 100) * C;
            return <Circle key={sl.key} cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={sl.color} strokeWidth={STROKE} fill="none" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-start} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />;
          })}
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }} pointerEvents="none">
          <Txt dim style={{ fontSize: 11, lineHeight: 14 }}>TOTAL</Txt>
          <Txt style={{ fontWeight: '700', fontSize: 16 }}>{money(total, hidden)}</Txt>
          <Txt dim style={{ fontSize: 11, lineHeight: 14 }}>{slices.length} {slices.length === 1 ? 'tipo' : 'tipos'}</Txt>
        </View>
      </View>}
      <View style={{ gap: S.xs, marginTop: S.xs }}>
        {slices.map(sl => (
          <View key={sl.key} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }} accessibilityLabel={`${sl.title}: ${sharePct(sl.pct)} da carteira`}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: sl.color }} />
            <Txt style={{ flex: 1 }}>{sl.title}</Txt>
            <Txt dim style={{ fontSize: 13 }}>{money(sl.total, hidden)}</Txt>
            <Txt style={{ fontWeight: '700', width: 52, textAlign: 'right' }}>{sharePct(sl.pct)}</Txt>
          </View>))}
      </View>
    </Card>);
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
