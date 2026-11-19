// Moves the fleets of the player forward: `landColonyFleet` (the outbound
// colonization fleets arrive now), `landFleet` (a mission: its outbound fleets
// arrive now), `returnFleet` (the returning fleets come home now), `endHold`
// (the fleets that hold end their holding time now, issue #55).
import type { SeedPart } from './lib/types.ts';

export const part: SeedPart = {
  order: 10,
  fields: ['landColonyFleet', 'landFleet', 'returnFleet', 'endHold'],
  apply({ store, d, user }) {
    const land = (mission: string): void => {
      store.db
        .prepare(
          "UPDATE fleets SET arr = ? WHERE owner = ? AND mission = ? AND state = 'out'",
        )
        .run(Date.now(), user.id, mission);
    };
    if (d.landColonyFleet) land('colonize');
    if (d.landFleet) land(d.landFleet);
    if (d.returnFleet)
      store.db
        .prepare("UPDATE fleets SET ret = ? WHERE owner = ? AND state = 'back'")
        .run(Date.now(), user.id);
    if (d.endHold)
      store.db
        .prepare(
          "UPDATE fleets SET hold = MAX(0, ? - arr) WHERE owner = ? AND state = 'hold'",
        )
        .run(Date.now(), user.id);
  },
};
