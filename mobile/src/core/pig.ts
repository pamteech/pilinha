/** Cores do porquinho (Ajustes › Porquinho). As folhas de cada cor são geradas por personagem/opcao2d/variantes.py. */
export type PigColor = 'roxo' | 'rosa' | 'azul' | 'menta' | 'dourado' | 'cinza';
export const PIG_COLORS: { key: PigColor; label: string }[] = [
  { key: 'roxo', label: 'Roxo' }, { key: 'rosa', label: 'Rosa' }, { key: 'azul', label: 'Azul' }, { key: 'menta', label: 'Menta' }, { key: 'dourado', label: 'Dourado' }, { key: 'cinza', label: 'Cinza' }];
export const validPigColor = (c: unknown): c is PigColor => PIG_COLORS.some(x => x.key === c);
