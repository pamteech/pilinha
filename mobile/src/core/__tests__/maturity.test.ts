import { maturityLabel, maturityReminders, upcomingMaturities } from '..';
// Aviso de vencimento da renda fixa: 7 dias antes e no dia, às 9h (Brasília). Dados fictícios, sem valores.
const NOW = new Date('2026-11-12T15:00:00Z'); // 12h em Brasília
const CEDO = new Date('2026-11-12T10:00:00Z'); // 7h em Brasília
const fi = (name: string, maturity?: string) => ({ name, maturity });
test('próximos vencimentos: em ordem de data, sem os passados, sem data ou com data inválida', () => {
  const list = [fi('CDB Banco X', '2027-03-01'), fi('LCI Banco Y', '2026-11-20'), fi('Antigo', '2026-11-11'), fi('Sem data'), fi('Dia que não existe', '2026-02-31'), fi('Texto', 'amanhã'),
    fi('Número', 20270101 as any), fi('Vence hoje', '2026-11-12'), fi('Tesouro IPCA+ 2029', '2029-05-15T00:00:00Z')];
  expect(upcomingMaturities(list, NOW)).toEqual([
    { name: 'Vence hoje', date: '2026-11-12', daysLeft: 0 }, { name: 'LCI Banco Y', date: '2026-11-20', daysLeft: 8 },
    { name: 'CDB Banco X', date: '2027-03-01', daysLeft: 109 }, { name: 'Tesouro IPCA+ 2029', date: '2029-05-15', daysLeft: 915 }]);
  expect(upcomingMaturities([], NOW)).toEqual([]);
});
test('rótulo: hoje, amanhã, em N dias', () => {
  expect(maturityLabel(0)).toBe('vence hoje'); expect(maturityLabel(1)).toBe('vence amanhã'); expect(maturityLabel(2)).toBe('vence em 2 dias'); expect(maturityLabel(109)).toBe('vence em 109 dias');
});
test('lembretes: 7 dias antes e no dia, às 9h, com o nome e sem valores', () => {
  const r = maturityReminders([fi('CDB Banco X', '2026-12-01')], NOW);
  expect(r).toEqual([
    { id: 'pilinha-venc-2026-12-01-7-CDB Banco X', name: 'CDB Banco X', fireAt: new Date('2026-11-24T12:00:00Z'), title: 'CDB Banco X vence em 7 dias', body: 'Veja se vai resgatar ou reinvestir.' },
    { id: 'pilinha-venc-2026-12-01-0-CDB Banco X', name: 'CDB Banco X', fireAt: new Date('2026-12-01T12:00:00Z'), title: 'Vence hoje: CDB Banco X', body: 'Veja se vai resgatar ou reinvestir.' }]);
  for (const x of r) expect(x.title + x.body).not.toMatch(/R\$|\d,\d/); // tela bloqueada: nada de dinheiro
});
test('lembrete que já passou não entra: o de 7 dias antes e o do dia depois das 9h', () => {
  // vence em 5 dias: o aviso de 7 dias antes ficou para trás
  expect(maturityReminders([fi('LCI Banco Y', '2026-11-17')], NOW).map(x => x.title)).toEqual(['Vence hoje: LCI Banco Y']);
  // vence em exatamente 7 dias: às 12h o aviso das 9h já passou; às 7h ainda não
  expect(maturityReminders([fi('LCI Banco Y', '2026-11-19')], NOW).map(x => x.title)).toEqual(['Vence hoje: LCI Banco Y']);
  expect(maturityReminders([fi('LCI Banco Y', '2026-11-19')], CEDO).map(x => x.title)).toEqual(['LCI Banco Y vence em 7 dias', 'Vence hoje: LCI Banco Y']);
  // vence hoje
  expect(maturityReminders([fi('CDB Banco X', '2026-11-12')], NOW)).toEqual([]);
  expect(maturityReminders([fi('CDB Banco X', '2026-11-12')], CEDO).map(x => x.title)).toEqual(['Vence hoje: CDB Banco X']);
  // passado, sem data e inválido: nada
  expect(maturityReminders([fi('Antigo', '2026-11-11'), fi('Sem data'), fi('Texto', 'amanhã')], NOW)).toEqual([]);
});
test('no máximo 20 lembretes: os mais próximos, em ordem', () => {
  // 15 títulos vencendo de 14 a 28/01/2027 = 30 lembretes (de 07/01 a 28/01)
  const many = Array.from({ length: 15 }, (_, i) => fi(`CDB ${i}`, `2027-01-${28 - i}`));
  const r = maturityReminders(many, NOW);
  expect(r.length).toBe(20);
  for (let k = 1; k < r.length; k++) expect(r[k].fireAt.getTime()).toBeGreaterThanOrEqual(r[k - 1].fireAt.getTime());
  expect(r[0]).toMatchObject({ title: 'CDB 14 vence em 7 dias', fireAt: new Date('2027-01-07T12:00:00Z') });
  expect(r[19].fireAt).toEqual(new Date('2027-01-20T12:00:00Z')); // os de 21/01 em diante ficam para a próxima vez que reagendar
  expect(new Set(r.map(x => x.id)).size).toBe(20);
});
test('dois títulos vencendo no mesmo dia: ids diferentes, estáveis e com o prefixo', () => {
  const list = [fi('CDB Banco X', '2027-03-01'), fi('LCA Banco Z', '2027-03-01')];
  const ids = maturityReminders(list, NOW).map(x => x.id);
  expect(ids.length).toBe(4); expect(new Set(ids).size).toBe(4);
  for (const id of ids) expect(id.startsWith('pilinha-venc-')).toBe(true);
  // outro dia, outra ordem na carteira: mesmos ids (reagendar substitui em vez de duplicar)
  expect(maturityReminders([...list].reverse(), new Date('2026-12-25T12:00:00Z')).map(x => x.id).sort()).toEqual([...ids].sort());
});
test('não altera a lista recebida', () => {
  const list = [fi('CDB Banco X', '2027-03-01'), fi('LCI Banco Y', '2026-11-20')], before = JSON.stringify(list);
  list.forEach(Object.freeze); Object.freeze(list); // ordenar no lugar daria erro
  upcomingMaturities(list, NOW); maturityReminders(list, NOW);
  expect(JSON.stringify(list)).toBe(before);
});
