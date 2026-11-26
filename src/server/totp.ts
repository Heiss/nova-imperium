// The authenticator app (#401, owner, 2026-11-25, 97b): TOTP of RFC 6238 on
// node:crypto, no library [V]. HMAC-SHA-1, six digits, steps of 30 s; a code
// is taken one step early or late (±1), and a step that signed in once is
// refused again (the caller keeps the last step per account).
import { createHmac, randomBytes } from 'node:crypto';

const STEP = 30_000;
const DIGITS = 6;
const WINDOW = 1;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 of RFC 4648 without padding, as authenticator apps read it. */
export function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** The bytes of a base32 secret; null for a character outside the alphabet. */
export function unbase32(text: string): Buffer | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new secret: 20 random bytes (160 bits, the size of SHA-1), base32. */
export const newSecret = (): string => base32(randomBytes(20));

/** HOTP of RFC 4226 with SHA-1: the code of one counter, `digits` long. */
export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', key).update(message).digest();
  const offset = mac[mac.length - 1]! & 15;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** The time step of a moment. */
export const stepOf = (now: number): number => Math.floor(now / STEP);

/**
 * The step a code fits, one step early or late allowed, and only after
 * `lastStep` (a step that signed in once is refused again); null for none.
 */
export function verifyTotp(
  secret: string,
  code: unknown,
  now: number,
  lastStep: number | null,
): number | null {
  const key = unbase32(secret);
  const typed = String(code ?? '').trim();
  if (!key || !/^\d{6}$/.test(typed)) return null;
  const at = stepOf(now);
  for (let step = at - WINDOW; step <= at + WINDOW; step++)
    if ((lastStep === null || step > lastStep) && hotp(key, step) === typed)
      return step;
  return null;
}

/** The address an authenticator app reads from the QR code. */
export function otpauthUri(secret: string, account: string): string {
  const issuer = 'Nova Imperium';
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP / 1000}`;
}
