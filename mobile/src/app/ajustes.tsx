import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Chip, Field, Screen, SectionTitle, ToggleRow, Txt, money } from '../components/ui';
import { View } from 'react-native';
import { S } from '../lib/theme';
import { parseNumberBR, isPositive, formatMonths, monthlyForGoal, monthsToGoal, passiveIncome, total } from '../core';
import { usePilinha } from '../lib/store';
import { DadosAvancados } from '../components/DadosAvancados';
import { authenticate, faceIdAvailable } from '../lib/auth';
export default function Ajustes() {
  const { settings, setSettings, hidden, snap } = usePilinha();
  const [has, setHas] = useState(false); const [goal, setGoal] = useState('');
  const [sim, setSim] = useState({ monthly: '', years: '' });
  useEffect(() => { faceIdAvailable().then(setHas); }, []);
  // Ligar/desligar exige confirmar com Face ID (ou senha do aparelho).
  const toggle = async (k: 'faceOnOpen' | 'faceOnReveal', v: boolean) => {
    if (!(await authenticate(v ? 'Ativar o Face ID no Pilinvest' : 'Desativar o Face ID no Pilinvest'))) return;
    await setSettings({ ...settings, [k]: v });
  };
  const saveGoal = async () => {
    if (!goal.trim()) { await setSettings({ ...settings, goal: null }); return; }
    const v = parseNumberBR(goal); if (!isPositive(v)) return Alert.alert('Confere aí', 'Valor da meta (ex. 10.000,00).');
    await setSettings({ ...settings, goal: v }); setGoal('');
  };
  return (
    <Screen>
      <Card>
        <SectionTitle first>Meta do cofrinho</SectionTitle>
        <Txt dim style={{ fontSize: 13 }}>{settings.goal ? `Meta atual: ${money(settings.goal, hidden)}` : 'Sem meta. Defina um valor para ver a barra de progresso no Início.'}</Txt>
        <Field placeholder="Valor da meta (ex. 10.000,00)" keyboardType="decimal-pad" value={goal} onChangeText={setGoal} />
        <Button title={goal.trim() ? 'Salvar meta' : settings.goal ? 'Remover meta' : 'Salvar meta'} onPress={saveGoal} />
      </Card>
      <Card>
        <SectionTitle first>Simulador de metas</SectionTitle>
        {!settings.goal ? <Txt dim style={{ fontSize: 13 }}>Defina a meta acima para simular quanto investir por mês.</Txt> : <>
          <Txt dim style={{ fontSize: 13 }}>Quanto investir por mês para chegar na meta, partindo do patrimônio de hoje e rendendo o CDI atual.</Txt>
          <Field placeholder="Aporte por mês (ex. 500,00)" keyboardType="decimal-pad" value={sim.monthly} onChangeText={monthly => setSim({ ...sim, monthly })} />
          <Field placeholder="Ou prazo em anos (ex. 5)" keyboardType="decimal-pad" value={sim.years} onChangeText={years => setSim({ ...sim, years })} />
          <GoalSim target={settings.goal} current={snap ? total(snap) : 0} cdi={snap?.cdiAnnual ?? null} monthly={parseNumberBR(sim.monthly)} years={parseNumberBR(sim.years)} hidden={hidden} />
        </>}
      </Card>
      <Card>
        <SectionTitle first>Aparência</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
          {([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']] as const).map(([k, l]) => <Chip key={k} label={l} on={(settings.appearance ?? 'auto') === k} onPress={() => setSettings({ ...settings, appearance: k })} />)}
        </View>
        <Txt dim style={{ fontSize: 13 }}>Automático segue o modo claro ou escuro do iPhone.</Txt>
      </Card>
      <Card>
        <SectionTitle first>Privacidade</SectionTitle>
        <ToggleRow label="Abrir com valores escondidos" hint="Ao abrir ou voltar para o app, toque no patrimônio para mostrar" value={settings.hideOnOpen !== false} onChange={v => setSettings({ ...settings, hideOnOpen: v })} />
      </Card>
      <Card>
        <SectionTitle first>Face ID</SectionTitle>
        {!has && <Txt dim style={{ fontSize: 13 }}>Face ID não disponível ou não configurado neste aparelho. A senha do iPhone funciona como alternativa.</Txt>}
        <ToggleRow label="Exigir ao abrir o app" hint="Também ao voltar do segundo plano" value={settings.faceOnOpen} onChange={v => toggle('faceOnOpen', v)} />
        <ToggleRow label="Exigir para mostrar valores" hint="Ao tocar no patrimônio com os valores escondidos" value={settings.faceOnReveal} onChange={v => toggle('faceOnReveal', v)} />
      </Card>
      <DadosAvancados />
      <Card>
        <SectionTitle first>Sobre</SectionTitle>
        <Txt dim style={{ fontSize: 13 }}>O Pilinvest é uma ferramenta de acompanhamento. Os valores são estimativas com base em cotações públicas (B3 via Yahoo/brapi, Banco Central, Tesouro Direto, CoinGecko e AwesomeAPI) e podem diferir do extrato da corretora. A manchete sobre o dólar vem do Google Notícias (busca fixa). Não é recomendação de investimento.</Txt>
        <Txt dim style={{ fontSize: 13 }}>Seus dados ficam só neste iPhone. Política de privacidade e suporte: pamteech.github.io/pilinha</Txt>
      </Card>
    </Screen>
  );
}

/** Resultado do simulador: prazo com o aporte informado, aporte para o prazo informado e a renda passiva projetada da meta. */
function GoalSim({ target, current, cdi, monthly, years, hidden }: { target: number; current: number; cdi: number | null; monthly: number; years: number; hidden: boolean }) {
  const rate = cdi ?? 10, lines: string[] = [];
  if (isPositive(monthly)) { const n = monthsToGoal(current, target, monthly, rate); lines.push(n == null ? `Com ${money(monthly, hidden)} por mês a meta não chega em 100 anos.` : n === 0 ? 'Você já chegou na meta!' : `Aportando ${money(monthly, hidden)} por mês, você chega em ${formatMonths(n)}.`); }
  if (isPositive(years)) { const m = Math.round(years * 12), a = monthlyForGoal(current, target, m, rate); if (a != null) lines.push(a === 0 ? (current >= target ? 'Você já chegou na meta!' : `Em ${formatMonths(m)} a meta chega só com o rendimento, sem precisar aportar.`) : `Para chegar em ${formatMonths(m)}: ${money(a, hidden)} por mês.`); }
  if (!lines.length) { const n = monthsToGoal(current, target, 0, rate); lines.push(n == null ? 'Preencha o aporte ou o prazo.' : n === 0 ? 'Você já chegou na meta!' : `Sem aportes, só rendendo, a meta chega em ${formatMonths(n)}. Preencha o aporte ou o prazo para simular.`); }
  lines.push(`Ao chegar, a meta rende cerca de ${money(passiveIncome(target, rate), hidden)} por mês a ${rate.toFixed(2).replace('.', ',')}% ao ano (${cdi == null ? 'CDI indisponível agora, usando 10%' : 'CDI de hoje'}, antes do IR).`);
  return <>{lines.map((l, i) => <Txt key={i} style={{ fontSize: 14 }}>{l}</Txt>)}</>;
}
