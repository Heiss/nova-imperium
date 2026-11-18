---
type: log-entry
date: 2026-11-18T23:50
kind: Code
issues: [93, 222, 224, 95, 78, 285, 94, 283]
---

#93 built on the bundle of the Classic features (#222): the research Kreuzzugs-Kartografie (classic Expeditionstechnik), the mission „Expedition“ to the position after the last planet position of each system, slots (⌊√level⌋, also a normal fleet slot), a stay of 1 to level hours, the finds of resources and ships by the owiki rules scaled with the points of rank 1, battles with pirates and aliens whose debris lies at the expedition position, the loss of the fleet and the earlier or later return, with reports and an audit entry; the Sternenkarte shows the position, the fleet form takes the hours. Migration `20261118T2319-expeditions` rebuilds `fleets` for the mission. The owner's table of chances per event does not exist in the cited article, so `EVENT_SHARES` stays `null` and every expedition finds nothing until it is decided; the per-round setting has no form yet (O20, O21). Vacation mode, abandon (#224), the Mondbruch (#95) and the highscore (#78) are tested; texts are [V]. See [Expeditions](/features/expeditions.md), [Lexicanum texts](/features/lexicanum-texts.md) (#285), [Grimdark naming](/features/naming.md) (#94), [Admin](/features/admin.md) (#283).
