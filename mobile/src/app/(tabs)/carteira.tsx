import { View } from 'react-native';
import { Card, SectionTitle, Screen, Txt, AssetRow, money } from '../../components/ui';
import { groupItems } from '../../core';
import { usePilinha } from '../../lib/store';
import { S } from '../../lib/theme';
const cat: Record<string, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA', acao: 'Ação', fii: 'FII', cripto: 'Cripto', dolar: 'Dólar' };
export default function Carteira() {
  const { snap, hidden } = usePilinha();
  if (!snap?.items.length) return <Screen><Txt dim>Nada cadastrado ainda.</Txt></Screen>;
  return (
    <Screen>
      {groupItems(snap.items).map(g => (
        <Card key={g.key} style={{ paddingBottom: S.xs, gap: 0 }}>
          <SectionTitle first right={<Txt style={{ fontWeight: '700' }}>{money(g.total, hidden)}</Txt>}>{g.title}</SectionTitle>
          {g.items.map((i, n) => <AssetRow key={i.category + i.name} item={i} hidden={hidden} last={n === g.items.length - 1} label={g.key === 'renda' ? cat[i.category] : i.category === 'fii' ? 'FII' : undefined} />)}
        </Card>
      ))}
    </Screen>
  );
}
