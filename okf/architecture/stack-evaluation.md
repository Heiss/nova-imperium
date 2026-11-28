---
type: Architecture
title: Stack evaluation of 2026-11-28 - Rust, rust-anything, WebAssembly, Bun
description: Whether a rewrite of the backend in Rust, a frontend in WebAssembly or Bun instead of Node would help the game, checked against the decisions and measurements of the project.
tags: [architecture, rust, wasm, bun, node, evaluation]
status: draft
generated: { by: claude-code/web, at: 2026-11-28T10:36:00Z }
---

# Question

The owner asked on 2026-11-28 whether the backend should be rewritten in
Rust with the tool rust-anything, whether the frontend of v3 should use
WebAssembly for faster rendering and 3D, and whether Bun should replace
Node. The owner is content with the performance today; the reasons named
were the interest in Rust around AI tools, the chance of a fresh start with
v3, a large image and a long test suite.

**[V]** Result of the evaluation: none of the three; the owner turned to the
concrete improvements of the [audit](/architecture/performance-audit.md)
(2026-11-28). Not a decision of the owner; the decisions below stay as they
are.

# Constraints from the decisions

* **[E]** TypeScript, SQLite with better-sqlite3 ([Overview](/overview.md)).
* **[E]** v3 is not a fresh start: its foundation goes to `main` as
  refactors without a change of behaviour, and the bug fixes of `main` are
  merged into v3 ([v3](/ops/v3.md)); a rewrite would end that merge.
* **[E]** The server is a Celeron J4104 without AVX (#449).
* `src/core` is shared by the server and the browser (164 files of the
  client import it, measured 2026-11-28).

# Rust for the backend

* **[M]** The measured cost of the server is algorithmic, not the language:
  three quarters of the state in the points and highscore (solved by #405),
  half of the rest in the daily reward (#479), and no statement cache
  (#480). Rust would speed up computation by a constant factor; it does not
  remove work done on every call. better-sqlite3 is already the C library.
* **[R]** About 39,000 lines of `src/server` and `src/core`, 132,000 lines
  of tests; Stryker, its floors and the reference tests are TypeScript only.
  Two languages would need a second `core` or a WebAssembly bridge.
* **[U]** A static Rust binary would make a much smaller image; that is the
  one clear gain.

## rust-anything

* **[R]** It does not translate code: it records what the functions of the
  original return, throw and print, an AI agent writes the port, and a gate
  compares. Its README says nothing about databases, side effects, time,
  randomness or background jobs, which the server consists of (randomness
  in `battle.ts`, `espionage.ts`, `expedition.ts`, `loot.ts`, `moon.ts`).
  Its version, release date and maturity were not found; it offers paid
  migration consulting.

# WebAssembly for the frontend

* **[R]** WebAssembly does not render; the browser draws the DOM, the GPU
  draws through WebGL/WebGPU. WebAssembly reaches the DOM only through
  JavaScript. Svelte 5 already updates the DOM directly.
* **[E]** The known cost of rendering is the views mounted anew on every
  poll; its fix is decided (#410, [Data exchange and realtime](/architecture/realtime.md)).
* **[R]** 3D needs WebGL/WebGPU, usable from TypeScript; a canvas is not seen
  by screen readers, so the controls stay in the DOM. Planets are layered
  CSS pictures by decision (D7, [Interface](/features/interface.md)).
* **[R]** The data exchange is network and JSON; `JSON.parse` is native in
  the browser; the state of a player is 4.7 KB with gzip.

# Bun instead of Node

* **[R]** Node already runs TypeScript directly (`node src/server/main.ts`).
* **[U]** Bun's standard x64 build needs AVX2; its baseline build was
  reported to crash with „Illegal instruction“ on CPUs without AVX (Bun
  1.3.6, WebKit built for Haswell); whether the fix is released was not
  found.
* **[U]** better-sqlite3 on Bun: mixed reports; `bun:sqlite` would replace an
  [E] decision.
* Vitest and Stryker run on Node; production on Bun would test another
  runtime than the one that runs.
* Bun belongs to Anthropic since December 2025 (the assistant's maker);
  noted as a conflict of interest of the evaluation.
