import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Chip, Field, Txt, money } from '../components/ui';
import { DateField, longDate } from '../components/DateField';
import { EyeToggle } from '../components/EyeToggle';
import { usePilinha } from '../lib/store';
import { treasuryOffers } from '../lib/treasury';
import * as St from '../lib/storage';
import { T, S, R } from '../lib/theme';
import {
  ASSET_TYPES, AssetType, CDI_SHORTCUTS, Draft, TickerHit, TreasuryOffer, applyDraft, brl, draftFor, emptyDraft, existingNotice, localSearch,
  mergeHits, multiDeposit, normTicker, offerName, parseYahooSearch, preview, removeItem, stockQuote, toISO, validTicker, validateDraft, yahooSearchURL, defaultFetcher,
} from '../core';
type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const STEP_LABEL: Partial<Record<AssetType, string>> = { renda: 'CAIXINHA OU CDB', tesouro: 'TESOURO', acao: 'AÇÕES', fii: 'FUNDOS IMOBILIÁRIOS', bitcoin: 'BITCOIN', dolar: 'DÓLAR', lcilca: 'LCI OU LCA', provento: 'PROVENTO' };
const Title = ({ step, label, title, sub }: { step: number; label?: string; title: string; sub?: string }) => (
  <View style={{ gap: 2, marginBottom: S.sm }}>
    <Txt style={{ fontSize: 11, letterSpacing: 1.6, color: T.lilacDeep, fontWeight: '700' }}>{`PASSO ${step} DE 3${label ? ' · ' + label : ''}`}</Txt>
    <Txt style={{ fontSize: 22, lineHeight: 28, fontWeight: '700' }}>{title}</Txt>
    {sub ? <Txt dim style={{ fontSize: 13 }}>{sub}</Txt> : null}
  </View>);
const Label = ({ children }: { children: React.ReactNode }) => <Txt dim style={{ fontSize: 13, marginTop: S.sm }}>{children}</Txt>;
const Hint = ({ children }: { children: React.ReactNode }) => <View style={{ backgroundColor: T.champLight, borderRadius: R.inner, padding: S.md, marginTop: S.sm }}><Txt style={{ fontSize: 12, color: T.text }}>{children}</Txt></View>;
const IconBox = ({ name }: { name: Icon }) => <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.champLight, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={name} size={19} color={T.pink} /></View>;

