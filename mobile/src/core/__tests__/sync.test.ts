import { deriveKeys, normalizeCode, formatCode, sealBlob, openBlob, decryptPortfolioJSON, parsePortfolio, mergePortfolio, emptyPortfolio } from '..';
// Mesmo vetor de Tests/NotchInvestCoreTests/SyncTests.swift (CryptoKit). Só dados falsos.
const code = 'abcd-efgh-2345-6789';
const plain = '{"stocks":[{"ticker":"FAKE3","quantity":1,"averagePrice":10}]}';
const blobB64 = 'AQIDBAUGBwgJCgsMIUqMH7Hr3bhM54ajIoKWCMT2+qWqi+C8sJs016HSlxMwH17H9FzYUyp9T7SCdcWwXdH3L/arvbMPL13M5fxomPkyf06SkHAe5HeMAxPF';
const nonce = new Uint8Array(12).map((_, i) => i + 1);
test('deriva as mesmas chaves que o Swift', () => {
  const k = deriveKeys(code);
  expect(k.id).toBe('23d10dee8f0d2f01e16ec8b0e1e24e54');
  expect(k.writeToken).toBe('95f865075b5832a663fa683661d460b43bb567bc6c1fc5589ce7eaa00e5027ed');
  expect(Buffer.from(k.key).toString('hex')).toBe('7e0d8eca82a8ff1c95ae2823422aa6317a9a6e109a21836bffd0328ffeb7c76b');
});
test('cifra igual ao CryptoKit e decifra', () => {
  const k = deriveKeys(code);
  expect(Buffer.from(sealBlob(k.key, new TextEncoder().encode(plain), nonce)).toString('base64')).toBe(blobB64);
  expect(decryptPortfolioJSON(code, new Uint8Array(Buffer.from(blobB64, 'base64')))).toBe(plain);
});
test('código errado ou blob alterado não abre', () => {
  const b = new Uint8Array(Buffer.from(blobB64, 'base64'));
  expect(() => decryptPortfolioJSON('ABCD-EFGH-2345-678A', b)).toThrow();
  const t = b.slice(); t[20] ^= 1; expect(() => openBlob(deriveKeys(code).key, t)).toThrow();
});
test('normaliza código', () => {
  expect(normalizeCode(' abcd efgh-2345-6789 ')).toBe('ABCDEFGH23456789');
  expect(normalizeCode('ABCD-EFGH-2345-678O')).toBeNull();
  expect(normalizeCode('curto')).toBeNull();
  expect(formatCode('ABCDEFGH23456789')).toBe('ABCD-EFGH-2345-6789');
});
test('carteira do Mac decifrada entra no merge', () => {
  const mac = parsePortfolio(decryptPortfolioJSON(code, new Uint8Array(Buffer.from(blobB64, 'base64'))));
  const phone = { ...emptyPortfolio(), stocks: [{ ticker: 'TEST4', quantity: 2 } as any] };
  expect(mergePortfolio(phone, mac).stocks.map(s => s.ticker).sort()).toEqual(['FAKE3', 'TEST4']);
});
test('utf8 sem TextEncoder (acentos)', () => {
  const { utf8, fromUtf8 } = require('../sync');
  const s = 'Caixinha Viagem — ação ✓';
  expect(Buffer.from(utf8(s)).equals(Buffer.from(s, 'utf8'))).toBe(true);
  expect(fromUtf8(utf8(s))).toBe(s);
});
