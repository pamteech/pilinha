import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pig } from '../../components/Pig';
import { Card, Measure, SectionTitle, Txt, colorFor, money, screenPad } from '../../components/ui';
import { TotalsSplit } from '../../components/TotalsSplit';
import { Plan, ageLabel, brl, compactBRL, planSummary, planTracking, goalProgress, Mood, lastDays, weekSummary, topMovers, Mover, dayChangePct, moodFrom, pct, safeNewsLink, shouldCelebrate, total, usdNewsTitle } from '../../core';
import type { UsdNewsState } from '../../lib/store';
import { usePilinha } from '../../lib/store';
import { liveActivityAvailable, liveActivityRunning, startLiveActivity, stopLiveActivity } from '../../lib/widget';
import { dividendToday, isTradingHours, staleInfo, toISO } from '../../core';
import { CashDividend, HistoryPoint, Portfolio, cdiRates, dividendsByMonth, grossValue, monthClose, parseISO, prevMonth, showMonthClose } from '../../core';
import { aporteStreak, aportesKnown, milestoneLabel, newMilestones, nextMilestone, reachedMilestones, streakLabel, topMilestones } from '../../core';
import { Alert } from 'react-native';
import { Button } from '../../components/ui';
import { reviewYear, showYearReview, yearReview } from '../../core';
import { T, S, R } from '../../lib/theme';
export default function Home() {
  const { snap, loading, refresh, hidden, toggleHidden, portfolio, history, settings, usdNews, usdClose, alerts, setSettings, ready } = usePilinha();
  const router = useRouter();
  const d = snap ? dayChangePct(snap) : null, tot = snap ? total(snap) : 0;
  const base = moodFrom(d, loading && !snap, !!snap?.errors.length, {
    hasData: !!snap?.items.length, goalReached: !!(settings.goal && snap && tot >= settings.goal),
    dividendToday: dividendToday(snap?.cash, portfolio.manualDividends, portfolio.stocks.map(x => x.ticker), toISO(new Date())), marketOpen: isTradingHours(),
  });
  const [mood, setMood] = useState<Mood>(base); const prev = useRef<number | null>(null);
  useEffect(() => {
    if (snap && shouldCelebrate(prev.current, tot, d)) { setMood('ganhou'); const t = setTimeout(() => setMood(base), 37 / 24 * 1000); prev.current = tot; return () => clearTimeout(t); }
    if (snap) prev.current = tot; setMood(base);
  }, [snap, base]);
  // Sequência de aportes e marcos: marco novo comemora uma vez (porquinho "ganhou" e linha no card) e entra em milestonesSeen para não repetir.
  // Só avalia com ajustes carregados, cotações em dia e histórico na tela: total parcial ou sequência ainda zerada virariam marco "novo" logo depois.
  // Ativo sem preço médio: o "aplicado" dele acompanha o mercado e alta de preço viraria aporte. Aí não há sequência nem linha de aportes.
  const known = !!snap && aportesKnown(snap.items), streak = known ? aporteStreak(history) : 0, reached = reachedMilestones({ total: tot, goal: settings.goal, streak });
  const [party, setParty] = useState(false); const [fresh, setFresh] = useState<string[]>([]);
  // !loading: avalia uma vez por atualização completa, com total e histórico novos juntos (no meio dela chegam em renders separados).
  const canMark = ready && !loading && !!snap && !snap.errors.length && history.length > 0;
  useEffect(() => {
    if (!canMark) return;
    const seen = settings.milestonesSeen, novos = newMilestones(reached, seen);
    if (seen && !novos.length) return;
    setSettings({ ...settings, milestonesSeen: seen ? [...seen, ...novos] : reached }).catch(() => {}); // primeira vez (null): os já alcançados entram sem comemorar
    if (!novos.length) return;
    setFresh(topMilestones(novos)); setParty(true);
  }, [canMark, reached.join()]);
  // Uma volta da animação, como na comemoração do dia, mas só com o Início na tela: marco costuma vir de um aporte lançado em outra aba.
  useFocusEffect(useCallback(() => { if (!party) return; const t = setTimeout(() => setParty(false), 37 / 24 * 1000); return () => clearTimeout(t); }, [party]));
  const [live, setLive] = useState(liveActivityRunning());
  const toggleLive = async () => {
    try { if (live) await stopLiveActivity(); else if (snap) await startLiveActivity(snap, hidden); } catch {}
    setLive(liveActivityRunning());
  };
  // O spinner só aparece no puxar-para-atualizar: com refreshing=true na abertura o iOS deixa a lista deslocada para cima.
  const [pulling, setPulling] = useState(false);
  const onPull = async () => { setPulling(true); try { await refresh(); } finally { setPulling(false); } };
  const empty = !portfolio.fixedIncome.length && !portfolio.stocks.length && !portfolio.crypto.length && !(portfolio.usd && portfolio.usd.amount > 0);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={screenPad} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={T.pink} />}>
      <View style={{ alignItems: 'center' }}><Pig mood={party ? 'ganhou' : mood} size={170} badge note={party ? 'Novo marco, oinc!' : undefined} /></View>
      {snap ? <TotalsSplit snap={snap} hidden={hidden} close={usdClose} variant="hero" cdiAnnual={snap.cdiAnnual} onToggleHidden={toggleHidden} /> : null}
      {liveActivityAvailable() && snap && (
        <Pressable onPress={toggleLive} style={{ backgroundColor: live ? T.card : T.pink, padding: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: live ? T.line : T.navy }}>
          <Txt style={{ color: live ? T.text : T.onPrimary, fontWeight: '700' }}>{live ? 'Tirar o Pilinvest da Ilha Dinâmica' : 'Acompanhar na Ilha Dinâmica'}</Txt>
          {!live && !isTradingHours() && <Txt style={{ color: T.onPrimary, fontSize: 12 }}>A bolsa está fechada agora</Txt>}
        </Pressable>
      )}
      {empty && <Card>
        <SectionTitle first>Boas-vindas ao Pilinvest</SectionTitle>
        {[['pencil-outline', 'Cadastre seus investimentos na aba Cadastro: renda fixa, ações, FIIs e cripto.'],
          ['refresh', 'Puxe a tela para atualizar as cotações de fontes públicas.'],
          ['cellphone-lock', 'Tudo fica só neste iPhone. Não há conta nem login.']].map(([i, t]) => (
          <View key={i} style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}><MaterialCommunityIcons name={i as any} size={20} color={T.pink} /><Txt style={{ flex: 1 }}>{t}</Txt></View>))}
      </Card>}
      <Stale errors={snap?.errors} />
      {usdNews ? <UsdNews n={usdNews} /> : null}
      {!empty && !alerts.length && <Pressable accessibilityRole="button" onPress={() => router.navigate('/alertas')}>
        <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
          <MaterialCommunityIcons name="bell-plus-outline" size={22} color={T.pink} />
          <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>Crie um alerta de preço</Txt><Txt dim style={{ fontSize: 13 }}>Para qualquer ação ou FII, mesmo que você ainda não tenha, para o dólar e para o bitcoin.</Txt></View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={T.dim} />
        </View></Card>
      </Pressable>}
      {settings.goal ? <Pressable accessibilityRole="button" accessibilityHint="Abre o plano" onPress={() => router.navigate('/plano')}><Goal total={tot} target={settings.goal} hidden={hidden} plan={settings.plan} history={history} /></Pressable>
        : !empty ? <Pressable accessibilityRole="button" onPress={() => router.navigate('/plano')}>
          <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
            <MaterialCommunityIcons name="flag-checkered" size={22} color={T.pink} />
            <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>Monte seu plano</Txt><Txt dim style={{ fontSize: 13 }}>Quanto quer ter e com que idade. O Pilinvest diz quanto investir por mês e acompanha.</Txt></View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={T.dim} />
          </View></Card></Pressable> : null}
      {!empty && snap && history.length > 0 && <Milestones streak={streak} fresh={fresh} last={settings.milestonesSeen?.slice(-1)[0]} total={tot} goal={settings.goal} hidden={hidden} known={known} />}
      <YearReviewCard history={history} />
      <MonthCloseCard history={history} hidden={hidden} portfolio={portfolio} cash={snap?.cash ?? []} aportesOk={known} />
      <Week points={lastDays(history, 7)} hidden={hidden} />
      {snap && <Movers m={topMovers(snap.items, 3)} />}
      <Txt dim style={{ textAlign: 'center', fontSize: 11 }}>Valores estimados para acompanhamento. Não é recomendação de investimento.</Txt>
      {snap && <Txt dim style={{ textAlign: 'center', fontSize: 12 }}>{loading ? 'Atualizando… · ' : ''}Atualizado {snap.updatedAt.toLocaleTimeString('pt-BR')} · puxe para atualizar</Txt>}
    </ScrollView>
  );
}

