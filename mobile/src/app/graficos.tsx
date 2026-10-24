import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Txt } from '../components/ui';
import { isTradingViewURL, tradingViewSymbol, tradingViewURL } from '../core';
import { usePilinha } from '../lib/store';
import { T } from '../lib/theme';
// TradingView oficial. Login por e-mail e senha: o Google bloqueia login dentro de webview
// (se a conta foi criada com Google, use "Esqueci a senha" no TradingView para criar uma senha).
export default function Graficos() {
  const { portfolio: p } = usePilinha();
  const syms = useMemo(() => [...p.stocks.map(s => s.ticker.toUpperCase()), ...p.crypto.map(c => c.symbol.toUpperCase())], [p]);
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel ?? syms[0] ?? 'IBOV';
  const url = tradingViewURL(cur === 'IBOV' ? 'BMFBOVESPA:IBOV' : tradingViewSymbol(cur, p.tradingview));
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, padding: 8 }}>
        {(syms.length ? syms : ['IBOV']).map(s => (
          <Pressable key={s} onPress={() => setSel(s)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: s === cur ? T.pink : T.card }}>
            <Txt style={{ color: s === cur ? T.bg : T.text }}>{s}</Txt>
          </Pressable>))}
      </ScrollView>
      <Txt dim style={{ fontSize: 12, paddingHorizontal: 10, paddingBottom: 6 }}>Entre com e-mail e senha do TradingView. Login com Google não funciona aqui.</Txt>
      <WebView source={{ uri: url }} style={{ flex: 1 }} sharedCookiesEnabled
        onShouldStartLoadWithRequest={r => isTradingViewURL(r.url) || r.url.startsWith('about:') || r.url.startsWith('blob:')} />
    </View>
  );
}
