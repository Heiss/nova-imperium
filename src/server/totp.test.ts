import { describe, expect, it } from 'vitest';
import {
  base32,
  hotp,
  newSecret,
  otpauthUri,
  stepOf,
  unbase32,
  verifyTotp,
} from './totp.ts';

// The SHA-1 key of RFC 6238 appendix B and RFC 4226 appendix D.
const KEY = Buffer.from('12345678901234567890');
const SECRET = base32(KEY);

describe('TOTP of RFC 6238 (#401)', () => {
  it('gives the codes of RFC 4226 appendix D', () => {
    expect(
      Array.from({ length: 10 }, (_, counter) => hotp(KEY, counter)),
    ).toEqual([
      '755224',
      '287082',
      '359152',
      '969429',
      '338314',
      '254676',
      '287922',
      '162583',
      '399871',
      '520489',
    ]);
  });

  it('gives the eight-digit SHA-1 codes of RFC 6238 appendix B', () => {
    const vectors: [number, string][] = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ];
    for (const [seconds, code] of vectors)
      expect(hotp(KEY, stepOf(seconds * 1000), 8)).toBe(code);
  });

  it('takes a code one step early or late, not two', () => {
    const now = 1111111111_000;
    const at = stepOf(now);
    for (const step of [at - 1, at, at + 1])
      expect(verifyTotp(SECRET, hotp(KEY, step), now, null)).toBe(step);
    for (const step of [at - 2, at + 2])
      expect(verifyTotp(SECRET, hotp(KEY, step), now, null)).toBeNull();
  });

  it('refuses a step that signed in once, and every step before it', () => {
    const now = 1111111111_000;
    const at = stepOf(now);
    const code = hotp(KEY, at);
    expect(verifyTotp(SECRET, code, now, at)).toBeNull();
    expect(verifyTotp(SECRET, hotp(KEY, at - 1), now, at - 1)).toBeNull();
    expect(verifyTotp(SECRET, code, now, at - 1)).toBe(at);
    expect(verifyTotp(SECRET, hotp(KEY, at + 1), now, at)).toBe(at + 1);
  });

  it('refuses what is not six digits, and a broken secret', () => {
    const now = 59_000;
    const code = hotp(KEY, stepOf(now));
    expect(verifyTotp(SECRET, ` ${code} `, now, null)).toBe(stepOf(now));
    for (const bad of [undefined, null, '', '12345', '1234567', 'abcdef', 42])
      expect(verifyTotp(SECRET, bad, now, null)).toBeNull();
    expect(verifyTotp('not base32!', code, now, null)).toBeNull();
  });

  it('writes and reads base32 of RFC 4648', () => {
    expect(base32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32(Buffer.from('f'))).toBe('MY');
    expect(SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(unbase32('MZXW6YTBOI')).toEqual(Buffer.from('foobar'));
    expect(unbase32(SECRET)).toEqual(KEY);
    expect(unbase32('mzxw')).toBeNull();
  });

  it('makes a new secret of 160 bits each time', () => {
    const a = newSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(unbase32(a)).toHaveLength(20);
    expect(newSecret()).not.toBe(a);
  });

  it('names the game and the account in the address of the QR code', () => {
    expect(otpauthUri(SECRET, 'Anna Ä')).toBe(
      'otpauth://totp/Nova%20Imperium%3AAnna%20%C3%84?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Nova%20Imperium&algorithm=SHA1&digits=6&period=30',
    );
  });
});
