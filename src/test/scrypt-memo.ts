// For route and action tests that only need the password check to answer, not
// to cost: `scryptSync` is a pure function, so a result is kept per input and
// handed out again. The result is the same bytes as the real call, the cost
// of the production profile stays as it is (auth.ts); only a repeated
// password and salt is not computed twice. Use it in the factory of
// `vi.mock('node:crypto', …)`; a test about the scrypt work itself does not.
import type * as Crypto from 'node:crypto';

export function memoScrypt(real: typeof Crypto): typeof Crypto {
  const kept = new Map<string, Buffer>();
  const scryptSync = ((
    password: string,
    salt: string,
    length: number,
    options?: object,
  ) => {
    if (typeof password !== 'string' || typeof salt !== 'string')
      return real.scryptSync(password, salt, length, options);
    const key = JSON.stringify([password, salt, length, options ?? null]);
    let hash = kept.get(key);
    if (!hash) {
      hash = real.scryptSync(password, salt, length, options);
      kept.set(key, hash);
    }
    return Buffer.from(hash);
  }) as typeof Crypto.scryptSync;
  return { ...real, scryptSync };
}
