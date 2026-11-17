import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Screen, SectionTitle, Txt } from '../components/ui';
import { ALLOC_ORDER, ALLOC_TITLES, AllocKey, AllocTargets, allocation, parseNumberBR, validateTargets } from '../core';
import { usePilinha } from '../lib/store';
import { T, S } from '../lib/theme';
// Distribuição ideal: quanto a pessoa quer ter em cada tipo, em % da carteira. É a base do "Onde aportar este mês" na Carteira.
// Só percentuais nesta tela (nenhum valor em R$), então não muda com os valores escondidos.
const pctStr = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
export default function AlocacaoScreen() {
  const { settings, setSettings, snap } = usePilinha(); const router = useRouter();
  const saved = settings.allocTargets;
  const [f, setF] = useState(() => Object.fromEntries(ALLOC_ORDER.map(k => [k, saved?.[k] ? pctStr(saved[k]!) : ''])) as Record<AllocKey, string>);
  // mesmos nomes do gráfico da Carteira (Bitcoin vira Cripto quando há outras moedas)
  const slices = allocation(snap?.items ?? []), title = (k: AllocKey) => slices.find(s => s.key === k)?.title ?? ALLOC_TITLES[k];
  const vals: AllocTargets = Object.fromEntries(ALLOC_ORDER.map(k => [k, f[k].trim() ? parseNumberBR(f[k]) : 0]));
  const sum = ALLOC_ORDER.reduce((a, k) => a + (Number.isFinite(vals[k]) ? vals[k]! : 0), 0), errors = validateTargets(vals), ok = errors.length === 0;
  const save = async () => {
    if (!ok) return;
    await setSettings({ ...settings, allocTargets: Object.fromEntries(ALLOC_ORDER.filter(k => vals[k]! > 0).map(k => [k, vals[k]])) });
    router.back();
  };
  const remove = () => Alert.alert('Remover distribuição ideal', 'A sugestão de aporte sai da Carteira. Seus investimentos não mudam.', [{ text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => { setSettings({ ...settings, allocTargets: null }); router.back(); } }]);
  return (
    <Screen>
      <Card>
        <SectionTitle first>Quanto quer ter em cada tipo</SectionTitle>
        <Txt dim style={{ fontSize: 13 }}>Em % da carteira. Deixe em branco o que não quer ter.</Txt>
        {ALLOC_ORDER.map(k => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
            <Txt style={{ flex: 1, fontWeight: '600' }}>{title(k)}</Txt>
            <View style={{ width: 96 }}><Field placeholder="0" keyboardType="decimal-pad" value={f[k]} onChangeText={v => setF(o => ({ ...o, [k]: v }))} accessibilityLabel={`${title(k)}, porcentagem ideal`} /></View>
            <Txt dim>%</Txt>
          </View>))}
        <Txt style={{ fontWeight: '700', color: ok ? T.up : T.text }}>{`Soma: ${pctStr(sum)}%`}</Txt>
        {errors.map(e => <Txt key={e} dim style={{ fontSize: 13 }}>{e}</Txt>)}
        <Button title={saved ? 'Salvar alterações' : 'Salvar distribuição'} onPress={save} disabled={!ok} />
        {saved ? <Button title="Remover" kind="secondary" onPress={remove} /> : null}
      </Card>
      <Txt dim style={{ fontSize: 11, textAlign: 'center' }}>A distribuição é uma escolha sua. Não é recomendação de investimento.</Txt>
    </Screen>
  );
}
