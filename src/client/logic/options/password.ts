// „Optionen“, the data of the box of the change of the password.
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface PasswordPart {
  /** The shortest password the server takes, once it has said so. */
  passwordMinLength: number | undefined;
}

/** The minimum length of a password, passed on. */
export const passwordPart = ({ ui }: OptionsState): PasswordPart => ({
  passwordMinLength: ui.passwordMinLength,
});
