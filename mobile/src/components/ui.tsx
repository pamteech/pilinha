import React from 'react';
import { ScrollView, StyleSheet, Text as RNText, TextProps, TextStyle, View, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgXml } from 'react-native-svg';
import { T, S, R, TY, tabular, fontFor, lineHeightFor } from '../lib/theme';
// Text com Manrope (a família muda conforme o peso).
export const Text = ({ style, ...p }: TextProps) => { const f = StyleSheet.flatten(style) || {}; return <RNText maxFontSizeMultiplier={1.3} {...p} style={[style, { fontFamily: fontFor(f.fontWeight), fontWeight: undefined, lineHeight: lineHeightFor(f.fontSize ?? 15, f.lineHeight) }]} />; };
export const Eyebrow = ({ children, color = T.champ }: { children: React.ReactNode; color?: string }) => (
  <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color, fontWeight: '600' }}>{children}</Text>);
export const screenPad = { paddingHorizontal: S.lg, paddingTop: S.lg, paddingBottom: S.xxl, gap: S.lg } as const;
export const Screen = ({ children }: { children: React.ReactNode }) => (
  <ScrollView style={{ flex: 1, backgroundColor: T.bg }} contentContainerStyle={screenPad} contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>{children}</ScrollView>);
// Título de seção dentro de card: mais espaço acima do que abaixo.
export const SectionTitle = ({ children, right, first }: { children: React.ReactNode; right?: React.ReactNode; first?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: first ? 0 : S.sm, marginBottom: S.xs }}>
    <Eyebrow color={T.text}>{children}</Eyebrow>{right}
  </View>);
// Mede a largura disponível (para gráficos não estourarem em telas pequenas).
export function Measure({ height, children }: { height: number; children: (w: number) => React.ReactNode }) {
  const [w, setW] = React.useState(0);
  return <View style={{ height, width: '100%' }} onLayout={e => setW(Math.floor(e.nativeEvent.layout.width))}>{w > 0 ? children(w) : null}</View>;
}
/** Superfície de cartão: fundo neutro, cantos arredondados, borda/sombra sutis. Roxo só como acento, nunca chapado. */
export const cardSurface = (extra?: ViewStyle): ViewStyle => ({
  backgroundColor: T.card,
  borderRadius: R.card,
  padding: S.lg,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: T.line,
  ...(T.scheme === 'light' ? { shadowColor: '#241B2E', shadowOpacity: 0.05, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 2 } : null),
  ...extra,
});
export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => (
  <View style={[cardSurface(), { gap: S.sm }, style]}>{children}</View>);
/** Texto que cabe numa linha só, reduzindo a fonte se preciso (iPhone estreito ou valor grande). */
export function Fit({ children, style, minScale = 0.55 }: { children: string; style?: TextStyle; minScale?: number }) {
  return <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={minScale} style={[{ width: '100%' }, tabular, style]}>{children}</Text>;
}
/** Barra arredondada de carregamento (sem dado real). */
export function Skeleton({ width, height, style }: { width?: number | `${number}%`; height: number; style?: ViewStyle }) {
  return <View accessibilityLabel="Carregando" style={[{ width: width ?? '100%', height, borderRadius: R.inner, backgroundColor: T.skeleton }, style]} />;
}
/** Larguras fixas para empilhar porcentagem à esquerda e dinheiro à direita, na mesma grade em todos os cartões. */
export const COL = { pct: 80, money: 108, arrow: 14 } as const;
/** Linha rotulada: coluna de % (largura fixa, à esquerda do dinheiro) e coluna de dinheiro alinhada à direita. */
export function CardRow({ label, pct, amount, tone, arrow }: {
  label: string; pct?: string | null; amount?: string | null; tone?: 'up' | 'down' | 'neutral'; arrow?: 'up' | 'down';
}) {
  const c = tone === 'up' ? T.up : tone === 'down' ? T.down : T.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: S.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.line }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: T.dim, ...TY.label, flex: 1, minWidth: 0 }}>{label}</Text>
      <View style={{ width: COL.pct, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
        <View style={{ width: COL.arrow, alignItems: 'center', justifyContent: 'center' }}>
          {arrow ? <MaterialCommunityIcons name={arrow === 'up' ? 'arrow-up' : 'arrow-down'} size={12} color={c} /> : null}
        </View>
        {pct ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: c, ...TY.pct, ...tabular, flex: 1, textAlign: 'right' }}>{pct}</Text> : <View style={{ flex: 1 }} />}
      </View>
      <View style={{ width: COL.money, alignItems: 'flex-end', justifyContent: 'center' }}>
        {amount ? <Fit minScale={0.6} style={{ color: T.text, ...TY.value, textAlign: 'right' }}>{amount}</Fit> : null}
      </View>
    </View>
  );
}
export const Txt = ({ children, style, dim }: { children: React.ReactNode; style?: TextStyle; dim?: boolean }) => (
  <Text style={[{ color: dim ? T.dim : T.text, fontSize: 15 }, (StyleSheet.flatten(style)?.fontSize ?? 15) <= 16 ? { lineHeight: 22 } : null, style]}>{children}</Text>);
