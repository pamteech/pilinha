import { Card, Screen, Txt, colorFor, money } from '../components/ui';
import { pct } from '../core';
import { usePilinha } from '../lib/store';
const cat: Record<string, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA', acao: 'Ação', fii: 'FII', cripto: 'Cripto' };
export default function Carteira() {
  const { snap, hidden } = usePilinha();
  if (!snap?.items.length) return <Screen><Txt dim>Nada cadastrado ainda.</Txt></Screen>;
  return (
    <Screen>
      {snap.items.map(i => {
        const g = i.invested && i.invested > 0 ? (i.current / i.invested - 1) * 100 : null;
        const dp = i.dayChange != null && i.current - i.dayChange > 0 ? (i.dayChange / (i.current - i.dayChange)) * 100 : null;
        return (
          <Card key={i.category + i.name}>
            <Txt style={{ fontWeight: '700' }}>{i.name} <Txt dim>· {cat[i.category] ?? i.category}</Txt></Txt>
            <Txt style={{ fontSize: 20 }}>{money(i.current, hidden)}</Txt>
            <Txt style={{ color: colorFor(dp) }}>Hoje {pct(dp)}</Txt>
            {g != null && <Txt style={{ color: colorFor(g) }}>Desde a compra {pct(g)}</Txt>}
            {i.net != null && <Txt dim>Líquido (IR/IOF): {money(i.net, hidden)}</Txt>}
          </Card>
        );
      })}
    </Screen>
  );
}
