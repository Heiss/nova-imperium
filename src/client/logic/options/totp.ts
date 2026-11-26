// „Optionen“ → „Konto“, the data of the box „Authenticator-App“ (#401, owner,
// 2026-11-25, text 4 and 137a): whether an app is set up.
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface TotpPart {
  /** An app is set up: „Eingerichtet.“ and „Entfernen“. */
  totp: boolean;
}

export const totpPart = ({ s }: OptionsState): TotpPart => ({
  totp: s.me.totp === true,
});
