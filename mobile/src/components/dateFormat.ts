import { parseISO } from '../core';
// Compartilhado entre DateField.tsx (web/testes) e DateField.native.tsx (iPhone).
// Não importar './DateField' dentro do .native: no iPhone o Metro resolve esse caminho para o próprio .native (import circular, longDate vira undefined).
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const longDate = (iso: string) => { const d = parseISO(iso); if (!d) return 'Escolher data'; const [y, m, dd] = iso.split('-').map(Number); return `${dd} de ${MESES[m - 1]} de ${y}`; };
export interface DateFieldProps { value: string; onChange: (iso: string) => void; max?: string; min?: string; placeholder?: string }