export const money = (v: number, hidden: boolean) => (hidden ? 'R$ ••••' : require('../core').brl(v));
export const colorFor = (v: number | null | undefined) => (v == null ? T.dim : v >= 0 ? T.up : T.down);
// Linha compacta de um ativo: renda fixa mostra a % do dia; ações/FIIs/cripto mostram a cotação e o PM.
export function AssetRow({ item, hidden, label, last }: { item: import('../core').LineItem; hidden: boolean; label?: string; last?: boolean }) {
  const C = require('../core');
  const market = C.isMarket(item), dp = C.itemDayPct(item), vs = C.priceVsAvg(item);
  const gain = C.itemGain(item) as number | null;
  const qColor = vs === 'up' ? T.up : vs === 'down' ? T.down : T.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: S.md, gap: S.md, borderBottomWidth: last ? 0 : 1, borderBottomColor: T.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.text, fontSize: 15, fontWeight: '600' }}>{item.name}{label ? <Text style={{ color: T.dim, fontWeight: '400', fontSize: 12 }}>  {label}</Text> : null}</Text>
        <Text style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>{money(item.current, hidden)}{item.net != null && !hidden ? ` · líq. ${money(item.net, false)}` : ''}</Text>
        {item.marketValue != null && <Text style={{ color: T.dim, fontSize: 12, marginTop: 2 }}>Venda hoje {money(item.marketValue, hidden)}{item.marketRate != null ? ` · taxa ${item.marketRate.toFixed(2).replace('.', ',')}%` : ''}</Text>}
        {gain != null && <Text style={{ color: colorFor(gain), fontSize: 12, fontWeight: '600', marginTop: 2 }}>{hidden ? '' : `${gain >= 0 ? '+' : '−'}${C.brl(Math.abs(gain))} · `}{C.pct(item.invested ? (gain / item.invested) * 100 : null)}</Text>}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        {market && item.unitPrice != null
          ? <Text style={{ color: qColor, fontSize: 15, fontWeight: '600' }}>{C.brl(item.unitPrice)}</Text>
          : <View style={{ backgroundColor: dp == null ? T.neutralLight : dp >= 0 ? T.upLight : T.downLight, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: colorFor(dp), fontSize: 12, fontWeight: '600' }}>{C.pct(dp)}</Text></View>}
        {market && dp != null && <Text style={{ color: colorFor(dp), fontSize: 12, fontWeight: '600' }}>{C.pct(dp)}</Text>}
        {market && item.avgPrice != null && <Text style={{ color: T.dim, fontSize: 11 }}>PM {money(item.avgPrice, hidden)}</Text>}
      </View>
    </View>
  );
}

