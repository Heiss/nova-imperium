---
type: ops
title: Documentation website
description: The public documentation website on GitHub Pages: Astro Starlight in website/, built from okf/ and docs/, with a generated agents.md for agents.
---

# Documentation website

Owner request of 2026-11-13: publish the OKF bundle and the documentation as
a full documentation website like other open-source projects, with how
things are done, how to contribute, the Git workflow, the checks and how the
automation fits together.

* **[E]** Astro Starlight (owner, 2026-11-13): sidebar from the folders,
  offline search, dark mode; it uses the front matter of the OKF files.
* **[E]** Language English, like code, OKF and pull requests; game terms
  stay German (owner, 2026-11-13).
* **[E]** The whole OKF bundle is published as it is in the repository
  (owner, 2026-11-13). The repository holds no secrets.
* **[E]** Published on GitHub Pages
  (`https://heiss.github.io/nova-imperium/`) after every push to `main`; the
  site is built in every pull request that changes it, with a link check,
  and published only after the merge (owner, 2026-11-13).
* **[E]** Sections (owner, 2026-11-13):
  1. Getting started (play, run locally)
  2. Contributing (issues, clarification, changelog fragments, labels, code
     style)
  3. Git workflow (branches, the pull request flow, squash merges, the
     release pull request, hotfixes, Renovate; with diagrams)
  4. CI and checks (every job, the CI Gate, mutation tests and shards,
     Trivy, gitleaks, CodeQL, CodeRabbit)
  5. Automation (how the workflows work together: release pull request,
     tag, release, candidate images, nightly run, security hotfix)
  6. Operations
  7. Decisions (the OKF bundle)
* **[E]** The site lives in `website/` with its own `package.json` and
  lockfile, outside the game build; `okf/` and `docs/` stay the only source
  and are read at build time (owner, 2026-11-13). No workspace packages.
* **[E]** `agents.md` for agents (owner, 2026-11-13): generated at build
  time from the title and description of every page, served raw (not
  rendered) at `/nova-imperium/agents.md`, a sitemap with a short
  description of where what is; every page is also served as raw Markdown
  and linked from it; `llms.txt` points to `agents.md`.
* **[E]** The repository „About“ (owner, 2026-11-13): „A classic space
  strategy browser game for a group of friends – Node.js, SQLite, Svelte,
  self-hosted with Docker.“, homepage the site, topics browser-game,
  strategy-game, space, nodejs, typescript, sqlite, svelte, self-hosted.
  The session cannot write repository settings; the owner sets it.
