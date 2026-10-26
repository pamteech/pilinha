import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Field, Screen, SectionTitle, ToggleRow, Txt, money } from '../components/ui';
import { parseNumberBR, isPositive } from '../core';
import { usePilinha } from '../lib/store';
import { authenticate, faceIdAvailable } from '../lib/auth';
export default function Ajustes() {
  const { settings, setSettings, hidden } = usePilinha();
  const [has, setHas] = useState(false); const [goal, setGoal] = useState('');
  useEffect(() => { faceIdAvailable().then(setHas); }, []);
  // Ligar/desligar exige confirmar com Face ID (ou senha do aparelho).
  const toggle = async (k: 'faceOnOpen' | 'faceOnReveal', v: boolean) => {
    if (!(await authenticate(v ? 'Ativar o Face ID no Pilinha' : 'Desativar o Face ID no Pilinha'))) return;
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
        <SectionTitle first>Face ID</SectionTitle>
        {!has && <Txt dim style={{ fontSize: 13 }}>Face ID não disponível ou não configurado neste aparelho. A senha do iPhone funciona como alternativa.</Txt>}
        <ToggleRow label="Exigir ao abrir o app" hint="Também ao voltar do segundo plano" value={settings.faceOnOpen} onChange={v => toggle('faceOnOpen', v)} />
        <ToggleRow label="Exigir para mostrar valores" hint="Ao tocar no patrimônio com os valores escondidos" value={settings.faceOnReveal} onChange={v => toggle('faceOnReveal', v)} />
      </Card>
    </Screen>
  );
}
