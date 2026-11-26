// The data of the box „Authenticator-App“ (#401): whether an app is set up.
import { describe, expect, it } from 'vitest';
import type { OptionsState } from './state.ts';
import { totpPart } from './totp.ts';

const at = (totp: unknown) =>
  ({ s: { me: { totp } } }) as unknown as OptionsState;

describe('the part of the box „Authenticator-App“ (#401)', () => {
  it('says set up only for a state that says so', () => {
    expect(totpPart(at(true))).toEqual({ totp: true });
    expect(totpPart(at(false))).toEqual({ totp: false });
    // A state of a server before #401 has no such key.
    expect(totpPart(at(undefined))).toEqual({ totp: false });
    expect(totpPart(at('yes'))).toEqual({ totp: false });
  });
});