/** Manchete do dia sobre o dólar (Google Notícias); toque abre a matéria no navegador. Só aparece com o aviso do dólar ligado. */
function UsdNews({ n }: { n: UsdNewsState }) {
  const url = safeNewsLink(n.item.link), when = n.item.publishedAt ? n.item.publishedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${usdNewsTitle(n.dir)}: ${n.item.title}. Abre a notícia`} disabled={!url} onPress={() => url && Linking.openURL(url).catch(() => {})}>
      <Card>
        <SectionTitle first right={<Txt style={{ color: colorFor(n.pct), fontWeight: '700' }}>{pct(n.pct)}</Txt>}>{usdNewsTitle(n.dir)}</SectionTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <MaterialCommunityIcons name="newspaper-variant-outline" size={20} color={T.lilacDeep} />
          <Txt style={{ flex: 1, fontWeight: '600' }}>{n.item.title}</Txt>
          {url ? <MaterialCommunityIcons name="open-in-new" size={16} color={T.dim} /> : null}
        </View>
        <Txt dim style={{ fontSize: 12 }}>{[n.item.source, when].filter(Boolean).join(' · ')}{n.item.source || when ? ' · ' : ''}manchete do Google Notícias</Txt>
      </Card>
    </Pressable>
  );
}
/**
 * Fechamento do mês anterior, só na primeira semana do mês: rendimento sem contar aportes, aportes, proventos e CDI.
 * Com valores escondidos ficam só as porcentagens.
 */
function MonthCloseCard({ history, hidden, portfolio, cash, aportesOk }: { history: HistoryPoint[]; hidden: boolean; portfolio: Portfolio; cash: CashDividend[]; /** custo conhecido em todos os ativos */ aportesOk: boolean }) {
  const c = showMonthClose() ? monthClose(history, prevMonth()) : null, month = c?.month;
  // CDI do mês pela série do BCB que a Evolução usa. Só com ponto nos 7 dias antes do mês: sem ele o rendimento cobre só parte do mês (ou mais de um mês, se o app ficou fechado) e o CDI ao lado enganaria.
  const whole = !!month && history.some(p => p.day < month && p.day >= toISO(new Date(parseISO(`${month}-01`)!.getTime() - 7 * 864e5)));
  const [cdi, setCdi] = useState<number | null>(null);
  useEffect(() => {
    setCdi(null); if (!month || !whole) return; let alive = true;
    const a = parseISO(`${month}-01`)!, b = parseISO(`${toISO(new Date()).slice(0, 7)}-01`)!; // o mês fechado é sempre o anterior ao de hoje
    cdiRates(a, b).then(r => { const f = grossValue(1, a, 100, r, b); if (alive && f > 1) setCdi((f - 1) * 100); }).catch(() => {}); // sem internet: a linha do CDI não aparece
    return () => { alive = false; };
  }, [month, whole]);
  if (!c) return null;
  // Proventos do mês só com o que o Início já tem (brapi do snapshot e lançamentos manuais). Ticker que dependeria do Yahoo (busca da aba Proventos): a linha some para não divergir de lá.
  const manual = portfolio.manualDividends ?? [], known = new Set([...cash, ...manual].map(x => x.ticker.toUpperCase()));
  const prov = portfolio.stocks.every(s => known.has(s.ticker.toUpperCase())) ? dividendsByMonth(portfolio.stocks, cash, manual).months.find(m => m.month === c.month)?.total ?? 0 : 0;
  return (
    <Card>
      <SectionTitle first>{`Fechamento de ${c.label}`}</SectionTitle>
      <Txt style={{ color: colorFor(hidden ? c.gainPct : c.gain), fontWeight: '600' }}>{hidden ? `Rendeu ${pct(c.gainPct)}` : `Rendeu ${money(c.gain, false)}${c.gainPct != null ? ` (${pct(c.gainPct)})` : ''}`}</Txt>
      {/* meio centavo de folga: ruído de arredondamento na soma do aplicado não vira "Você resgatou R$ 0,00" */}
      {!hidden && aportesOk && <Txt style={{ fontSize: 13 }}>{`${c.aportes > -0.005 ? 'Você aportou' : 'Você resgatou'} ${money(Math.abs(c.aportes), false)}`}</Txt>}
      {!hidden && prov > 0 && <Txt style={{ fontSize: 13 }}>{`Proventos: ${money(prov, false)}`}</Txt>}
      {cdi != null && <Txt dim style={{ fontSize: 13 }}>{`CDI no mês: ${cdi.toFixed(2).replace('.', ',')}%`}</Txt>}
      {/* a conta é patrimônio menos aplicado: venda ou vencimento com lucro tira o lucro antigo do mês, por isso sem veredito contra o CDI */}
      <Txt dim style={{ fontSize: 12 }}>{`Estimativa. Venda ou vencimento com lucro no mês distorce o rendimento.${aportesOk ? '' : ' Ativo sem preço médio fica fora da conta, e por isso os aportes não aparecem.'}`}</Txt>
    </Card>
  );
}
/** Retrospectiva do ano, de 1º de dezembro a 31 de janeiro: só a porcentagem (igual com valores escondidos) e o atalho para a tela. */
function YearReviewCard({ history }: { history: HistoryPoint[] }) {
  const router = useRouter(), r = showYearReview() ? yearReview(history, reviewYear()) : null;
  if (!r) return null;
  return (
    <Card>
      <SectionTitle first>{`Seu ${r.year} no Pilinvest`}</SectionTitle>
      {r.gainPct != null && <Txt style={{ color: colorFor(r.gainPct), fontWeight: '600' }}>{`Rendeu ${pct(r.gainPct)}${r.partial ? ' até agora' : ''}`}</Txt>}
      <Button title="Ver retrospectiva" onPress={() => router.navigate('/retrospectiva')} />
    </Card>
  );
}
function Week({ points, hidden }: { points: { total: number; invested: number }[]; hidden: boolean }) {
  const H = 72;
  const { ys, pct: ch, gain } = weekSummary(points, hidden);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const path = (W: number) => ys.map((y, i) => `${i ? 'L' : 'M'}${2 + (i / Math.max(1, ys.length - 1)) * (W - 4)},${H - ((y - min) / span) * (H - 8) - 4}`).join(' ');
  return (
    <Card>
      <SectionTitle first right={<Txt style={{ color: colorFor(ch), fontWeight: '600' }}>{pct(ch)}{!hidden && gain != null ? ` · ${gain >= 0 ? '+' : ''}${money(gain, false)}` : ''}</Txt>}>Últimos 7 dias</SectionTitle>
      {ys.length < 2 ? <Txt dim>O gráfico aparece a partir do segundo dia de uso.</Txt>
        : <Measure height={H}>{W => <Svg width={W} height={H}><Path d={path(W)} stroke={colorFor(ch)} strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" /></Svg>}</Measure>}
    </Card>
  );
}
function Movers({ m }: { m: { up: Mover[]; down: Mover[] } }) {
  if (!m.up.length && !m.down.length) return null;
  const col = (title: string, xs: Mover[], up: boolean) => (
    <View style={{ flex: 1, gap: S.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MaterialCommunityIcons name={up ? 'arrow-up-bold' : 'arrow-down-bold'} size={14} color={up ? T.up : T.down} /><Txt dim style={{ fontSize: 13 }}>{title}</Txt></View>
      {xs.length ? xs.map(x => <View key={x.name} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt style={{ fontWeight: '600' }}>{x.name}</Txt><Txt style={{ color: colorFor(x.pct), textAlign: 'right' }}>{pct(x.pct)}</Txt></View>) : <Txt dim>—</Txt>}
    </View>
  );
  return (
    <Card>
      <SectionTitle first>Maiores altas e quedas do dia</SectionTitle>
      <View style={{ flexDirection: 'row', gap: S.xl }}>{col('Altas', m.up, true)}{col('Quedas', m.down, false)}</View>
    </Card>
  );
}

function Goal({ total, target, hidden, plan, history }: { total: number; target: number; hidden: boolean; plan: Plan | null; history: import('../../core').HistoryPoint[] }) {
  const g = goalProgress(total, target); if (!g) return null;
  const sum = plan ? planSummary(plan, target, total) : null, tr = plan && plan.monthly > 0 ? planTracking(plan, total, history) : null;
  const R$ = (v: number) => brl(Math.round(v)).replace(/,00$/, '');
  return (
    <Card>
      <SectionTitle first right={<Txt style={{ fontWeight: '700', color: g.done ? T.up : T.text }}>{g.pct < 1 && g.pct > 0 ? '<1' : g.pct.toFixed(0)}%</Txt>}>{plan?.targetAge ? `Meta: ${hidden ? 'R$ ••••' : compactBRL(target)} aos ${plan.targetAge}` : 'Meta'}</SectionTitle>
      <View style={{ height: 10, borderRadius: 999, backgroundColor: T.champLight, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(g.pct, g.pct > 0 ? 1 : 0)}%`, height: '100%', backgroundColor: g.done ? T.up : T.bar, borderRadius: 999 }} />
      </View>
      <Txt dim style={{ fontSize: 13 }}>{g.done ? `Meta de ${money(target, hidden)} alcançada!` : hidden ? 'Valores escondidos' : `${money(total, false)} de ${compactBRL(target)} · faltam ${compactBRL(g.remaining)}`}</Txt>
      {sum && plan && plan.monthly > 0 && !g.done ? <Txt style={{ fontSize: 13 }}>{sum.reachAge == null ? 'No ritmo de hoje, a meta não chega antes dos 100.' : `No ritmo de hoje, chega aos ${ageLabel(sum.reachAge)}${plan.targetAge ? (sum.reachAge <= plan.targetAge ? ', dentro do prazo' : `, depois dos ${plan.targetAge}`) : ''}.`}</Txt> : null}
      {tr && tr.monthAporte != null ? <Txt dim style={{ fontSize: 13 }}>{hidden ? `Este mês: ${Math.min(999, Math.round((tr.monthAporte / Math.max(1, tr.monthPlanned)) * 100))}% do aporte` : `Este mês: ${R$(tr.monthAporte)} de ${R$(tr.monthPlanned)}`}</Txt> : null}
    </Card>
  );
}

