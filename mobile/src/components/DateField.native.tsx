import React from 'react';
import { Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Txt } from './ui';
import { T, S, R } from '../lib/theme';
import { parseISO, toISO } from '../core';
import { longDate, DateFieldProps } from './DateField';
export { longDate } from './DateField';
// iPhone: calendário do sistema (inline), em português. Datas sempre AAAA-MM-DD no fuso de Brasília.
const toDate = (iso?: string) => { const d = iso ? parseISO(iso) : null; return d ? new Date(d.getTime() + 12 * 3600_000) : undefined; };
export function DateField({ value, onChange, max, min, placeholder }: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bg, borderRadius: R.inner, borderWidth: 1, borderColor: T.line, paddingHorizontal: S.md, paddingVertical: S.md }}>
        <Txt>{value ? longDate(value) : placeholder ?? 'Escolher data'}</Txt>
        <MaterialCommunityIcons name="calendar-month-outline" size={20} color={T.lilacDeep} />
      </Pressable>
      {open && <DateTimePicker value={toDate(value) ?? toDate(max) ?? new Date()} mode="date" display="inline" locale="pt-BR" accentColor={T.pink} themeVariant="light"
        maximumDate={toDate(max)} minimumDate={toDate(min)}
        onChange={(e, d) => { if (e.type === 'set' && d) { onChange(toISO(d)); setOpen(false); } else if (e.type === 'dismissed') setOpen(false); }} />}
    </View>);
}
