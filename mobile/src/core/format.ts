export const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`);
