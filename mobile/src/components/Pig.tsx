import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Text } from './ui';
import { FPS, Mood, frameCount, moodBadge } from '../core';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { T } from '../lib/theme';
// Folhas de sprite do porquinho 2D (256 px por quadro, horizontal), do próprio Pilinha.
const sheets: Record<Mood, any> = {
  feliz: require('../../assets/pig/porco2d_feliz.png'), neutro: require('../../assets/pig/porco2d_neutro.png'),
  triste: require('../../assets/pig/porco2d_triste.png'), dormindo: require('../../assets/pig/porco2d_dormindo.png'),
  erro: require('../../assets/pig/porco2d_erro.png'), ganhou: require('../../assets/pig/porco2d_ganhou.png'),
};
const halo = (m: Mood) => (m === 'feliz' || m === 'ganhou' ? T.upLight : m === 'triste' || m === 'erro' ? T.downLight : T.champLight);
export function Pig({ mood, size = 160, badge = false }: { mood: Mood; size?: number; badge?: boolean }) {
  const [f, setF] = useState(0); const n = frameCount[mood];
  useEffect(() => { setF(0); const t = setInterval(() => setF(x => (x + 1) % n), 1000 / FPS); return () => clearInterval(t); }, [mood, n]);
  const b = moodBadge(mood);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: halo(mood) }}>
        <View style={{ width: size, height: size, overflow: 'hidden' }}>
          <Image source={sheets[mood]} style={{ width: size * n, height: size, transform: [{ translateX: -f * size }] }} />
        </View>
        {/* Selo redondo e discreto (não parece botão) */}
        {badge && <View pointerEvents="none" accessibilityLabel={b.text} style={{ position: 'absolute', right: size * 0.06, top: size * 0.06, backgroundColor: T.badge, borderRadius: 999, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={b.icon as any} size={18} color={b.tone === 'up' ? T.up : b.tone === 'down' ? T.down : T.dim} /></View>}
      </View>
      {badge && <Text style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>{b.text}</Text>}
    </View>
  );
}