const LOGO_SIZE = 52;
const logoKV = { get: (k: string) => AsyncStorage.getItem(k), set: (k: string, v: string) => AsyncStorage.setItem(k, v) };
/** Círculo do cartão: logo da empresa, ou o ícone roxo do tipo enquanto carrega / se faltar. */
export function AssetLogo({ ticker, icon }: { ticker: string; icon: string }) {
  const C = require('../core');
  const peek = C.peekLogo(ticker);
  const [xml, setXml] = React.useState<string | null>(typeof peek === 'string' ? peek : null);
  React.useEffect(() => {
    if (peek === 'miss' || typeof peek === 'string') return;
    let live = true;
    C.loadLogo(ticker, C.defaultLogoFetch, logoKV).then((r: import('../core').LogoResult) => { if (live && r.ok) setXml(r.xml); });
    return () => { live = false; };
  }, [ticker]);
  return (
    <View style={{ width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2, overflow: 'hidden', backgroundColor: T.champLight, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: T.line }}>
      {xml
        ? <SvgXml xml={xml} width={LOGO_SIZE} height={LOGO_SIZE} />
        : <MaterialCommunityIcons name={icon as any} size={26} color={T.pink} />}
    </View>
  );
}
// Cartão de um papel na aba Ações e FIIs: ícone do tipo, valor em destaque e linhas rotuladas.
export function AssetCard({ item, hidden }: { item: import('../core').LineItem; hidden: boolean }) {
  const v = require('../core').assetCardView(item, hidden);
  return (
    <Card style={{ gap: S.sm, padding: S.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.lg }}>
        <AssetLogo ticker={item.name} icon={v.icon} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: T.text, fontSize: 15, lineHeight: 20, fontWeight: '700' }}>{v.title}</Text>
          <Text numberOfLines={1} style={{ color: T.dim, ...TY.label, marginTop: 2 }}>{v.subtitle}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={T.dim} />
      </View>
      <Fit style={{ color: T.text, ...TY.valueHero, fontSize: 24, lineHeight: 32, marginTop: S.sm }}>{v.total}</Fit>
      <View>
        {v.rows.map((r: import('../core').AssetCardRow) => (
          <CardRow key={r.label} label={r.label} pct={r.hint} amount={r.value} tone={r.tone} arrow={r.arrow} />))}
      </View>
    </Card>
  );
}
// Campos e botões compartilhados (Ajustes, Alertas).
import { Pressable as RNPressable, TextInput as RNTextInput, Switch as RNSwitch } from 'react-native';
export const Field = (p: React.ComponentProps<typeof RNTextInput>) => (
  <RNTextInput placeholderTextColor={T.dim} maxFontSizeMultiplier={1.3} keyboardAppearance={T.scheme} {...p}
    style={{ color: T.text, fontFamily: 'Manrope_400Regular', fontSize: 15, lineHeight: 20, backgroundColor: T.bg, borderRadius: R.inner, paddingHorizontal: S.md, paddingVertical: S.md, borderWidth: 1, borderColor: T.line }} />);
export const Button = ({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'secondary'; disabled?: boolean }) => (
  <RNPressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={{ backgroundColor: kind === 'primary' ? T.pink : T.card, borderWidth: 1, borderColor: kind === 'primary' ? T.pink : T.line, paddingVertical: S.md + 2, borderRadius: R.pill, alignItems: 'center', marginTop: S.xs, opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ color: kind === 'primary' ? T.onPrimary : T.pink, fontWeight: '700' }}>{title}</Text>
  </RNPressable>);
export const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <RNPressable onPress={onPress} style={{ paddingVertical: S.xs + 2, paddingHorizontal: S.md, borderRadius: R.pill, borderWidth: 1, borderColor: on ? T.pink : T.line, backgroundColor: on ? T.pink : T.bg }}>
    <Text style={{ color: on ? T.onPrimary : T.text, fontSize: 14 }}>{label}</Text>
  </RNPressable>);
export const ToggleRow = ({ label, hint, value, onChange, disabled }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.sm }}>
    <View style={{ flex: 1 }}><Txt style={{ fontWeight: '600' }}>{label}</Txt>{hint ? <Txt dim style={{ fontSize: 13 }}>{hint}</Txt> : null}</View>
    <RNSwitch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: T.navy2, false: T.line }} thumbColor={T.thumb} />
  </View>);
