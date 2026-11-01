import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Txt } from './ui';
import { usePilinha } from '../lib/store';
import { S, T } from '../lib/theme';
// Olho de mostrar/esconder valores: mesma máscara global da tela Início (toque revela, com Face ID se ligado).
export function EyeToggle() {
  const { hidden, toggleHidden, loading, snap } = usePilinha();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt dim style={{ fontSize: 12 }}>{loading && snap ? 'Atualizando…' : ''}</Txt>
      <Pressable onPress={toggleHidden} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'Mostrar valores' : 'Esconder valores'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingVertical: 4 }}>
        <MaterialCommunityIcons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.lilacDeep} />
        <Txt style={{ fontSize: 13, color: T.lilacDeep, fontWeight: '600' }}>{hidden ? 'Mostrar valores' : 'Esconder valores'}</Txt>
      </Pressable>
    </View>);
}
