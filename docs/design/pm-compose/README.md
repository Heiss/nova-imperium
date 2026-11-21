# Writing private messages – design study (#349)

Design draft for issue #349: the form for „Neue Nachricht“ and „Antworten“
of the private messages (#226). This branch is never merged
(`okf/ops/branching-release.md`). The owner picks a variant; then it is built
in the release after 26.11.25.

The owner (2026-11-21) [E] named two complaints: the text field has only one
line, and the whole form sits in one row. Every variant fixes both: the text
is a multi-line `<textarea>`, and the labels, fields and button are stacked
instead of sitting in one row. The guild chat is out of scope [E].

## Files

- `mockup.html` is the whole study in one self-contained, static file, with
  no build step and no server.
  - The style sheet (`src/client/static/style.css`), the five fonts (SIL OFL
    1.1, see `src/client/static/fonts/`) and the four resource icons are
    inlined.
  - The frame (header, menu, tab bar, „Nachrichten“ with its tabs, the list
    of conversations, the open conversation, the settings) is the DOM of the
    real page of release 26.11.24 (fa90e0a). It was captured from the running
    app and only the names were replaced. The proposed CSS of the variants
    sits in the second `<style>` block, under the `pmx-` prefix.
  - Open it without a hash for the index of the states. Each state has a hash
    of its own: `#today-new`, `#today-reply`, `#a-new`, `#a-reply`, `#b-new`,
    `#b-reply`, `#c-new`, `#c-reply`. Add `&kbd` to a hash (for example
    `#a-reply&kbd`) to show a phone with the on-screen keyboard open (see
    below).
  - The gold caption bar at the top of each state belongs to the mockup only.
    So do the index texts.
- `screenshots/*.webp` were taken with Playwright at device scale factor 2.
  - Desktop shots are 1280 px wide (the full page; for C, the 1280×900
    viewport with the dialog).
  - Phone shots are 412×915 px (the size of a Pixel 7), scrolled to the form.
  - `*-phone-keyboard.webp` shows the 412×575 px that stay visible above a
    keyboard.

| State              | Desktop               | Phone               | Phone, keyboard open         |
| ------------------ | --------------------- | ------------------- | ---------------------------- |
| Today, new message | `today-new-desktop`   | `today-new-phone`   | –                            |
| Today, reply       | `today-reply-desktop` | `today-reply-phone` | `today-reply-phone-keyboard` |
| A, new message     | `a-new-desktop`       | `a-new-phone`       | –                            |
| A, reply           | `a-reply-desktop`     | `a-reply-phone`     | `a-reply-phone-keyboard`     |
| B, new message     | `b-new-desktop`       | `b-new-phone`       | –                            |
| B, reply           | `b-reply-desktop`     | `b-reply-phone`     | `b-reply-phone-keyboard`     |
| C, new message     | `c-new-desktop`       | `c-new-phone`       | `c-new-phone-keyboard`       |
| C, reply           | `c-reply-desktop`     | `c-reply-phone`     | `c-reply-phone-keyboard`     |

The sample content is neutral: two players, „Kepler“ and „Mira“, agree on
mining times. Every variant uses the same draft text, so the screenshots
compare directly.

## Today

`PmCompose.svelte` is one `form.flex` holding „Empfänger“, an
`<input list>`, „Nachricht“ as a one-line `<input class="wide">` (at most
1000 characters, `MAX_PM_TEXT`) and „Senden“ or „Antworten“.

- On a desktop everything sits in one row.
- On a phone the row wraps at random places: in the capture, „Nachricht“
  ends up beside the recipient field and its field on the next line.
- A text of several sentences cannot be read back while it is being written.

## Variant A – stacked, in place

**What changes.** The form stays where it is today: „Neue Nachricht“ opens
it above the list, and „Antworten“ sits below the messages of the open
conversation. The difference is the inside of the form:

- each label stands above its field;
- the recipient field keeps its width of a name;
- „Nachricht“ is a `<textarea>` (6 lines for a new message, 4 for a reply)
  that the player can make taller;
- a footer row holds the remaining characters on the left, „Noch 858
  Zeichen“ [V], and the button on the right.

**Trade-offs.**

- It is the smallest change and the most familiar one, close to the other
  forms of the game.
- In a long conversation the reply form is below the log, as today. On a
  phone the player scrolls past the messages to reach it.

**Cost.**

- `PmCompose.svelte`: the markup, `<input>` becomes `<textarea>`, and a
  `$derived` count of the remaining characters.
- About 30 lines of CSS in `style.css`.
- Nothing in `PmInbox.svelte` or `PmThread.svelte`.
- E2E: the selectors `#pm-text` and `#pm-reply-text` stay the same, and
  `fill()` works on a textarea.

**Accessibility.**

- The labels are visible and bound with `for`.
- The count is linked to the field with `aria-describedby`. The mockup uses
  no live region, because announcing the count on every key is too noisy
  (see the open questions).
- The tab order is recipient, text, button.
- On a phone the existing 44 px rule for touch targets covers the textarea.

## Variant B – writing bar docked to the conversation

**What changes.**

- **Reply:** the form becomes a writing bar at the bottom of the box of the
  open conversation, below „Unterhaltung löschen“ and „Blockieren“.
  - It is `position: sticky`: while the conversation is on screen, the bar
    stays at the bottom edge. On a phone it sits just above the fixed tab bar.
  - Its label names the recipient: „Nachricht an Kepler“ [V].
  - The textarea starts with 3 lines and grows with the text up to a maximum
    height, then scrolls.
  - The button sits below it, on the right.
  - It shows no character count.
- **New message:** „Neue Nachricht“ does not open a form above the list. It
  opens an empty conversation in the place of the open one: „Empfänger“ with
  its field as the head of the box, and the same writing bar with „Senden“
  below it.
- New message and reply look alike.

**Trade-offs.**

- It feels like a chat, and the reply is always reachable without scrolling
  past a long log.
- The bar takes space at the bottom of a small screen.
- With the keyboard open, the bar, the keyboard and the header together
  leave little of the log visible.
- „Neue Nachricht“ closes the open conversation; whether that is acceptable
  is an open question.
- Without a count, the player learns about the limit only from the field
  stopping at 1000 characters.

**Cost.**

- `PmCompose.svelte` (textarea, auto-grow), `PmThread.svelte` (the bar last
  in the box), `PmInbox.svelte` (the new message as a panel in the place of
  the conversation), CSS.
- On phones the keyboard must not cover the sticky bar. That needs
  `interactive-widget=resizes-content` in the viewport meta of `index.html`
  (which affects every page), or handling through `visualViewport`.
- The auto-grow sets only `style.height`, never `value`, so the guard
  `src/test/field-writes.test.ts` is not affected.
- E2E: new selectors for the panel of a new message.

**Accessibility.**

- The visible label includes the recipient.
- The sticky bar must not cover the element that has the focus while the
  player tabs through the messages. That needs a `scroll-padding-bottom` of
  the height of the bar.
- Auto-grow must not move the focus.

## Variant C – a dialog

**What changes.**

- „Neue Nachricht“, and an „Antworten“ button below the conversation, open a
  dialog in the frame of the app's dialogs (`#modal`), wider than today's
  (560 px). On a phone the dialog fills the whole screen.
- **New message:**
  - „Empfänger“ (the field as today), with buttons below it for the players
    the inbox already has a conversation with: „Zuletzt geschrieben:“ [V]
    „Kepler“. A click fills the field.
  - „Nachricht“ as a textarea of 8 lines, with the count „142 / 1000“ below
    it on the right.
  - „Abbrechen“ (already used by the game's dialogs) and „Senden“.
- **Reply:** the title is „Antworten“. Instead of the recipient field the
  dialog shows „An Kepler“ [V], and above the text the last message received
  as context: „Letzte Nachricht von Kepler“ [V].

**Trade-offs.**

- It gives the most room for writing, especially on a phone: a full screen,
  no tab bar, no log.
- Writing is one step further away (one more click), and the conversation
  is hidden while writing. The quoted last message only partly makes up for
  that.
- „Abbrechen“ with text typed needs a rule (open question).
- It is the only variant that offers a quick choice of the recipient. It
  uses data the inbox already has; no new server rule.

**Cost.**

- A new `PmDialog.svelte`, best as a native `<dialog>` with `showModal()`,
  which brings the focus trap, Escape and the backdrop.
  - The app's `#modal` is filled by `data-act` handlers. A Svelte component
    of its own avoids mixing the two models.
  - The draft must survive the poll of the state; the component owns it.
- `PmInbox.svelte` and `PmThread.svelte` get the opening buttons.
- CSS for the full-screen sheet on a phone.
- E2E: the flow changes (open the dialog first).

**Accessibility.**

- `role="dialog"` with `aria-modal` and `aria-labelledby` pointing at the
  title.
- When the dialog opens, the focus goes to the first empty field (the
  recipient, or the text for a reply). Escape and „Abbrechen“ close it and
  return the focus to the button that opened it.
- The quick-pick buttons point at „Zuletzt geschrieben:“ through
  `aria-describedby` and show their state with `aria-pressed`.

## Phone and on-screen keyboard

The page has no `interactive-widget` in its viewport meta, so Chrome on
Android uses its default: the keyboard shrinks only the visual viewport.
The fixed tab bar stays at the bottom of the layout and ends up behind the
keyboard, and the browser scrolls the focused field into view.

- **A and today** work with that default.
- **B needs a decision:** its sticky bar is otherwise hidden behind the
  keyboard (see Cost).
- **C** fills the screen anyway.

The `&kbd` states show the proposal for all three variants: the part of a
Pixel 7 that stays visible above the keyboard (412×575 px), with the tab bar
hidden while a text field has the focus. This is a simulation, not a device
test.

## New German texts (proposals)

Every one of them is a proposal [V] until the owner approves it.

| Text                              | Where                                              |
| --------------------------------- | -------------------------------------------------- |
| „Noch {n} Zeichen“ [V]            | A: the remaining characters below the text         |
| „Nachricht an {Name}“ [V]         | B: the label of the writing bar of a reply         |
| „Zuletzt geschrieben:“ [V]        | C: before the quick-pick buttons of the recipients |
| „An {Name}“ [V]                   | C: the recipient in the dialog „Antworten“         |
| „Letzte Nachricht von {Name}“ [V] | C: the heading of the quoted last message          |

Reused unchanged:

- from `PM_LABELS`: „Neue Nachricht“, „Empfänger“, „Nachricht“, „Senden“,
  „Antworten“, „Unterhaltung löschen“, „Blockieren“;
- from the game's dialogs: „Abbrechen“.

„{n} / 1000“ (C) has no words; 1000 is `MAX_PM_TEXT`.

## Open questions for the owner

1. Does Enter send the message or start a new line? (And if Enter makes a
   new line, should Ctrl+Enter or Cmd+Enter send?)
2. The count of the remaining characters:
   - always (A),
   - never (B),
   - as „n / 1000“ (C),
   - or only near the limit, and if so, from how many characters on?
3. How tall is the text field at the start? Should it grow with the text,
   and up to what height?
4. Phone: should the tab bar hide while the player types? And may the
   viewport meta of the whole app change (`interactive-widget`)?
5. B: may „Neue Nachricht“ close the open conversation?
6. C: what happens on „Abbrechen“ or Escape when text is already typed?
   - discard it without asking,
   - ask first,
   - or keep it as a draft for the next opening?
7. C: which players does the quick choice offer (the conversations of the
   inbox, the friends, both), and how many?
8. Should the recipient field keep its list of every other player (today's
   `datalist`)?
9. Should a typed text survive a switch to another conversation or another
   tab of „Nachrichten“?
10. The lock screen of the vacation mode allows replies only. Should the
    reply there take the same form as in the chosen variant?

## Not checked

- Real phones: iOS Safari and Android Chrome with a real on-screen keyboard.
  The keyboard states are a simulation.
- Screen readers.
- axe (WCAG 2.1 A and AA) passed on all eight states, desktop and phone,
  with the mockup caption excluded. That covers the static markup only, not
  the focus handling of the dialog in C.
