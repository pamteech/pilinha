import { View } from 'react-native';
import { Card, Screen, Txt, AssetRow, money } from '../components/ui';
import { groupItems } from '../core';
import { usePilinha } from '../lib/store';
import { T } from '../lib/theme';
const cat: Record<string, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA', acao: 'Ação', fii: 'FII', cripto: 'Cripto' };
export default function Carteira() {
  const { snap, hidden } = usePilinha();
  if (!snap?.items.length) return <Screen><Txt dim>Nada cadastrado ainda.</Txt></Screen>;
  return (
    <Screen>
      {groupItems(snap.items).map(g => (
        <Card key={g.key} style={{ paddingVertical: 10, gap: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 4 }}>
            <Txt style={{ color: T.pink, fontWeight: '700', fontSize: 16 }}>{g.title}</Txt>
            <Txt style={{ fontWeight: '700' }}>{money(g.total, hidden)}</Txt>
          </View>
          {g.items.map(i => <AssetRow key={i.category + i.name} item={i} hidden={hidden} label={g.key === 'renda' ? cat[i.category] : i.category === 'fii' ? 'FII' : undefined} />)}
        </Card>
      ))}
    </Screen>
  );
}
