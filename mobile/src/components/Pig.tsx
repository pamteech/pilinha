import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Text } from './ui';
import { Mood, frameCount, moodBadge, moodFps } from '../core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { T } from '../lib/theme';
import { PigColor, SHEET_COLS, sheetRows } from '../core';
// Folhas de animação em WebP (grade de 8 quadros de 384 px por linha, geradas por personagem/opcao2d/gera_folhas.py); uma pasta por cor.
const sheetsByColor: Record<PigColor, Record<Mood, any>> = {
  roxo: { feliz: require('../../assets/pig/porco2d_feliz.webp'), neutro: require('../../assets/pig/porco2d_neutro.webp'), triste: require('../../assets/pig/porco2d_triste.webp'), dormindo: require('../../assets/pig/porco2d_dormindo.webp'), erro: require('../../assets/pig/porco2d_erro.webp'), ganhou: require('../../assets/pig/porco2d_ganhou.webp'), preocupado: require('../../assets/pig/porco2d_preocupado.webp'), apaixonado: require('../../assets/pig/porco2d_apaixonado.webp'), pensando: require('../../assets/pig/porco2d_pensando.webp'), rico: require('../../assets/pig/porco2d_rico.webp'), surpreso: require('../../assets/pig/porco2d_surpreso.webp'), chorando: require('../../assets/pig/porco2d_chorando.webp') },
  rosa: { feliz: require('../../assets/pig/rosa/porco2d_feliz.webp'), neutro: require('../../assets/pig/rosa/porco2d_neutro.webp'), triste: require('../../assets/pig/rosa/porco2d_triste.webp'), dormindo: require('../../assets/pig/rosa/porco2d_dormindo.webp'), erro: require('../../assets/pig/rosa/porco2d_erro.webp'), ganhou: require('../../assets/pig/rosa/porco2d_ganhou.webp'), preocupado: require('../../assets/pig/rosa/porco2d_preocupado.webp'), apaixonado: require('../../assets/pig/rosa/porco2d_apaixonado.webp'), pensando: require('../../assets/pig/rosa/porco2d_pensando.webp'), rico: require('../../assets/pig/rosa/porco2d_rico.webp'), surpreso: require('../../assets/pig/rosa/porco2d_surpreso.webp'), chorando: require('../../assets/pig/rosa/porco2d_chorando.webp') },
  azul: { feliz: require('../../assets/pig/azul/porco2d_feliz.webp'), neutro: require('../../assets/pig/azul/porco2d_neutro.webp'), triste: require('../../assets/pig/azul/porco2d_triste.webp'), dormindo: require('../../assets/pig/azul/porco2d_dormindo.webp'), erro: require('../../assets/pig/azul/porco2d_erro.webp'), ganhou: require('../../assets/pig/azul/porco2d_ganhou.webp'), preocupado: require('../../assets/pig/azul/porco2d_preocupado.webp'), apaixonado: require('../../assets/pig/azul/porco2d_apaixonado.webp'), pensando: require('../../assets/pig/azul/porco2d_pensando.webp'), rico: require('../../assets/pig/azul/porco2d_rico.webp'), surpreso: require('../../assets/pig/azul/porco2d_surpreso.webp'), chorando: require('../../assets/pig/azul/porco2d_chorando.webp') },
  menta: { feliz: require('../../assets/pig/menta/porco2d_feliz.webp'), neutro: require('../../assets/pig/menta/porco2d_neutro.webp'), triste: require('../../assets/pig/menta/porco2d_triste.webp'), dormindo: require('../../assets/pig/menta/porco2d_dormindo.webp'), erro: require('../../assets/pig/menta/porco2d_erro.webp'), ganhou: require('../../assets/pig/menta/porco2d_ganhou.webp'), preocupado: require('../../assets/pig/menta/porco2d_preocupado.webp'), apaixonado: require('../../assets/pig/menta/porco2d_apaixonado.webp'), pensando: require('../../assets/pig/menta/porco2d_pensando.webp'), rico: require('../../assets/pig/menta/porco2d_rico.webp'), surpreso: require('../../assets/pig/menta/porco2d_surpreso.webp'), chorando: require('../../assets/pig/menta/porco2d_chorando.webp') },
  dourado: { feliz: require('../../assets/pig/dourado/porco2d_feliz.webp'), neutro: require('../../assets/pig/dourado/porco2d_neutro.webp'), triste: require('../../assets/pig/dourado/porco2d_triste.webp'), dormindo: require('../../assets/pig/dourado/porco2d_dormindo.webp'), erro: require('../../assets/pig/dourado/porco2d_erro.webp'), ganhou: require('../../assets/pig/dourado/porco2d_ganhou.webp'), preocupado: require('../../assets/pig/dourado/porco2d_preocupado.webp'), apaixonado: require('../../assets/pig/dourado/porco2d_apaixonado.webp'), pensando: require('../../assets/pig/dourado/porco2d_pensando.webp'), rico: require('../../assets/pig/dourado/porco2d_rico.webp'), surpreso: require('../../assets/pig/dourado/porco2d_surpreso.webp'), chorando: require('../../assets/pig/dourado/porco2d_chorando.webp') },
  cinza: { feliz: require('../../assets/pig/cinza/porco2d_feliz.webp'), neutro: require('../../assets/pig/cinza/porco2d_neutro.webp'), triste: require('../../assets/pig/cinza/porco2d_triste.webp'), dormindo: require('../../assets/pig/cinza/porco2d_dormindo.webp'), erro: require('../../assets/pig/cinza/porco2d_erro.webp'), ganhou: require('../../assets/pig/cinza/porco2d_ganhou.webp'), preocupado: require('../../assets/pig/cinza/porco2d_preocupado.webp'), apaixonado: require('../../assets/pig/cinza/porco2d_apaixonado.webp'), pensando: require('../../assets/pig/cinza/porco2d_pensando.webp'), rico: require('../../assets/pig/cinza/porco2d_rico.webp'), surpreso: require('../../assets/pig/cinza/porco2d_surpreso.webp'), chorando: require('../../assets/pig/cinza/porco2d_chorando.webp') },
};
const stills: Record<PigColor, any> = { roxo: require('../../assets/pig/still_roxo.png'), rosa: require('../../assets/pig/still_rosa.png'), azul: require('../../assets/pig/still_azul.png'), menta: require('../../assets/pig/still_menta.png'), dourado: require('../../assets/pig/still_dourado.png'), cinza: require('../../assets/pig/still_cinza.png') };
const sheetFor = (color: PigColor | undefined, mood: Mood) => (sheetsByColor[color ?? 'roxo'] ?? sheetsByColor.roxo)[mood];
/** Porquinho parado (miniatura leve), para o seletor de cor. */
export function PigStill({ color, size = 56 }: { color: PigColor; size?: number }) {
  return <Image source={stills[color] ?? stills.roxo} style={{ width: size, height: size }} />;
}
const halo = (m: Mood) => (m === 'feliz' || m === 'ganhou' || m === 'rico' || m === 'apaixonado' || m === 'surpreso' ? T.upLight : m === 'triste' || m === 'erro' || m === 'chorando' ? T.downLight : T.champLight);
export function Pig({ mood, size = 160, badge = false, color }: { mood: Mood; size?: number; badge?: boolean; color?: PigColor }) {
  const [f, setF] = useState(0); const n = frameCount[mood];
  useEffect(() => { setF(0); const t = setInterval(() => setF(x => (x + 1) % n), 1000 / moodFps(mood)); return () => clearInterval(t); }, [mood, n]);
  const b = moodBadge(mood);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: halo(mood) }}>
        <View style={{ width: size, height: size, overflow: 'hidden' }}>
          <Image source={sheetFor(color, mood)} style={{ width: size * SHEET_COLS, height: size * sheetRows(mood), transform: [{ translateX: -(f % SHEET_COLS) * size }, { translateY: -Math.floor(f / SHEET_COLS) * size }] }} />
        </View>
        {/* Selo redondo e discreto (não parece botão) */}
        {badge && <View pointerEvents="none" accessibilityLabel={b.text} style={{ position: 'absolute', right: size * 0.06, top: size * 0.06, backgroundColor: T.badge, borderRadius: 999, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={b.icon as any} size={18} color={b.tone === 'up' ? T.up : b.tone === 'down' ? T.down : T.dim} /></View>}
      </View>
      {badge && <Text style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>{b.text}</Text>}
    </View>
  );
}