export default function Adicionar() {
  const params = useLocalSearchParams<{ cat?: string; name?: string; type?: string }>();
  const router = useRouter();
  const { portfolio: p, update, snap, hidden } = usePilinha();
  const today = toISO(new Date());
  const editing = React.useMemo(() => (params.cat && params.name ? draftFor(p, { category: String(params.cat), name: String(params.name) }) : null), []); // eslint-disable-line
  const [d, setD] = React.useState<Draft | null>(editing ?? (params.type ? emptyDraft(params.type as AssetType, today) : null));
  const [step, setStep] = React.useState(editing || params.type ? 2 : 1);
  const [adv, setAdv] = React.useState(false);
  const [price, setPrice] = React.useState<number | null>(null);
  const set = (x: Partial<Draft>) => setD(o => (o ? { ...o, ...x } : o));
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const pick = (t: AssetType) => { setD(emptyDraft(t, today)); setAdv(false); setPrice(null); setStep(2); };
  const next = () => {
    if (!d) return; const e = validateDraft(d, p);
    if (e.length) return Alert.alert('Confere aí', e.join('\n'));
    setStep(3);
  };
  const save = async () => {
    if (!d) return; const e = validateDraft(d, p); if (e.length) return Alert.alert('Confere aí', e.join('\n'));
    await update(applyDraft(p, d).portfolio); close();
  };
  const remove = () => {
    if (!params.cat || !params.name) return;
    Alert.alert('Remover', `Remover ${params.name} da carteira?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: async () => { await update(removeItem(p, { category: String(params.cat), name: String(params.name) })); close(); } }]);
  };
  // Bitcoin/dólar: cotação que o app já tem; ações: busca na hora.
  React.useEffect(() => {
    if (!d) return;
    if (d.type === 'bitcoin') setPrice(snap?.items.find(i => i.category === 'cripto')?.unitPrice ?? null);
    if (d.type === 'dolar') setPrice(snap?.usdBRL ?? null);
  }, [d?.type]); // eslint-disable-line

  const footer = step === 1 ? null : (
    <View style={{ padding: S.lg, gap: S.sm, backgroundColor: T.bg, borderTopWidth: 1, borderTopColor: T.line }}>
      {step === 2 ? <Button title="Continuar" onPress={next} /> : <Button title={editing ? 'Salvar alterações' : 'Salvar na carteira'} onPress={save} />}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {(step === 3 || !editing) ? <Pressable onPress={() => setStep(step - 1)} hitSlop={8}><Txt style={{ color: T.lilacDeep, fontWeight: '600' }}>Voltar</Txt></Pressable> : <View />}
        {editing && step === 2 ? <Pressable onPress={remove} hitSlop={8}><Txt style={{ color: T.down, fontWeight: '600' }}>Remover da carteira</Txt></Pressable> : null}
      </View>
    </View>);
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ padding: S.lg, gap: S.sm, paddingBottom: S.xxl }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {step === 1 && <TypeStep onPick={pick} />}
        {step === 2 && d && <FieldsStep d={d} set={set} adv={adv} setAdv={setAdv} price={price} setPrice={setPrice} editing={!!editing} multi={multiDeposit(p, d)} today={today} />}
        {step === 3 && d && <ConfirmStep d={d} price={price} hidden={hidden} notice={existingNotice(d, p, hidden)} cdiAnnual={snap?.cdiAnnual ?? null} editing={!!editing} multi={multiDeposit(p, d)} />}
      </ScrollView>
      {footer}
    </View>);
}

function TypeStep({ onPick }: { onPick: (t: AssetType) => void }) {
  return (<>
    <Title step={1} title="O que você quer adicionar?" sub="Escolha o tipo. Dá para mudar depois." />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
      {ASSET_TYPES.map(a => (
        <Pressable key={a.type} onPress={() => onPick(a.type)} accessibilityRole="button" accessibilityLabel={a.title}
          style={{ width: '48.5%', backgroundColor: T.card, borderRadius: R.inner + 2, borderWidth: 1, borderColor: T.line, padding: S.md, gap: S.sm, minHeight: 104 }}>
          <IconBox name={a.icon as Icon} />
          <View><Txt style={{ fontWeight: '700', fontSize: 14 }}>{a.title}</Txt><Txt dim style={{ fontSize: 12 }}>{a.hint}</Txt></View>
        </Pressable>))}
    </View>
  </>);
}

function FieldsStep({ d, set, adv, setAdv, price, setPrice, editing, multi, today }: { d: Draft; set: (x: Partial<Draft>) => void; adv: boolean; setAdv: (b: boolean) => void; price: number | null; setPrice: (n: number | null) => void; editing: boolean; multi: boolean; today: string }) {
  const lbl = STEP_LABEL[d.type];
  const money = <>
    {multi ? <Hint>Este investimento tem vários aportes. Aqui você muda a taxa, o nome e o vencimento; para somar dinheiro novo, use o botão + e escolha o mesmo tipo e nome.</Hint> : <>
      <Label>Quanto você investiu?</Label>
      <Field placeholder="R$ 1.000,00" keyboardType="decimal-pad" value={d.amount} onChangeText={amount => set({ amount })} />
      <Label>Quando?</Label>
      <DateField value={d.date} max={today} onChange={date => set({ date })} />
    </>}
  </>;
  const advToggle = (text: string, body: React.ReactNode) => <>
    <Pressable onPress={() => setAdv(!adv)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: S.md }}>
      <MaterialCommunityIcons name={adv ? 'chevron-up' : 'chevron-down'} size={18} color={T.lilacDeep} />
      <Txt style={{ color: T.lilacDeep, fontWeight: '600', fontSize: 13 }}>{adv ? 'Esconder opções avançadas' : 'Mostrar opções avançadas'}</Txt>
    </Pressable>
    {adv ? body : <Hint>{text}</Hint>}
  </>;
  if (d.type === 'tesouro') return <TesouroFields d={d} set={set} money={money} advToggle={advToggle} />;
  if (d.type === 'renda' || d.type === 'lcilca') {
    const kinds = d.type === 'renda' ? [['caixinha', 'Caixinha'], ['cdb', 'CDB']] : [['lci', 'LCI'], ['lca', 'LCA']];
    const custom = !CDI_SHORTCUTS.map(String).includes(d.cdi);
    return (<>
      <Title step={2} label={lbl} title={d.type === 'renda' ? 'Onde está o dinheiro?' : 'Qual LCI ou LCA?'} sub="Dê um nome que você reconheça (ex. Caixinha Viagem)." />
      <View style={{ flexDirection: 'row', gap: S.sm }}>{kinds.map(([k, l]) => <Chip key={k} label={l} on={d.kind === k} onPress={() => set({ kind: k as Draft['kind'] })} />)}</View>
      <Label>Nome</Label>
      <Field placeholder={d.type === 'renda' ? 'Ex.: Caixinha Viagem' : 'Ex.: LCI Banco Inter'} value={d.name} onChangeText={name => set({ name })} />
      {money}
      <Label>Quanto rende?</Label>
      <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>{CDI_SHORTCUTS.map(c => <Chip key={c} label={`${c}% do CDI`} on={d.cdi === String(c)} onPress={() => set({ cdi: String(c) })} />)}</View>
      {advToggle('Opções avançadas: outro % do CDI e vencimento. Quase ninguém precisa mexer.', <>
        <Label>Outro % do CDI</Label>
        <Field placeholder="Ex.: 102" keyboardType="decimal-pad" value={custom ? d.cdi : ''} onChangeText={cdi => set({ cdi })} />
        <Label>Vencimento (opcional)</Label>
        <DateField value={d.maturity} min={today} placeholder="Sem vencimento" onChange={maturity => set({ maturity })} />
      </>)}
    </>);
  }
  if (d.type === 'acao' || d.type === 'fii') return <StockFields d={d} set={set} lbl={lbl} price={price} setPrice={setPrice} editing={editing} />;
  if (d.type === 'provento') return (<>
    <Title step={2} label={lbl} title="Qual provento caiu?" sub="O valor que caiu na conta. Ele substitui o da internet para esse código." />
    <Label>De qual ação ou FII?</Label>
    <Field placeholder="Ex.: MXRF11" autoCapitalize="characters" autoCorrect={false} value={d.ticker} onChangeText={ticker => set({ ticker })} />
    <Label>Quanto caiu na conta?</Label>
    <Field placeholder="R$ 12,50" keyboardType="decimal-pad" value={d.amount} onChangeText={amount => set({ amount })} />
    <Label>Quando?</Label>
    <DateField value={d.date} max={today} onChange={date => set({ date })} />
  </>);
  const btc = d.type === 'bitcoin';
  return (<>
    <Title step={2} label={lbl} title={btc ? 'Quanto de bitcoin você tem?' : 'Quantos dólares você tem?'} sub="A cotação é automática e entra no total." />
    <Label>{btc ? 'Quantidade (ex. 0,0015)' : 'Quantidade em US$'}</Label>
    <Field placeholder={btc ? '0,0015' : 'US$ 1.500,00'} keyboardType="decimal-pad" value={d.quantity} onChangeText={quantity => set({ quantity })} />
    {price != null ? <Txt dim style={{ fontSize: 12 }}>Cotação agora: {brl(price)}</Txt> : null}
    <Label>{btc ? 'Quanto pagou em média por bitcoin? (opcional)' : 'Quanto pagou por dólar? (opcional)'}</Label>
    <Field placeholder={btc ? 'Ex.: 350.000,00' : 'Ex.: 5,10'} keyboardType="decimal-pad" value={d.avg} onChangeText={avg => set({ avg })} />
    <Hint>Não lembra? Deixe em branco. O app mostra o valor de hoje e você completa depois.</Hint>
  </>);
}

function StockFields({ d, set, lbl, price, setPrice, editing }: { d: Draft; set: (x: Partial<Draft>) => void; lbl?: string; price: number | null; setPrice: (n: number | null) => void; editing: boolean }) {
  const [q, setQ] = React.useState(d.ticker);
  const [hits, setHits] = React.useState<TickerHit[]>([]);
  const [quotes, setQuotes] = React.useState<Record<string, number | null>>({});
  const fii = d.type === 'fii';
  React.useEffect(() => {
    if (d.ticker && normTicker(q) === d.ticker) { setHits([]); return; }
    const local = localSearch(q, fii); setHits(local);
    if (q.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      try { const r = parseYahooSearch(await defaultFetcher(yahooSearchURL(q), { 'User-Agent': 'Mozilla/5.0' })); if (alive) setHits(mergeHits(local, r.filter(h => h.ticker.endsWith('11') === fii || !fii && !h.ticker.endsWith('11')))); } catch {}
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q]); // eslint-disable-line
  // Cotação ao vivo de cada resultado (no máximo 5) e do escolhido.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const token = await St.loadToken();
      for (const h of hits.slice(0, 5)) if (!(h.ticker in quotes)) stockQuote(h.ticker, token).then(x => alive && setQuotes(o => ({ ...o, [h.ticker]: x.price }))).catch(() => alive && setQuotes(o => ({ ...o, [h.ticker]: null })));
    })();
    return () => { alive = false; };
  }, [hits]); // eslint-disable-line
  React.useEffect(() => {
    if (!validTicker(d.ticker)) { setPrice(null); return; }
    let alive = true; St.loadToken().then(tk => stockQuote(d.ticker, tk)).then(x => alive && setPrice(x.price)).catch(() => alive && setPrice(null));
    return () => { alive = false; };
  }, [d.ticker]); // eslint-disable-line
  const choose = (t: string) => { set({ ticker: t }); setQ(t); setHits([]); };
  return (<>
    <Title step={2} label={lbl} title={fii ? 'Qual fundo?' : 'Qual ação?'} sub="Digite o nome ou o código." />
    <Field placeholder={fii ? 'Ex.: Maxi Renda ou MXRF11' : 'Ex.: Petrobras ou PETR4'} autoCapitalize="characters" autoCorrect={false} value={q}
      onChangeText={x => { setQ(x); const t = normTicker(x); set({ ticker: validTicker(t) ? t : '' }); }} />
    {hits.length > 0 && <Card style={{ padding: S.sm, gap: 0 }}>
      {hits.map((h, i) => (
        <Pressable key={h.ticker} onPress={() => choose(h.ticker)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.sm + 2, paddingHorizontal: S.sm, borderBottomWidth: i === hits.length - 1 ? 0 : 1, borderBottomColor: T.line }}>
          <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700', fontSize: 14 }}>{h.ticker}</Txt><Txt dim style={{ fontSize: 12 }}>{h.name}</Txt></View>
          <Txt style={{ fontSize: 14 }}>{quotes[h.ticker] != null ? brl(quotes[h.ticker]!) : quotes[h.ticker] === null ? '—' : '…'}</Txt>
        </Pressable>))}
    </Card>}
    {d.ticker ? <Txt dim style={{ fontSize: 12 }}>{d.ticker}{price != null ? ` · cotação agora ${brl(price)}` : ''}</Txt> : null}
    <Label>{fii ? 'Quantas cotas você tem?' : 'Quantas você tem?'}</Label>
    <Field placeholder="100" keyboardType="decimal-pad" value={d.quantity} onChangeText={quantity => set({ quantity })} />
    <Label>{fii ? 'Quanto pagou em média por cota? (opcional)' : 'Quanto pagou em média por ação? (opcional)'}</Label>
    <Field placeholder="Ex.: 32,10" keyboardType="decimal-pad" value={d.avg} onChangeText={avg => set({ avg })} />
    <Hint>{editing ? 'Aqui você corrige a quantidade e o preço médio que estão na carteira.' : 'Não lembra? Deixe em branco. O app mostra o valor de hoje e você completa depois.'}</Hint>
  </>);
}

function TesouroFields({ d, set, money, advToggle }: { d: Draft; set: (x: Partial<Draft>) => void; money: React.ReactNode; advToggle: (t: string, b: React.ReactNode) => React.ReactNode }) {
  const [offers, setOffers] = React.useState<TreasuryOffer[] | null>(null);
  React.useEffect(() => { let a = true; treasuryOffers().then(o => a && setOffers(o)).catch(() => a && setOffers([])); return () => { a = false; }; }, []);
  const list = (offers ?? []).filter(o => o.type === d.treasury);
  // Na edição a taxa contratada é mantida (a do dia só preenche um cadastro novo).
  const choose = (o: TreasuryOffer) => set({ title: offerName(o), maturity: o.maturity, ...(!d.editKey && o.type !== 'selic' && o.buyRate != null ? { rate: String(o.buyRate).replace('.', ',') } : {}) });
  const auto = (o: TreasuryOffer) => o.type !== 'selic' && o.buyRate != null && String(o.buyRate).replace('.', ',') === d.rate;
  const rateText = (o: TreasuryOffer) => (o.buyRate == null ? 'sem taxa hoje' : o.type === 'selic' ? `Hoje: Selic + ${o.buyRate.toFixed(4).replace('.', ',')}%` : o.type === 'ipca' ? `Hoje: IPCA + ${o.buyRate.toFixed(2).replace('.', ',')}% ao ano` : `Hoje: ${o.buyRate.toFixed(2).replace('.', ',')}% ao ano`);
  const chosen = list.find(o => o.maturity === d.maturity && (!d.title || d.title === offerName(o)));
  return (<>
    <Title step={2} label="TESOURO" title="Qual título?" />
    <View style={{ flexDirection: 'row', gap: S.sm }}>
      {([['selic', 'Selic'], ['prefixado', 'Prefixado'], ['ipca', 'IPCA+']] as const).map(([k, l]) => <Chip key={k} label={l} on={d.treasury === k} onPress={() => set({ treasury: k, title: undefined, maturity: '', rate: '' })} />)}
    </View>
    {offers == null ? <Txt dim style={{ fontSize: 13 }}>Buscando os títulos de hoje na planilha do Tesouro…</Txt>
      : list.length ? list.map(o => {
        const on = chosen === o;
        return <Pressable key={o.title + o.maturity} onPress={() => choose(o)} style={{ backgroundColor: T.card, borderRadius: R.inner, borderWidth: on ? 2 : 1, borderColor: on ? T.pink : T.line, padding: S.md }}>
          <Txt style={{ fontWeight: '700', fontSize: 14 }}>{offerName(o)}</Txt>
          <Txt dim style={{ fontSize: 12 }}>{rateText(o)}{on && auto(o) ? ' · preenchido sozinho' : ''}</Txt>
        </Pressable>; })
      : <Txt dim style={{ fontSize: 13 }}>Não deu para ler a planilha do Tesouro agora. Abra as opções avançadas e digite a taxa e o vencimento.</Txt>}
    {d.editKey && d.treasury !== 'selic' && d.rate ? <Txt dim style={{ fontSize: 12 }}>Taxa contratada: {d.treasury === 'ipca' ? `IPCA + ${d.rate}%` : `${d.rate}%`} ao ano (mude nas opções avançadas).</Txt> : null}
    {money}
    {advToggle('Opções avançadas: taxa que você contratou (se diferente), vencimento e apelido. Quase ninguém precisa mexer.', <>
      {d.treasury !== 'selic' && <><Label>{d.treasury === 'ipca' ? 'Taxa contratada (IPCA + % ao ano)' : 'Taxa contratada (% ao ano)'}</Label>
        <Field placeholder={d.treasury === 'ipca' ? 'Ex.: 7,5' : 'Ex.: 13,2'} keyboardType="decimal-pad" value={d.rate} onChangeText={rate => set({ rate })} /></>}
      <Label>Vencimento</Label>
      <DateField value={d.maturity} placeholder="Escolher vencimento" onChange={maturity => set({ maturity })} />
      <Label>Apelido (opcional)</Label>
      <Field placeholder={d.title ?? 'Ex.: Tesouro Aposentadoria'} value={d.name} onChangeText={name => set({ name })} />
    </>)}
  </>);
}

function ConfirmStep({ d, price, hidden, notice, cdiAnnual, editing, multi }: { d: Draft; price: number | null; hidden: boolean; notice: string | null; cdiAnnual: number | null; editing: boolean; multi: boolean }) {
  const pv = preview(d, { cdiAnnual, price });
  const icon = (ASSET_TYPES.find(a => a.type === d.type)?.icon ?? 'wallet-outline') as Icon;
  const row = (l: string, v: React.ReactNode, color?: string, last?: boolean) => (
    <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: S.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line }}>
      <Txt dim style={{ fontSize: 14 }}>{l}</Txt><Txt style={{ fontWeight: '700', fontSize: 14, color: color ?? T.text }}>{v}</Txt></View>);
  const rows: React.ReactNode[] = [];
  const fixed = d.type === 'renda' || d.type === 'tesouro' || d.type === 'lcilca';
  if (d.type === 'provento') { rows.push(row('Recebido', pv.today != null ? money(pv.today, hidden) : '—'), row('Em', longDate(d.date), undefined, true)); }
  else if (fixed && !multi) {
    rows.push(row('Investido', pv.invested != null ? money(pv.invested, hidden) : '—'), row('Em', longDate(d.date)), row('Vale hoje (estimado)', pv.today != null ? money(pv.today, hidden) : '—'),
      row('Em 1 ano rende cerca de', pv.yearGain != null ? (hidden ? 'R$ ••••' : `+ ${brl(pv.yearGain)}`) : '—', T.up, true));
  } else if (fixed) rows.push(row('Aportes', 'mantidos como estão', undefined, true));
  else {
    rows.push(row('Quantidade', hidden ? '••••' : d.quantity));
    if (pv.invested != null) rows.push(row('Investido', money(pv.invested, hidden)));
    rows.push(row('Vale hoje', pv.today != null ? money(pv.today, hidden) : 'sem cotação agora', undefined, true));
  }
  return (<>
    <Title step={3} title="Confere antes de salvar" sub="É assim que vai aparecer na carteira." />
    <EyeToggle />
    <Card style={{ gap: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.xs }}>
        <IconBox name={icon} />
        <View style={{ flex: 1 }}><Txt style={{ fontWeight: '700' }}>{pv.label}</Txt><Txt dim style={{ fontSize: 12 }}>{pv.sub}</Txt></View>
      </View>
      {rows}
    </Card>
    {notice ? <Hint>{notice}</Hint> : null}
    {fixed && !multi ? <Hint>{`Estimativa${d.type === 'tesouro' && d.treasury === 'ipca' ? ' com IPCA de 4,5% ao ano' : d.type === 'tesouro' && d.treasury === 'prefixado' ? ' pela taxa prefixada' : ' pelo CDI de hoje'}, antes do IR. O valor real aparece na carteira${d.type === 'tesouro' ? ', marcado a mercado pela planilha do Tesouro' : ''}.`}</Hint> : null}
    {editing ? <Hint>Você está editando um item que já existe. Só ele muda; o resto da carteira fica igual.</Hint> : null}
  </>);
}
