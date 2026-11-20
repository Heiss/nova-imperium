---
type: log-entry
date: 2026-11-20T01:00
kind: Code
issues: [317, 326]
---

#317, part 1 of the second round of the clean-up (owner, 2026-11-20): `src/server/game/registry-pin.test.ts` is deleted. It was a one-time proof for #326 (the list of the actions with their groups and the key order of the state); nothing imported it. The guard `src/server/game/registry.test.ts` already checked that an action name, a state key and an order number exist once and that the state is built in the order of the parts; the two properties that only the pin held (a player without a planet gets the same keys, and the lock screen of the vacation mode keeps to declared keys in their order) moved into the guard without a list. A new action or key is no longer written anywhere else than in the feature's own module.
