---
type: process
title: Release loop
description: How Claude works through a release with /loop - plan with the owner, clarify, build, make the release pull request ready, keep it ready until the owner merges it, stop.
---

# Release loop

The owner runs `/loop` in Claude Code without a prompt; Claude Code then
reads `.claude/loop.md` (project file, plain Markdown, at most 25,000 bytes,
edits apply from the next iteration). Without an interval Claude chooses the
pause itself, between one minute and one hour, and ends the loop with
`ScheduleWakeup` and `stop`. A loop runs only while the session runs and
ends after seven days at the latest (Claude Code documentation on scheduled
tasks).

* **[E]** One step per iteration, chosen from the state on GitHub in this
  order: finish the own open pull request, make the release ready (all
  issues of the milestone closed), plan the release (no open milestone),
  clarify the next issue, build it (owner, 2026-11-12). Releasing needs an
  open milestone, so a closed one never triggers it again.
* **[V]** Questions to the owner are asked with the question tool inside the
  iteration; the iteration waits for the answer and continues with it. An
  issue counts as clarified when it has a comment that starts with
  `Geklärt` and lists the decisions with the OKF link.
* **[E]** The loop asks the owner first what a release should bring, with
  proposals from the open issues; **infrastructure first**, features after
  it (owner, 2026-11-12). The chosen issues form the milestone
  `next release`.
* **[E]** When every issue of the milestone is closed and the release pull
  request is green with its candidate image, the loop tells the owner. The
  owner merges the release pull request; that is the release (owner,
  2026-11-12, [Branching and release](/ops/branching-release.md)). The loop
  **stops** once the owner has merged it, not when it has told the owner
  (owner, 2026-11-13, #149; replaces „tells the owner and stops“).
* **[E]** The release pull request of `main` is a draft with the cheap run
  after every rebuild; its CI Gate is red on purpose (owner, 2026-11-13 and
  2026-11-14, #147, [Branching and release](/ops/branching-release.md)).
  In the step „Make the release ready“ the loop checks the single cheap
  jobs and the texts, then marks it „Ready for review“: that starts the
  full run (`release-ready.yml`). It waits for the green CI Gate of that
  run and for the candidate image, then tells the owner. A rebuild during
  the wait (a push to `main`) sets it back to draft: the loop marks it
  ready again.
* **[E]** No merge freeze (owner, 2026-11-13, #149): every merge into
  `main` while the release pull request is open, not only a security
  merge, rebuilds it and sets it back to draft, and its last full run no
  longer counts. The loop keeps running after „Make the release ready“
  until the owner has merged the release pull request; after each rebuild
  it makes the release ready again (texts and cheap jobs, „Ready for
  review“, the green full run and the candidate image) and then tells the
  owner again. That message is the only notice besides the draft state:
  no comment on the release pull request and no issue.
* **[V]** The milestone `next release` stays open until the release pull
  request is merged, so the step „Make the release ready“ keeps applying
  while the loop waits and „Plan the release“ does not start the next
  cycle before the release is out; a restarted `/loop` finds the same
  state on GitHub. The loop sees the merge as a pull request from
  `release/main` merged after the last issue of the milestone was closed
  (after that merge `release-pr.sh` opens no new one, `tag.yml` takes
  over), then closes the milestone and stops. While the release pull
  request stays ready and green, the loop only waits and does not repeat
  its message (#149; before, the milestone was closed when the owner was
  told).
* **[E]** While a released hotfix is not merged back, „Ready for review“
  is refused: „Release ready“ sets the pull request back to draft and
  comments why (owner, 2026-11-14, #147); the loop does not mark it ready
  then.
* **[V]** The loop does not mark it ready while the last run of „Release
  pull request“ failed (a version held by another release branch): before
  #147 the workflow kept it a draft, now only the draft that every rebuild
  has shows it.
* **[E]** The release pull request, `CHANGELOG.md` and `VERSION` come only
  from `scripts/release-pr.sh`: the changelog section from the fragments,
  the version from the tags, the list of pull requests from the Git
  history (squash commits ending in `(#N)`). The loop never writes them
  by hand; it refreshes them by running the workflow (owner, 2026-11-12).
* **[E]** The rules of the project stay as they are: ask instead of
  assuming, 3 to 5 options per decision, merges under O4, never a merge of a
  release pull request.
* **[E]** Up to two own pull requests may be open at a time; subagents build
  issues that don't depend on each other in their own git worktrees, Claude
  reviews each diff and opens, finishes and merges the pull requests itself
  (owner, 2026-11-12; replaces „one own pull request at a time“).
* **[E]** A red security pull request of Renovate (from GitHub's Dependabot
  alerts, `[SECURITY]` at the end of its title) is handled like an own pull
  request in the first step (owner, 2026-11-13, #148; patch, pin and
  digest security updates merge themselves, minor ones from version 1.0
  on; a major one and a minor one below 1.0 wait for the owner, see
  [Branching and release](/ops/branching-release.md)): the loop finds the
  root cause and fixes it in its own `claude/…` pull request, never by a
  push to the Renovate branch; if it cannot, it asks the owner. That fix
  pull request does not count toward the limit of two open own pull
  requests (security first).
* **[E]** Local Stryker runs before a push only for changed logic files whose
  score is less than about 2 points above their floor in
  `mutation-standard.json` (for example `economy.ts`, `settle.ts`,
  `actions.ts`); data and interface files such as `catalog.ts` or
  `icons.ts` are left to the CI mutation job. A local run does not speed up
  the CI, which keeps its own incremental cache; it only saves a red run
  (owner, 2026-11-12).
* **[E]** Claude bundles pushes: while the CI of a pull request runs, no
  push of documentation or OKF alone (for example confirmed [V] → [E]); such
  changes go with the next code push, or are pushed before the pull request
  is marked ready. Every push cancels the running CI and starts all jobs
  again (owner, 2026-11-12).
* **[V]** Guards from loop engineering practice: a stop condition a machine
  can check (release pull request merged, milestone closed), the state read
  fresh in every iteration, small reviewable steps, tests never weakened,
  and a hand-back to the owner after two failed attempts at one problem.
* **[V]** While the loop waits on CI or a review it wakes every 20 to 30
  minutes; GitHub events of subscribed pull requests wake it earlier.
* **[U]** Milestones are managed through the GitHub tools of the session;
  whether they can set a milestone on an issue is checked in the first
  planning iteration.
