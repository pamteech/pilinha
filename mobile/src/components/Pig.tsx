import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { FPS, Mood, frameCount, moodBadge } from '../core';
import { T } from '../lib/theme';
// Folhas de sprite do porquinho 2D (256 px por quadro, horizontal), do próprio Pilinha.
const sheets: Record<Mood, any> = {
  feliz: require('../../assets/pig/porco2d_feliz.png'), neutro: require('../../assets/pig/porco2d_neutro.png'),
  triste: require('../../assets/pig/porco2d_triste.png'), dormindo: require('../../assets/pig/porco2d_dormindo.png'),
  erro: require('../../assets/pig/porco2d_erro.png'), ganhou: require('../../assets/pig/porco2d_ganhou.png'),
};
const halo: Partial<Record<Mood, string>> = { feliz: 'rgba(95,211,141,0.18)', ganhou: 'rgba(95,211,141,0.25)', triste: 'rgba(255,107,122,0.16)', erro: 'rgba(255,107,122,0.16)' };
export function Pig({ mood, size = 160, badge = false }: { mood: Mood; size?: number; badge?: boolean }) {
  const [f, setF] = useState(0); const n = frameCount[mood];
  useEffect(() => { setF(0); const t = setInterval(() => setF(x => (x + 1) % n), 1000 / FPS); return () => clearInterval(t); }, [mood, n]);
  const b = moodBadge(mood);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: halo[mood] ?? 'transparent' }}>
        <View style={{ width: size, height: size, overflow: 'hidden' }}>
          <Image source={sheets[mood]} style={{ width: size * n, height: size, transform: [{ translateX: -f * size }] }} />
        </View>
        {badge && <View style={{ position: 'absolute', right: 4, top: 4, backgroundColor: T.card, borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 24 }}>{b.emoji}</Text></View>}
      </View>
      {badge && <Text style={{ color: T.dim, fontSize: 13, marginTop: 2 }}>{b.text}</Text>}
    </View>
  );
}
