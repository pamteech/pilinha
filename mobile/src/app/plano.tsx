import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Button, Card, Chip, Eyebrow, Field, Measure, Screen, SectionTitle, Txt } from '../components/ui';
import { EyeToggle } from '../components/EyeToggle';
import { PLAN_PROFILES, Plan, PlanProfile, REMINDER_DAYS, ageLabel, ageNow, brl, compactBRL, isPositive, parseNumberBR, planPath, planSummary, planTracking, toISO, total, validatePlan } from '../core';
import { usePilinha } from '../lib/store';
import { permissionGranted, requestPermission } from '../lib/alerts';
import { T, S, R } from '../lib/theme';
// "Quero R$ 5 milhões aos 60": a pessoa diz quanto quer, com que idade e quanto pode investir por mês.
// Tudo em dinheiro de hoje (rendimento acima da inflação). Resultado ao vivo enquanto digita; salvar liga o acompanhamento e o lembrete.
const Label = ({ children }: { children: React.ReactNode }) => <Txt dim style={{ fontSize: 13, marginTop: S.xs }}>{children}</Txt>;
const intStr = (n: number | null | undefined) => (n == null ? '' : String(Math.floor(n)));
const moneyStr = (n: number | null | undefined) => (n == null || !(n > 0) ? '' : brl(n).replace('R$ ', '').replace(/,00$/, ''));
export default function PlanoScreen() {
  const { settings, setSettings, snap, history, hidden } = usePilinha();
  const saved = settings.plan, now = new Date();
  const [f, setF] = useState(() => ({
    target: moneyStr(settings.goal), age: intStr(saved ? ageNow(saved, now) : null), targetAge: intStr(saved?.targetAge), monthly: moneyStr(saved?.monthly),
    profile: (saved?.profile ?? 'moderado') as PlanProfile, reminderDay: saved?.reminderDay ?? null as number | null,
  }));
  const set = (x: Partial<typeof f>) => setF(o => ({ ...o, ...x }));
  const current = snap ? total(snap) : 0;
  const vals = { target: parseNumberBR(f.target), age: parseInt(f.age, 10), targetAge: f.targetAge.trim() ? parseInt(f.targetAge, 10) : null, monthly: f.monthly.trim() ? parseNumberBR(f.monthly) : 0 };
  const ok = validatePlan(vals).length === 0;
  // plano em edição (resultado ao vivo) com a base do plano salvo, se houver
  const draft: Plan | null = ok ? { age: vals.age, ageAsOf: toISO(now).slice(0, 7), targetAge: vals.targetAge, monthly: vals.monthly, profile: f.profile, startDate: saved?.startDate ?? toISO(now), startAmount: saved?.startAmount ?? current, reminderDay: f.reminderDay } : null;
  const sum = useMemo(() => (draft ? planSummary(draft, vals.target, current, now) : null), [JSON.stringify(draft), vals.target, current]); // eslint-disable-line
  const path = useMemo(() => (draft ? planPath(draft, vals.target, current, now) : []), [JSON.stringify(draft), vals.target, current]); // eslint-disable-line
  const track = saved && settings.goal ? planTracking(saved, current, history, now) : null;
  const R$ = (v: number) => (hidden ? 'R$ ••••' : brl(Math.round(v)).replace(/,00$/, ''));
  const big = (v: number) => (hidden ? 'R$ ••••' : compactBRL(v));
  const save = async () => {
    const e = validatePlan(vals); if (e.length) return Alert.alert('Confere aí', e.join('\n'));
    if (f.reminderDay && !(await permissionGranted())) await requestPermission();
    const changed = !saved || saved.monthly !== vals.monthly || saved.profile !== f.profile || settings.goal !== vals.target || saved.targetAge !== vals.targetAge;
    const sameAge = saved && Math.floor(ageNow(saved, now)) === vals.age;
    const plan: Plan = { age: sameAge ? saved!.age : vals.age, ageAsOf: sameAge ? saved!.ageAsOf : toISO(now).slice(0, 7), targetAge: vals.targetAge, monthly: vals.monthly, profile: f.profile,
      startDate: changed ? toISO(now) : saved!.startDate, startAmount: changed ? current : saved!.startAmount, reminderDay: f.reminderDay };
    await setSettings({ ...settings, goal: vals.target, plan });
    Alert.alert('Plano salvo', f.reminderDay ? `Você recebe um lembrete todo dia ${f.reminderDay}, às 9h.` : 'O acompanhamento aparece no Início.');
  };
  const remove = () => Alert.alert('Remover plano', 'A meta e o plano saem do Início. Seus investimentos não mudam.', [{ text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => { setSettings({ ...settings, goal: null, plan: null }); setF({ target: '', age: '', targetAge: '', monthly: '', profile: 'moderado', reminderDay: null }); } }]);
  const reachTxt = (a: number | null) => (a == null ? 'não chega antes dos 100 anos' : `chega aos ${ageLabel(a)}`);
  const form = (
      <Card>
        <SectionTitle first>{saved ? 'Ajustar plano' : 'Sua meta'}</SectionTitle>
        <Label>Quanto quer ter investido?</Label>
        <Field placeholder="R$ 5.000.000" keyboardType="decimal-pad" value={f.target} onChangeText={target => set({ target })} />
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <View style={{ flex: 1 }}><Label>Sua idade</Label><Field placeholder="30" keyboardType="number-pad" value={f.age} onChangeText={age => set({ age })} /></View>
          <View style={{ flex: 1 }}><Label>Chegar aos (opcional)</Label><Field placeholder="60" keyboardType="number-pad" value={f.targetAge} onChangeText={targetAge => set({ targetAge })} /></View>
        </View>
        <Label>Quanto pode investir por mês?</Label>
        <Field placeholder="R$ 3.000" keyboardType="decimal-pad" value={f.monthly} onChangeText={monthly => set({ monthly })} />
        <Label>Quanto espera render, acima da inflação</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>{PLAN_PROFILES.map(p => <Chip key={p.key} label={`${p.label} · ${p.real}%`} on={f.profile === p.key} onPress={() => set({ profile: p.key })} />)}</View>
        <Label>Lembrete para aportar</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          <Chip label="Sem" on={!f.reminderDay} onPress={() => set({ reminderDay: null })} />
          {REMINDER_DAYS.map(d => <Chip key={d} label={`Dia ${d}`} on={f.reminderDay === d} onPress={() => set({ reminderDay: d })} />)}
        </View>
        <Button title={saved ? 'Salvar alterações' : 'Salvar plano'} onPress={save} />
        {saved ? <Button title="Remover plano" kind="secondary" onPress={remove} /> : null}
      </Card>);
  const results = (sum && draft ? <>
        <Card style={{ backgroundColor: T.navy, borderColor: T.navy }}>
          <Eyebrow>{draft.targetAge != null ? 'Para chegar lá' : 'No seu ritmo'}</Eyebrow>
          {draft.targetAge != null && sum.required != null ? <>
            <Txt style={{ color: T.onDark, fontSize: 30, lineHeight: 38, fontWeight: '800' }}>{sum.required === 0 ? 'Já dá!' : `${R$(sum.required)} por mês`}</Txt>
            <Txt style={{ color: T.onDarkDim, fontSize: 14 }}>{sum.required === 0 ? `Só com o rendimento do que você já tem, chega em ${big(vals.target)} aos ${draft.targetAge} anos.` : `para ter ${big(vals.target)} aos ${draft.targetAge} anos, partindo de ${R$(current)} de hoje e rendendo ${sum.realRate}% ao ano acima da inflação.`}</Txt>
          </> : draft.targetAge != null ? <Txt style={{ color: T.onDark, fontSize: 18, lineHeight: 24, fontWeight: '700' }}>A idade da meta já passou. Escolha uma idade maior.</Txt>
          : <Txt style={{ color: T.onDark, fontSize: 24, lineHeight: 32, fontWeight: '800' }}>{vals.monthly > 0 ? `Você ${reachTxt(sum.reachAge)}` : 'Diga quanto pode investir por mês'}</Txt>}
          {vals.monthly > 0 && draft.targetAge != null && sum.required != null && sum.required > 0 ? (
            <View style={{ backgroundColor: T.navy2, borderRadius: R.inner, padding: S.md, marginTop: S.sm, gap: 2 }}>
              <Txt style={{ color: T.onDark, fontWeight: '700' }}>{`Com ${R$(vals.monthly)} por mês, você ${reachTxt(sum.reachAge)}`}</Txt>
              <Txt style={{ color: sum.reachAge != null && sum.reachAge <= draft.targetAge ? T.upOnDark : T.onDarkDim, fontSize: 13 }}>
                {sum.reachAge != null && sum.reachAge <= draft.targetAge ? 'Antes do prazo. Mantendo o aporte, a meta vem com folga.' : `Para chegar aos ${draft.targetAge}, faltam ${R$(Math.max(0, sum.required - vals.monthly))} por mês.`}
              </Txt>
            </View>) : null}
        </Card>

        {path.length > 1 ? <Card>
          <SectionTitle first>O caminho</SectionTitle>
          <PathChart path={path} target={vals.target} targetAge={draft.targetAge} reachAge={sum.reachAge} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Txt dim style={{ fontSize: 12 }}>hoje · {Math.floor(path[0].age)} anos</Txt>
            <Txt dim style={{ fontSize: 12 }}>{Math.round(path[path.length - 1].age)} anos</Txt>
          </View>
          <Txt dim style={{ fontSize: 12 }}>{`Seu patrimônio em dinheiro de hoje, aportando ${R$(vals.monthly)} por mês. Tracejado: a meta${draft.targetAge != null ? ' e a idade-alvo' : ''}. Ponto verde: quando você chega.`}</Txt>
        </Card> : null}

        <Card style={{ gap: 0 }}>
          <SectionTitle first>Em cada cenário</SectionTitle>
          {sum.byProfile.map((p, i) => (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderTopWidth: i ? 1 : 0, borderTopColor: T.line }}>
              <View style={{ flex: 1 }}><Txt style={{ fontWeight: f.profile === p.key ? '700' : '600' }}>{p.label}</Txt><Txt dim style={{ fontSize: 12 }}>{p.real}% ao ano acima da inflação</Txt></View>
              <View style={{ alignItems: 'flex-end' }}>
                {draft.targetAge != null && p.required != null ? <Txt style={{ fontWeight: '700' }}>{p.required === 0 ? 'já dá' : `${R$(p.required)}/mês`}</Txt> : null}
                {vals.monthly > 0 ? <Txt dim style={{ fontSize: 12 }}>{p.reachAge == null ? 'não chega' : `chega aos ${ageLabel(p.reachAge)}`}</Txt> : null}
              </View>
            </View>))}
          <Txt dim style={{ fontSize: 12, marginTop: S.sm }}>Quanto mais a carteira rende acima da inflação, menos precisa por mês. Mas rendimento maior costuma vir com mais oscilação no caminho.</Txt>
        </Card>

        <Card>
          <SectionTitle first>Por que em dinheiro de hoje</SectionTitle>
          {sum.nominalTarget != null && sum.nominalYear != null ? <Txt style={{ fontSize: 14 }}>{`${big(vals.target)} de hoje serão cerca de ${big(sum.nominalTarget)} em ${sum.nominalYear}, com inflação de 4,5% ao ano. Por isso a conta usa o rendimento acima da inflação.`}</Txt> : null}
          <Txt style={{ fontSize: 14 }}>{`Na prática: aumente o aporte pela inflação uma vez por ano (ex.: ${R$(vals.monthly || sum.required || 0)} hoje, uns ${R$((vals.monthly || sum.required || 0) * 1.045)} no ano que vem).`}</Txt>
          <Txt style={{ fontSize: 14 }}>{`Ao chegar, ${big(vals.target)} rendem cerca de ${R$(sum.passive)} por mês acima da inflação no cenário ${PLAN_PROFILES.find(p => p.key === f.profile)!.label.toLowerCase()}.`}</Txt>
        </Card>
      </> : <Card><Txt dim>Preencha quanto quer ter e a sua idade para ver o plano.</Txt></Card>);
  const tracking = (track && saved ? <Card>
        <SectionTitle first>Acompanhamento</SectionTitle>
        {saved.monthly > 0 ? <>
          <Txt>{track.monthAporte == null ? 'Os aportes do mês aparecem a partir da próxima atualização.' : `Este mês você aportou ${R$(track.monthAporte)} de ${R$(track.monthPlanned)}.`}</Txt>
          {track.monthAporte != null ? <View style={{ height: 10, borderRadius: 999, backgroundColor: T.champLight, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (track.monthAporte / Math.max(1, track.monthPlanned)) * 100)}%`, height: '100%', backgroundColor: track.monthAporte >= track.monthPlanned ? T.up : T.bar, borderRadius: 999 }} />
          </View> : null}
        </> : null}
        <Txt dim style={{ fontSize: 13 }}>{track.monthsElapsed < 1 ? 'A comparação com o caminho do plano começa no mês que vem.' : track.diff >= 0 ? `Você está ${R$(track.diff)} à frente do caminho do plano.` : `Você está ${R$(-track.diff)} atrás do caminho do plano.`}</Txt>
        <Txt dim style={{ fontSize: 12 }}>Aportes medidos pelo valor investido registrado no Pilinvest. Lance cada aporte no Cadastro para a conta fechar.</Txt>
      </Card> : null);
  return (
    <Screen>
      <EyeToggle />
      {saved ? <>{tracking}{results}{form}</> : <>{form}{results}</>}
      <Txt dim style={{ fontSize: 11, textAlign: 'center' }}>Simulação com rendimento constante e inflação estimada. Não é recomendação de investimento.</Txt>
    </Screen>
  );
}

/** Caminho do patrimônio por idade (uma série só: o título nomeia), meta tracejada, idade-alvo tracejada e ponto de chegada. */
function PathChart({ path, target, targetAge, reachAge }: { path: { age: number; value: number }[]; target: number; targetAge: number | null; reachAge: number | null }) {
  const H = 180, PL = 6, PR = 6, PT = 20, PB = 8;
  const a0 = path[0].age, a1 = path[path.length - 1].age, vmax = Math.max(target, ...path.map(p => p.value)) * 1.08;
  return (
    <Measure height={H}>{W => {
      const x = (a: number) => PL + ((a - a0) / Math.max(1e-6, a1 - a0)) * (W - PL - PR);
      const y = (v: number) => H - PB - (v / vmax) * (H - PT - PB);
      const d = path.map((p, k) => `${k ? 'L' : 'M'}${x(p.age).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
      return (
        <Svg width={W} height={H}>
          <Path d={`M${PL},${H - PB} L${W - PR},${H - PB}`} stroke={T.line} strokeWidth={1} />
          <Path d={`M${PL},${y(target)} L${W - PR},${y(target)}`} stroke={T.lilac} strokeWidth={1.5} strokeDasharray="5 5" />
          <SvgText x={PL + 2} y={y(target) - 6} fill={T.dim} fontSize={11} fontFamily="Manrope_600SemiBold" textAnchor="start">meta</SvgText>
          {targetAge != null && targetAge <= a1 ? <>
            <Path d={`M${x(targetAge)},${PT - 6} L${x(targetAge)},${H - PB}`} stroke={T.line} strokeWidth={1.5} strokeDasharray="3 4" />
            <SvgText x={x(targetAge)} y={PT - 9} fill={T.dim} fontSize={11} fontFamily="Manrope_600SemiBold" textAnchor="middle">{`${targetAge} anos`}</SvgText>
          </> : null}
          <Path d={d} stroke={T.pink} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={x(a0)} cy={y(path[0].value)} r={4} fill={T.pink} />
          {reachAge != null && reachAge <= a1 ? <Circle cx={x(reachAge)} cy={y(target)} r={5.5} fill={T.up} stroke={T.card} strokeWidth={2} /> : null}
        </Svg>);
    }}</Measure>);
}
