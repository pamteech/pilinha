import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { FPS, Mood, frameCount } from '../core';
// Folhas de sprite do porquinho 2D (256 px por quadro, horizontal), do próprio Pilinha.
const sheets: Record<Mood, any> = {
  feliz: require('../../assets/pig/porco2d_feliz.png'), neutro: require('../../assets/pig/porco2d_neutro.png'),
  triste: require('../../assets/pig/porco2d_triste.png'), dormindo: require('../../assets/pig/porco2d_dormindo.png'),
  erro: require('../../assets/pig/porco2d_erro.png'), ganhou: require('../../assets/pig/porco2d_ganhou.png'),
};
export function Pig({ mood, size = 160 }: { mood: Mood; size?: number }) {
  const [f, setF] = useState(0); const n = frameCount[mood];
  useEffect(() => { setF(0); const t = setInterval(() => setF(x => (x + 1) % n), 1000 / FPS); return () => clearInterval(t); }, [mood, n]);
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image source={sheets[mood]} style={{ width: size * n, height: size, transform: [{ translateX: -f * size }] }} />
    </View>
  );
}
