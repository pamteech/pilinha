import { View } from 'react-native';
import { Card, Eyebrow, Screen, Txt, money } from '../components/ui';
import { T } from '../lib/theme';
import { usePilinha } from '../lib/store';
export default function Proventos() {
  const { snap, hidden, hasToken } = usePilinha(); const s = snap?.dividends;
  return (
    <Screen>
      <Card><Eyebrow color={T.text}>Últimos 12 meses</Eyebrow><Txt dim style={{ fontSize: 13 }}>Estimativa com a quantidade atual</Txt><Txt style={{ fontSize: 28, lineHeight: 36, fontWeight: '700' }}>{money(s?.last12m ?? 0, hidden)}</Txt></Card>
      {Object.entries(s?.byTicker ?? {}).map(([t, v]) => (
        <Card key={t}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Txt style={{ fontWeight: '700' }}>{t}</Txt><Txt dim style={{ fontSize: 12 }}>{s!.source[t] === 'manual' ? 'lançado à mão' : 'brapi'}</Txt></View><Txt style={{ fontWeight: '600', textAlign: 'right' }}>{money(v, hidden)}</Txt></View></Card>))}
      {!snap && <Txt dim>Carregando…</Txt>}
      {snap && !Object.keys(s?.byTicker ?? {}).length && <Card><Txt dim>Nenhum provento nos últimos 12 meses.</Txt></Card>}
      {!hasToken && <Txt dim style={{ fontSize: 13, paddingHorizontal: 4 }}>Sem token da brapi os proventos automáticos não aparecem; dá para lançar à mão no Cadastro.</Txt>}
    </Screen>
  );
}
