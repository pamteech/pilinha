import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, Screen, SectionTitle, ToggleRow, Txt, money } from '../components/ui';
import { View } from 'react-native';
import { S } from '../lib/theme';
import { compactBRL } from '../core';
import { usePilinha } from '../lib/store';
import { DadosAvancados } from '../components/DadosAvancados';
import { authenticate, faceIdAvailable } from '../lib/auth';
export default function Ajustes() {
  const { settings, setSettings, hidden } = usePilinha(); const router = useRouter();
  const [has, setHas] = useState(false);
  useEffect(() => { faceIdAvailable().then(setHas); }, []);
  // Ligar/desligar exige confirmar com Face ID (ou senha do aparelho).
  const toggle = async (k: 'faceOnOpen' | 'faceOnReveal', v: boolean) => {
    if (!(await authenticate(v ? 'Ativar o Face ID no Pilinvest' : 'Desativar o Face ID no Pilinvest'))) return;
    await setSettings({ ...settings, [k]: v });
  };
  return (
    <Screen>
      <Card>
        <SectionTitle first>Meta e plano</SectionTitle>
        <Txt dim style={{ fontSize: 13 }}>{settings.goal ? `${hidden ? 'R$ ••••' : compactBRL(settings.goal)}${settings.plan?.targetAge ? ` aos ${settings.plan.targetAge} anos` : ''}${settings.plan?.monthly ? ` · ${money(settings.plan.monthly, hidden)} por mês` : ''}` : 'Quanto você quer ter, com que idade e quanto pode investir por mês. O Pilinvest calcula o caminho e acompanha.'}</Txt>
        <Button title={settings.goal ? 'Abrir meu plano' : 'Montar meu plano'} onPress={() => router.push('/plano')} />
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
