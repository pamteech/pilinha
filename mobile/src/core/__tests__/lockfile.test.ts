import * as fs from 'fs'; import * as path from 'path';
// Guarda contra o lock fora de sincronia (o EAS roda npm ci com npm 10 e falha).
test('toda dependência do package.json está no package-lock', () => {
  const root = path.join(__dirname, '../../..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')), lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }, missing = Object.keys(deps).filter(d => !lock.packages?.[`node_modules/${d}`]);
  expect(missing).toEqual([]); expect(lock.packages[''].dependencies).toEqual(pkg.dependencies);
});
