// The setup of the authenticator app under way and its QR code (#401).
import { describe, expect, it } from 'vitest';
import { endTotpSetup, qrModules, totpSetup } from './totp-setup.svelte.ts';

describe('the QR code of the setup (#401)', () => {
  it('is a square of modules with the three finder patterns', () => {
    const m = qrModules(
      'otpauth://totp/Nova%20Imperium%3AAnna?secret=GEZDGNBV&issuer=Nova%20Imperium',
    );
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect((n - 17) % 4).toBe(0);
    for (const row of m) expect(row).toHaveLength(n);
    // A finder pattern: a dark 7×7 ring with a dark 3×3 core, in three corners.
    const finder = (r0: number, c0: number) =>
      [0, 6].every((i) =>
        [0, 1, 2, 3, 4, 5, 6].every(
          (j) => m[r0 + i]![c0 + j] && m[r0 + j]![c0 + i],
        ),
      ) &&
      !m[r0 + 1]![c0 + 1] &&
      m[r0 + 3]![c0 + 3];
    expect(finder(0, 0)).toBe(true);
    expect(finder(0, n - 7)).toBe(true);
    expect(finder(n - 7, 0)).toBe(true);
    expect(finder(n - 7, n - 7)).toBe(false);
  });

  it('differs for another address and forgets the setup', () => {
    expect(qrModules('otpauth://a')).not.toEqual(qrModules('otpauth://b'));
    totpSetup.uri = 'otpauth://a';
    totpSetup.secret = 'A';
    endTotpSetup();
    expect({ ...totpSetup }).toEqual({ uri: null, secret: null });
  });
});
