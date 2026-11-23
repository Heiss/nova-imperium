# Imperialer Herold and Börse – design study

Design study for two ideas of the owner (2026-11-23): the Imperialer Herold (#382) and the Börse (#386), not decided. Everything
not marked **[E]** is a proposal **[V]**: names, texts, stages, days, fees and numbers are
examples, not game values. Interface v2 (`src/client/static/style.css`) plus `study.css`.

Files:

- `herald-ticker.html` / `.png` – the Imperialer Herold as its own full-screen page
  (1600 × 900, second screen), reachable by a public link per round: price crawl, the battle of
  the day with its replay, breaking news, a correction („Dementi“), exchange prices, research
  firsts, empire movements
- `herald-precision.html` / `.png` – the same battle at three stages of the round, the stages of
  the Chronisten, the research „Schweigegelübde“ against them, fake news and the correction
- `battle-storyboard.html` / `.png` – storyboard of a battle replay with eight shots (camera,
  sound, data per shot), the animation `camera.gif`, and how destroyed defense is shown
- `battle-replay-data.html` / `.png` – how a battle is recorded so Godot can replay it and the
  picture always matches the battle report: data flow, a sample log, the rules that keep it
  consistent, Godot in the browser, sound, limits
- `boerse.html` / `.png` – the exchange: order book, price chart, order form with escrow,
  contracts delivered by cargo fleet on both sides, the contract flow and the open points
- `admin.html` / `.png` – the dialog „Neue Runde“: the four trade modes, the exchange settings,
  the settings of the Herold with the public link
- `shot-1.jpg` … `shot-8.jpg`, `camera.gif` – the stills and the animation of the storyboard

The stills and the animation are placeholders from a simple Three.js scene
(`render/scene.html`, `render/anim.html`), not from Godot. To render them again, install
`three@0.170.0` in `render/` and open `scene.html?shot=1` … `8` or `anim.html` (call
`renderAll()`; the frames are in `window.frames`) through a local server.

The HTML files reference `/style.css`, `/fonts/` and `/icons/` absolutely: serve them from a
root that holds `src/client/static/` with this folder beside it, or look at the PNGs.
