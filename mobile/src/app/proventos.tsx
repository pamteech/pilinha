import { Card, Screen, Txt, money } from '../components/ui';
import { usePilinha } from '../lib/store';
export default function Proventos() {
  const { snap, hidden, hasToken } = usePilinha(); const s = snap?.dividends;
  return (
    <Screen>
      <Card><Txt dim>Últimos 12 meses (estimativa com a quantidade atual)</Txt><Txt style={{ fontSize: 28, fontWeight: '700' }}>{money(s?.last12m ?? 0, hidden)}</Txt></Card>
      {Object.entries(s?.byTicker ?? {}).map(([t, v]) => (
        <Card key={t}><Txt style={{ fontWeight: '700' }}>{t} <Txt dim>· {s!.source[t] === 'manual' ? 'lançado à mão' : 'brapi'}</Txt></Txt><Txt>{money(v, hidden)}</Txt></Card>))}
      {!hasToken && <Txt dim>Sem token da brapi os proventos automáticos não aparecem; dá para lançar à mão no Cadastro.</Txt>}
    </Screen>
  );
}
