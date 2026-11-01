import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Txt } from './ui';
import { T, S, R } from '../lib/theme';
import { parseISO, toISO } from '../core';
// Web e telas de teste: calendário próprio (no iPhone vale o DateField.native.tsx com o calendário do sistema).
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const longDate = (iso: string) => { const d = parseISO(iso); if (!d) return 'Escolher data'; const [y, m, dd] = iso.split('-').map(Number); return `${dd} de ${MESES[m - 1]} de ${y}`; };
export interface DateFieldProps { value: string; onChange: (iso: string) => void; max?: string; min?: string; placeholder?: string }
export function DateField({ value, onChange, max, min, placeholder }: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const base = parseISO(value) ? value : max ?? toISO(new Date());
  const [ym, setYm] = React.useState(() => base.slice(0, 7));
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (k: number) => { const d = new Date(Date.UTC(y, m - 1 + k, 1)); setYm(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); };
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bg, borderRadius: R.inner, borderWidth: 1, borderColor: T.line, paddingHorizontal: S.md, paddingVertical: S.md }}>
        <Txt>{value ? longDate(value) : placeholder ?? 'Escolher data'}</Txt>
        <MaterialCommunityIcons name="calendar-month-outline" size={20} color={T.lilacDeep} />
      </Pressable>
      {open && <View style={{ marginTop: S.sm, backgroundColor: T.card, borderRadius: R.inner, borderWidth: 1, borderColor: T.line, padding: S.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.sm }}>
          <Pressable onPress={() => shift(-1)} hitSlop={8}><MaterialCommunityIcons name="chevron-left" size={22} color={T.text} /></Pressable>
          <Txt style={{ fontWeight: '600' }}>{MESES[m - 1]} {y}</Txt>
          <Pressable onPress={() => shift(1)} hitSlop={8}><MaterialCommunityIcons name="chevron-right" size={22} color={T.text} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, i) => <View key={'w' + i} style={{ width: '14.28%', alignItems: 'center' }}><Txt dim style={{ fontSize: 12 }}>{w}</Txt></View>)}
          {cells.map((d, i) => {
            if (d == null) return <View key={'e' + i} style={{ width: '14.28%', height: 36 }} />;
            const iso = `${ym}-${String(d).padStart(2, '0')}`, off = (max && iso > max) || (min && iso < min), on = iso === value;
            return <Pressable key={iso} disabled={!!off} onPress={() => { onChange(iso); setOpen(false); }} style={{ width: '14.28%', height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? T.pink : 'transparent' }}>
                <Txt style={{ color: on ? T.bg : off ? T.line : T.text, fontSize: 14 }}>{d}</Txt></View></Pressable>;
          })}
        </View>
      </View>}
    </View>);
}
