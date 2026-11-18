---
type: log-entry
date: 2026-11-18T17:30
kind: Fix
issues: [301, 169, 163, 302]
---

#301: the client marks the guild chat as seen by itself, 600 ms after the view shows it (#169). When the member lost the right to read the chat in that moment, for example the Leitung that hands over and takes a rank without it (#163), the server refused this action and the client showed „Dazu fehlt deinem Rang das Recht.“ over the message of the player's own action. Seen as an E2E test that failed about once in 20 runs. Such an action of the client itself is now sent with `quiet` of `src/client/logic/act.ts`: its refusal is no message for the player; the server still refuses it. The E2E servers take their ports from `E2E_PORT` when it is set (the game on it, the mail server one below, the mail sink two below), so two runs on one machine no longer wait for each other; #302 goes on with the data of the tests.
