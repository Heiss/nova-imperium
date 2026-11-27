---
type: feature
title: Marketplace
description: Exchange resources at ratios the admin sets per pair, with moving prices, the building Handelsposten that lowers the fee, a cap by the free storage and a limit per player per day (issue #171).
---

# Marketplace

Issue #171 („Geklärt“, owner, 2026-11-17, label `ready`). The rules are in
`src/core/market.ts` (pure integer functions), the texts both sides share in
`src/core/market-text.ts`, the action in `src/server/game/market.ts`, the
view in `src/client/views/market.ts`. Out of scope (the issue): trading
between players, and the races of #154.

# Decisions

* **[E]** A player can always exchange one resource for another at ratios
  the admin sets; the admin can switch the market off for a round; it is on
  by default in a new round (owner, 2026-11-13, D6 2026-11-17). Free: no
  premium, only the ratio and the fee.
* **[E]** D1: moving prices. The ratios of the admin are the base prices.
  Each exchange shifts the price of its pair by a share of the amount
  traded, and the price drifts back to the base over a set time. Step and
  drift time are per-round admin values.
* **[E]** D2: a ratio per pair, six numbers; the panel warns when a round
  trip would gain resources.
* **[E]** D3: the building „Handelsposten“; level 1 is needed, higher levels
  lower the fee. Art as for other new buildings.
* **[E]** D4: the result is capped by the free storage of the target; the
  preview shows the cap.
* **[E]** D5: a limit per player per day, a per-round admin value; 0 means no limit; an exchange above what is left of the day is cut to it, not refused, and the message says so (owner, 2026-11-19).
* **[E]** X1: the per-round values are set in „Neue Runde“ and stay editable
  during the round (all twelve are `live` rows of the universe settings).
* **[E]** Owner, 2026-11-19, on the build 2a910db: the ratio is the amount received per 1,000 given; the defaults follow 1 : 2 : 4 (500, 250, 2000, 500, 4000, 2000), every round trip returns exactly what it started with; the Handelsposten costs 5,000 / 10,000 / 5,000, factor 2, needs the Servitorenschmiede at level 4 and stands on planets only; the fee is set by the admin per round (level 1: 10 % by default, falling by 1 percentage point per level by default, never below 0); the price step (5 per mille per 1,000 units) and the recovery (24 hours, straight line) are set per round; one price per pair for all players, the reverse pair keeps its price. Still [V]: the default 100,000 of the daily limit, counting the amount given per UTC day, the ranges, the legend, the texts.
* **[E]** Adamant, Psikristall and Promethium can be traded; energy cannot.
* **[E]** Changes of the market settings are in the audit log: the action
  `settings` records the whole universe before and after, `reset` the rules
  of the round before and after; an exchange is a game action with its
  amounts (`planet`, `give`, `get`, `given`, `got`, `fee`, `capped`,
  `price`).

# Built [V]

Everything below the decisions is a proposal for the owner to confirm in the
pull request.

* **[V]** Where: on the shown planet, with its stock and storage; the
  Handelsposten of that planet counts (a moon cannot hold one).
* **[V]** A ratio is a whole number from 1 to 100,000 (the unit [E], 2026-11-19);
  the pair is ordered (`mc` is Adamant for Psikristall). The defaults [E]
  (1 : 2 : 4): `mc` 500, `md` 250, `cm` 2000, `cd` 500, `dm` 4000, `dc` 2000.
  Every two-way and three-way trip multiplies to exactly 1,000 to the power
  of its length, so none gains (`gainingTrips` finds none; a test checks it).
* **[V]** Result = ⌊amount · ratio · price · (1000 − fee) / 10¹²⌋ with the
  ratio per 1,000, the price in millionths of the base and the fee in
  thousandths (the fee in whole percent times 10). Integers only (BigInt),
  every division rounds down.
* **[V]** Price: only the pair that was exchanged falls, by
  price′ = ⌊price · 10⁶ / (10⁶ + step · given)⌋, never below 0 and never above
  the base; the reverse pair keeps its price, so movement never creates a
  gain. Step: whole „Promille je 1.000 getauschte Einheiten“, 1 to 1,000,
  default 5 (20,000 given lower the price by about 10 %). The price drifts
  back in a straight line over „Preiserholung (Stunden)“, 0 to 720, default
  24, rounded so it is never above the line; one drift time after the last
  exchange it is at the base. The stored price is relative to the base, so a
  change of a ratio during the round applies at once, and a change of the
  drift time applies to the stored prices.
* **[E]** The price the player saw (#406, owner, 2026-11-25, O31): the
  action `trade` carries `price`, the price of the pair the form showed, in
  millionths of the base; the server refuses any worse price, with no
  tolerance, and nothing changes. **[V]** The price compared is the one
  before the own exchange moves it; a lower price is worse (a test of the
  formula checks it first: a lower price never gives more); the drift back
  towards the base only ever helps, so only an exchange of someone else on
  the same pair in between refuses. A price that is no whole number counts
  as worse. The other refusals (closed, no Handelsposten, amount, stock,
  storage, limit) come first. The refusal says „Der Kurs hat sich geändert:
  jetzt <Kurs>. Bitte erneut bestätigen.“ with the rate of the preview
  („<n> <Rohstoff> je 1.000 <Rohstoff>“), and after any refused exchange the
  form loads the state of the shown place again, so the preview shows the
  price of now and the amount stays.
* **[E]** (owner, 2026-11-21, #346) 0 hours mean no recovery: the price of a
  pair stays where the last exchange left it until the round ends, and
  nothing else raises it (the reverse pair keeps its own price). The owner
  knows the consequence: with step 5 a pair is at about 0.7 % of the base
  after 1,000,000 units given, so the market is a finite stock in such a
  round. A change from 0 to some hours applies to the stored prices like
  every change of the drift time (a price whose last exchange is older than
  the new time is at the base at once). The label of the setting is
  „Marktplatz Preiserholung (Stunden, 0 = keine Erholung)“; the page of the
  Lexicanum says at 0, in place of „Danach erholt sich der Preis gleichmäßig
  bis zum Basispreis, in dieser Runde in …“, „In dieser Runde erholt sich der
  Preis nicht.“ (`src/core/lexicon/pages/market.ts`; the text for every
  other value is unchanged). `priceNow` returns the stored price with 0
  hours: the straight line would put every price at the base at once.
* **[V]** The price is shared by all players (the classic market); the
  amount of the day is the player's.
* **[E]** Fee of the Handelsposten (owner, 2026-11-19): the admin sets the fee
  at level 1 and the points every further level takes off, per round;
  defaults 10 % and 1 point, never below 0. **[V]** Whole percent and whole
  percentage points (the arithmetic in thousandths would allow tenths, but
  nobody asked), each 0 to 100; the fee at level L is
  max(0, fee − step · (L − 1)). Cost 5,000 / 10,000 / 5,000, factor 2, needs
  the Servitorenschmiede at level 4, planets only [E]; order 170 (last
  building) and the abbreviation „HP“ are [V].
* **[V]** The cap (D4): when the result would exceed the free storage, the
  result is the free storage and only the least amount that gives it is
  taken; the surplus stays with the player. A free storage of 0 refuses.
* **[E]** The limit (D5, owner, 2026-11-19): per round, 0 means no limit. An
  exchange above what is left of the day is cut to it, not refused; the
  done message says so; the preview shows the cut before the exchange. Only
  when nothing is left is it refused. **[V]** The amount given, all
  resources added, per UTC day (like the daily reward), 0 to 10,000,000,
  default 100,000.
* **[V]** Cut by the limit and capped by the storage together: the smaller
  amount wins and only that cause is named. The storage cap is computed
  first (the least amount that fills the free storage); when the rest of the
  day is smaller than that, the exchange is cut to the rest and the limit is
  named („cut“); when the rest is as large or larger, the storage is named
  („capped“). The two are never named together, because the player needs to
  know what stopped the exchange, and that is only the smaller one.
* **[V]** The switch is the number 1 (Ja) or 0 (Nein), because a switch of
  the registry cannot be `live`.
* **[V]** The warning: round trips through two or three resources whose
  ratios multiply to more than 1,000 to the power of their length, at fee 0
  (the lowest fee) and at the base price; shown in the universe settings
  below the table. A set that is warned about can gain; the admin may save it.
* **[V]** The view „Marktplatz“ after „Rohstoffe“ in the menu, under „Mehr“ on
  a phone.
* **[E]** While the market is off it is hidden, not shown as closed (#404;
  owner, 2026-11-25, 112a to 114a): no „Marktplatz“ in the menu or under
  „Mehr“, its address `?view=market` opens the overview, an open view falls
  back to the overview at the next state, and its Lexicanum page
  („Marktplatz“, `rule-market`) is not listed, found or linked and its
  address opens the start page of the Lexicanum; the same for the admin,
  whose switch „Marktplatz aktiv“ stays in „Universum“. **[V]** The rule is
  `offered: marketOpen` of the view and of the page
  ([16. Svelte views](/architecture/patterns/16-views.md)). The server keeps
  its own switch: a trade while the market is off is refused with „Der
  Marktplatz ist in dieser Runde geschlossen.“ (`CLOSED`, the code
  `closed` of `trade`), and the state still carries the prices. The closed
  notice of `marketPage` stays for a state without prices; in the game the
  view is not mounted while the market is off.
* **[E]** The Handelsposten while the market is off (#442; owner,
  2026-11-27, 226b, 227b): a special rule of this building, no general
  mechanism. It is not listed under „Gebäude“, and its next level cannot be
  ordered; the server refuses the order with „Der Marktplatz ist in dieser
  Runde geschlossen.“ ([V], `CLOSED`, the code `off` of `buildErrors`).
  Built levels stay and can be demolished, with the refund of the
  demolition. With the market on again, the building and its levels are
  back. **[V]** The built levels keep counting for the points. **[V]** Its
  Lexicanum article follows the page „Marktplatz“: not listed, found or
  linked while the market is off (`opens` of `logic/lexicanum.ts`).
  **[V]** A level already in the build queue when the market is switched
  off finishes as ordered, like a running level of the Kolonialverwaltung
  (its rule is asked only at the start of a level); „Abbrechen“ with the
  refund stays possible.
  * The one place of the rule is `tradingPostOffered` in `src/core/market.ts`
    (and `tradingPostOfferedIn` for the universe, whose live rows carry
    `roundMarketOn`). With the Börse (#386, 245a) it becomes „the
    marketplace or the Börse is open“.
* **[V]** Existing universes start with the market on and the defaults;
  nobody has a Handelsposten there yet.

# Settings of the round

All in one fieldset „Marktplatz“ of the dialog „Neue Runde“ and all `live`,
registered in `src/core/market.ts` (`order` 320 to 430, key `roundMarket…`).

| Key | Label | Range | Default | Order |
|---|---|---|---|---|
| `roundMarketOn` | Marktplatz aktiv | 0 / 1 (Nein / Ja) | 1 | 320 |
| `roundMarketMc` | Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant) | 1 to 100,000 | 500 | 330 |
| `roundMarketMd` | … Adamant → Promethium (Promethium je 1.000 Adamant) | 1 to 100,000 | 250 | 340 |
| `roundMarketCm` | … Psikristall → Adamant (Adamant je 1.000 Psikristall) | 1 to 100,000 | 2000 | 350 |
| `roundMarketCd` | … Psikristall → Promethium (Promethium je 1.000 Psikristall) | 1 to 100,000 | 500 | 360 |
| `roundMarketDm` | … Promethium → Adamant (Adamant je 1.000 Promethium) | 1 to 100,000 | 4000 | 370 |
| `roundMarketDc` | … Promethium → Psikristall (Psikristall je 1.000 Promethium) | 1 to 100,000 | 2000 | 380 |
| `roundMarketStep` | Marktplatz Preisschritt (Promille je 1.000 getauschte Einheiten) | 1 to 1,000 | 5 | 390 |
| `roundMarketDrift` | Marktplatz Preiserholung (Stunden, 0 = keine Erholung) | 0 to 720 (0: no recovery, #346) | 24 | 400 |
| `roundMarketLimit` | Marktplatz Tageslimit je Spieler (Einheiten, 0 = unbegrenzt) | 0 to 10,000,000 | 100,000 | 410 |
| `roundMarketFee` | Marktplatz Gebühr auf Stufe 1 des Handelspostens (Prozent) | 0 to 100 | 10 | 420 |
| `roundMarketFeeStep` | Marktplatz Gebühr sinkt je weitere Stufe um (Prozentpunkte) | 0 to 100 | 1 | 430 |

The two fee settings stand after the limit (420 and 430), so no number of the
other ten changes. The ranges are [V]; the defaults of the ratios, the
step, the drift time, the fee and its step are [E] (2026-11-19), the default
100,000 of the limit is [V].

# Texts

* **[V]** From the issue body, which stays [V] (owner, 2026-11-17): „Der Marktplatz ist in dieser
  Runde geschlossen.“, the menu „Marktplatz“, „Du gibst“, „Du erhältst“,
  „Gebühr“, „Tauschen“, „Marktplatz aktiv“, the section „Marktplatz“ of the
  admin settings.
* **[V]** Refusals (`src/core/market-text.ts`, server and browser alike):
  „Auf diesem Planeten fehlt ein Handelsposten.“, „Diese Rohstoffe lassen
  sich nicht tauschen.“, „Bitte eine ganze Menge von mindestens 1 angeben.“,
  „So viel hast du auf diesem Planeten nicht.“, „Das Lager für <Rohstoff> ist
  voll.“, „Tageslimit erreicht: Heute kannst du noch <n> tauschen.“ (only when
  nothing is left), „Für diese Menge bekommst du nichts.“. Done: „<n>
  <Rohstoff> gegen <m> <Rohstoff> getauscht.“ and, when capped, „ Das Lager
  für <Rohstoff> ist jetzt voll.“, when cut by the limit, „ Tageslimit
  erreicht: Es wurden nur <n> <Rohstoff> getauscht.“
* **[V]** View: „Menge“, „max“, „Kurs“, „Heute noch“, „kein Limit“, „Begrenzt
  durch das freie Lager: Du gibst nur <n> <Rohstoff> ab.“, „Begrenzt durch
  das Tageslimit: Du gibst nur <n> <Rohstoff> ab.“, „Baue ihn unter
  „Gebäude“.“; admin warning „Achtung: Ein Tausch im Kreis bringt selbst ohne
  Gebühr Gewinn: <Kreis>; …. Bitte die Kurse anpassen.“ The labels of the
  settings are in the table above.
* **[V]** The article of the Handelsposten in the Lexicanum
  ([Lexicanum texts](/features/lexicanum-texts.md)) and its short and long
  text (`src/features/market/texts.de.ts`). Its table „Gebühr auf den Stufen
  in dieser Runde“ reads the fee settings of the round; the text says that
  the admin sets the fee, the ratios and the limit, and what the cut does,
  without a typed number.

# Rounding and the property test

Every product is an integer, every division rounds down, a price is never
above its base and a fee never below 0. So an exchange never gives more than
the ratio says, and a chain of exchanges returns at most what it started
with for every ratio set the panel does not warn about. The property tests in
`src/core/market.test.ts` (fast-check) play random sequences (pair, share,
hours between, level, step, drift, storage) and check that the value of the
stock never rises for ratios derived from values, that the start resource
ends at most as it began for any ratios without a warning, that a round trip
at fee 0 never returns more when the ratios multiply to at most 1,000², and
that the result is the exact floor. **[U]** Ratios the panel warns about can
gain by design (D2 only warns); the property holds for the others.

# Seams for later work

* Vacation mode (#223): every own action is refused in vacation; `trade` is
  on no allow list, nothing to build now.
* Demolition (#202): a torn-down Handelsposten lowers its level; the market
  reads the level at every exchange, so nothing to change.
* Highscore categories (#78): the market adds no points; the amounts given
  are in the audit log.

# Open points

* The dialog „Neue Runde“ shows no warning about gaining ratios, only the
  universe settings do.
* The market is shared; whether the price should be per player is not
  decided (options in the pull request).
