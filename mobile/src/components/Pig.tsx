import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Text } from './ui';
import { Mood, frameCount, moodBadge, moodFps } from '../core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { T } from '../lib/theme';
import { SHEET_COLS, sheetRows } from '../core';
// Folhas de animação em WebP (grade de 8 quadros de 384 px por linha), geradas por personagem/opcao2d/gera_folhas.py.
const sheets: Record<Mood, any> = { feliz: require('../../assets/pig/porco2d_feliz.webp'), neutro: require('../../assets/pig/porco2d_neutro.webp'), triste: require('../../assets/pig/porco2d_triste.webp'), dormindo: require('../../assets/pig/porco2d_dormindo.webp'), erro: require('../../assets/pig/porco2d_erro.webp'), ganhou: require('../../assets/pig/porco2d_ganhou.webp'), preocupado: require('../../assets/pig/porco2d_preocupado.webp'), apaixonado: require('../../assets/pig/porco2d_apaixonado.webp'), pensando: require('../../assets/pig/porco2d_pensando.webp'), rico: require('../../assets/pig/porco2d_rico.webp'), surpreso: require('../../assets/pig/porco2d_surpreso.webp'), chorando: require('../../assets/pig/porco2d_chorando.webp') };
const halo = (m: Mood) => (m === 'feliz' || m === 'ganhou' || m === 'rico' || m === 'apaixonado' || m === 'surpreso' ? T.upLight : m === 'triste' || m === 'erro' || m === 'chorando' ? T.downLight : T.champLight);
export function Pig({ mood, size = 160, badge = false, note }: { mood: Mood; size?: number; badge?: boolean; /** frase do selo no lugar da do humor (comemoração de marco não é "dia positivo") */ note?: string }) {
  const [f, setF] = useState(0); const n = frameCount[mood];
  useEffect(() => { setF(0); const t = setInterval(() => setF(x => (x + 1) % n), 1000 / moodFps(mood)); return () => clearInterval(t); }, [mood, n]);
  const b = note ? { ...moodBadge(mood), text: note } : moodBadge(mood);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: halo(mood) }}>
        <View style={{ width: size, height: size, overflow: 'hidden' }}>
          <Image source={sheets[mood]} style={{ width: size * SHEET_COLS, height: size * sheetRows(mood), transform: [{ translateX: -(f % SHEET_COLS) * size }, { translateY: -Math.floor(f / SHEET_COLS) * size }] }} />
        </View>
        {/* Selo redondo e discreto (não parece botão) */}
        {badge && <View pointerEvents="none" accessibilityLabel={b.text} style={{ position: 'absolute', right: size * 0.06, top: size * 0.06, backgroundColor: T.badge, borderRadius: 999, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={b.icon as any} size={18} color={b.tone === 'up' ? T.up : b.tone === 'down' ? T.down : T.dim} /></View>}
      </View>
      {badge && <Text style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>{b.text}</Text>}
    </View>
  );
}
