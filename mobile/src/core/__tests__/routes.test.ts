import * as fs from 'fs'; import * as path from 'path';
// Estrutura do expo-router: abas dentro de (tabs) e só Ajustes/Alertas na raiz. Uma tela de aba solta na raiz
// (ex.: cópia antiga de app/index.tsx) vira tela de pilha com título "index", voltar e sem barra de abas.
const app = path.join(__dirname, '../../app');
test('rotas no lugar certo', () => {
  expect(fs.readdirSync(app).sort()).toEqual(['(tabs)', '_layout.tsx', 'ajustes.tsx', 'alertas.tsx']);
  expect(fs.readdirSync(path.join(app, '(tabs)')).sort()).toEqual(['_layout.tsx', 'cadastro.tsx', 'carteira.tsx', 'evolucao.tsx', 'graficos.tsx', 'index.tsx', 'proventos.tsx']);
  const root = fs.readFileSync(path.join(app, '_layout.tsx'), 'utf8');
  expect(root).toMatch(/anchor: '\(tabs\)'/); expect(root).toMatch(/name="\(tabs\)" options=\{\{ headerShown: false \}\}/);
});
