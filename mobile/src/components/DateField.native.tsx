import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Txt } from './ui';
import { T, S, R } from '../lib/theme';
import { pickerBounds, toISO } from '../core';
import { longDate, DateFieldProps } from './DateField';
export { longDate } from './DateField';
// iPhone: calendário do sistema numa janela que sobe só ao tocar (nunca fica montado na tela).
// A data passada ao calendário é sempre válida e dentro de [min, max] (pickerBounds); datas sempre AAAA-MM-DD no fuso de Brasília.
export function DateField({ value, onChange, max, min, placeholder }: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const b = React.useMemo(() => pickerBounds(value, min, max), [value, min, max]);
  const [temp, setTemp] = React.useState<Date>(b.value);
  const show = () => { setTemp(pickerBounds(value, min, max).value); setOpen(true); };
  const done = () => { const v = temp && Number.isFinite(temp.getTime()) ? toISO(temp) : null; setOpen(false); if (v) onChange(v); };
  return (
    <View>
      <Pressable onPress={show} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.bg, borderRadius: R.inner, borderWidth: 1, borderColor: T.line, paddingHorizontal: S.md, paddingVertical: S.md }}>
        <Txt>{value ? longDate(value) : placeholder ?? 'Escolher data'}</Txt>
        <MaterialCommunityIcons name="calendar-month-outline" size={20} color={T.lilacDeep} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: S.xl, paddingTop: S.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.sm }}>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}><Txt style={{ color: T.lilacDeep, fontWeight: '600' }}>Cancelar</Txt></Pressable>
            <Pressable onPress={done} hitSlop={8}><Txt style={{ color: T.pink, fontWeight: '700' }}>Pronto</Txt></Pressable>
          </View>
          {open ? <DateTimePicker value={temp} mode="date" display="spinner" locale="pt-BR" themeVariant="light" textColor="#000"
            {...(b.max ? { maximumDate: b.max } : {})} {...(b.min ? { minimumDate: b.min } : {})}
            onChange={(_e, d) => { if (d && Number.isFinite(d.getTime())) setTemp(d); }} /> : null}
        </View>
      </Modal>
    </View>);
}
