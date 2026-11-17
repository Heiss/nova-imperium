// The numbers of the dialog „Neue Runde“: the lock of the main planet
// (#221) and the thresholds of the recognition of foreign fleets (#228,
// X1), named as in the universe settings, where the admin changes them
// during the round. The server checks them (`recognitionErrors`).
import {
  RECOGNITION_KEYS,
  type Recognition,
} from '../../core/fleet-recognition.ts';
import { UNIVERSE_SPECS, type UniverseSpec } from '../../core/universe.ts';

type RecognitionPart = keyof Recognition;

/** One threshold in the dialog: its input and the setting it stands for. */
interface RecognitionInput {
  part: RecognitionPart;
  id: string;
  spec: UniverseSpec;
}

export const RECOGNITION_INPUTS: readonly RecognitionInput[] = (
  Object.keys(RECOGNITION_KEYS) as RecognitionPart[]
).map((part) => ({
  part,
  id: `round-recognition-${part}`,
  spec: UNIVERSE_SPECS.find((s) => s.key === RECOGNITION_KEYS[part])!,
}));

/** A field as a number; an empty one as none, so the server refuses it. */
const num = (raw: string): number | null =>
  raw.trim() === '' ? null : Number(raw);

/** The numbers the dialog sends with „Ja, neue Runde“; `val` reads an input. */
export const roundNumbers = (val: (sel: string) => string) => ({
  mainLock: num(val('#round-main-lock')),
  recognition: Object.fromEntries(
    RECOGNITION_INPUTS.map((i) => [i.part, num(val(`#${i.id}`))]),
  ) as Record<RecognitionPart, number | null>,
});
