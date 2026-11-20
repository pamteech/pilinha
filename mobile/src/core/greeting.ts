/** Saudação do Início conforme a hora local do aparelho (sem nome da pessoa). */
export type Greeting = 'Bom dia' | 'Boa tarde' | 'Boa noite';

export function greetingAt(now: Date = new Date()): Greeting {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}
