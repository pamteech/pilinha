import { EyeToggle } from '../../components/EyeToggle';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, Field, SectionTitle, Screen, Txt, AssetRow, AssetCard, Measure, money } from '../../components/ui';
import { ALLOC_ORDERS, ALLOC_TITLES, AllocOrder, AllocSlice, AllocTargets, allocation, aporteSuggestion, groupItems, parseNumberBR, pct, brl, sharePct, sortAllocation, WatchRow, LineItem } from '../../core';
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
  // Páginas: Distribuição, um bloco por grupo e os favoritos. Passa com o dedo ou toca no título; bolinhas embaixo.
  const slices = sortAllocation(allocation(snap!.items, T.scheme === 'dark'), order);
  const pages: { key: string; title: string; node: React.ReactNode }[] = [
    ...(slices.length ? [{ key: 'dist', title: 'Distribuição', node: <View style={{ gap: S.lg }}>
        <Allocation slices={slices} hidden={hidden} order={order} setOrder={o => setSettings({ ...settings, allocOrder: o })} chart={chart} setChart={c => setSettings({ ...settings, allocChart: c })} />
        <Aporte key={settings.plan?.monthly ?? 0} slices={slices} targets={settings.allocTargets} monthly={settings.plan?.monthly} hidden={hidden} open={() => router.push('/alocacao')} />
      </View> }] : []),
    ...groupItems(snap!.items).map(g => ({ key: g.key, title: g.title, node: g.key === 'acoes'
      ? <EquityList items={g.items} total={g.total} dayPct={g.dayPct} hidden={hidden} onOpen={i => router.push({ pathname: '/adicionar', params: { cat: i.category, name: i.name } })} />
      : (
        <Card style={{ paddingBottom: S.xs, gap: 0 }}>
          <SectionTitle first right={<Txt style={{ fontWeight: '700' }}>{money(g.total, hidden)}{g.dayPct != null ? <Txt style={{ fontWeight: '700', color: g.dayPct >= 0 ? T.up : T.down }}>{'  ' + pct(g.dayPct)}</Txt> : null}</Txt>}>{g.title}</SectionTitle>
          {g.items.map((i, n) => <Pressable key={i.category + i.name} accessibilityRole="button" accessibilityHint="Abre para editar" onPress={() => router.push({ pathname: '/adicionar', params: { cat: i.category, name: i.name } })}><AssetRow item={i} hidden={hidden} last={n === g.items.length - 1} label={g.key === 'renda' ? cat[i.category] : i.category === 'dolar' && i.quantity != null && !hidden ? `US$ ${i.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined} /></Pressable>)}
        </Card>) })),
    ...(snap?.watch?.length ? [{ key: 'watch', title: 'Quero comprar', node: <Watch rows={snap.watch} hidden={hidden} /> }] : []),
  ];
  return (
    <Screen>
      <EyeToggle />
      <AddButton onPress={add} />
      <Pager pages={pages} />
    </Screen>
  );
}

/** Aba Ações e FIIs: um cartão por papel, com espaço entre eles. O toque abre o detalhe (editar). */
function EquityList({ items, total, dayPct, hidden, onOpen }: { items: LineItem[]; total: number; dayPct: number | null; hidden: boolean; onOpen: (i: LineItem) => void }) {
  return (
    <View style={{ gap: S.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: S.xs }}>
        <Txt style={{ fontWeight: '700' }}>{money(total, hidden)}</Txt>
        {dayPct != null ? <Txt style={{ fontWeight: '700', color: dayPct >= 0 ? T.up : T.down }}>{pct(dayPct)}</Txt> : null}
      </View>
      {items.map(i => (
        <Pressable key={i.category + i.name} accessibilityRole="button" accessibilityHint="Abre para editar" onPress={() => onOpen(i)}>
          <AssetCard item={i} hidden={hidden} />
        </Pressable>))}
    </View>);
}

/** Paginação da carteira: títulos (toque para pular), páginas largura cheia com altura da página atual, e bolinhas. */
function Pager({ pages }: { pages: { key: string; title: string; node: React.ReactNode }[] }) {
  const [i, setI] = useState(0); const [w, setW] = useState(0); const [hs, setHs] = useState<Record<string, number>>({}); const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const cur = Math.min(i, pages.length - 1);
  const go = (n: number) => { ref.current?.scrollTo({ x: n * w, animated: true }); setI(n); };
  const h = hs[pages[cur]?.key];
  return (
    <View onLayout={e => setW(Math.round(e.nativeEvent.layout.width))}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.sm, paddingBottom: S.md }}>
        {pages.map((p, n) => <Chip key={p.key} label={p.title} on={n === cur} onPress={() => go(n)} />)}
      </ScrollView>
      {w > 0 && <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
        onMomentumScrollEnd={e => setI(Math.max(0, Math.min(pages.length - 1, Math.round(e.nativeEvent.contentOffset.x / w))))}
        style={h ? { height: h } : undefined}>
        {pages.map(p => <View key={p.key} style={{ width: w }} onLayout={e => { const v = Math.ceil(e.nativeEvent.layout.height); setHs(o => (o[p.key] === v ? o : { ...o, [p.key]: v })); }}>{p.node}</View>)}
      </ScrollView>}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: S.md }} accessibilityLabel={`Página ${cur + 1} de ${pages.length}: ${pages[cur]?.title}`}>
        {pages.map((p, n) => <View key={p.key} style={{ width: n === cur ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: n === cur ? T.pink : T.line }} />)}
      </View>
    </View>);
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
/** Onde aportar este mês: com a distribuição ideal definida, divide o aporte só com compras. O valor digitado não é salvo (a key remonta se o aporte do plano mudar). */
function Aporte({ slices, targets, monthly, hidden, open }: { slices: AllocSlice[]; targets: AllocTargets | null; monthly?: number; hidden: boolean; open: () => void }) {
  const [amount, setAmount] = useState(monthly != null && monthly > 0 ? monthly.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');
  if (!targets) return (
    <Card>
      <SectionTitle first>Onde aportar este mês</SectionTitle>
      <Txt dim style={{ fontSize: 13 }}>Diga quanto quer ter em cada tipo e o Pilinvest mostra onde colocar o aporte do mês para chegar lá, sem vender nada.</Txt>
      <Button title="Definir distribuição ideal" onPress={open} />
    </Card>);
  const rows = aporteSuggestion(slices, targets, parseNumberBR(amount)), sum = rows.reduce((a, r) => a + r.suggest, 0);
  return (
    <Card>
      <SectionTitle first>Onde aportar este mês</SectionTitle>
      <Txt dim style={{ fontSize: 13 }}>Quanto vai aportar</Txt>
      {/* escondido: o campo vira senha, como os outros valores em R$ */}
      <Field placeholder="R$ 1.000" keyboardType="decimal-pad" secureTextEntry={hidden} value={amount} onChangeText={setAmount} accessibilityLabel="Quanto vai aportar" />
      <View>
        {rows.map((r, i) => {
          const title = slices.find(s => s.key === r.key)?.title ?? ALLOC_TITLES[r.key], pcts = `hoje ${sharePct(r.currentPct)} → ideal ${sharePct(r.targetPct)}`;
          const value = !(sum > 0) ? '—' : hidden ? `${sharePct((r.suggest / sum) * 100)} do aporte` : money(r.suggest, hidden);
          return (
            <View key={r.key} accessible accessibilityLabel={`${title}: ${pcts.replace(' →', ',')}${sum > 0 ? `, aportar ${value}` : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
              <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>{title}</Txt><Txt dim style={{ fontSize: 12 }}>{pcts}</Txt></View>
              <Txt style={{ fontWeight: '700' }}>{value}</Txt>
            </View>);
        })}
      </View>
      <Pressable onPress={open} hitSlop={12} accessibilityRole="link" accessibilityHint="Abre a distribuição ideal" style={{ alignSelf: 'flex-start' }}><Txt style={{ color: T.pink, fontWeight: '700' }}>Editar distribuição</Txt></Pressable>
      <Txt dim style={{ fontSize: 12 }}>Sugestão só com compras, sem vender nada. Não é recomendação de investimento.</Txt>
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
