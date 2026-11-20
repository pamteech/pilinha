export const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const pct = (v: number | null | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`);
/** Impede que 'R$' ou 'US$' quebrem de linha do valor (espaço não separável). */
export const oneLineMoney = (s: string) => s.replace(/R\$ /g, 'R$\u00A0').replace(/US\$ /g, 'US$\u00A0');