/**
 * Sequência de aportes e marcos: a sequência, o marco novo (ou o último alcançado) e o próximo, com barra de progresso.
 * Com valores escondidos o marco de patrimônio aparece sem o valor e não há progresso até ele (revelariam o tamanho da carteira); os de meta ficam, em %.
 */
function Milestones({ streak, fresh, last, total, goal, hidden, known }: { streak: number; fresh: string[]; last?: string; total: number; goal: number | null; hidden: boolean; /** custo conhecido em todos os ativos: sem isso não dá para contar aportes */ known: boolean }) {
  const next = nextMilestone({ total, goal, hidden });
  const line = (id: string, pre: string) => (hidden && id.startsWith('total-') ? `${pre} de patrimônio` : `${pre}: ${milestoneLabel(id, hidden)}`);
  const row = (icon: string, text: string, strong = false) => (
    <View key={text} style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}><MaterialCommunityIcons name={icon as any} size={20} color={T.pink} /><Txt style={{ flex: 1, fontWeight: strong ? '700' : undefined }}>{text}</Txt></View>);
  return (
    <Card>
      <SectionTitle first>Sequência e marcos</SectionTitle>
      {known ? row('fire', streakLabel(streak)) : <Txt dim style={{ fontSize: 13 }}>Para contar seus aportes, informe o preço médio de todos os ativos.</Txt>}
      {fresh.length ? fresh.map(id => row('party-popper', line(id, 'Novo marco'), true)) : last && milestoneLabel(last, hidden) ? row('trophy-outline', line(last, 'Último marco')) : null}
      {next && <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: S.md }}><Txt dim style={{ flex: 1, fontSize: 13 }}>{`Próximo marco: ${milestoneLabel(next.id, hidden)}`}</Txt><Txt dim style={{ fontSize: 13 }}>{`${Math.floor(next.pct)}%`}</Txt></View>}
      {next && <View style={{ height: 4, borderRadius: 999, backgroundColor: T.champLight, overflow: 'hidden' }}><View style={{ width: `${next.pct}%`, height: '100%', backgroundColor: T.bar, borderRadius: 999 }} /></View>}
    </Card>
  );
}

/** Aviso discreto: só um ícone de relógio e "dados atrasados"; o detalhe técnico aparece ao tocar. */
export function Stale({ errors }: { errors?: string[] }) {
  const s = staleInfo(errors); if (!s.stale) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Dados atrasados, toque para detalhes" onPress={() => Alert.alert(s.title, s.detail)} hitSlop={8}
      style={{ flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center', paddingHorizontal: S.md, paddingVertical: 4, borderRadius: 999, backgroundColor: T.champLight }}>
      <MaterialCommunityIcons name="clock-alert-outline" size={14} color={T.dim} /><Txt dim style={{ fontSize: 12 }}>{s.title}</Txt>
    </Pressable>);
}
