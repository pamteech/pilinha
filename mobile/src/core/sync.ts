import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
/**
 * Sincronização Mac → iPhone cifrada ponta a ponta.
 * O código de pareamento (16 letras/números, mostrado no Mac) gera, via HKDF-SHA256:
 *  - id (16 bytes, hex): endereço do blob no servidor;
 *  - chave AES-256-GCM: só o Mac e o iPhone conhecem;
 *  - token de escrita: só o Mac manda (o servidor guarda o hash).
 * Blob = nonce(12) | cifrado | tag(16), igual ao `combined` do CryptoKit. AAD fixo.
 * O servidor nunca vê a carteira nem o código.
 */
export const SYNC_URL = 'https://pilinha-sync.pamellaks22.workers.dev';
export const SYNC_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
// UTF-8 sem TextEncoder/TextDecoder (nem todo Hermes tem os dois).
declare function escape(s: string): string; declare function unescape(s: string): string;
export const utf8 = (s: string) => Uint8Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0));
export const fromUtf8 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 4096) s += String.fromCharCode(...b.subarray(i, i + 4096)); return decodeURIComponent(escape(s)); };
const enc = { encode: utf8 };
const SALT = enc.encode('pilinha-sync-v1');
const AAD = enc.encode('pilinha-sync-v1');
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
/** Aceita minúsculas, espaços e traços. O alfabeto não tem 0/O nem 1/I/L, para não confundir. */
export function normalizeCode(s: string): string | null {
  const c = s.toUpperCase().replace(/[\s-]/g, '');
  return c.length === 16 && [...c].every(ch => SYNC_ALPHABET.includes(ch)) ? c : null;
}
export const formatCode = (c: string) => c.match(/.{1,4}/g)!.join('-');
export interface SyncKeys { id: string; key: Uint8Array; writeToken: string }
export function deriveKeys(code: string): SyncKeys {
  const n = normalizeCode(code); if (!n) throw new Error('Código inválido.');
  const ikm = enc.encode(n);
  const d = (info: string, len: number) => hkdf(sha256, ikm, SALT, enc.encode(info), len);
  return { id: hex(d('id', 16)), key: d('key', 32), writeToken: hex(d('write', 32)) };
}
export function sealBlob(key: Uint8Array, plain: Uint8Array, nonce: Uint8Array): Uint8Array {
  const ct = gcm(key, nonce, AAD).encrypt(plain);
  const out = new Uint8Array(12 + ct.length); out.set(nonce); out.set(ct, 12); return out;
}
export function openBlob(key: Uint8Array, blob: Uint8Array): Uint8Array {
  if (blob.length < 28) throw new Error('Dados do Mac incompletos.');
  return gcm(key, blob.slice(0, 12), AAD).decrypt(blob.slice(12));
}
export const decryptPortfolioJSON = (code: string, blob: Uint8Array) => fromUtf8(openBlob(deriveKeys(code).key, blob));
