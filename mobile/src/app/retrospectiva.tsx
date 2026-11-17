import React from 'react';
import { Alert, Share, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Screen, SectionTitle, Txt, colorFor, money } from '../components/ui';
import { EyeToggle } from '../components/EyeToggle';
import { aportesKnown, bestAsset, dividendsByMonth, pct, reviewYear, yearReview, yearShareText } from '../core';
import { usePilinha } from '../lib/store';
import { T, S } from '../lib/theme';
// Retrospectiva do ano (em janeiro, do ano que acabou): rendimento, aportes, proventos, melhor mês e maior ganho, um card por linha.
// Com valores escondidos ficam só porcentagens e contagens. O que sai pelo Compartilhar nunca leva valor em reais.
const Fact = ({ icon, children }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; children: React.ReactNode }) => (
  <Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md }}>
    <MaterialCommunityIcons name={icon} size={22} color={T.pink} /><View style={{ flex: 1 }}>{children}</View>
  </View></Card>);
export default function Retrospectiva() {
  const { history, snap, portfolio, hidden } = usePilinha();
  const now = new Date(), year = reviewYear(now), r = yearReview(history, year, now);
  if (!r) return (
    <Screen>
      <Card>
        <SectionTitle first>{`Seu ${year} no Pilinvest`}</SectionTitle>
        <Txt>Ainda não dá para montar a sua retrospectiva.</Txt>
        <Txt dim style={{ fontSize: 13 }}>{`Ela é feita com o histórico que o Pilinvest guarda a cada dia de uso, e precisa que o app tenha sido aberto em pelo menos dois dias de ${year}.`}</Txt>
      </Card>
    </Screen>);
  // Proventos do ano só com o que o app já tem (brapi do snapshot e lançamentos manuais), sem busca nova. Mesma regra do fechamento do mês no Início:
  // ticker que dependeria do Yahoo (busca da aba Proventos) faz a linha sumir para não divergir de lá. 13 meses cobrem o ano inteiro também em janeiro.
  const cash = snap?.cash ?? [], manual = portfolio.manualDividends ?? [], known = new Set([...cash, ...manual].map(x => x.ticker.toUpperCase()));
  const prov = portfolio.stocks.every(s => known.has(s.ticker.toUpperCase())) ? dividendsByMonth(portfolio.stocks, cash, manual, now, 13).months.filter(m => m.month.startsWith(`${year}-`)).reduce((a, m) => a + m.total, 0) : 0;
  const best = snap ? bestAsset(snap.items) : null, months = `${r.monthsWithAporte} de ${r.monthsTracked} ${r.monthsTracked === 1 ? 'mês' : 'meses'}`;
  // Ativo sem preço médio: o "aplicado" dele acompanha o mercado, então aportes não são confiáveis e saem da tela e do texto compartilhado.
  const aportesOk = !!snap && aportesKnown(snap.items);
  const share = () => Share.share({ message: yearShareText(r, aportesOk) }).catch(e => Alert.alert('Não deu para compartilhar', (e as Error).message));
  return (
    <Screen>
      <EyeToggle />
      <Card style={{ backgroundColor: T.navy, borderColor: T.navy }}>
        <Txt style={{ color: T.onDark, fontSize: 28, lineHeight: 36, fontWeight: '800' }}>{`Seu ${r.year} no Pilinvest`}</Txt>
        {r.partial && <Txt style={{ color: T.onDarkDim, fontSize: 14 }}>até agora</Txt>}
      </Card>
      <Fact icon="chart-line">
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: S.sm }}>
          <Txt style={{ color: colorFor(hidden ? r.gainPct : r.gain), fontSize: 22, lineHeight: 28, fontWeight: '800' }}>{`Rendeu ${pct(r.gainPct)}`}</Txt>
          {!hidden && <Txt style={{ color: colorFor(r.gain), fontWeight: '600' }}>{money(r.gain, false)}</Txt>}
        </View>
      </Fact>
      {/* meio centavo de folga, como no fechamento do mês: ruído de arredondamento não vira "Você resgatou R$ 0,00" */}
      {aportesOk && <Fact icon="piggy-bank-outline"><Txt>{hidden ? `Aportou em ${months}` : r.aportes > -0.005 ? `Você aportou ${money(Math.abs(r.aportes), false)}, em ${months}` : `No saldo do ano, você resgatou ${money(-r.aportes, false)}. Aportou em ${months}`}</Txt></Fact>}
      {!hidden && prov > 0 && <Fact icon="cash-multiple"><Txt>{`Proventos no ano: ${money(prov, false)}`}</Txt></Fact>}
      {r.bestMonth && <Fact icon="calendar-star"><Txt>{`Melhor mês: ${r.bestMonth.label} (${pct(r.bestMonth.pct)})`}</Txt></Fact>}
      {/* só quando há ganho de fato: com tudo no prejuízo, "maior ganho" enganaria */}
      {best && best.pct > 0 && <Fact icon="trophy-outline">
        <Txt>{`Maior ganho desde a compra: ${best.name} (${pct(best.pct)})`}</Txt>
        <Txt dim style={{ fontSize: 12 }}>Conta desde que você comprou, não só neste ano.</Txt>
      </Fact>}
      <Txt dim style={{ fontSize: 12 }}>{`Estimativa pelo histórico do app. Venda ou vencimento com lucro distorce o rendimento.${aportesOk ? '' : ' Ativo sem preço médio fica fora da conta, e por isso os aportes não aparecem.'}`}</Txt>
      <Button title="Compartilhar" onPress={share} />
      <Txt dim style={{ fontSize: 12, textAlign: 'center' }}>O texto compartilhado leva só porcentagens e contagens, nunca valores em reais.</Txt>
    </Screen>
  );
}
