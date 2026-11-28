// The shape of a live on/off switch of the round (okf/ops/feature-switches.md):
// a number of 1 („An“) and 0 („Aus“), because a switch of the registry
// (`kind: 'switch'`) cannot be live; a universe without the key reads the
// default, „An“ (owner, 2026-11-27, 261a). „Wache stellen“ (#440) and
// „Verbandsangriff“ (#466) are such switches. Its own module without
// imports, so the settings of a feature can take it without a cycle through
// the registry (round.ts imports every feature's settings).

/** The range, the default, the choices and `live` of a live on/off switch. */
export const LIVE_SWITCH = {
  min: 0,
  max: 1,
  def: 1,
  choices: [
    { value: 1, label: 'An' },
    { value: 0, label: 'Aus' },
  ],
  live: true,
} as const;
