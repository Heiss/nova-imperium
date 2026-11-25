// „Optionen“, the data of the box of the display of this device.
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface DisplayPart {
  animations: boolean;
}

/** Whether the planets of this device move. */
export const displayPart = ({ ui }: OptionsState): DisplayPart => ({
  animations: !!ui.animations,
});
